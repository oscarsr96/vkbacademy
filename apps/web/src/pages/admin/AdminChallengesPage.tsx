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

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '1.5rem',
  };

  const modalStyle: React.CSSProperties = {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    padding: '2rem',
    width: '100%',
    maxWidth: 560,
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: 'var(--shadow-card)',
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--color-text)' }}>
          {title}
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', marginBottom: '0.5rem' }}>
          <div className="field">
            <label>Título</label>
            <input
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Nombre del reto"
            />
          </div>
          <div className="field">
            <label>Icono badge</label>
            <input
              style={{ width: 80 }}
              value={form.badgeIcon}
              onChange={(e) => set('badgeIcon', e.target.value)}
              placeholder="🏅"
            />
          </div>
        </div>

        <div className="field">
          <label>Descripción</label>
          <textarea
            style={{ height: 72, resize: 'vertical' }}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Descripción del reto..."
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="field">
            <label>Tipo de reto</label>
            <select
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

          <div className="field">
            <label>Objetivo</label>
            <input
              type="number"
              min={1}
              value={form.target}
              onChange={(e) => set('target', parseInt(e.target.value, 10) || 1)}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="field">
            <label>Puntos al completar</label>
            <input
              type="number"
              min={1}
              value={form.points}
              onChange={(e) => set('points', parseInt(e.target.value, 10) || 1)}
            />
          </div>

          <div className="field">
            <label>Color badge</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="color"
                value={form.badgeColor}
                onChange={(e) => set('badgeColor', e.target.value)}
                style={{ width: 40, height: 36, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 0, flexShrink: 0 }}
              />
              <input
                style={{ flex: 1 }}
                value={form.badgeColor}
                onChange={(e) => set('badgeColor', e.target.value)}
                placeholder="#6366f1"
              />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
          <button className="btn btn-ghost" onClick={onCancel} disabled={isPending}>
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            onClick={() => onSubmit(form)}
            disabled={isPending || !form.title || !form.description}
          >
            {isPending ? 'Guardando...' : 'Guardar reto'}
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

  const list = challenges ?? [];
  const activeCount = list.filter((c) => c.isActive).length;

  const thStyle: React.CSSProperties = {
    textAlign: 'left',
    padding: '0.75rem 1rem',
    fontSize: '0.75rem',
    fontWeight: 700,
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    borderBottom: '1px solid var(--color-border)',
    background: 'var(--color-bg)',
  };

  const tdStyle: React.CSSProperties = {
    padding: '0.875rem 1rem',
    fontSize: '0.875rem',
    color: 'var(--color-text)',
    verticalAlign: 'middle',
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem' }}>

      {/* Hero */}
      <div className="page-hero animate-in">
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="hero-title">Gestión de Retos</h1>
            <p className="hero-subtitle">
              {list.length} retos · {activeCount} activos
            </p>
          </div>
          <button className="btn btn-dark" onClick={() => setShowCreate(true)}>
            + Nuevo reto
          </button>
        </div>
      </div>

      {/* Tabla */}
      {isLoading && (
        <p style={{ color: 'var(--color-text-muted)', padding: '2rem 0', textAlign: 'center' }}>
          Cargando retos...
        </p>
      )}

      {!isLoading && (
        <div className="table-wrap">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Icono</th>
                <th style={thStyle}>Título</th>
                <th style={thStyle}>Tipo</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Objetivo</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Puntos</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Completados</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Estado</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr
                  key={c.id}
                  style={{ borderBottom: '1px solid var(--color-border)', cursor: 'pointer', transition: 'background 0.12s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  onClick={() => setEditing(c)}
                >
                  {/* Icono badge */}
                  <td style={tdStyle}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        fontSize: '1.2rem',
                        background: c.badgeColor + '22',
                        border: `1px solid ${c.badgeColor}44`,
                      }}
                    >
                      {c.badgeIcon}
                    </span>
                  </td>

                  {/* Título */}
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 500 }}>{c.title}</span>
                  </td>

                  {/* Tipo */}
                  <td style={tdStyle}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        padding: '3px 10px',
                        borderRadius: 20,
                        background: 'rgba(234,88,12,0.08)',
                        color: 'var(--color-primary)',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {CHALLENGE_TYPE_LABELS[c.type]}
                    </span>
                  </td>

                  {/* Objetivo */}
                  <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600 }}>{c.target}</td>

                  {/* Puntos */}
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <span style={{ color: '#f59e0b', fontWeight: 700 }}>+{c.points}</span>
                  </td>

                  {/* Completados */}
                  <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    {c._count.userChallenges}
                  </td>

                  {/* Estado toggle */}
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <button
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '4px 14px',
                        borderRadius: 20,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        background: c.isActive ? 'rgba(234,88,12,0.1)' : 'rgba(255,255,255,0.04)',
                        color: c.isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                        border: `1px solid ${c.isActive ? 'rgba(234,88,12,0.3)' : 'var(--color-border)'}`,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMutation.mutate(c.id);
                      }}
                    >
                      {c.isActive ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>

                  {/* Acciones */}
                  <td
                    style={{ ...tdStyle, textAlign: 'right' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {confirmDelete === c.id ? (
                      <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          className="btn"
                          style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem', background: 'rgba(220,38,38,0.1)', color: 'var(--color-error)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
                          onClick={() => handleDelete(c.id)}
                          disabled={deleteMutation.isPending}
                        >
                          Confirmar
                        </button>
                        <button
                          className="btn btn-ghost"
                          style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem' }}
                          onClick={() => setConfirmDelete(null)}
                        >
                          Cancelar
                        </button>
                      </span>
                    ) : (
                      <button
                        className="btn btn-ghost"
                        style={{ padding: '0.3rem 0.65rem', fontSize: '0.8rem', color: 'var(--color-error)' }}
                        onClick={() => setConfirmDelete(c.id)}
                      >
                        Eliminar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    style={{ ...tdStyle, textAlign: 'center', color: 'var(--color-text-muted)', padding: '3rem' }}
                  >
                    No hay retos creados aún.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Crear */}
      {showCreate && (
        <ChallengeForm
          title="Nuevo reto"
          onSubmit={handleCreate}
          onCancel={() => setShowCreate(false)}
          isPending={createMutation.isPending}
        />
      )}

      {/* Modal: Editar */}
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
