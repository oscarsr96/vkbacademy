import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useLogin } from '../hooks/useAuth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { mutate, isPending, error } = useLogin();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutate({ email, password });
  }

  const apiError =
    (error as { response?: { data?: { message?: string } } } | null)?.response?.data?.message;

  return (
    <div style={s.page}>
      {/* Glow decorativo fondo */}
      <div style={s.bgGlow} />

      <div style={s.card} className="animate-in">
        {/* Encabezado */}
        <div style={s.header}>
          <img
            src="https://vallekasbasket.com/wp-content/uploads/2022/04/logotipo-vallekas-basket.png"
            alt="Vallekas Basket"
            style={s.logoImg}
          />
          <h1 style={s.title}>Bienvenido de vuelta</h1>
          <p style={s.subtitle}>Accede a tu cuenta de VKB Academy</p>
        </div>

        {/* Error de API */}
        {apiError && (
          <div style={s.errorBox}>
            <span style={s.errorIcon}>!</span>
            {apiError}
          </div>
        )}

        <form onSubmit={handleSubmit} style={s.form} noValidate>
          <div className="field field-dark">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
            />
          </div>

          <div className="field field-dark">
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
            className="btn btn-primary btn-full"
            disabled={isPending}
            style={{ marginTop: 4, padding: '13px 22px', fontSize: '1rem' }}
          >
            {isPending ? <span className="spinner" /> : 'Entrar'}
          </button>
        </form>

        <div style={s.footerLinks}>
          <p style={s.footerText}>
            <Link to="/forgot-password" style={s.link}>
              ¿Olvidaste tu contraseña?
            </Link>
          </p>
          <p style={s.footerText}>
            <span style={s.footerMuted}>¿No tienes cuenta? </span>
            <Link to="/register" style={s.link}>
              Regístrate
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

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
  card: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    maxWidth: '420px',
    background: 'rgba(8,14,26,0.88)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1.5px solid rgba(234,88,12,0.20)',
    borderRadius: '20px',
    padding: '40px 36px',
    boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(234,88,12,0.10)',
    display: 'flex',
    flexDirection: 'column',
    gap: '22px',
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
