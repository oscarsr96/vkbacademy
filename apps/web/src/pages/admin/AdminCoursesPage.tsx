import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Course } from '@vkbacademy/shared';
import {
  useAdminCourses,
  useCreateCourse,
  useGenerateCourse,
  useDeleteCourse,
  useUpdateCourse,
  useImportCourse,
  useSchoolYears,
} from '../../hooks/useAdminCourses';

// ─── Tipos internos ──────────────────────────────────────────────────────────

const SUBJECTS = [
  'Ataque', 'Defensa', 'Tiro', 'Pase', 'Bote',
  'Rebote', 'Táctica', 'Preparación Física',
];

type Tab = 'manual' | 'ia' | 'import';

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

  // Estado importación JSON
  const [importJson, setImportJson] = useState('');
  const [importError, setImportError] = useState('');
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
  const importMutation = useImportCourse();
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

  // ── Handler importar JSON ────────────────────────────────────────────────
  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    setImportError('');
    let parsed: unknown;
    try {
      parsed = JSON.parse(importJson);
    } catch {
      setImportError('El JSON no es válido. Revisa la sintaxis.');
      return;
    }
    try {
      const result = await importMutation.mutateAsync(parsed);
      setShowNewModal(false);
      setImportJson('');
      showToast(result.message);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setImportError(msg ?? 'Error al importar el curso');
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImportJson((ev.target?.result as string) ?? '');
      setImportError('');
    };
    reader.readAsText(file);
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

      {/* Hero */}
      <div className="page-hero animate-in" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' as const }}>
          <div>
            <h1 className="hero-title">Gestión de Cursos</h1>
            <p className="hero-subtitle">
              {data ? `${data.total} curso${data.total !== 1 ? 's' : ''} en total` : 'Cargando…'}
            </p>
          </div>
          <button className="btn btn-primary" style={{ flexShrink: 0, marginTop: 4 }} onClick={() => setShowNewModal(true)}>
            + Nuevo curso
          </button>
        </div>
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
          <button type="submit" className="btn btn-ghost" style={{ padding: '8px 16px', fontSize: '0.875rem' }}>Buscar</button>
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
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Título</th>
              <th>Nivel</th>
              <th>Asignatura</th>
              <th>Módulos</th>
              <th>Alumnos</th>
              <th>Estado</th>
              <th>Acciones</th>
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
                <tr key={course.id}>
                  <td style={{ fontWeight: 600 }}>{course.title}</td>
                  <td>{course.schoolYear?.label ?? '—'}</td>
                  <td>{course.subject ?? '—'}</td>
                  <td style={{ textAlign: 'center' as const }}>
                    {(course as unknown as { _count?: { modules?: number } })._count?.modules ?? 0}
                  </td>
                  <td style={{ textAlign: 'center' as const }}>
                    {(course as unknown as { studentCount?: number }).studentCount ?? 0}
                  </td>
                  <td>
                    <span style={course.published ? s.badgeOk : s.badgeDraft}>
                      {course.published ? 'Publicado' : 'Borrador'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <button style={s.btnIcon} onClick={() => navigate(`/admin/courses/${course.id}`)} title="Gestionar contenido">📋</button>
                      <button style={s.btnIcon} onClick={() => openEdit(course)} title="Editar">✏️</button>
                      {deletingId === course.id ? (
                        <span style={s.confirmDelete}>
                          ¿Seguro?{' '}
                          <button style={s.btnDangerSm} onClick={() => void handleDelete(course.id)} disabled={deleteMutation.isPending}>
                            Sí
                          </button>{' '}
                          <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: '0.78rem' }} onClick={() => setDeletingId(null)}>No</button>
                        </span>
                      ) : (
                        <button style={s.btnIcon} onClick={() => setDeletingId(course.id)} title="Eliminar">🗑️</button>
                      )}
                    </div>
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
          <button className="btn btn-ghost" style={{ padding: '7px 14px', fontSize: '0.875rem' }} disabled={page === 1} onClick={() => setPage(page - 1)}>
            Anterior
          </button>
          <span style={s.pageInfo}>Página {page} de {data.totalPages}</span>
          <button className="btn btn-ghost" style={{ padding: '7px 14px', fontSize: '0.875rem' }} disabled={page === data.totalPages} onClick={() => setPage(page + 1)}>
            Siguiente
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
              <button
                style={{ ...s.tab, ...(newTab === 'import' ? s.tabActive : {}) }}
                onClick={() => { setNewTab('import'); setImportError(''); }}
              >
                ⬆️ Importar JSON
              </button>
            </div>

            {newTab === 'manual' ? (
              <form onSubmit={(e) => void handleCreateManual(e)} style={s.form}>
                <div className="field">
                  <label>Título</label>
                  <input
                    required
                    minLength={3}
                    value={newForm.title}
                    onChange={(e) => setNewForm({ ...newForm, title: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Descripción</label>
                  <textarea
                    style={{ height: 80, resize: 'vertical' as const }}
                    value={newForm.description}
                    onChange={(e) => setNewForm({ ...newForm, description: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Nivel educativo</label>
                  <select
                    value={newForm.schoolYearId}
                    onChange={(e) => setNewForm({ ...newForm, schoolYearId: e.target.value })}
                  >
                    <option value="">Sin nivel</option>
                    {schoolYears.map((sy) => (
                      <option key={sy.id} value={sy.id}>{sy.label}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Asignatura</label>
                  <input
                    list="subjects-datalist"
                    placeholder="Selecciona o escribe una asignatura..."
                    value={newForm.subject}
                    onChange={(e) => setNewForm({ ...newForm, subject: e.target.value })}
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary btn-full"
                  style={{ marginTop: 16 }}
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? 'Creando...' : 'Crear curso'}
                </button>
              </form>
            ) : newTab === 'ia' ? (
              <form onSubmit={(e) => void handleGenerateIA(e)} style={s.form}>
                <div className="field">
                  <label>Nombre del curso</label>
                  <input
                    required
                    placeholder="Ej: Matemáticas, Historia del Arte..."
                    value={iaName}
                    onChange={(e) => setIaName(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Nivel educativo</label>
                  <select
                    required
                    value={iaSchoolYearId}
                    onChange={(e) => setIaSchoolYearId(e.target.value)}
                  >
                    <option value="">Selecciona un nivel</option>
                    {schoolYears.map((sy) => (
                      <option key={sy.id} value={sy.id}>{sy.label}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  className="btn btn-primary btn-full"
                  style={{ marginTop: 16 }}
                  disabled={generateMutation.isPending}
                >
                  {generateMutation.isPending ? 'El agente está creando el curso...' : 'Generar con IA'}
                </button>
                {generateMutation.isPending && (
                  <p style={s.hint}>Esto puede tardar unos segundos.</p>
                )}
              </form>
            ) : (
              /* ── Tab: Importar JSON ── */
              <form onSubmit={(e) => void handleImport(e)} style={s.form}>
                <p style={s.hint}>
                  Sube un archivo <code>.json</code> generado con Claude o pégalo directamente.{' '}
                  <a href="#" style={{ color: 'var(--color-primary)' }} onClick={(e) => { e.preventDefault(); setImportJson(EXAMPLE_JSON); setImportError(''); }}>
                    Ver ejemplo
                  </a>
                </p>

                {/* Selector de archivo */}
                <div style={s.fileZone}>
                  <label style={s.fileLabel}>
                    <input
                      type="file"
                      accept=".json,application/json"
                      style={{ display: 'none' }}
                      onChange={handleFileUpload}
                    />
                    <span style={s.fileBtn}>📂 Seleccionar archivo .json</span>
                  </label>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>o pega el JSON abajo</span>
                </div>

                {/* Textarea JSON */}
                <div className="field">
                  <label>JSON del curso</label>
                  <textarea
                    required
                    style={{ height: 180, resize: 'vertical' as const, fontFamily: 'monospace', fontSize: '0.8rem' }}
                    placeholder={'{\n  "name": "...",\n  "schoolYear": "1eso",\n  "modules": [...]\n}'}
                    value={importJson}
                    onChange={(e) => { setImportJson(e.target.value); setImportError(''); }}
                  />
                </div>

                {/* Error de validación */}
                {importError && (
                  <div style={s.importError}>{importError}</div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary btn-full"
                  style={{ marginTop: 4 }}
                  disabled={importMutation.isPending || !importJson.trim()}
                >
                  {importMutation.isPending ? 'Importando...' : 'Importar curso'}
                </button>
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
              <div className="field">
                <label>Título</label>
                <input
                  required
                  minLength={3}
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Descripción</label>
                <textarea
                  style={{ height: 80, resize: 'vertical' as const }}
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Nivel educativo</label>
                <select
                  value={editForm.schoolYearId}
                  onChange={(e) => setEditForm({ ...editForm, schoolYearId: e.target.value })}
                >
                  <option value="">Sin nivel</option>
                  {schoolYears.map((sy) => (
                    <option key={sy.id} value={sy.id}>{sy.label}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Asignatura</label>
                <input
                  list="subjects-datalist"
                  placeholder="Selecciona o escribe una asignatura..."
                  value={editForm.subject}
                  onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: '0.875rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={editForm.published}
                  onChange={(e) => setEditForm({ ...editForm, published: e.target.checked })}
                />
                Publicado
              </label>
              <button
                type="submit"
                className="btn btn-primary btn-full"
                style={{ marginTop: 16 }}
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
  page: { padding: '2rem', position: 'relative', maxWidth: 1100, margin: '0 auto' },
  filters: { display: 'flex', gap: 12, marginBottom: '1.25rem', flexWrap: 'wrap' as const },
  searchForm: { display: 'flex', gap: 8, flex: 1, minWidth: 240 },
  input: {
    flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)', color: 'var(--color-text)',
    fontSize: '0.9rem',
  },
  select: {
    padding: '8px 12px', borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)', color: 'var(--color-text)',
    fontSize: '0.9rem', cursor: 'pointer',
  },
  tdCenter: { padding: '2rem', textAlign: 'center' as const, color: 'var(--color-text-muted)' },

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

  btnDangerSm: {
    background: '#fef2f2', color: '#ef4444',
    border: '1px solid #fecaca', borderRadius: 6, padding: '2px 8px',
    fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer',
  },
  btnIcon: {
    background: 'transparent', border: 'none', cursor: 'pointer',
    fontSize: '1rem', padding: '2px 4px', borderRadius: 4,
  },
  confirmDelete: { fontSize: '0.82rem', color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 },

  // Modal
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 100,
  },
  modal: {
    background: 'var(--color-surface)',
    borderRadius: 'var(--radius-md)', padding: 28,
    width: '100%', maxWidth: 480,
    boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
    border: '1.5px solid var(--color-border)',
  },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 },
  closeBtn: { background: 'transparent', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: 'var(--color-text-muted)' },

  // Tabs
  tabs: { display: 'flex', gap: 4, marginBottom: 20, background: 'var(--color-border)', borderRadius: 8, padding: 3 },
  tab: {
    flex: 1, padding: '7px 0', borderRadius: 6,
    border: 'none', background: 'transparent',
    color: 'var(--color-text-muted)', fontWeight: 500,
    cursor: 'pointer', fontSize: '0.875rem',
  },
  tabActive: { background: 'var(--color-surface)', color: 'var(--color-text)', fontWeight: 600, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },

  // Formulario
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  hint: { fontSize: '0.8rem', color: 'var(--color-text-muted)', textAlign: 'center' as const, marginTop: 8 },

  // Toast
  toast: {
    position: 'fixed', bottom: 24, right: 24,
    color: '#fff', padding: '10px 20px',
    borderRadius: 8, fontWeight: 600, fontSize: '0.9rem',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 200,
  },

  // Importación
  fileZone: {
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
    gap: 6, padding: '14px 16px',
    border: '2px dashed var(--color-border)', borderRadius: 10,
    background: 'rgba(234,88,12,0.03)',
    cursor: 'pointer',
  },
  fileLabel: { cursor: 'pointer' },
  fileBtn: {
    display: 'inline-block', padding: '7px 16px',
    background: 'rgba(234,88,12,0.08)',
    border: '1px solid rgba(234,88,12,0.25)',
    borderRadius: 8, color: 'var(--color-primary)',
    fontWeight: 600, fontSize: '0.875rem',
    cursor: 'pointer',
  },
  importError: {
    background: 'rgba(220,38,38,0.08)',
    border: '1px solid rgba(220,38,38,0.25)',
    color: '#dc2626', borderRadius: 8,
    padding: '10px 14px', fontSize: '0.875rem',
  },
};

// ─── JSON de ejemplo (enlace "Ver ejemplo") ───────────────────────────────────

const EXAMPLE_JSON = JSON.stringify({
  name: "Fundamentos del Baloncesto",
  schoolYear: "1eso",
  modules: [
    {
      title: "Introducción al juego",
      order: 1,
      lessons: [
        {
          title: "Historia y reglas básicas",
          type: "VIDEO",
          order: 1,
          youtubeId: "dQw4w9WgXcQ"
        },
        {
          title: "¿Cuántos jugadores hay en cancha?",
          type: "FILL_BLANK",
          order: 2,
          content: {
            template: "Cada equipo tiene {{5}} jugadores en cancha. El partido se divide en {{4}} cuartos.",
            distractors: ["3", "6", "2", "8"]
          }
        },
        {
          title: "Test del módulo",
          type: "QUIZ",
          order: 3,
          quiz: {
            questions: [
              {
                text: "¿Cuántos jugadores hay por equipo en cancha?",
                answers: [
                  { text: "5", isCorrect: true },
                  { text: "6", isCorrect: false },
                  { text: "4", isCorrect: false },
                  { text: "7", isCorrect: false }
                ]
              }
            ]
          }
        }
      ],
      examQuestions: [
        {
          text: "¿Cuántos cuartos tiene un partido de baloncesto?",
          answers: [
            { text: "4", isCorrect: true },
            { text: "2", isCorrect: false },
            { text: "3", isCorrect: false },
            { text: "5", isCorrect: false }
          ]
        }
      ]
    }
  ]
}, null, 2);
