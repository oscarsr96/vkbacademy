import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useRegister } from '../hooks/useAuth';
import { useSchoolYears } from '../hooks/useCourses';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [schoolYearId, setSchoolYearId] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const { mutate, isPending, error } = useRegister();
  const { data: schoolYears = [] } = useSchoolYears();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setPasswordError('');

    if (password.length < 8) {
      setPasswordError('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    mutate({ name, email, password, ...(schoolYearId ? { schoolYearId } : {}) });
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
          <div style={s.logoWrap}>
            <span style={s.logoEmoji}>🏀</span>
          </div>
          <h1 style={s.title}>Crear cuenta</h1>
          <p style={s.subtitle}>Únete a VKB Academy</p>
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
            <label htmlFor="name">Nombre completo</label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Juan García"
              required
            />
          </div>

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
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              className={passwordError ? 'error' : ''}
              required
            />
            {passwordError && (
              <span style={s.fieldError}>{passwordError}</span>
            )}
          </div>

          {schoolYears.length > 0 && (
            <div className="field field-dark">
              <label htmlFor="schoolYear">Nivel educativo (opcional)</label>
              <select
                id="schoolYear"
                value={schoolYearId}
                onChange={(e) => setSchoolYearId(e.target.value)}
              >
                <option value="">Selecciona tu curso (opcional)</option>
                {schoolYears.map((sy) => (
                  <option key={sy.id} value={sy.id}>{sy.label}</option>
                ))}
              </select>
              <span style={s.fieldHint}>
                Un administrador puede asignarte el nivel más adelante.
              </span>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={isPending}
            style={{ marginTop: 4, padding: '13px 22px', fontSize: '1rem' }}
          >
            {isPending ? <span className="spinner" /> : 'Crear cuenta'}
          </button>
        </form>

        <p style={s.footerText}>
          <span style={s.footerMuted}>¿Ya tienes cuenta? </span>
          <Link to="/login" style={s.link}>
            Inicia sesión
          </Link>
        </p>
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
  logoWrap: {
    width: '68px',
    height: '68px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 32px rgba(234,88,12,0.35)',
    flexShrink: 0,
  },
  logoEmoji: {
    fontSize: '32px',
    lineHeight: 1,
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
  fieldError: {
    fontSize: '0.8125rem',
    color: '#fca5a5',
    marginTop: '2px',
  },
  fieldHint: {
    fontSize: '0.78rem',
    color: 'rgba(255,255,255,0.40)',
    marginTop: '4px',
    display: 'block',
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
