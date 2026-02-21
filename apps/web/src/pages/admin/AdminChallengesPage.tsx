import { useState } from 'react';
import {
  useAdminChallenges,
  useCreateChallenge,
  useUpdateChallenge,
  useDeleteChallenge,
  useToggleChallenge,
} from '../../hooks/useChallenges';
import type { AdminChallenge, AdminChallengeType, CreateChallengePayload } from '../../api/admin.api';

const CHALLENGE_TYPE_LABELS: Record<AdminChallengeType, string> = {
  LESSON_COMPLETED: 'Lecciones completadas',
  MODULE_COMPLETED: 'Módulos completados',
  COURSE_COMPLETED: 'Cursos completados',
  QUIZ_SCORE: 'Puntuación en quiz (%)',
  BOOKING_ATTENDED: 'Clases asistidas',
  STREAK_WEEKLY: 'Racha semanal',
  TOTAL_HOURS: 'Horas totales',
};

const CHALLENGE_TYPES = Object.keys(CHALLENGE_TYPE_LABELS) as AdminChallengeType[];

const EMPTY_FORM: CreateChallengePayload = {
  title: '',
  description: '',
  type: 'LESSON_COMPLETED',
  target: 1,
  points: 10,
  badgeIcon: '🏅',
  badgeColor: '#6366f1',
};

interface ChallengeFormProps {
  initial?: Partial<CreateChallengePayload>;
  onSubmit: (data: CreateChallengePayload) => void;
  onCancel: () => void;
  isPending: boolean;
  title: string;
}

