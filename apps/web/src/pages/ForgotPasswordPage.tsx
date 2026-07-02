import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '../api/auth.api';
import Icon from '../components/ui/Icon';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => authApi.forgotPassword(email),
    onSuccess: () => setSent(true),
  });

  const apiError =
    (error as { response?: { data?: { message?: string } } } | null)?.response?.data?.message;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutate();
  }

  return (
    <div style={s.page} className="court-lines sweep-light">
      {/* Glow decorativo fondo */}
      <div style={s.bgGlow} />

      <div style={s.card} className="animate-in">
        {/* Encabezado */}
        <div style={s.header}>
          <div style={s.logoWrap}>
            <Icon name="basketball" size={32} color="var(--brand-contrast)" />
          </div>
          <h1 style={s.title}>Recuperar contraseña</h1>
          <p style={s.subtitle}>
            Introduce tu email y te enviaremos un enlace para restablecer tu contraseña.
          </p>
        </div>

        {sent ? (
          /* Estado de éxito */
          <div style={s.successBox}>
            <div style={s.successIconWrap}>
              <Icon name="check" size={32} color="#16a34a" />
            </div>
            <p style={s.successTitle}>Correo enviado</p>
            <p style={s.successText}>
              Si el email está registrado, recibirás un enlace en breve. Revisa también la carpeta
              de spam.
            </p>
            <Link to="/login" style={s.successLink}>
              Volver al inicio de sesión
            </Link>
          </div>
        ) : (
          <>
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

              <button
                type="submit"
                className="btn btn-primary btn-full"
                disabled={isPending || !email}
                style={{ marginTop: 4, padding: '13px 22px', fontSize: '1rem' }}
              >
                {isPending ? <span className="spinner" /> : 'Enviar enlace'}
              </button>
            </form>

            <p style={s.footerText}>
              <Link to="/login" style={s.link}>
                Volver al inicio de sesión
              </Link>
            </p>
          </>
        )}
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
    background:
      'radial-gradient(120% 80% at 50% -10%, rgba(245,145,30,0.14), transparent 55%), radial-gradient(80% 60% at 90% 110%, rgba(255,210,77,0.07), transparent 60%), linear-gradient(180deg, var(--navy-950) 0%, var(--navy-800) 100%)',
    position: 'relative',
    overflow: 'hidden',
  },
  bgGlow: {
    position: 'fixed',
    top: '-10%',
    right: '-10%',
    width: '600px',
    height: '600px',
    background: 'radial-gradient(circle, var(--brand-soft) 0%, transparent 60%)',
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
    border: '1.5px solid rgba(245,145,30,0.20)',
    borderRadius: '20px',
    padding: '40px 36px',
    boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(245,145,30,0.10)',
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
    background: 'var(--gradient-orange)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 32px rgba(245,145,30,0.35)',
    flexShrink: 0,
  },
  title: {
    fontSize: '1.6rem',
    fontWeight: 800,
    color: '#ffffff',
    fontFamily: 'var(--font-display)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.03em',
    lineHeight: 1.2,
  },
  subtitle: {
    fontSize: '0.9rem',
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 1.6,
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
  footerText: {
    textAlign: 'center',
    fontSize: '0.875rem',
  },
  link: {
    color: 'var(--brand-light)',
    fontWeight: 600,
    textDecoration: 'none',
  },
  /* Estado de éxito */
  successBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '14px',
    textAlign: 'center',
    padding: '8px 0 4px',
  },
  successIconWrap: {
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    background: 'rgba(22,163,74,0.15)',
    border: '1.5px solid rgba(22,163,74,0.30)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: '1.2rem',
    fontWeight: 700,
    color: '#ffffff',
  },
  successText: {
    fontSize: '0.9rem',
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 1.6,
  },
  successLink: {
    color: 'var(--brand-light)',
    fontWeight: 600,
    textDecoration: 'none',
    fontSize: '0.9rem',
    marginTop: '4px',
  },
};
