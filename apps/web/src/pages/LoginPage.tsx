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
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Logo / cabecera */}
        <div style={styles.header}>
          <img
            src="https://vallekasbasket.com/wp-content/uploads/2022/04/logotipo-vallekas-basket.png"
            alt="Vallekas Basket"
            style={styles.logo}
          />
          <h1 style={styles.title}>VKB Academy</h1>
          <p style={styles.subtitle}>Accede a tu cuenta</p>
        </div>

        {apiError && <div className="alert alert-error">{apiError}</div>}

        <form onSubmit={handleSubmit} style={styles.form} noValidate>
          <div className="field">
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

          <div className="field">
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

          <button type="submit" className="btn btn-primary btn-full" disabled={isPending}>
            {isPending ? <span className="spinner" /> : 'Entrar'}
          </button>
        </form>

        <p style={styles.footer}>
          <Link to="/forgot-password" style={styles.link}>
            ¿Olvidaste tu contraseña?
          </Link>
        </p>
        <p style={styles.footer}>
          ¿No tienes cuenta?{' '}
          <Link to="/register" style={styles.link}>
            Regístrate
          </Link>
        </p>
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
  logo: { width: 140, objectFit: 'contain' as const },
  title: { fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-dark)' },
  subtitle: { fontSize: '0.9rem', color: 'var(--color-text-muted)' },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  footer: { textAlign: 'center', fontSize: '0.875rem', color: 'var(--color-text-muted)' },
  link: { color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' },
};
