import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Course } from '@vkbacademy/shared';
import {
  useAdminCourses,
  useCreateCourse,
  useGenerateCourse,
  useDeleteCourse,
  useUpdateCourse,
  useSchoolYears,
} from '../../hooks/useAdminCourses';

// ─── Tipos internos ──────────────────────────────────────────────────────────

const SUBJECTS = [
  'Ataque', 'Defensa', 'Tiro', 'Pase', 'Bote',
  'Rebote', 'Táctica', 'Preparación Física',
];

type Tab = 'manual' | 'ia';

interface NewCourseForm {
  title: string;
  description: string;
  schoolYearId: string;
  subject: string;
}

interface EditCourseForm {
  title: string;
  description: string;
  schoolYearId: string;
  subject: string;
  published: boolean;
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function AdminCoursesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterSchoolYearId, setFilterSchoolYearId] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Modales
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Formularios
  const [newTab, setNewTab] = useState<Tab>('manual');
  const [newForm, setNewForm] = useState<NewCourseForm>({ title: '', description: '', schoolYearId: '', subject: '' });
  const [iaName, setIaName] = useState('');
  const [iaSchoolYearId, setIaSchoolYearId] = useState('');
  const [editForm, setEditForm] = useState<EditCourseForm>({
    title: '',
    description: '',
    schoolYearId: '',
    subject: '',
    published: false,
  });

  const navigate = useNavigate();

  // Toast
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  // Queries y mutaciones
  const { data, isLoading } = useAdminCourses(page, {
    search: search || undefined,
    schoolYearId: filterSchoolYearId || undefined,
  });
  const { data: schoolYears = [] } = useSchoolYears();
  const createMutation = useCreateCourse();
  const generateMutation = useGenerateCourse();
  const deleteMutation = useDeleteCourse();
  const updateMutation = useUpdateCourse();

  // ── Helpers de toast ────────────────────────────────────────────────────
  function showToast(msg: string, type: 'ok' | 'err' = 'ok') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  // ── Handlers búsqueda/filtro ─────────────────────────────────────────────
  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  function handleFilterChange(val: string) {
    setFilterSchoolYearId(val);
    setPage(1);
  }

  // ── Handler crear manual ─────────────────────────────────────────────────
  async function handleCreateManual(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createMutation.mutateAsync({
        title: newForm.title,
        description: newForm.description || undefined,
        schoolYearId: newForm.schoolYearId || undefined,
        subject: newForm.subject || undefined,
      });
      setShowNewModal(false);
      setNewForm({ title: '', description: '', schoolYearId: '', subject: '' });
      showToast('Curso creado correctamente');
    } catch {
      showToast('Error al crear el curso', 'err');
    }
  }

  // ── Handler generar con IA ───────────────────────────────────────────────
  async function handleGenerateIA(e: React.FormEvent) {
    e.preventDefault();
    if (!iaName.trim() || !iaSchoolYearId) return;
    try {
      await generateMutation.mutateAsync({ name: iaName, schoolYearId: iaSchoolYearId });
      setShowNewModal(false);
      setIaName('');
      setIaSchoolYearId('');
      showToast('Curso generado y guardado correctamente');
    } catch {
      showToast('El agente IA no pudo generar el curso', 'err');
    }
  }

  // ── Handler editar ───────────────────────────────────────────────────────
  function openEdit(course: Course) {
    setEditForm({
      title: course.title,
      description: course.description ?? '',
      schoolYearId: course.schoolYearId ?? '',
      subject: course.subject ?? '',
      published: course.published,
    });
    setEditingCourse(course);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingCourse) return;
    try {
      await updateMutation.mutateAsync({
        id: editingCourse.id,
        payload: {
          title: editForm.title,
          description: editForm.description || undefined,
          schoolYearId: editForm.schoolYearId || null,
          subject: editForm.subject || undefined,
          published: editForm.published,
        },
      });
      setEditingCourse(null);
      showToast('Curso actualizado correctamente');
    } catch {
      showToast('Error al actualizar el curso', 'err');
    }
  }

  // ── Handler borrar ───────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    try {
      await deleteMutation.mutateAsync(id);
      setDeletingId(null);
      showToast('Curso eliminado');
    } catch {
      showToast('Error al eliminar el curso', 'err');
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={s.page}>
      {/* Toast */}
      {toast && (
        <div style={{ ...s.toast, background: toast.type === 'ok' ? 'var(--color-primary)' : 'var(--color-error)' }}>
          {toast.msg}
        </div>
      )}

      {/* Cabecera */}
      <div style={s.header}>
        <h1 style={s.title}>Gestión de Cursos</h1>
        <button style={s.btnPrimary} onClick={() => setShowNewModal(true)}>
          + Nuevo curso
        </button>
      </div>

      {/* Filtros */}
      <div style={s.filters}>
        <form onSubmit={handleSearch} style={s.searchForm}>
          <input
            style={s.input}
            placeholder="Buscar por título..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <button type="submit" style={s.btnSecondary}>Buscar</button>
        </form>
        <select
          style={s.select}
          value={filterSchoolYearId}
          onChange={(e) => handleFilterChange(e.target.value)}
        >
          <option value="">Todos los niveles</option>
          {schoolYears.map((sy) => (
            <option key={sy.id} value={sy.id}>{sy.label}</option>
          ))}
        </select>
      </div>

      {/* Tabla */}
      <div style={s.tableWrapper}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Título</th>
              <th style={s.th}>Nivel</th>
              <th style={s.th}>Asignatura</th>
              <th style={s.th}>Módulos</th>
              <th style={s.th}>Alumnos</th>
              <th style={s.th}>Estado</th>
              <th style={s.th}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} style={s.tdCenter}>Cargando...</td>
              </tr>
            ) : !data?.data.length ? (
              <tr>
                <td colSpan={7} style={s.tdCenter}>No hay cursos.</td>
              </tr>
            ) : (
              data.data.map((course) => (
                <tr key={course.id} style={s.tr}>
                  <td style={s.td}>{course.title}</td>
                  <td style={s.td}>{course.schoolYear?.label ?? '—'}</td>
                  <td style={s.td}>{course.subject ?? '—'}</td>
                  <td style={s.td}>
                    {(course as unknown as { _count?: { modules?: number } })._count?.modules ?? 0}
                  </td>
                  <td style={s.td}>
                    {(course as unknown as { studentCount?: number }).studentCount ?? 0}
                  </td>
                  <td style={s.td}>
                    <span style={course.published ? s.badgeOk : s.badgeDraft}>
                      {course.published ? 'Publicado' : 'Borrador'}
                    </span>
                  </td>
                  <td style={s.td}>
                    <button style={s.btnIcon} onClick={() => navigate(`/admin/courses/${course.id}`)} title="Gestionar contenido">📋</button>
                    <button style={s.btnIcon} onClick={() => openEdit(course)} title="Editar">✏️</button>
                    {deletingId === course.id ? (
                      <span style={s.confirmDelete}>
                        ¿Seguro?{' '}
                        <button style={s.btnDangerSm} onClick={() => void handleDelete(course.id)} disabled={deleteMutation.isPending}>
                          Sí
                        </button>{' '}
                        <button style={s.btnSecondarySmall} onClick={() => setDeletingId(null)}>No</button>
                      </span>
                    ) : (
                      <button style={s.btnIcon} onClick={() => setDeletingId(course.id)} title="Eliminar">🗑️</button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {data && data.totalPages > 1 && (
        <div style={s.pagination}>
          <button style={s.btnSecondary} disabled={page === 1} onClick={() => setPage(page - 1)}>
            ‹ Anterior
          </button>
          <span style={s.pageInfo}>Página {page} de {data.totalPages}</span>
          <button style={s.btnSecondary} disabled={page === data.totalPages} onClick={() => setPage(page + 1)}>
            Siguiente ›
          </button>
        </div>
      )}

      {/* Modal Nuevo */}
      {showNewModal && (
        <div style={s.overlay} onClick={() => setShowNewModal(false)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>Nuevo curso</h2>
              <button style={s.closeBtn} onClick={() => setShowNewModal(false)}>✕</button>
            </div>

            {/* Tabs */}
            <div style={s.tabs}>
              <button
                style={{ ...s.tab, ...(newTab === 'manual' ? s.tabActive : {}) }}
                onClick={() => setNewTab('manual')}
              >
                Manual
              </button>
              <button
                style={{ ...s.tab, ...(newTab === 'ia' ? s.tabActive : {}) }}
                onClick={() => setNewTab('ia')}
              >
                Generar con IA
              </button>
            </div>

            {newTab === 'manual' ? (
              <form onSubmit={(e) => void handleCreateManual(e)} style={s.form}>
                <label style={s.label}>Título</label>
                <input
                  required
                  minLength={3}
                  style={s.input}
                  value={newForm.title}
                  onChange={(e) => setNewForm({ ...newForm, title: e.target.value })}
                />
                <label style={s.label}>Descripción</label>
                <textarea
                  style={{ ...s.input, height: 80, resize: 'vertical' }}
                  value={newForm.description}
                  onChange={(e) => setNewForm({ ...newForm, description: e.target.value })}
                />
                <label style={s.label}>Nivel educativo</label>
                <select
                  style={s.select}
                  value={newForm.schoolYearId}
                  onChange={(e) => setNewForm({ ...newForm, schoolYearId: e.target.value })}
                >
                  <option value="">Sin nivel</option>
                  {schoolYears.map((sy) => (
                    <option key={sy.id} value={sy.id}>{sy.label}</option>
                  ))}
                </select>
                <label style={s.label}>Asignatura</label>
                <input
                  list="subjects-datalist"
                  style={s.input}
                  placeholder="Selecciona o escribe una asignatura..."
                  value={newForm.subject}
                  onChange={(e) => setNewForm({ ...newForm, subject: e.target.value })}
                />
                <button
                  type="submit"
                  style={{ ...s.btnPrimary, marginTop: 16, width: '100%' }}
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? 'Creando...' : 'Crear curso'}
                </button>
              </form>
            ) : (
              <form onSubmit={(e) => void handleGenerateIA(e)} style={s.form}>
                <label style={s.label}>Nombre del curso</label>
                <input
                  required
                  style={s.input}
                  placeholder="Ej: Matemáticas, Historia del Arte..."
                  value={iaName}
                  onChange={(e) => setIaName(e.target.value)}
                />
                <label style={s.label}>Nivel educativo</label>
                <select
                  required
                  style={s.select}
                  value={iaSchoolYearId}
                  onChange={(e) => setIaSchoolYearId(e.target.value)}
                >
                  <option value="">Selecciona un nivel</option>
                  {schoolYears.map((sy) => (
                    <option key={sy.id} value={sy.id}>{sy.label}</option>
                  ))}
                </select>
                <button
                  type="submit"
                  style={{ ...s.btnPrimary, marginTop: 16, width: '100%' }}
                  disabled={generateMutation.isPending}
                >
                  {generateMutation.isPending ? 'El agente está creando el curso...' : 'Generar con IA'}
                </button>
                {generateMutation.isPending && (
                  <p style={s.hint}>Esto puede tardar unos segundos.</p>
                )}
              </form>
            )}
          </div>
        </div>
      )}

      {/* Datalist de asignaturas (compartido por ambos formularios) */}
      <datalist id="subjects-datalist">
        {SUBJECTS.map((subj) => (
          <option key={subj} value={subj} />
        ))}
      </datalist>

      {/* Modal Editar */}
      {editingCourse && (
        <div style={s.overlay} onClick={() => setEditingCourse(null)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>Editar curso</h2>
              <button style={s.closeBtn} onClick={() => setEditingCourse(null)}>✕</button>
            </div>
            <form onSubmit={(e) => void handleEdit(e)} style={s.form}>
              <label style={s.label}>Título</label>
              <input
                required
                minLength={3}
                style={s.input}
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              />
              <label style={s.label}>Descripción</label>
              <textarea
                style={{ ...s.input, height: 80, resize: 'vertical' }}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              />
              <label style={s.label}>Nivel educativo</label>
              <select
                style={s.select}
                value={editForm.schoolYearId}
                onChange={(e) => setEditForm({ ...editForm, schoolYearId: e.target.value })}
              >
                <option value="">Sin nivel</option>
                {schoolYears.map((sy) => (
                  <option key={sy.id} value={sy.id}>{sy.label}</option>
                ))}
              </select>
              <label style={s.label}>Asignatura</label>
              <input
                list="subjects-datalist"
                style={s.input}
                placeholder="Selecciona o escribe una asignatura..."
                value={editForm.subject}
                onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
              />
              <label style={{ ...s.label, display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                <input
                  type="checkbox"
                  checked={editForm.published}
                  onChange={(e) => setEditForm({ ...editForm, published: e.target.checked })}
                />
                Publicado
              </label>
              <button
                type="submit"
                style={{ ...s.btnPrimary, marginTop: 16, width: '100%' }}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Estilos ─────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page: { padding: '2rem', position: 'relative' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' },
  title: { fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text)' },
  filters: { display: 'flex', gap: 12, marginBottom: '1.25rem', flexWrap: 'wrap' },
  searchForm: { display: 'flex', gap: 8, flex: 1, minWidth: 240 },

  tableWrapper: { overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 8 },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left',
    padding: '10px 14px',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--color-text-muted)',
    background: 'var(--color-surface)',
    borderBottom: '1px solid var(--color-border)',
  },
  tr: { borderBottom: '1px solid var(--color-border)' },
  td: { padding: '12px 14px', fontSize: '0.9rem', color: 'var(--color-text)', verticalAlign: 'middle' },
  tdCenter: { padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' },

  badgeOk: {
    display: 'inline-block', fontSize: '0.72rem', fontWeight: 600,
    padding: '2px 8px', borderRadius: 999,
    background: '#d1fae5', color: '#065f46',
  },
  badgeDraft: {
    display: 'inline-block', fontSize: '0.72rem', fontWeight: 600,
    padding: '2px 8px', borderRadius: 999,
    background: 'var(--color-border)', color: 'var(--color-text-muted)',
  },

  pagination: { display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', marginTop: 20 },
  pageInfo: { fontSize: '0.875rem', color: 'var(--color-text-muted)' },

  // Botones
  btnPrimary: {
    background: 'var(--color-primary)', color: '#fff',
    border: 'none', borderRadius: 6, padding: '8px 16px',
    fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
  },
  btnSecondary: {
    background: 'var(--color-surface)', color: 'var(--color-text)',
    border: '1px solid var(--color-border)', borderRadius: 6, padding: '8px 14px',
    fontWeight: 500, fontSize: '0.875rem', cursor: 'pointer',
  },
  btnSecondarySmall: {
    background: 'var(--color-surface)', color: 'var(--color-text)',
    border: '1px solid var(--color-border)', borderRadius: 4, padding: '2px 8px',
    fontWeight: 500, fontSize: '0.78rem', cursor: 'pointer',
  },
  btnDangerSm: {
    background: 'var(--color-error)', color: '#fff',
    border: 'none', borderRadius: 4, padding: '2px 8px',
    fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer',
  },
  btnIcon: {
    background: 'transparent', border: 'none', cursor: 'pointer',
    fontSize: '1rem', padding: '2px 4px', borderRadius: 4,
  },
  confirmDelete: { fontSize: '0.82rem', color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 },

  // Input / select
  input: {
    width: '100%', boxSizing: 'border-box',
    padding: '8px 12px', borderRadius: 6,
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)', color: 'var(--color-text)',
    fontSize: '0.9rem',
  },
  select: {
    padding: '8px 12px', borderRadius: 6,
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)', color: 'var(--color-text)',
    fontSize: '0.9rem', cursor: 'pointer',
  },

  // Modal
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 100,
  },
  modal: {
    background: 'var(--color-surface)',
    borderRadius: 12, padding: 28,
    width: '100%', maxWidth: 480,
    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
  },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text)' },
  closeBtn: { background: 'transparent', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: 'var(--color-text-muted)' },

  // Tabs
  tabs: { display: 'flex', gap: 4, marginBottom: 20, background: 'var(--color-border)', borderRadius: 6, padding: 3 },
  tab: {
    flex: 1, padding: '6px 0', borderRadius: 5,
    border: 'none', background: 'transparent',
    color: 'var(--color-text-muted)', fontWeight: 500,
    cursor: 'pointer', fontSize: '0.875rem',
  },
  tabActive: { background: 'var(--color-surface)', color: 'var(--color-text)', fontWeight: 600 },

  // Formulario
  form: { display: 'flex', flexDirection: 'column', gap: 8 },
  label: { fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-muted)' },
  hint: { fontSize: '0.8rem', color: 'var(--color-text-muted)', textAlign: 'center', marginTop: 8 },

  // Toast
  toast: {
    position: 'fixed', bottom: 24, right: 24,
    color: '#fff', padding: '10px 20px',
    borderRadius: 8, fontWeight: 600, fontSize: '0.9rem',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 200,
  },
};
