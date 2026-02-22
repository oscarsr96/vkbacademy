import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '../api/auth.api';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [localError, setLocalError] = useState('');
  const [done, setDone] = useState(false);

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => authApi.resetPassword(token, password),
    onSuccess: () => {
      setDone(true);
      setTimeout(() => navigate('/login'), 3000);
    },
  });

  const apiError =
    (error as { response?: { data?: { message?: string } } } | null)?.response?.data?.message;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLocalError('');
    if (password.length < 6) {
      setLocalError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (password !== confirm) {
      setLocalError('Las contraseñas no coinciden');
      return;
    }
    mutate();
  }

  if (!token) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <p style={{ textAlign: 'center', color: '#dc2626' }}>
            Enlace inválido o expirado.{' '}
            <Link to="/forgot-password" style={styles.link}>
              Solicitar uno nuevo
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <img
            src="https://vallekasbasket.com/wp-content/uploads/2022/04/logotipo-vallekas-basket.png"
            alt="Vallekas Basket"
            style={styles.logo}
          />
          <h1 style={styles.title}>Nueva contraseña</h1>
          <p style={styles.subtitle}>Elige una contraseña segura para tu cuenta.</p>
        </div>

        {done ? (
          <div style={styles.successBox}>
            <div style={styles.successIcon}>✅</div>
            <p style={styles.successText}>
              ¡Contraseña actualizada! Redirigiendo al inicio de sesión...
            </p>
          </div>
        ) : (
          <>
            {(apiError || localError) && (
              <div className="alert alert-error">{apiError ?? localError}</div>
            )}

            <form onSubmit={handleSubmit} style={styles.form} noValidate>
              <div className="field">
                <label htmlFor="password">Nueva contraseña</label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setLocalError(''); }}
                  placeholder="••••••••"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="confirm">Confirmar contraseña</label>
                <input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => { setConfirm(e.target.value); setLocalError(''); }}
                  placeholder="••••••••"
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-full"
                disabled={isPending || !password || !confirm}
              >
                {isPending ? <span className="spinner" /> : 'Restablecer contraseña'}
              </button>
            </form>

            <p style={styles.footer}>
              <Link to="/login" style={styles.link}>
                ← Volver al inicio de sesión
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

const BG = 'https://vallekasbasket.com/wp-content/uploads/elementor/thumbs/Cadete-Naranja-1-min-raea6l891p6m04namsw9268rncd2xfsv58r19entlg.jpg';

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundImage: `linear-gradient(135deg, rgba(10,15,30,0.88) 0%, rgba(10,15,30,0.55) 100%), url(${BG})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    background: 'rgba(255,255,255,0.97)',
    borderRadius: 'var(--radius-lg)',
    padding: '40px 36px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  header: { textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 },
  logo: { width: 120, objectFit: 'contain' as const },
  title: { fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-dark)' },
  subtitle: { fontSize: '0.875rem', color: 'var(--color-text-muted)' },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  footer: { textAlign: 'center', fontSize: '0.875rem' },
  link: { color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' },
  successBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' },
  successIcon: { fontSize: '3rem' },
  successText: { fontSize: '0.9rem', color: '#475569', lineHeight: 1.6 },
};
