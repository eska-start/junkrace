import { useCallback, useEffect, useRef, useState } from 'react';
import { CHARACTERS } from '../data/items';
import { useGame, MODE_LABEL, TEAM_COLORS, type GameMode } from '../store';
import { sfx } from '../game/audio';
import { CharacterFace } from './CharacterFace';
import { GameIcon } from './GameIcon';
import { getActiveRoom, PeerRoom, setActiveRoom, MAX_PLAYERS, roomFromUrl as networkRoomFromUrl } from '../game/net';

export interface RoomPlayer {
  id: string;
  name: string;
  characterId: string;
  color: string;
  team: number;
  ready: boolean;
  isHost: boolean;
}
export interface RoomMessage {
  id: number;
  name: string;
  text: string;
  playerId: string | null;
  system: boolean;
}
export interface RoomData {
  code: string;
  hostId: string;
  status: string;
  mode: GameMode;
  round: number;
  maxPlayers: number;
  players: RoomPlayer[];
  messages: RoomMessage[];
}

const NAME_KEY = 'jr-player-name';

export function loadSession() {
  const room = getActiveRoom();
  if (!room || room.status !== 'open' || !room.myId) return null;
  return { code: room.state.code, playerId: room.myId, seenRound: room.state.round };
}

export function roomFromUrl() {
  return networkRoomFromUrl();
}

function snapshot(room: PeerRoom): RoomData {
  const hostId = room.state.members.find((m) => m.host)?.id ?? '';
  return {
    code: room.state.code,
    hostId,
    status: room.state.inGame ? 'playing' : 'waiting',
    mode: room.state.mode,
    round: room.state.round,
    maxPlayers: room.capacity,
    players: room.state.members.map((m) => ({
      id: m.id,
      name: m.name,
      characterId: m.characterId,
      color: m.color,
      team: m.team,
      ready: m.ready,
      isHost: m.host,
    })),
    messages: room.state.chat.map((c) => ({
      id: c.id,
      name: c.name,
      text: c.text,
      playerId: c.sys ? null : (room.state.members.find((m) => m.name === c.name)?.id ?? null),
      system: Boolean(c.sys),
    })),
  };
}

/** PeerJS 연결 자체가 방 연결을 유지하므로 HTTP heartbeat는 필요하지 않습니다. */
export function useOnlineHeartbeat() {
  useEffect(() => undefined, []);
}

export function CopyButton({ value, label, icon }: { value: string; label: string; icon: 'copy' | 'link' }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    sfx.click();
    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
      } else {
        const area = document.createElement('textarea');
        area.value = value;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        document.body.removeChild(area);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button type="button" className="jr-copy-button" onClick={copy}>
      <GameIcon name={copied ? 'check' : icon} size={15} />
      {copied ? '복사됨!' : label}
    </button>
  );
}

function ShareInviteButton({ code, link }: { code: string; link: string }) {
  const [sent, setSent] = useState(false);

  const share = async () => {
    sfx.click();
    try {
      if (navigator.share) {
        await navigator.share({
          title: '고물 레이서즈 초대',
          text: `같이 해요! 방 코드: ${code}`,
          url: link,
        });
      } else {
        await navigator.clipboard?.writeText(link);
      }
      setSent(true);
      window.setTimeout(() => setSent(false), 1400);
    } catch {
      // 공유 취소
    }
  };

  return (
    <button type="button" className={`jr-copy-button ${sent ? 'done' : ''}`} onClick={share}>
      <GameIcon name={sent ? 'check' : 'people'} size={15} />
      {sent ? '초대 준비됨!' : '친구 초대'}
    </button>
  );
}

