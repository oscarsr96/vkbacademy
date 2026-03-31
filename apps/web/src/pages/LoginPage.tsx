import { useState, useEffect, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useLogin } from '../hooks/useAuth';
import { useAcademyDomain } from '../contexts/AcademyContext';
import { contrastText } from '../utils/color';

/* ---------- Basketball SVG component ---------- */
function Basketball({ size = 40, style, color = '#ea580c' }: { size?: number; style?: React.CSSProperties; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={style}
      aria-hidden="true"
    >
      <circle cx="50" cy="50" r="48" fill={color} stroke={`${color}cc`} strokeWidth="3" />
      {/* líneas del balón */}
      <path d="M50 2 Q50 50 50 98" fill="none" stroke="#1a1a1a" strokeWidth="2.5" opacity="0.35" />
      <path d="M2 50 Q50 50 98 50" fill="none" stroke="#1a1a1a" strokeWidth="2.5" opacity="0.35" />
      <path d="M15 15 Q50 35 85 15" fill="none" stroke="#1a1a1a" strokeWidth="2" opacity="0.3" />
      <path d="M15 85 Q50 65 85 85" fill="none" stroke="#1a1a1a" strokeWidth="2" opacity="0.3" />
    </svg>
  );
}

/* ---------- Floating ball config ---------- */
interface FloatingBall {
  id: number;
  x: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
}

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const { mutate, isPending, error } = useLogin();
  const { academy: domainAcademy } = useAcademyDomain();
  const [mounted, setMounted] = useState(false);

  // Branding dinámico
  const accentColor = domainAcademy?.primaryColor ?? '#ea580c';
  const academyName = domainAcademy?.name ?? 'VKB Academy';
  const academyLogo = domainAcademy?.logoUrl ?? 'https://vallekasbasket.com/wp-content/uploads/2022/04/logotipo-vallekas-basket.png';

  const [balls] = useState<FloatingBall[]>(() =>
    Array.from({ length: 8 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      size: 18 + Math.random() * 28,
      duration: 6 + Math.random() * 8,
      delay: Math.random() * 5,
      opacity: 0.06 + Math.random() * 0.1,
    })),
  );

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutate({ identifier, password });
  }

  const apiError =
    (error as { response?: { data?: { message?: string } } } | null)?.response?.data?.message;

  return (
    <div style={s.page}>
      {/* Estilos de animación */}
      <style>{getAnimationCSS(accentColor)}</style>

      {/* Glow */}
      <div style={{ ...s.bgGlow, background: `radial-gradient(circle, ${accentColor}1f 0%, transparent 60%)` }} />

      {/* Líneas de cancha de fondo */}
      <svg style={s.courtLines} viewBox="0 0 800 800" aria-hidden="true">
        <circle cx="400" cy="400" r="120" fill="none" stroke={`${accentColor}14`} strokeWidth="3" />
        <circle cx="400" cy="400" r="5" fill={`${accentColor}1a`} />
        <line x1="0" y1="400" x2="800" y2="400" stroke={`${accentColor}0f`} strokeWidth="3" />
        <path d="M280 0 L280 180 A120 120 0 0 0 520 180 L520 0" fill="none" stroke={`${accentColor}0f`} strokeWidth="2.5" />
        <path d="M280 800 L280 620 A120 120 0 0 1 520 620 L520 800" fill="none" stroke={`${accentColor}0f`} strokeWidth="2.5" />
        <rect x="50" y="50" width="700" height="700" rx="8" fill="none" stroke={`${accentColor}0d`} strokeWidth="3" />
      </svg>

      {/* Balones flotantes */}
      {balls.map((b) => (
        <div
          key={b.id}
          className="floating-ball"
          style={{
            position: 'fixed',
            left: `${b.x}%`,
            bottom: '-60px',
            animationDuration: `${b.duration}s`,
            animationDelay: `${b.delay}s`,
            opacity: 0,
            zIndex: 0,
            pointerEvents: 'none',
          }}
        >
          <Basketball size={b.size} color={accentColor} style={{ opacity: b.opacity }} />
        </div>
      ))}

      {/* Balón principal rebotando */}
      <div className="hero-ball" style={s.heroBall}>
        <Basketball size={70} color={accentColor} style={{ filter: `drop-shadow(0 8px 24px ${accentColor}66)` }} />
      </div>

      {/* Card */}
      <div
        style={{
          ...s.card,
          border: `1.5px solid ${accentColor}38`,
          boxShadow: `0 24px 64px rgba(0,0,0,0.55), 0 0 80px ${accentColor}14, 0 0 0 1px ${accentColor}1a`,
          transform: mounted ? 'translateY(0) scale(1)' : 'translateY(-40px) scale(0.95)',
          opacity: mounted ? 1 : 0,
        }}
      >
        {/* Encabezado */}
        <div style={s.header}>
          {academyLogo ? (
            <img
              src={academyLogo}
              alt={academyName}
              style={s.logoImg}
              className="logo-pulse"
            />
          ) : (
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '2rem', fontWeight: 800, color: contrastText(accentColor),
              boxShadow: `0 8px 32px ${accentColor}55`,
            }}>
              {academyName.charAt(0)}
            </div>
          )}
          <h1 style={s.title}>
            Bienvenido de vuelta
          </h1>
          <p style={s.subtitle}>Accede a tu cuenta de {academyName}</p>
        </div>

        {/* Error de API */}
        {apiError && (
          <div style={s.errorBox} className="shake-error">
            <span style={s.errorIcon}>!</span>
            {apiError}
          </div>
        )}

        <form onSubmit={handleSubmit} style={s.form} noValidate>
          <div className="field field-dark field-glow">
            <label htmlFor="identifier">Email o nombre de usuario</label>
            <input
              id="identifier"
              type="text"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="tu@email.com o tu nombre"
              required
            />
          </div>

          <div className="field field-dark field-glow">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full slam-btn"
            disabled={isPending}
            style={{ marginTop: 4, padding: '14px 22px', fontSize: '1.05rem', position: 'relative', overflow: 'hidden' }}
          >
            {isPending ? <span className="spinner" /> : 'Entrar'}
          </button>
        </form>

        <div style={s.footerLinks}>
          <p style={s.footerText}>
            <Link to="/forgot-password" style={{ ...s.link, color: accentColor }}>
              ¿Olvidaste tu contraseña?
            </Link>
          </p>
          <p style={s.footerText}>
            <span style={s.footerMuted}>¿No tienes cuenta? </span>
            <Link to="/register" style={{ ...s.link, color: accentColor }}>
              Regístrate
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------- Animation CSS ---------- */
function getAnimationCSS(color: string) {
  return `
  @keyframes float-up {
    0%   { transform: translateY(0) rotate(0deg); opacity: 0; }
    10%  { opacity: 1; }
    90%  { opacity: 1; }
    100% { transform: translateY(-110vh) rotate(360deg); opacity: 0; }
  }

  @keyframes bounce-ball {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    30%      { transform: translateY(-80px) rotate(90deg); }
    50%      { transform: translateY(0) rotate(180deg); }
    70%      { transform: translateY(-35px) rotate(270deg); }
    85%      { transform: translateY(0) rotate(330deg); }
  }

  @keyframes logo-glow {
    0%, 100% { filter: drop-shadow(0 0 8px ${color}00); }
    50%      { filter: drop-shadow(0 0 20px ${color}80); }
  }

  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20%      { transform: translateX(-8px); }
    40%      { transform: translateX(8px); }
    60%      { transform: translateX(-5px); }
    80%      { transform: translateX(5px); }
  }

  .floating-ball { animation: float-up linear infinite; }
  .hero-ball { animation: bounce-ball 2.2s cubic-bezier(0.22, 1, 0.36, 1) infinite; }
  .logo-pulse { animation: logo-glow 3s ease-in-out infinite; }
  .shake-error { animation: shake 0.5s ease-in-out; }

  .slam-btn { transition: transform 0.15s ease, box-shadow 0.15s ease !important; }
  .slam-btn:hover:not(:disabled) {
    transform: scale(1.04) !important;
    box-shadow: 0 0 30px ${color}80, 0 4px 15px rgba(0,0,0,0.4) !important;
  }
  .slam-btn:active:not(:disabled) { transform: scale(0.97) !important; }

  .field-glow input:focus {
    box-shadow: 0 0 0 2px ${color}4d, 0 0 20px ${color}1a !important;
    border-color: ${color}80 !important;
  }
`;
}

