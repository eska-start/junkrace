import { useEffect, useState } from 'react';
import { GameIcon } from './GameIcon';
import { Modal } from './Modal';
import { sfx } from '../game/audio';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface Window {
    __pwaPrompt?: BeforeInstallPromptEvent | null;
  }
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => {
    if (typeof window !== 'undefined' && window.__pwaPrompt) {
      return window.__pwaPrompt;
    }
    return null;
  });
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if running as installed standalone PWA
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches ||
        window.matchMedia('(display-mode: window-controls-overlay)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      setIsStandalone(isStandaloneMode);
    };

    checkStandalone();
    const media = window.matchMedia('(display-mode: standalone)');
    media.addEventListener?.('change', checkStandalone);

    // Detect iOS
    const ua = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIos(isAppleDevice);

    // If window already captured beforeinstallprompt early
    if (window.__pwaPrompt) {
      setDeferredPrompt(window.__pwaPrompt);
    }

    const handlePromptReady = () => {
      if (window.__pwaPrompt) {
        setDeferredPrompt(window.__pwaPrompt);
      }
    };

    // Listen for Chrome/Edge/Android beforeinstallprompt
    const handleBeforeInstall = (e: Event) => {
      const pwaEvt = e as BeforeInstallPromptEvent;
      pwaEvt.preventDefault();
      window.__pwaPrompt = pwaEvt;
      setDeferredPrompt(pwaEvt);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      window.__pwaPrompt = null;
      setDeferredPrompt(null);
      setIsStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('pwa-prompt-ready', handlePromptReady);
    window.addEventListener('pwa-installed', handleAppInstalled);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      media.removeEventListener?.('change', checkStandalone);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('pwa-prompt-ready', handlePromptReady);
      window.removeEventListener('pwa-installed', handleAppInstalled);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = async (): Promise<boolean> => {
    const prompt = deferredPrompt || (typeof window !== 'undefined' ? window.__pwaPrompt : null);
    if (!prompt) return false;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
        window.__pwaPrompt = null;
        setDeferredPrompt(null);
        return true;
      }
    } catch (err) {
      console.warn('[PWA] Install prompt error:', err);
    }
    return false;
  };

  return {
    isStandalone,
    isInstallable: !!(deferredPrompt || (typeof window !== 'undefined' && window.__pwaPrompt)),
    isIos,
    isInstalled,
    promptInstall,
  };
}

export function IosInstallGuideModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="홈 화면에 앱으로 추가" label="INSTALL PWA" onClose={onClose}>
      <div className="jr-app-preview-badge">
        <img
          src="/icons/icon-192.png"
          alt="고물 레이서즈 아이콘"
          className="jr-app-preview-img"
          width={64}
          height={64}
        />
        <div>
          <strong className="jr-app-preview-title">고물 레이서즈 (Junk Racers)</strong>
          <span className="jr-app-preview-subtitle">브라우저 창 없이 즉시 전체 화면 플레이</span>
        </div>
      </div>

      <p className="jr-muted" style={{ marginBottom: 16 }}>
        Safari 브라우저에서 아래 순서대로 진행하시면 독립 앱으로 설치됩니다.
      </p>

      <div className="jr-ios-steps">
        <div className="jr-ios-step">
          <span className="jr-step-num">1</span>
          <div>
            <strong>공유 버튼 터치</strong>
            <p>Safari 화면 하단(또는 상단)의 공유 아이콘 [↑]을 터치하세요.</p>
          </div>
        </div>
        <div className="jr-ios-step">
          <span className="jr-step-num">2</span>
          <div>
            <strong>&lsquo;홈 화면에 추가&rsquo; 선택</strong>
            <p>공유 메뉴를 아래로 스크롤하여 <strong>[홈 화면에 추가]</strong>를 누르세요.</p>
          </div>
        </div>
        <div className="jr-ios-step">
          <span className="jr-step-num">3</span>
          <div>
            <strong>우측 상단 &lsquo;추가&rsquo; 완료</strong>
            <p>우측 상단의 <strong>[추가]</strong> 버튼을 누르면 홈 화면에 고물 레이서즈 아이콘이 생성됩니다!</p>
          </div>
        </div>
      </div>
      <button className="jr-primary full" style={{ marginTop: 20 }} onClick={onClose}>
        확인했습니다
      </button>
    </Modal>
  );
}

