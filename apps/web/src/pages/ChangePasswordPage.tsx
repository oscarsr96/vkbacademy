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
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'linear-gradient(135deg, #080e1a 0%, #0d1b2a 60%, #152233 100%)',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: 420,
          background: 'rgba(8,14,26,0.88)',
          border: '1.5px solid rgba(234,88,12,0.20)',
          borderRadius: 20,
          padding: '36px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
        noValidate
      >
        <h1 style={{ color: '#fff', fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>
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