export function OnlineLobby({ onStarted }: { onStarted: () => void }) {
  const characterId = useGame((s) => s.characterId);
  const paintColor = useGame((s) => s.paintColor);
  const defaultMode = useGame((s) => s.gameMode);

  const [mode, setMode] = useState<GameMode>(defaultMode);
  const [inviteCode] = useState(roomFromUrl);
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem(NAME_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const [joinCode, setJoinCode] = useState(inviteCode ?? '');
  const [peerRoom, setPeerRoom] = useState<PeerRoom | null>(() => {
    const room = getActiveRoom();
    return room && room.status !== 'closed' ? room : null;
  });
  const [, setVersion] = useState(0);
  const [chat, setChat] = useState('');
  const enteredRound = useRef<number | null>(null);
  const chatRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!peerRoom) return undefined;
    const off = peerRoom.subscribe(() => setVersion((v) => v + 1));
    setVersion((v) => v + 1);
    return () => { off(); };
  }, [peerRoom]);

  const room = peerRoom ? snapshot(peerRoom) : null;
  const myId = peerRoom?.myId ?? '';

  const rememberName = (next: string) => {
    try {
      localStorage.setItem(NAME_KEY, next);
    } catch {
      // optional
    }
  };

  const enterGame = useCallback((data: RoomData, roomInstance: PeerRoom) => {
    if (!data.round || enteredRound.current === data.round) return;
    if (useGame.getState().phase !== 'select') return;

    enteredRound.current = data.round;
    const game = useGame.getState();
    const me = data.players.find((p) => p.id === roomInstance.myId);

    if (me) {
      game.setCharacter(me.characterId);
      game.setPaintColor(me.color);
    }

    game.setOnline({
      code: data.code,
      playerId: roomInstance.myId,
      players: data.players.map((p) => ({
        id: p.id,
        name: p.name,
        characterId: p.characterId,
        color: p.color,
        team: p.team,
      })),
    });
    game.setGameMode(data.mode);
    game.setLocalPlayers([], data.code);
    game.startCollect();
    onStarted();
  }, [onStarted]);

  useEffect(() => {
    if (!peerRoom || peerRoom.status !== 'open') return;
    if (peerRoom.state.inGame) enterGame(snapshot(peerRoom), peerRoom);
  }, [peerRoom, room?.round, room?.status, enterGame]);

  // 얼음땡과 같은 방식: 초대 링크를 열면 코드 입력 없이 바로 참가
  useEffect(() => {
    if (!inviteCode) return;
    if (peerRoom?.state.code === inviteCode) return;

    peerRoom?.leave();
    const next = PeerRoom.join(inviteCode, name.trim() || '레이서', characterId);
    setActiveRoom(next);
    setPeerRoom(next);
    // 초대 링크는 최초 진입 때 한 번만 처리
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteCode]);

  useEffect(() => {
    if (room?.messages.length) chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight });
  }, [room?.messages.length]);

  const create = () => {
    const n = name.trim() || `레이서${Math.floor(Math.random() * 900 + 100)}`;
    rememberName(n);
    setName(n);
    sfx.click();

    peerRoom?.leave();
    const next = PeerRoom.host(n, characterId, paintColor, mode);
    setActiveRoom(next);
    setPeerRoom(next);
  };

  const join = useCallback((codeArg?: string) => {
    const code = (codeArg ?? joinCode).trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    if (code.length !== 5) return;

    const n = name.trim() || `레이서${Math.floor(Math.random() * 900 + 100)}`;
    rememberName(n);
    setName(n);
    sfx.click();

    peerRoom?.leave();
    const next = PeerRoom.join(code, n, characterId);
    setActiveRoom(next);
    setPeerRoom(next);
  }, [joinCode, name, characterId, peerRoom]);

  const leave = () => {
    sfx.click();
    peerRoom?.leave();
    setActiveRoom(null);
    setPeerRoom(null);
    useGame.getState().setOnline(null);
    useGame.getState().setLocalPlayers([]);

    const url = new URL(location.href);
    url.searchParams.delete('invite');
    url.searchParams.delete('room');
    history.replaceState(null, '', `${url.pathname}${url.search}`);
  };

  if (peerRoom && peerRoom.status === 'connecting') {
    return (
      <div className="jr-invite-joining">
        <span className="jr-invite-icon"><GameIcon name="people" size={25} /></span>
        <span className="jr-eyebrow">{peerRoom.state.code}</span>
        <h3>{peerRoom.error ? '연결에 실패했어요' : '방에 연결하는 중…'}</h3>
        <p>{peerRoom.error || '얼음땡처럼 다른 기기끼리 직접 연결하고 있습니다.'}</p>
      </div>
    );
  }

  if (peerRoom && peerRoom.status === 'error') {
    return (
      <div className="jr-invite-joining">
        <span className="jr-invite-icon"><GameIcon name="link" size={25} /></span>
        <h3>방에 들어가지 못했어요</h3>
        <p>{peerRoom.error || '연결 오류가 발생했어요.'}</p>
        <div className="jr-lobby-actions">
          <button className="jr-lobby-btn ghost" onClick={() => { peerRoom.leave(); setPeerRoom(null); }}>다시 입력</button>
          <button className="jr-lobby-btn" onClick={() => {
            peerRoom.leave();
            const next = PeerRoom.join(peerRoom.state.code, name || '레이서', characterId);
            setActiveRoom(next);
            setPeerRoom(next);
          }}>다시 참가</button>
        </div>
      </div>
    );
  }

  // ── 얼음땡과 같은 입장 화면: 코드 참가 | 또는 | 방 만들기 ──
  if (!peerRoom || peerRoom.status !== 'open' || !room) {
    const valid = joinCode.length === 5;

    return (
      <div>
        <div className="jr-lobby-field">
          <label htmlFor="jr-name-entry">내 닉네임</label>
          <input
            id="jr-name-entry"
            value={name}
            maxLength={12}
            placeholder="닉네임 (최대 12자)"
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
          <section className="rounded-3xl bg-white p-4 border border-[#26473518] shadow-[0_10px_30px_-12px_rgba(30,80,60,.35)]">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-9 h-9 rounded-xl bg-[#e8f4ff] text-[#4489c8] grid place-items-center">
                <GameIcon name="link" size={18} />
              </span>
              <div className="font-game text-lg">코드로 참가</div>
            </div>
            <p className="text-xs text-slate-400 mb-3">친구에게 받은 5자리 방 코드를 입력하세요.</p>

            <div className="jr-code-input-wrap">
              <div
                className="grid grid-cols-5 gap-1.5"
                role="button"
                tabIndex={-1}
                onClick={() => document.getElementById('jr-join-code')?.focus()}
                aria-label="방 코드 입력"
              >
                {Array.from({ length: 5 }, (_, i) => (
                  <div
                    key={i}
                    className={`h-14 rounded-2xl grid place-items-center text-2xl font-extrabold tracking-widest ${joinCode[i] ? 'bg-slate-900 text-white' : i === joinCode.length ? 'bg-[#eef8ff] ring-2 ring-[#50a8e8] text-slate-300' : 'bg-slate-100 text-slate-300'}`}
                  >
                    {joinCode[i] ?? ''}
                  </div>
                ))}
              </div>

              <input
                id="jr-join-code"
                value={joinCode}
                maxLength={5}
                aria-label="방 코드"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                inputMode="text"
                className="jr-code-input-hitarea"
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5))}
                onKeyDown={(e) => { if (e.key === 'Enter' && valid) join(); }}
              />
            </div>

            <button
              disabled={!valid}
              onClick={() => join()}
              className={`mt-3 w-full h-12 rounded-2xl font-game text-lg ${valid ? 'bg-gradient-to-r from-[#51b5f0] to-[#4d7ff0] text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}
            >
              참가하기
            </button>
          </section>

          <section className="rounded-3xl bg-white p-4 border border-[#26473518] shadow-[0_10px_30px_-12px_rgba(30,80,60,.35)]">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-9 h-9 rounded-xl bg-[#fff0df] text-[#e58c49] grid place-items-center">
                <GameIcon name="people" size={18} />
              </span>
              <div className="font-game text-lg">방 만들기</div>
            </div>
            <div className="text-xs text-slate-400 mb-2">내가 호스트가 되어 친구에게 5자리 코드를 보내세요.</div>

            <div className="grid grid-cols-2 gap-2">
              {(['ffa', 'team'] as GameMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => { sfx.click(); setMode(m); }}
                  className={`rounded-2xl p-3 text-left transition ${mode === m ? 'bg-slate-900 text-white shadow' : 'bg-slate-50 text-slate-600'}`}
                >
                  <div className="font-game">{MODE_LABEL[m]}</div>
                  <div className={`text-[10px] mt-0.5 ${mode === m ? 'text-white/60' : 'text-slate-400'}`}>
                    {m === 'ffa' ? 'FREE FOR ALL' : '2 VS 2 TEAM'}
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={create}
              className="mt-3 w-full h-12 rounded-2xl bg-gradient-to-r from-[#f4a78e] to-[#f6c16b] text-[#293c32] font-game text-lg shadow-lg"
            >
              방 만들기<GameIcon name="arrow" size={17} />
            </button>
          </section>
        </div>

        <div className="rounded-2xl bg-[#26473508] px-3 py-2 mt-3 text-[11px] text-slate-400 text-center">
          얼음땡처럼 다른 기기끼리 직접 연결됩니다. 최대 {MAX_PLAYERS}명까지 함께할 수 있어요.
        </div>
        <p className="jr-footnote text-center">초대 링크를 받은 경우 코드를 입력하지 않아도 바로 참가합니다.</p>
      </div>
    );
  }

  const me = room.players.find((p) => p.id === myId);
  const isHost = me?.isHost ?? false;
  const guests = room.players.filter((p) => !p.isHost);
  const playing = room.status === 'playing';
  const link = `${location.origin}${location.pathname}?invite=${room.code}`;

  const act = (action: string, value?: unknown) => {
    switch (action) {
      case 'ready':
        peerRoom.setReady(Boolean(value));
        break;
      case 'mode':
        peerRoom.setOptions(value === 'team' ? 'team' : 'ffa');
        break;
      case 'start':
        peerRoom.start();
        break;
      case 'kick':
        if (typeof value === 'string') peerRoom.kick(value);
        break;
      case 'chat':
        if (typeof value === 'string') peerRoom.chat(value);
        break;
      case 'profile':
        if (value && typeof value === 'object') {
          const v = value as { name?: string; characterId?: string };
          peerRoom.updateProfile(v.name ?? name, v.characterId ?? characterId);
        }
        break;
      case 'return':
        peerRoom.returnToLobby();
        break;
    }
  };

  return (
    <div>
      <section className="rounded-3xl p-4 text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg,#1e293b 0%,#1e3a8a 100%)' }}>
        <div className="absolute -right-8 -top-10 w-40 h-40 rounded-full bg-sky-400/20 blur-xl" />
        <div className="relative flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold text-white/60 tracking-[.22em]">ROOM CODE</div>
            <div className="text-[34px] font-extrabold tracking-[.25em] leading-tight">{room.code}</div>
          </div>
          <div className="flex gap-2">
            <CopyButton value={room.code} label="코드 복사" icon="copy" />
            <ShareInviteButton code={room.code} link={link} />
          </div>
        </div>
        <button
          onClick={() => void navigator.clipboard?.writeText(link)}
          className="relative mt-2 flex items-center gap-1.5 text-[10px] text-white/60 truncate max-w-full"
        >
          <GameIcon name="link" size={12} />
          <span className="truncate">{link}</span>
        </button>
      </section>

      <section className="rounded-3xl bg-white p-3 shadow-sm mt-3">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="font-game">게임 설정</span>
          {!isHost && <span className="text-[10px] text-slate-400">방장만 변경할 수 있어요</span>}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(['ffa', 'team'] as GameMode[]).map((m) => (
            <button
              key={m}
              disabled={!isHost || playing}
              onClick={() => { sfx.click(); act('mode', m); }}
              className={`rounded-2xl p-2.5 text-left ${room.mode === m ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-500'}`}
            >
              <div className="font-game">{MODE_LABEL[m]}</div>
              <div className={`text-[10px] ${room.mode === m ? 'text-white/60' : 'text-slate-400'}`}>
                {m === 'ffa' ? 'FREE FOR ALL' : '2 VS 2 TEAM'}
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-3">
        <div className="flex items-center justify-between px-1 mb-2">
          <span className="font-game">플레이어</span>
          <span className="text-[10px] text-slate-400">{room.players.length} / {room.maxPlayers}</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: room.maxPlayers }, (_, i) => {
            const p = room.players[i];
            if (!p) {
              return (
                <div key={i} className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 h-[84px] flex flex-col items-center justify-center text-[11px] text-slate-400">
                  빈 자리 · AI
                </div>
              );
            }

            const ch = CHARACTERS.find((c) => c.id === p.characterId) ?? CHARACTERS[0];

            return (
              <div
                key={p.id}
                className={`relative rounded-2xl bg-white h-[84px] flex items-center gap-2 px-3 ${p.id === myId ? 'ring-2 ring-[#50ccb6]' : ''}`}
              >
                <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full" style={{ background: room.mode === 'team' ? TEAM_COLORS[p.team] : p.color }} />
                <CharacterFace species={ch.species} size={38} />
                <div className="min-w-0 flex-1">
                  <strong className="block text-[12px] truncate">{p.name}{p.id === myId ? ' (나)' : ''}</strong>
                  <small className="block text-[10px] text-slate-400">{ch.name}</small>
                  <span className={`inline-flex mt-1 text-[9px] font-extrabold px-2 py-0.5 rounded-full ${p.isHost ? 'bg-amber-100 text-amber-700' : p.ready ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                    {p.isHost ? '방장' : p.ready ? '준비 완료' : '대기 중'}
                  </span>
                </div>
                {isHost && !p.isHost && (
                  <button className="absolute left-2 bottom-2 text-[9px] text-slate-400 hover:text-red-500" onClick={() => act('kick', p.id)}>내보내기</button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="jr-lobby-chat mt-3">
        <ul ref={chatRef}>
          {room.messages.map((m) => (
            <li key={m.id} className={m.system ? 'sys' : ''}>
              {m.system ? `· ${m.text}` : <><b>{m.name}</b>{m.text}</>}
            </li>
          ))}
        </ul>
        <form onSubmit={(e) => {
          e.preventDefault();
          if (chat.trim()) {
            act('chat', chat);
            setChat('');
          }
        }}>
          <input value={chat} maxLength={40} placeholder="메시지 보내기" onChange={(e) => setChat(e.target.value)} />
          <button type="submit">전송</button>
        </form>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-end mt-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="jr-lobby-field mb-0">
            <label>내 닉네임</label>
            <input
              value={me?.name ?? name}
              maxLength={12}
              placeholder="닉네임을 입력하세요"
              onChange={(e) => {
                const nextName = e.target.value.slice(0, 12);
                setName(nextName);
                act('profile', { name: nextName, characterId: me?.characterId ?? characterId });
              }}
              onBlur={() => rememberName(name)}
            />
          </div>

          <div className="jr-lobby-field mb-0">
            <label>내 캐릭터</label>
            <select
              value={me?.characterId ?? characterId}
              onChange={(e) => {
                useGame.getState().setCharacter(e.target.value);
                act('profile', { name: me?.name ?? name, characterId: e.target.value });
              }}
            >
              {CHARACTERS.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.tagline}</option>)}
            </select>
          </div>
        </div>

        <div className="flex gap-2">
          {!isHost && (
            <button
              className={`jr-lobby-btn min-w-[150px] ${me?.ready ? '' : 'ready'}`}
              onClick={() => { sfx.click(); act('ready', !me?.ready); }}
            >
              {me?.ready ? '준비 취소' : '준비 완료'}
            </button>
          )}

          {isHost && !playing && (
            <button
              className="jr-primary min-w-[180px]"
              disabled={!peerRoom.allReady}
              onClick={() => { sfx.click(); act('start'); }}
            >
              {peerRoom.allReady ? (guests.length ? '게임 시작' : '혼자 시작 (AI와 대결)') : '친구가 준비할 때까지 대기'}
              <GameIcon name="arrow" size={17} />
            </button>
          )}

          {isHost && playing && (
            <button className="jr-primary min-w-[180px]" onClick={() => { sfx.click(); act('return'); }}>
              대기실로 돌아가기<GameIcon name="arrow" size={17} />
            </button>
          )}
        </div>
      </section>

      <div className="jr-lobby-actions" style={{ marginTop: 10 }}>
        <button className="jr-lobby-btn ghost" onClick={leave}>방 나가기</button>
      </div>
    </div>
  );
}