export function DesktopInstallGuideModal({
  onClose,
  canPrompt,
  onPrompt,
}: {
  onClose: () => void;
  canPrompt?: boolean;
  onPrompt?: () => void;
}) {
  return (
    <Modal title="웹앱으로 설치하기" label="INSTALL PWA" onClose={onClose}>
      <div className="jr-app-preview-badge">
        <img
          src="/icons/icon-192.png"
          alt="고물 레이서즈 아이콘"
          className="jr-app-preview-img"
          width={64}
          height={64}
        />
        <div>
          <strong className="jr-app-preview-title">고물 레이서즈 (Junk Racers)</strong>
          <span className="jr-app-preview-subtitle">PC / 모바일 홈 화면에서 독립 창으로 실행</span>
        </div>
      </div>

      <p className="jr-muted" style={{ marginBottom: 16 }}>
        고물 레이서즈를 독립 웹앱(PWA)으로 설치하면 주소창 없이 더 넓고 부드럽게 플레이할 수 있습니다.
      </p>

      {canPrompt ? (
        <div className="jr-desktop-install-box">
          <div className="jr-desktop-install-icon">
            <GameIcon name="install" size={30} />
          </div>
          <div>
            <strong>지금 바로 원클릭 설치 가능</strong>
            <p>아래 설치 버튼을 누르면 브라우저의 공식 앱 설치 창이 바로 열립니다.</p>
          </div>
        </div>
      ) : (
        <div className="jr-desktop-install-box">
          <div className="jr-desktop-install-icon">
            <GameIcon name="install" size={30} />
          </div>
          <div>
            <strong>주소창의 [설치] 버튼을 확인하세요</strong>
            <p>
              Chrome / Edge 브라우저 주소창 오른쪽에 나타나는 <strong>[앱 설치]</strong> 아이콘(또는 메뉴 &gt; &lsquo;고물 레이서즈 설치&rsquo;)을 클릭하시면 즉시 데스크톱 앱으로 등록됩니다.
            </p>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        {canPrompt && onPrompt && (
          <button
            className="jr-primary"
            style={{ flex: 1 }}
            onClick={() => {
              onPrompt();
              onClose();
            }}
          >
            지금 앱 설치하기
          </button>
        )}
        <button
          className={canPrompt ? 'jr-btn' : 'jr-primary full'}
          style={{ flex: canPrompt ? '0 0 100px' : undefined }}
          onClick={onClose}
        >
          닫기
        </button>
      </div>
    </Modal>
  );
}

export function InstallHeaderButton() {
  const { isStandalone, isIos, isInstallable, promptInstall } = usePwaInstall();
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  // If already running in installed standalone mode, hide button
  if (isStandalone) {
    return null;
  }

  const handleClick = async () => {
    sfx.init();
    sfx.click();
    if (isInstallable) {
      const ok = await promptInstall();
      if (!ok && isIos) {
        setShowIosGuide(true);
      } else if (!ok) {
        setShowGuide(true);
      }
    } else if (isIos) {
      setShowIosGuide(true);
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <button
        className="install-btn"
        onClick={handleClick}
        aria-label="웹앱으로 설치하기"
        title="홈 화면 또는 PC에 앱으로 설치하기"
      >
        <span className="install-btn-icon-wrap">
          <img src="/icons/favicon-32.png" alt="" width={18} height={18} className="install-btn-mini-icon" />
        </span>
        <span className="install-btn-text">앱 설치</span>
      </button>

      {showIosGuide && <IosInstallGuideModal onClose={() => setShowIosGuide(false)} />}
      {showGuide && (
        <DesktopInstallGuideModal
          onClose={() => setShowGuide(false)}
          canPrompt={isInstallable}
          onPrompt={promptInstall}
        />
      )}
    </>
  );
}