function ChallengeForm({ initial, onSubmit, onCancel, isPending, title }: ChallengeFormProps) {
  const [form, setForm] = useState<CreateChallengePayload>({ ...EMPTY_FORM, ...initial });
  const set = (k: keyof CreateChallengePayload, v: string | number) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h2 style={styles.modalTitle}>{title}</h2>

        <div style={styles.formGrid}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Título</label>
            <input
              style={styles.input}
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Nombre del reto"
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Icono badge</label>
            <input
              style={{ ...styles.input, width: 80 }}
              value={form.badgeIcon}
              onChange={(e) => set('badgeIcon', e.target.value)}
              placeholder="🏅"
            />
          </div>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Descripción</label>
          <textarea
            style={{ ...styles.input, height: 72, resize: 'vertical' }}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Descripción del reto..."
          />
        </div>

        <div style={styles.formGrid}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Tipo de reto</label>
            <select
              style={styles.input}
              value={form.type}
              onChange={(e) => set('type', e.target.value)}
            >
              {CHALLENGE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {CHALLENGE_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Objetivo</label>
            <input
              style={styles.input}
              type="number"
              min={1}
              value={form.target}
              onChange={(e) => set('target', parseInt(e.target.value, 10) || 1)}
            />
          </div>
        </div>

        <div style={styles.formGrid}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Puntos al completar</label>
            <input
              style={styles.input}
              type="number"
              min={1}
              value={form.points}
              onChange={(e) => set('points', parseInt(e.target.value, 10) || 1)}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Color badge</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="color"
                value={form.badgeColor}
                onChange={(e) => set('badgeColor', e.target.value)}
                style={{ width: 40, height: 36, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 0 }}
              />
              <input
                style={{ ...styles.input, flex: 1 }}
                value={form.badgeColor}
                onChange={(e) => set('badgeColor', e.target.value)}
                placeholder="#6366f1"
              />
            </div>
          </div>
        </div>

        <div style={styles.modalActions}>
          <button onClick={onCancel} style={styles.btnSecondary} disabled={isPending}>
            Cancelar
          </button>
          <button
            onClick={() => onSubmit(form)}
            style={styles.btnPrimary}
            disabled={isPending || !form.title || !form.description}
          >
            {isPending ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminChallengesPage() {
  const { data: challenges, isLoading } = useAdminChallenges();
  const createMutation = useCreateChallenge();
  const updateMutation = useUpdateChallenge();
  const deleteMutation = useDeleteChallenge();
  const toggleMutation = useToggleChallenge();

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<AdminChallenge | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const handleCreate = (data: CreateChallengePayload) => {
    createMutation.mutate(data, { onSuccess: () => setShowCreate(false) });
  };

  const handleUpdate = (data: CreateChallengePayload) => {
    if (!editing) return;
    updateMutation.mutate({ id: editing.id, payload: data }, { onSuccess: () => setEditing(null) });
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, { onSuccess: () => setConfirmDelete(null) });
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>Gestión de Retos</h1>
        <button style={styles.btnPrimary} onClick={() => setShowCreate(true)}>
          + Nuevo reto
        </button>
      </div>

      {isLoading && <p style={styles.empty}>Cargando retos...</p>}

      {!isLoading && (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Icono</th>
                <th style={styles.th}>Título</th>
                <th style={styles.th}>Tipo</th>
                <th style={styles.th}>Objetivo</th>
                <th style={styles.th}>Puntos</th>
                <th style={styles.th}>Completados</th>
                <th style={styles.th}>Activo</th>
                <th style={styles.th}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {(challenges ?? []).map((c) => (
                <tr
                  key={c.id}
                  style={styles.tr}
                  onClick={() => setEditing(c)}
                >
                  <td style={styles.td}>
                    <span
                      style={{
                        ...styles.iconBadge,
                        background: c.badgeColor + '22',
                        border: `1px solid ${c.badgeColor}44`,
                      }}
                    >
                      {c.badgeIcon}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <span style={styles.challengeTitle}>{c.title}</span>
                  </td>
                  <td style={styles.td}>
                    <span style={styles.typePill}>{CHALLENGE_TYPE_LABELS[c.type]}</span>
                  </td>
                  <td style={{ ...styles.td, textAlign: 'center' }}>{c.target}</td>
                  <td style={{ ...styles.td, textAlign: 'center' }}>⭐ {c.points}</td>
                  <td style={{ ...styles.td, textAlign: 'center' }}>{c._count.userChallenges}</td>
                  <td style={{ ...styles.td, textAlign: 'center' }}>
                    <button
                      style={{
                        ...styles.toggleBtn,
                        background: c.isActive ? '#10b98122' : 'rgba(255,255,255,0.05)',
                        color: c.isActive ? '#10b981' : 'var(--color-muted)',
                        border: `1px solid ${c.isActive ? '#10b98144' : 'var(--color-border)'}`,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMutation.mutate(c.id);
                      }}
                    >
                      {c.isActive ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td style={styles.td} onClick={(e) => e.stopPropagation()}>
                    {confirmDelete === c.id ? (
                      <span style={{ display: 'flex', gap: 6 }}>
                        <button
                          style={{ ...styles.btnSmall, background: '#ef444422', color: '#ef4444' }}
                          onClick={() => handleDelete(c.id)}
                          disabled={deleteMutation.isPending}
                        >
                          Confirmar
                        </button>
                        <button
                          style={styles.btnSmall}
                          onClick={() => setConfirmDelete(null)}
                        >
                          Cancelar
                        </button>
                      </span>
                    ) : (
                      <button
                        style={{ ...styles.btnSmall, color: '#ef4444' }}
                        onClick={() => setConfirmDelete(c.id)}
                      >
                        Eliminar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {(challenges ?? []).length === 0 && (
                <tr>
                  <td colSpan={8} style={{ ...styles.td, textAlign: 'center', color: 'var(--color-muted)' }}>
                    No hay retos creados aún.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <ChallengeForm
          title="Nuevo reto"
          onSubmit={handleCreate}
          onCancel={() => setShowCreate(false)}
          isPending={createMutation.isPending}
        />
      )}

      {editing && (
        <ChallengeForm
          title="Editar reto"
          initial={editing}
          onSubmit={handleUpdate}
          onCancel={() => setEditing(null)}
          isPending={updateMutation.isPending}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 1100, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: '1.6rem', fontWeight: 700, color: 'var(--color-text)' },

  tableWrapper: { overflowX: 'auto' as const, borderRadius: 'var(--radius)', border: '1px solid var(--color-border)' },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  th: {
    textAlign: 'left' as const,
    padding: '12px 16px',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--color-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    background: 'var(--color-surface)',
    borderBottom: '1px solid var(--color-border)',
  },
  tr: {
    borderBottom: '1px solid var(--color-border)',
    cursor: 'pointer',
    transition: 'background 0.12s',
  },
  td: { padding: '12px 16px', fontSize: '0.9rem', color: 'var(--color-text)', verticalAlign: 'middle' as const },

  iconBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: 8,
    fontSize: '1.2rem',
  },
  challengeTitle: { fontWeight: 500 },
  typePill: {
    fontSize: '0.75rem',
    padding: '3px 10px',
    borderRadius: 20,
    background: 'rgba(99,102,241,0.12)',
    color: 'var(--color-primary)',
    fontWeight: 500,
    whiteSpace: 'nowrap' as const,
  },

  toggleBtn: {
    fontSize: '0.75rem',
    fontWeight: 600,
    padding: '4px 12px',
    borderRadius: 20,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  btnSmall: {
    padding: '4px 10px',
    fontSize: '0.8rem',
    borderRadius: 6,
    border: '1px solid var(--color-border)',
    background: 'transparent',
    color: 'var(--color-text)',
    cursor: 'pointer',
  },

  btnPrimary: {
    padding: '10px 20px',
    background: 'var(--color-primary)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.875rem',
    transition: 'opacity 0.15s',
  },
  btnSecondary: {
    padding: '10px 20px',
    background: 'transparent',
    color: 'var(--color-muted)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontWeight: 500,
    fontSize: '0.875rem',
  },

  empty: { color: 'var(--color-muted)', padding: '32px 0', textAlign: 'center' as const },

  // Modal
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 24,
  },
  modal: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius)',
    padding: 32,
    width: '100%',
    maxWidth: 560,
    maxHeight: '90vh',
    overflowY: 'auto' as const,
  },
  modalTitle: { fontSize: '1.25rem', fontWeight: 700, marginBottom: 24, color: 'var(--color-text)' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 },
  formGroup: { display: 'flex', flexDirection: 'column' as const, gap: 6, marginBottom: 16 },
  label: { fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.04em' },
  input: {
    padding: '10px 12px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--color-text)',
    fontSize: '0.9rem',
    width: '100%',
    boxSizing: 'border-box' as const,
    outline: 'none',
  },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
};