/* ---------- Styles ---------- */
const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    background: 'linear-gradient(135deg, #080e1a 0%, #0d1b2a 60%, #152233 100%)',
    position: 'relative',
    overflow: 'hidden',
  },
  bgGlow: {
    position: 'fixed',
    top: '-10%',
    right: '-10%',
    width: '600px',
    height: '600px',
    background: 'radial-gradient(circle, rgba(234,88,12,0.12) 0%, transparent 60%)',
    pointerEvents: 'none',
    zIndex: 0,
  },
  courtLines: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    width: '110vmin',
    height: '110vmin',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
    zIndex: 0,
  },
  heroBall: {
    position: 'fixed',
    bottom: '10%',
    right: '8%',
    zIndex: 0,
    pointerEvents: 'none',
  },
  card: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    maxWidth: '420px',
    background: 'rgba(8,14,26,0.92)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '1.5px solid rgba(234,88,12,0.22)',
    borderRadius: '20px',
    padding: '40px 36px',
    boxShadow: '0 24px 64px rgba(0,0,0,0.55), 0 0 80px rgba(234,88,12,0.08), 0 0 0 1px rgba(234,88,12,0.10)',
    display: 'flex',
    flexDirection: 'column',
    gap: '22px',
    transition: 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.6s ease',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    textAlign: 'center',
  },
  logoImg: {
    height: '80px',
    width: 'auto',
    objectFit: 'contain' as const,
  },
  title: {
    fontSize: '1.6rem',
    fontWeight: 800,
    color: '#ffffff',
    letterSpacing: '-0.01em',
    lineHeight: 1.2,
  },
  subtitle: {
    fontSize: '0.9rem',
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 1.5,
  },
  errorBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    background: 'rgba(220,38,38,0.15)',
    borderLeft: '4px solid #dc2626',
    borderRadius: '8px',
    padding: '12px 14px',
    color: '#fca5a5',
    fontSize: '0.875rem',
    lineHeight: 1.5,
  },
  errorIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    background: '#dc2626',
    color: '#fff',
    fontSize: '0.7rem',
    fontWeight: 800,
    flexShrink: 0,
    marginTop: '1px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  footerLinks: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  footerText: {
    textAlign: 'center',
    fontSize: '0.875rem',
  },
  footerMuted: {
    color: 'rgba(255,255,255,0.55)',
  },
  link: {
    color: '#f97316',
    fontWeight: 600,
    textDecoration: 'none',
  },
};
