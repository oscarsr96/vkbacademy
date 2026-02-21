import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useRegister } from '../hooks/useAuth';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const { mutate, isPending, error } = useRegister();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setPasswordError('');

    if (password.length < 8) {
      setPasswordError('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    mutate({ name, email, password });
  }

  const apiError =
    (error as { response?: { data?: { message?: string } } } | null)?.response?.data?.message;

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.logo}>🏀</div>
          <h1 style={styles.title}>VKB Academy</h1>
          <p style={styles.subtitle}>Crea tu cuenta</p>
        </div>

        {apiError && <div className="alert alert-error">{apiError}</div>}

        <form onSubmit={handleSubmit} style={styles.form} noValidate>
          <div className="field">
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
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              className={passwordError ? 'error' : ''}
              required
            />
            {passwordError && <span className="field-error">{passwordError}</span>}
          </div>

          <button type="submit" className="btn btn-primary btn-full" disabled={isPending}>
            {isPending ? <span className="spinner" /> : 'Crear cuenta'}
          </button>
        </form>

        <p style={styles.footer}>
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" style={styles.link}>
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--color-dark)',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    background: 'var(--color-surface)',
    borderRadius: 'var(--radius-lg)',
    padding: '40px 36px',
    boxShadow: 'var(--shadow-md)',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  header: { textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 6 },
  logo: { fontSize: 40 },
  title: { fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-dark)' },
  subtitle: { fontSize: '0.9rem', color: 'var(--color-text-muted)' },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  footer: { textAlign: 'center', fontSize: '0.875rem', color: 'var(--color-text-muted)' },
  link: { color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' },
};
