import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '../api/auth.api';
import { useAuthStore } from '../store/auth.store';

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (newPassword: string) => authApi.changePassword(newPassword),
    onSuccess: () => {
      if (user) setUser({ ...user, mustChangePassword: false });
      navigate('/dashboard', { replace: true });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'No se pudo cambiar la contraseña. Inténtalo de nuevo.');
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres');
    if (password !== confirm) return setError('Las contraseñas no coinciden');
    mutation.mutate(password);
  }

  return (
    <div
      className="court-lines sweep-light"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        position: 'relative',
        overflow: 'hidden',
        background:
          'radial-gradient(120% 80% at 50% -10%, rgba(245,145,30,0.14), transparent 55%), radial-gradient(80% 60% at 90% 110%, rgba(255,210,77,0.07), transparent 60%), linear-gradient(180deg, var(--navy-950) 0%, var(--navy-800) 100%)',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: 420,
          background: 'rgba(8,14,26,0.88)',
          border: '1.5px solid rgba(245,145,30,0.20)',
          borderRadius: 20,
          padding: '36px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          position: 'relative',
          zIndex: 1,
        }}
        noValidate
      >
        <h1
          style={{
            color: '#fff',
            fontSize: '1.4rem',
            fontWeight: 800,
            margin: 0,
            fontFamily: 'var(--font-display)',
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
          }}
        >
          Crea tu contraseña
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.9rem', margin: 0 }}>
          Por seguridad, elige una contraseña nueva antes de continuar.
        </p>
        {error && <div style={{ color: '#fca5a5', fontSize: '0.85rem' }}>{error}</div>}
        <div className="field field-dark">
          <label htmlFor="new-pass">Nueva contraseña</label>
          <input
            id="new-pass"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
            required
          />
        </div>
        <div className="field field-dark">
          <label htmlFor="confirm-pass">Repite la contraseña</label>
          <input
            id="confirm-pass"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>
        <button
          type="submit"
          className="btn btn-primary btn-full"
          disabled={mutation.isPending}
          style={{ padding: '13px 22px', fontSize: '1rem' }}
        >
          {mutation.isPending ? <span className="spinner" /> : 'Guardar y continuar'}
        </button>
      </form>
    </div>
  );
}
