import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth.store';
import { usersApi } from '../api/users.api';
import type { User } from '@vkbacademy/shared';

// ─── Estilos ───────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  page: { maxWidth: 680, margin: '0 auto', padding: '2rem 1.5rem' },
  header: { marginBottom: '2rem' },
  title: { fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0 },
  subtitle: { fontSize: '0.9rem', color: '#64748b', marginTop: 6 },
  card: {
    background: '#fff',
    borderRadius: 14,
    border: '1px solid #e2e8f0',
    padding: '1.75rem',
    marginBottom: '1.5rem',
  },
  cardTitle: { fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: '1.25rem' },
  field: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 },
  label: { fontSize: '0.8rem', fontWeight: 600, color: '#475569' },
  input: {
    height: 42,
    padding: '0 12px',
    borderRadius: 8,
    border: '1.5px solid #e2e8f0',
    fontSize: '0.9rem',
    outline: 'none',
    color: '#0f172a',
    background: '#fff',
  },
  row: { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' as const },
  btn: {
    height: 40,
    padding: '0 20px',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '0.875rem',
    transition: 'background 0.15s',
  },
  btnPrimary: { background: '#ea580c', color: '#fff' },
  btnDisabled: { background: '#cbd5e1', color: '#94a3b8', cursor: 'not-allowed' },
  alert: {
    padding: '10px 14px',
    borderRadius: 8,
    fontSize: '0.85rem',
    fontWeight: 500,
    marginTop: 12,
  },
  alertSuccess: { background: '#dcfce7', color: '#166534' },
  alertError: { background: '#fee2e2', color: '#991b1b' },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: '50%',
    background: '#ea580c',
    color: '#fff',
    fontSize: '2rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '1rem',
  },
};

// ─── Sección: datos personales ─────────────────────────────────────────────────

function PersonalDataSection({ user }: { user: User }) {
  const setUser = useAuthStore((s) => s.setUser);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const { mutate, isPending } = useMutation({
    mutationFn: () => usersApi.updateProfile({ name, email }),
    onSuccess: (updated) => {
      setUser({ ...user, name: updated.name, email: updated.email });
      setStatus('success');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErrorMsg(msg ?? 'Error al actualizar los datos');
      setStatus('error');
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus('idle');
    mutate();
  }

  const unchanged = name === user.name && email === user.email;

  return (
    <div style={S.card}>
      <div style={S.cardTitle}>Datos personales</div>
      <form onSubmit={handleSubmit} noValidate>
        <div style={S.field}>
          <label style={S.label}>Nombre</label>
          <input
            style={S.input}
            value={name}
            onChange={(e) => { setName(e.target.value); setStatus('idle'); }}
            required
          />
        </div>
        <div style={S.field}>
          <label style={S.label}>Email</label>
          <input
            style={S.input}
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setStatus('idle'); }}
            required
          />
        </div>
        <div style={S.row}>
          <button
            type="submit"
            style={{ ...S.btn, ...(isPending || unchanged ? S.btnDisabled : S.btnPrimary) }}
            disabled={isPending || unchanged}
          >
            {isPending ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
        {status === 'success' && (
          <div style={{ ...S.alert, ...S.alertSuccess }}>Datos actualizados correctamente.</div>
        )}
        {status === 'error' && (
          <div style={{ ...S.alert, ...S.alertError }}>{errorMsg}</div>
        )}
      </form>
    </div>
  );
}

// ─── Sección: cambiar contraseña ───────────────────────────────────────────────

function ChangePasswordSection() {
  const [current, setCurrent] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const { mutate, isPending } = useMutation({
    mutationFn: () => usersApi.updateProfile({ password: newPass }),
    onSuccess: () => {
      setStatus('success');
      setCurrent(''); setNewPass(''); setConfirm('');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErrorMsg(msg ?? 'Error al cambiar la contraseña');
      setStatus('error');
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus('idle');
    if (newPass.length < 6) {
      setErrorMsg('La nueva contraseña debe tener al menos 6 caracteres');
      setStatus('error');
      return;
    }
    if (newPass !== confirm) {
      setErrorMsg('Las contraseñas no coinciden');
      setStatus('error');
      return;
    }
    mutate();
  }

  return (
    <div style={S.card}>
      <div style={S.cardTitle}>Cambiar contraseña</div>
      <form onSubmit={handleSubmit} noValidate>
        <div style={S.field}>
          <label style={S.label}>Contraseña actual</label>
          <input
            style={S.input}
            type="password"
            value={current}
            onChange={(e) => { setCurrent(e.target.value); setStatus('idle'); }}
            placeholder="••••••••"
          />
        </div>
        <div style={S.field}>
          <label style={S.label}>Nueva contraseña</label>
          <input
            style={S.input}
            type="password"
            value={newPass}
            onChange={(e) => { setNewPass(e.target.value); setStatus('idle'); }}
            placeholder="••••••••"
          />
        </div>
        <div style={S.field}>
          <label style={S.label}>Confirmar nueva contraseña</label>
          <input
            style={S.input}
            type="password"
            value={confirm}
            onChange={(e) => { setConfirm(e.target.value); setStatus('idle'); }}
            placeholder="••••••••"
          />
        </div>
        <div style={S.row}>
          <button
            type="submit"
            style={{ ...S.btn, ...(isPending || !newPass ? S.btnDisabled : S.btnPrimary) }}
            disabled={isPending || !newPass}
          >
            {isPending ? 'Actualizando...' : 'Cambiar contraseña'}
          </button>
        </div>
        {status === 'success' && (
          <div style={{ ...S.alert, ...S.alertSuccess }}>Contraseña actualizada correctamente.</div>
        )}
        {status === 'error' && (
          <div style={{ ...S.alert, ...S.alertError }}>{errorMsg}</div>
        )}
      </form>
    </div>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────────

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);

  if (!user) return null;

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={S.avatarCircle}>{user.name.charAt(0).toUpperCase()}</div>
        <h1 style={S.title}>Mi perfil</h1>
        <p style={S.subtitle}>{user.email} · {user.role}</p>
      </div>

      <PersonalDataSection user={user} />
      <ChangePasswordSection />
    </div>
  );
}
