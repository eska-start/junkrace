import Peer, { type DataConnection } from 'peerjs';
import type { CarBuild } from '../store';

export interface NetCarState {
  x: number; y: number; z: number; heading: number; speed: number; steer: number;
  shield: number; firing: boolean; phase: string;
  build?: CarBuild; items?: Record<number, string>;
  t: number;
}

export interface RoomMember {
  id: string;
  name: string;
  characterId: string;
  color: string;
  team: number;
  ready: boolean;
  host: boolean;
}

export interface ChatLine {
  id: number;
  name: string;
  text: string;
  sys?: boolean;
}

export interface LobbyState {
  code: string;
  mode: 'ffa' | 'team';
  round: number;
  members: RoomMember[];
  chat: ChatLine[];
  inGame: boolean;
}

export type NetMsg = { t: string; [k: string]: unknown };

const PREFIX = 'junk-racers-room-v1-';
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const COLORS = ['#f56a87', '#50ccb6', '#699cfa', '#ffc16b'];
export const CODE_LEN = 5;
export const MAX_PLAYERS = 4;

export const genCode = () =>
  Array.from({ length: CODE_LEN }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');

export const net = {
  remote: new Map<string, NetCarState>(),
  running: false,
};

let activeRoom: PeerRoom | null = null;
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let generation = 0;

export function getActiveRoom() {
  return activeRoom;
}

export function setActiveRoom(room: PeerRoom | null) {
  activeRoom = room;
  if (!room) net.remote.clear();
}

function safeName(name: string) {
  return name.trim().slice(0, 12) || '레이서';
}

function editableName(name: string) {
  return name.trim().slice(0, 12);
}

function nextColor(members: RoomMember[]) {
  return COLORS.find((c) => !members.some((m) => m.color === c)) ?? COLORS[members.length % COLORS.length];
}

export class PeerRoom {
  role: 'host' | 'guest';
  peer: Peer | null = null;
  conns = new Map<string, DataConnection>();
  fastConns = new Map<string, DataConnection>();
  hostConn: DataConnection | null = null;
  fastConn: DataConnection | null = null;
  myId = '';
  status: 'connecting' | 'open' | 'error' | 'closed' = 'connecting';
  error = '';
  state: LobbyState;
  private listeners = new Set<() => void>();
  private chatId = 0;
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private myName: string;
  private myCharacter: string;
  private myColor: string;

  private constructor(
    role: 'host' | 'guest',
    state: LobbyState,
    name: string,
    characterId: string,
    color: string,
  ) {
    this.role = role;
    this.state = state;
    this.myName = safeName(name);
    this.myCharacter = characterId;
    this.myColor = color;
  }

  static host(name: string, characterId: string, color: string, mode: 'ffa' | 'team') {
    const r = new PeerRoom(
      'host',
      { code: genCode(), mode, round: 0, members: [], chat: [], inGame: false },
      name,
      characterId,
      color,
    );
    r.openHost(0);
    return r;
  }

  static join(code: string, name: string, characterId: string) {
    const r = new PeerRoom(
      'guest',
      {
        code: code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LEN),
        mode: 'ffa',
        round: 0,
        members: [],
        chat: [],
        inGame: false,
      },
      name,
      characterId,
      '',
    );
    r.openGuest();
    return r;
  }

  private armTimeout(message: string) {
    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = setTimeout(() => {
      if (this.status === 'connecting') this.fail(message);
    }, 14000);
  }

  private clearRoomTimeout() {
    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = null;
  }

  private fail(message: string) {
    this.clearRoomTimeout();
    this.status = 'error';
    this.error = message;
    this.emit();
  }

  private emit() {
    this.listeners.forEach((listener) => listener());
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get capacity() {
    return MAX_PLAYERS;
  }

  get isHost() {
    return this.role === 'host';
  }

  get me() {
    return this.state.members.find((member) => member.id === this.myId);
  }

  get allReady() {
    return this.state.members.every((member) => member.host || member.ready);
  }

  private openHost(attempt: number) {
    const peer = new Peer(PREFIX + this.state.code, { debug: 0 });
    this.peer = peer;
    this.status = 'connecting';
    this.error = '';
    this.armTimeout('방을 만들지 못했어요. 네트워크를 확인해 주세요.');

    peer.on('open', (id) => {
      this.clearRoomTimeout();
      this.myId = id;
      this.status = 'open';
      this.state.members = [{
        id,
        name: this.myName,
        characterId: this.myCharacter,
        color: this.myColor,
        team: 0,
        ready: true,
        host: true,
      }];
      this.sys(`${this.myName}님이 방을 만들었어요`);
      this.emit();
    });

    peer.on('connection', (conn) => {
      if ((conn.metadata as { fast?: boolean } | undefined)?.fast) this.acceptFast(conn);
      else this.acceptGuest(conn);
    });

    peer.on('error', (err: { type?: string }) => {
      if (err.type === 'unavailable-id' && attempt < 4) {
        peer.destroy();
        this.state.code = genCode();
        this.openHost(attempt + 1);
        return;
      }
      this.fail(
        err.type === 'network' || err.type === 'server-error'
          ? '연결 서버에 접속하지 못했어요.'
          : '방 연결 중 오류가 발생했어요.',
      );
    });

    peer.on('disconnected', () => {
      if (this.status === 'open') peer.reconnect();
    });
  }

  private acceptFast(conn: DataConnection) {
    this.fastConns.set(conn.peer, conn);
    conn.on('data', (raw) => this.receiveGame(raw as NetMsg));
    const drop = () => {
      if (this.fastConns.get(conn.peer) === conn) this.fastConns.delete(conn.peer);
    };
    conn.on('close', drop);
    conn.on('error', drop);
  }

  private acceptGuest(conn: DataConnection) {
    conn.on('data', (raw) => {
      const msg = raw as NetMsg;

      if (msg.t === 'hello') {
        if (this.state.inGame) {
          conn.send({ t: 'deny', reason: '게임이 이미 시작된 방이에요.' });
          setTimeout(() => conn.close(), 250);
          return;
        }

        if (this.state.members.length >= this.capacity) {
          conn.send({ t: 'deny', reason: `방이 가득 찼어요. (최대 ${this.capacity}명)` });
          setTimeout(() => conn.close(), 250);
          return;
        }

        this.conns.set(conn.peer, conn);

        const member: RoomMember = {
          id: conn.peer,
          name: safeName(String(msg.name ?? '레이서')),
          characterId: typeof msg.characterId === 'string' ? msg.characterId : 'dog',
          color: nextColor(this.state.members),
          team: this.nextTeam(),
          ready: false,
          host: false,
        };

        this.state.members.push(member);
        this.sys(`${member.name}님이 들어왔어요`);
        conn.send({ t: 'lobby', state: this.state });
        this.broadcastLobby();
        return;
      }

      this.handleGuest(conn.peer, msg);
    });

    const drop = () => {
      if (!this.conns.has(conn.peer)) return;
      this.conns.delete(conn.peer);
      this.fastConns.delete(conn.peer);

      const member = this.state.members.find((m) => m.id === conn.peer);
      this.state.members = this.state.members.filter((m) => m.id !== conn.peer);
      net.remote.delete(conn.peer);

      if (member) this.sys(`${member.name}님이 나갔어요`);
      this.broadcastLobby();
    };

    conn.on('close', drop);
    conn.on('error', drop);
  }

  private nextTeam() {
    const a = this.state.members.filter((m) => m.team === 0).length;
    const b = this.state.members.filter((m) => m.team === 1).length;
    return a <= b ? 0 : 1;
  }

  private openGuest() {
    const peer = new Peer({ debug: 0 });
    this.peer = peer;
    this.status = 'connecting';
    this.error = '';
    this.armTimeout('방에 연결하지 못했어요. 코드를 확인해 주세요.');

    peer.on('open', (id) => {
      this.myId = id;

      const conn = peer.connect(PREFIX + this.state.code, {
        reliable: true,
        serialization: 'json',
      });
      this.hostConn = conn;

      conn.on('open', () => {
        this.clearRoomTimeout();
        conn.send({
          t: 'hello',
          name: this.myName,
          characterId: this.myCharacter,
        });

        const fast = peer.connect(PREFIX + this.state.code, {
          reliable: false,
          serialization: 'json',
          metadata: { fast: true },
        });

        fast.on('open', () => {
          this.fastConn = fast;
        });
        fast.on('data', (raw) => this.receiveGame(raw as NetMsg));
        fast.on('close', () => {
          if (this.fastConn === fast) this.fastConn = null;
        });
        fast.on('error', () => {
          if (this.fastConn === fast) this.fastConn = null;
        });
      });

      conn.on('data', (raw) => this.handleHost(raw as NetMsg));
      conn.on('close', () => {
        if (this.status !== 'error' && this.status !== 'closed') this.fail('방장이 방을 닫았어요.');
      });
      conn.on('error', () => {
        if (this.status !== 'error' && this.status !== 'closed') this.fail('방 연결이 끊어졌어요.');
      });
    });

    peer.on('error', (err: { type?: string }) => {
      if (err.type === 'peer-unavailable') this.fail('방을 찾을 수 없어요. 코드를 다시 확인해 주세요.');
      else this.fail('연결 오류가 발생했어요.');
    });
  }

  private handleHost(msg: NetMsg) {
    switch (msg.t) {
      case 'lobby':
        this.clearRoomTimeout();
        this.state = msg.state as LobbyState;
        this.status = 'open';
        this.emit();
        break;
      case 'deny':
        this.fail(String(msg.reason ?? '방 참가가 거부되었어요.'));
        break;
      case 'kick':
        this.fail('방장이 내보냈어요.');
        this.closeConnections();
        break;
      default:
        this.receiveGame(msg);
        break;
    }
  }

  private handleGuest(id: string, msg: NetMsg) {
    const member = this.state.members.find((m) => m.id === id);
    if (!member) return;

    switch (msg.t) {
      case 'ready':
        member.ready = Boolean(msg.ready);
        this.broadcastLobby();
        break;
      case 'profile':
        member.name = editableName(String(msg.name ?? member.name));
        if (typeof msg.characterId === 'string') member.characterId = msg.characterId;
        this.broadcastLobby();
        break;
      case 'chat':
        this.pushChat(member.name, String(msg.text ?? '').slice(0, 40));
        this.broadcastLobby();
        break;
      default:
        this.receiveGame(msg);
        break;
    }
  }

  private receiveGame(msg: NetMsg) {
    if (msg.t !== 'state') return;
    const id = typeof msg.playerId === 'string' ? msg.playerId : '';
    const state = msg.state as NetCarState | undefined;
    if (!id || !state || id === this.myId) return;

    net.remote.set(id, {
      ...state,
      t: typeof state.t === 'number' ? state.t : Date.now(),
    });
  }

  private snapshotMessage() {
    this.state.chat = this.state.chat.slice(-40);
    this.chatId = Math.max(this.chatId, ...this.state.chat.map((line) => line.id), 0);
    return { t: 'lobby', state: this.state };
  }

  private broadcastLobby() {
    const msg = this.snapshotMessage();
    this.emit();
    this.conns.forEach((conn) => {
      if (conn.open) conn.send(msg);
    });
  }

  private pushChat(name: string, text: string, sys = false) {
    const clean = text.trim();
    if (!clean) return;

    this.state.chat.push({
      id: ++this.chatId,
      name,
      text: clean,
      sys,
    });
    this.state.chat = this.state.chat.slice(-40);
  }

  private sys(text: string) {
    this.pushChat('', text, true);
  }

  setReady(ready: boolean) {
    if (this.isHost) return;
    if (this.hostConn?.open) this.hostConn.send({ t: 'ready', ready });
  }

  updateProfile(name: string, characterId: string) {
    this.myName = editableName(name);
    this.myCharacter = characterId;

    if (this.isHost) {
      const me = this.me;
      if (me) {
        me.name = this.myName;
        me.characterId = this.myCharacter;
        this.broadcastLobby();
      }
    } else if (this.hostConn?.open) {
      this.hostConn.send({
        t: 'profile',
        name: this.myName,
        characterId: this.myCharacter,
      });
    }
  }

  setOptions(mode: 'ffa' | 'team') {
    if (!this.isHost || this.state.inGame) return;

    this.state.mode = mode;
    this.state.members.forEach((member, index) => {
      member.team = index % 2;
      if (!member.host) member.ready = false;
    });
    this.broadcastLobby();
  }

  start() {
    if (!this.isHost || this.state.inGame || !this.allReady) return false;

    this.state.round += 1;
    this.state.inGame = true;
    this.broadcastLobby();
    return true;
  }

  returnToLobby() {
    if (!this.isHost) return;
    this.state.inGame = false;
    this.state.members.forEach((member) => {
      if (!member.host) member.ready = false;
    });
    this.broadcastLobby();
  }

  kick(id: string) {
    if (!this.isHost) return;

    const conn = this.conns.get(id);
    if (!conn) return;

    if (conn.open) conn.send({ t: 'kick' });
    setTimeout(() => conn.close(), 120);
  }

  chat(text: string) {
    const clean = text.trim().slice(0, 40);
    if (!clean) return;

    if (this.isHost) {
      this.pushChat(this.me?.name ?? '방장', clean);
      this.broadcastLobby();
    } else if (this.hostConn?.open) {
      this.hostConn.send({ t: 'chat', text: clean });
    }
  }

  broadcastFast(msg: NetMsg) {
    this.conns.forEach((conn, id) => {
      const fast = this.fastConns.get(id);
      const channel = fast?.open ? fast : conn;
      if (!channel.open) return;

      const dc = (channel as unknown as { dataChannel?: RTCDataChannel }).dataChannel;
      if (dc && dc.bufferedAmount > 24 * 1024) return;

      channel.send(msg);
    });
  }

  sendFast(msg: NetMsg) {
    const channel = this.fastConn?.open ? this.fastConn : this.hostConn;
    if (!channel?.open) return;

    const dc = (channel as unknown as { dataChannel?: RTCDataChannel }).dataChannel;
    if (dc && dc.bufferedAmount > 16 * 1024 && msg.t === 'state') return;

    channel.send(msg);
  }

  closeConnections() {
    this.conns.forEach((conn) => conn.close());
    this.fastConns.forEach((conn) => conn.close());
    this.hostConn?.close();
    this.fastConn?.close();
  }

  leave() {
    this.clearRoomTimeout();
    this.closeConnections();
    this.peer?.destroy();
    this.status = 'closed';
    this.listeners.clear();

    if (activeRoom === this) activeRoom = null;
    net.remote.clear();
  }
}

export function startNetSync(
  code: string,
  playerId: string,
  getLocal: () => Omit<NetCarState, 't'> | null,
) {
  stopNetSync();

  const room = activeRoom;
  if (!room || room.state.code !== code || room.myId !== playerId) return;

  const gen = ++generation;
  net.running = true;
  let buildSentAt = 0;

  const tick = () => {
    if (gen !== generation || room.status !== 'open') return;

    const local = getLocal();
    if (local) {
      const packet: NetMsg = {
        t: 'state',
        playerId,
        state: {
          ...local,
          t: Date.now(),
        },
      };

      if (room.isHost) room.broadcastFast(packet);
      else room.sendFast(packet);
    }

    if (gen === generation) syncTimer = setTimeout(tick, 120);
  };

  tick();
}

export function stopNetSync() {
  generation++;
  net.running = false;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = null;
  net.remote.clear();
}
export function freshRemote(id: string): NetCarState | null {
  const state = net.remote.get(id);
  if (!state || Date.now() - state.t > 2000 || state.phase !== 'battle') return null;
  return state;
}

export function roomFromUrl(): string | null {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(location.search);
  const q = params.get('invite') ?? params.get('room');
  const h = /(?:invite|room)=([A-Za-z0-9]+)/.exec(location.hash)?.[1];

  return (q ?? h ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LEN) || null;
}
