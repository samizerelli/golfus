import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { haptic } from './ui';

const SEEN_KEY = 'gf.introSeen';
export const HAD_ACCOUNT_KEY = 'gf.hadAccount';

export function introSeen() {
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}
function markSeen() {
  try {
    sessionStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* stockage indisponible */
  }
}
/** Un compte a-t-il déjà été utilisé sur cet appareil ? (→ connexion plutôt que création) */
export function hadAccount() {
  try {
    return localStorage.getItem(HAD_ACCOUNT_KEY) === '1';
  } catch {
    return false;
  }
}

/** Balle de golf en SVG : alvéoles, ombrage et inscription « I wanna play ». */
function GolfBall() {
  // Alvéoles disposées en quinconce, uniquement dans le disque
  const dimples: [number, number][] = [];
  for (let y = 18; y <= 182; y += 13) {
    const offset = (Math.round(y / 13) % 2) * 6.5;
    for (let x = 18 + offset; x <= 182; x += 13) {
      if ((x - 100) ** 2 + (y - 100) ** 2 < 86 ** 2) dimples.push([x, y]);
    }
  }
  return (
    <svg viewBox="0 0 200 200" className="size-full drop-shadow-[0_30px_40px_rgba(0,0,0,0.45)]" aria-hidden="true">
      <defs>
        <radialGradient id="ball-shade" cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.55" stopColor="#f1f4f2" />
          <stop offset="0.85" stopColor="#cfd8d3" />
          <stop offset="1" stopColor="#a9b7af" />
        </radialGradient>
        <radialGradient id="dimple" cx="60%" cy="65%" r="60%">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#7c8b83" stopOpacity="0.35" />
        </radialGradient>
        <clipPath id="ball-clip">
          <circle cx="100" cy="100" r="92" />
        </clipPath>
      </defs>
      <circle cx="100" cy="100" r="92" fill="url(#ball-shade)" />
      <g clipPath="url(#ball-clip)">
        {dimples.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="4.6" fill="url(#dimple)" />
        ))}
      </g>
      {/* Reflet spéculaire */}
      <ellipse cx="72" cy="58" rx="30" ry="18" fill="#fff" opacity=".75" transform="rotate(-28 72 58)" />
      {/* Inscription imprimée sur la balle */}
      <g fontFamily="'SF Pro Display', -apple-system, 'Inter', system-ui, sans-serif" textAnchor="middle" fill="#0f3d2e">
        <text x="100" y="97" fontSize="26" fontWeight="800" letterSpacing="-0.5">
          I wanna
        </text>
        <text x="100" y="125" fontSize="30" fontWeight="800" letterSpacing="-0.5" fontStyle="italic">
          play
        </text>
      </g>
      <circle cx="100" cy="100" r="92" fill="none" stroke="#ffffff" strokeOpacity=".5" />
    </svg>
  );
}

/**
 * Écran d'accueil (visiteur non connecté) : fond vert foncé et balle « I wanna play ».
 * Toucher la balle → création de compte à la première visite, sinon connexion.
 */
export function Intro({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [pressed, setPressed] = useState(false);
  const returning = hadAccount();
  const action = returning ? t('auth.tabLogin') : t('auth.tabRegister');

  const go = () => {
    haptic(18);
    setPressed(true);
    markSeen();
    setTimeout(() => {
      onClose();
      navigate(`/connexion?mode=${returning ? 'login' : 'register'}`);
    }, 380);
  };

  return (
    <div
      className="intro fixed inset-0 z-[2500] flex flex-col items-center justify-between overflow-hidden px-6 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] text-white"
      role="dialog"
      aria-modal="true"
      aria-labelledby="intro-title"
    >
      <h1 id="intro-title" className="text-center text-[34px] leading-none tracking-tight">
        Golf<span className="text-gold-400">Us</span>
      </h1>

      <div className="flex flex-col items-center gap-8">
        <button
          type="button"
          onClick={go}
          aria-label={`I wanna play — ${action}`}
          className={`intro-ball relative size-[min(68vw,320px)] rounded-full transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-gold-400 active:scale-95 ${pressed ? 'is-pressed' : ''}`}
        >
          <GolfBall />
        </button>
        {/* Ombre portée sur le « green » */}
        <span className="intro-shadow -mt-6 block h-4 w-[min(48vw,220px)] rounded-[50%] bg-black/35 blur-md" aria-hidden />
        <p className="text-center text-[15px] font-medium text-white/85">{t('intro.hint', { action: action.toLowerCase() })}</p>
      </div>

      <button
        type="button"
        onClick={() => {
          markSeen();
          onClose();
        }}
        className="h-11 rounded-full px-4 text-sm font-medium text-white/80 underline-offset-4 hover:text-white hover:underline"
      >
        {t('intro.guest')}
      </button>
    </div>
  );
}
