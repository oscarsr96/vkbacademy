import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth.store';
import { usersApi } from '../api/users.api';
import type { User } from '@vkbacademy/shared';

// ─── Mapa de etiquetas de rol ───────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  STUDENT: 'Alumno',
  TUTOR: 'Tutor',
  TEACHER: 'Profesor',
  ADMIN: 'Administrador',
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
    <div className="vkb-card animate-in" style={{ marginBottom: 20 }}>
      <div style={S.cardHeader}>
        <span style={S.cardIcon}>👤</span>
        <span style={S.cardTitle}>Información personal</span>
      </div>
      <form onSubmit={handleSubmit} noValidate style={{ marginTop: 20 }}>
        <div className="field" style={{ marginBottom: 16 }}>
          <label>Nombre completo</label>
          <input
            value={name}
            onChange={(e) => { setName(e.target.value); setStatus('idle'); }}
            required
          />
        </div>
        <div className="field" style={{ marginBottom: 20 }}>
          <label>Correo electrónico</label>
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setStatus('idle'); }}
            required
          />
        </div>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isPending || unchanged}
        >
          {isPending ? 'Guardando...' : 'Guardar cambios'}
        </button>
        {status === 'success' && (
          <div className="alert alert-success" style={{ marginTop: 14 }}>
            Datos actualizados correctamente.
          </div>
        )}
        {status === 'error' && (
          <div className="alert alert-error" style={{ marginTop: 14 }}>
            {errorMsg}
          </div>
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
    <div className="vkb-card animate-in" style={{ marginBottom: 20 }}>
      <div style={S.cardHeader}>
        <span style={S.cardIcon}>🔐</span>
        <span style={S.cardTitle}>Cambiar contraseña</span>
      </div>
      <form onSubmit={handleSubmit} noValidate style={{ marginTop: 20 }}>
        <div className="field" style={{ marginBottom: 16 }}>
          <label>Contraseña actual</label>
          <input
            type="password"
            value={current}
            onChange={(e) => { setCurrent(e.target.value); setStatus('idle'); }}
            placeholder="••••••••"
          />
        </div>
        <div className="field" style={{ marginBottom: 16 }}>
          <label>Nueva contraseña</label>
          <input
            type="password"
            value={newPass}
            onChange={(e) => { setNewPass(e.target.value); setStatus('idle'); }}
            placeholder="••••••••"
          />
        </div>
        <div className="field" style={{ marginBottom: 20 }}>
          <label>Confirmar nueva contraseña</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => { setConfirm(e.target.value); setStatus('idle'); }}
            placeholder="••••••••"
          />
        </div>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isPending || !newPass}
        >
          {isPending ? 'Actualizando...' : 'Cambiar contraseña'}
        </button>
        {status === 'success' && (
          <div className="alert alert-success" style={{ marginTop: 14 }}>
            Contraseña actualizada correctamente.
          </div>
        )}
        {status === 'error' && (
          <div className="alert alert-error" style={{ marginTop: 14 }}>
            {errorMsg}
          </div>
        )}
      </form>
    </div>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────────

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);

  if (!user) return null;

  const initial = user.name.charAt(0).toUpperCase();
  const roleLabel = ROLE_LABELS[user.role] ?? user.role;

  return (
    <div style={S.page}>
      {/* Hero */}
      <div className="page-hero animate-in" style={{ marginBottom: 28 }}>
        <div style={S.heroInner}>
          {/* Avatar circular */}
          <div style={S.avatarRing}>
            <div style={S.avatarInner}>{initial}</div>
          </div>

          {/* Info */}
          <div style={S.heroText}>
            <h1 style={S.heroName}>{user.name}</h1>
            <p className="hero-subtitle">{user.email}</p>
            <span style={S.rolePill}>{roleLabel}</span>
          </div>
        </div>
      </div>

      {/* Formularios */}
      <div style={S.content}>
        <PersonalDataSection user={user} />
        <ChangePasswordSection />
      </div>
    </div>
  );
}

// ─── Estilos ───────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 680,
    margin: '0 auto',
    padding: '0 0 3rem',
  },

  // Hero
  heroInner: {
    display: 'flex',
    alignItems: 'center',
    gap: 24,
    flexWrap: 'wrap' as const,
  },
  avatarRing: {
    padding: 3,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
    boxShadow: '0 0 24px rgba(234,88,12,0.45)',
    flexShrink: 0,
  },
  avatarInner: {
    width: 72,
    height: 72,
    borderRadius: '50%',
    background: '#0d1b2a',
    border: '2px solid #152233',
    color: '#f97316',
    fontSize: '2rem',
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
  },
  heroName: {
    fontSize: '1.75rem',
    fontWeight: 900,
    color: '#fff',
    letterSpacing: '-0.02em',
    margin: 0,
  },
  rolePill: {
    display: 'inline-block',
    marginTop: 6,
    background: 'rgba(234,88,12,0.18)',
    border: '1px solid rgba(234,88,12,0.35)',
    color: '#fb923c',
    borderRadius: 999,
    padding: '3px 12px',
    fontSize: '0.78rem',
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
  },

  // Cards
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 16,
    borderBottom: '1.5px solid #f1f5f9',
  },
  cardIcon: {
    fontSize: '1.25rem',
  },
  cardTitle: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#0f172a',
  },

  content: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 0,
  },
};
