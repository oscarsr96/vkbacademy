import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, type AdminUser, type CreateUserPayload, type UpdateUserPayload } from '../../api/admin.api';
import { Role } from '@vkbacademy/shared';
import type { Course } from '@vkbacademy/shared';

const ROLE_LABELS: Record<Role, string> = {
  [Role.STUDENT]: 'Alumno',
  [Role.TUTOR]: 'Tutor',
  [Role.TEACHER]: 'Profesor',
  [Role.ADMIN]: 'Admin',
};

const ROLE_COLORS: Record<Role, string> = {
  [Role.STUDENT]: '#6366f1',
  [Role.TUTOR]: '#f59e0b',
  [Role.TEACHER]: '#10b981',
  [Role.ADMIN]: '#ef4444',
};

const ALL_ROLES = Object.values(Role);

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------

export default function AdminUsersPage() {
  const qc = useQueryClient();

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: adminApi.getUsers,
  });

  const { data: schoolYears } = useQuery({
    queryKey: ['school-years'],
    queryFn: adminApi.listSchoolYears,
  });

  const updateRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Role }) =>
      adminApi.updateRole(userId, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  const assignTutor = useMutation({
    mutationFn: ({ studentId, tutorId }: { studentId: string; tutorId: string | null }) =>
      adminApi.assignTutor(studentId, tutorId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  const createUser = useMutation({
    mutationFn: (payload: CreateUserPayload) => adminApi.createUser(payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'users'] }); setShowCreate(false); },
  });

  const updateUser = useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: UpdateUserPayload }) =>
      adminApi.updateUser(userId, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'users'] }); setEditTarget(null); },
  });

  const deleteUser = useMutation({
    mutationFn: (userId: string) => adminApi.deleteUser(userId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'users'] }); setDeleteId(null); },
  });

  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<Role | ''>('');
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [enrollmentTarget, setEnrollmentTarget] = useState<AdminUser | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleRoleChange(userId: string, role: Role) {
    try {
      await updateRole.mutateAsync({ userId, role });
      showToast('Rol actualizado', true);
    } catch { showToast('Error al cambiar el rol', false); }
  }

  async function handleTutorChange(studentId: string, tutorId: string) {
    try {
      await assignTutor.mutateAsync({ studentId, tutorId: tutorId || null });
      showToast('Tutor actualizado', true);
    } catch { showToast('Error al asignar el tutor', false); }
  }

  async function handleCreate(payload: CreateUserPayload) {
    try {
      await createUser.mutateAsync(payload);
      showToast('Usuario creado', true);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      showToast(err?.response?.data?.message ?? 'Error al crear el usuario', false);
    }
  }

  async function handleUpdate(userId: string, payload: UpdateUserPayload) {
    try {
      await updateUser.mutateAsync({ userId, payload });
      showToast('Usuario actualizado', true);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      showToast(err?.response?.data?.message ?? 'Error al actualizar el usuario', false);
    }
  }

  async function handleDelete(userId: string) {
    try {
      await deleteUser.mutateAsync(userId);
      showToast('Usuario eliminado', true);
    } catch { showToast('Error al eliminar el usuario', false); }
  }

  const tutors = users?.filter((u) => u.role === Role.TUTOR) ?? [];

  const filtered = users?.filter((u) => {
    const matchesSearch =
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = !filterRole || u.role === filterRole;
    return matchesSearch && matchesRole;
  }) ?? [];

  return (
    <div style={s.page}>
      {/* Cabecera */}
      <div style={s.header}>
        <h1 style={s.title}>Usuarios</h1>
        <button style={s.btnPrimary} onClick={() => setShowCreate(true)}>+ Nuevo usuario</button>
      </div>

      {/* Filtros */}
      <div style={s.filters}>
        <input
          style={s.input}
          placeholder="Buscar por nombre o email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          style={s.select}
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value as Role | '')}
        >
          <option value="">Todos los roles</option>
          {ALL_ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
        <span style={s.count}>{filtered.length} usuario{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {isLoading && <p style={s.muted}>Cargando usuarios...</p>}

      {!isLoading && (
        <div style={s.tableWrapper}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Usuario</th>
                <th style={s.th}>Email</th>
                <th style={s.th}>Rol</th>
                <th style={s.th}>Tutor</th>
                <th style={s.th}>Alumnos</th>
                <th style={s.th}>Registro</th>
                <th style={s.th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  tutors={tutors}
                  deleteId={deleteId}
                  onRoleChange={handleRoleChange}
                  onTutorChange={handleTutorChange}
                  onEdit={() => setEditTarget(user)}
                  onDelete={() => setDeleteId(user.id)}
                  onDeleteConfirm={() => handleDelete(user.id)}
                  onDeleteCancel={() => setDeleteId(null)}
                  onEnrollments={() => setEnrollmentTarget(user)}
                  isPending={updateRole.isPending || assignTutor.isPending || deleteUser.isPending}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal crear */}
      {showCreate && (
        <UserModal
          title="Nuevo usuario"
          schoolYears={schoolYears ?? []}
          tutors={tutors}
          isPending={createUser.isPending}
          onClose={() => setShowCreate(false)}
          onSubmit={(data) => handleCreate(data as CreateUserPayload)}
          onTutorCreated={() => qc.invalidateQueries({ queryKey: ['admin', 'users'] })}
          mode="create"
        />
      )}

      {/* Modal editar */}
      {editTarget && (
        <UserModal
          title="Editar usuario"
          initial={editTarget}
          schoolYears={schoolYears ?? []}
          tutors={tutors}
          isPending={updateUser.isPending}
          onClose={() => setEditTarget(null)}
          onSubmit={(data) => handleUpdate(editTarget.id, data as UpdateUserPayload)}
          mode="edit"
        />
      )}

      {/* Modal matrículas */}
      {enrollmentTarget && (
        <EnrollmentModal
          user={enrollmentTarget}
          onClose={() => setEnrollmentTarget(null)}
        />
      )}

      {toast && (
        <div style={{ ...s.toast, background: toast.ok ? '#22c55e' : '#ef4444' }}>{toast.msg}</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fila de usuario
// ---------------------------------------------------------------------------

function UserRow({
  user, tutors, deleteId,
  onRoleChange, onTutorChange, onEdit,
  onDelete, onDeleteConfirm, onDeleteCancel, onEnrollments, isPending,
}: {
  user: AdminUser;
  tutors: AdminUser[];
  deleteId: string | null;
  onRoleChange: (id: string, role: Role) => void;
  onTutorChange: (id: string, tutorId: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  onEnrollments: () => void;
  isPending: boolean;
}) {
  const initials = user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  const createdAt = new Date(user.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  const isDeleting = deleteId === user.id;

  return (
    <tr style={s.row}>
      <td style={s.td}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div style={{ ...s.avatar, background: ROLE_COLORS[user.role] }}>
            {user.avatarUrl
              ? <img src={user.avatarUrl} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' as const }} />
              : initials}
          </div>
          <span style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '0.875rem' }}>{user.name}</span>
        </div>
      </td>
      <td style={{ ...s.td, color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>{user.email}</td>
      <td style={s.td}>
        <select
          style={{ ...s.selectInline, borderColor: ROLE_COLORS[user.role], color: ROLE_COLORS[user.role] }}
          value={user.role}
          disabled={isPending}
          onChange={(e) => onRoleChange(user.id, e.target.value as Role)}
        >
          {ALL_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
      </td>
      <td style={s.td}>
        {user.role === Role.STUDENT ? (
          <select
            style={s.selectInline}
            value={user.tutorId ?? ''}
            disabled={isPending}
            onChange={(e) => onTutorChange(user.id, e.target.value)}
          >
            <option value="">Sin tutor</option>
            {tutors.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        ) : <span style={s.muted}>—</span>}
      </td>
      <td style={{ ...s.td, textAlign: 'center' as const }}>
        {user.role === Role.TUTOR
          ? <span style={s.badge}>{user._count.students}</span>
          : <span style={s.muted}>—</span>}
      </td>
      <td style={{ ...s.td, color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>{createdAt}</td>
      <td style={s.td}>
        {isDeleting ? (
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>¿Seguro?</span>
            <button style={s.btnDanger} onClick={onDeleteConfirm} disabled={isPending}>Sí, eliminar</button>
            <button style={s.btnGhost} onClick={onDeleteCancel}>Cancelar</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {user.role === Role.STUDENT && (
              <button style={s.iconBtn} title="Gestionar cursos" onClick={onEnrollments}>📚</button>
            )}
            <button style={s.iconBtn} title="Editar" onClick={onEdit}>✏️</button>
            <button style={{ ...s.iconBtn, color: '#ef4444' }} title="Eliminar" onClick={onDelete}>🗑️</button>
          </div>
        )}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Modal crear / editar
// ---------------------------------------------------------------------------

function UserModal({
  title, initial, schoolYears, tutors, isPending, onClose, onSubmit, onTutorCreated, mode,
}: {
  title: string;
  initial?: AdminUser;
  schoolYears: { id: string; name: string; label: string }[];
  tutors: AdminUser[];
  isPending: boolean;
  onClose: () => void;
  onSubmit: (data: CreateUserPayload | UpdateUserPayload) => void;
  onTutorCreated?: () => void;
  mode: 'create' | 'edit';
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>(initial?.role ?? Role.STUDENT);
  const [schoolYearId, setSchoolYearId] = useState(
    (initial as (AdminUser & { schoolYearId?: string }) | undefined)?.schoolYearId ?? ''
  );
  const [tutorId, setTutorId] = useState(initial?.tutorId ?? '');

  // Lista local de tutores (se puede ampliar si se crea uno nuevo inline)
  const [localTutors, setLocalTutors] = useState<AdminUser[]>(tutors);

  // Estado del mini-formulario de creación de tutor
  const [showNewTutor, setShowNewTutor] = useState(false);
  const [newTutorName, setNewTutorName] = useState('');
  const [newTutorEmail, setNewTutorEmail] = useState('');
  const [newTutorPassword, setNewTutorPassword] = useState('');
  const [creatingTutor, setCreatingTutor] = useState(false);
  const [tutorError, setTutorError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === 'create') {
      const payload: CreateUserPayload = { name, email, password, role };
      if (role === Role.STUDENT && schoolYearId) payload.schoolYearId = schoolYearId;
      if (role === Role.STUDENT && tutorId) payload.tutorId = tutorId;
      onSubmit(payload);
    } else {
      const payload: UpdateUserPayload = {};
      if (name !== initial?.name) payload.name = name;
      if (email !== initial?.email) payload.email = email;
      if (password) payload.password = password;
      if (role === Role.STUDENT) payload.schoolYearId = schoolYearId || null;
      onSubmit(payload);
    }
  }

  async function handleCreateTutor(e: React.SyntheticEvent) {
    e.preventDefault();
    setTutorError('');
    setCreatingTutor(true);
    try {
      const newTutor = await adminApi.createUser({
        name: newTutorName,
        email: newTutorEmail,
        password: newTutorPassword,
        role: Role.TUTOR,
      });
      setLocalTutors((prev) => [...prev, newTutor]);
      setTutorId(newTutor.id);
      setShowNewTutor(false);
      setNewTutorName('');
      setNewTutorEmail('');
      setNewTutorPassword('');
      onTutorCreated?.();
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } } };
      setTutorError(apiErr?.response?.data?.message ?? 'Error al crear el tutor');
    } finally {
      setCreatingTutor(false);
    }
  }

  return (
    <div style={s.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={s.modal}>
        <h2 style={s.modalTitle}>{title}</h2>
        <form onSubmit={handleSubmit}>
          <div style={s.field}>
            <label style={s.label}>Nombre</label>
            <input style={s.input} value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
          </div>
          <div style={s.field}>
            <label style={s.label}>Email</label>
            <input style={s.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div style={s.field}>
            <label style={s.label}>{mode === 'create' ? 'Contraseña' : 'Nueva contraseña (opcional)'}</label>
            <input
              style={s.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={mode === 'create'}
              minLength={8}
              placeholder={mode === 'edit' ? 'Dejar en blanco para no cambiar' : ''}
            />
          </div>
          {mode === 'create' && (
            <div style={s.field}>
              <label style={s.label}>Rol</label>
              <select style={s.input} value={role} onChange={(e) => { setRole(e.target.value as Role); setTutorId(''); setShowNewTutor(false); }}>
                {ALL_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
          )}
          {role === Role.STUDENT && (
            <div style={s.field}>
              <label style={s.label}>Nivel educativo</label>
              <select style={s.input} value={schoolYearId} onChange={(e) => setSchoolYearId(e.target.value)}>
                <option value="">Sin asignar</option>
                {schoolYears.map((sy) => <option key={sy.id} value={sy.id}>{sy.label}</option>)}
              </select>
            </div>
          )}
          {mode === 'create' && role === Role.STUDENT && (
            <div style={s.field}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                <label style={s.label}>Tutor</label>
                {!showNewTutor && (
                  <button
                    type="button"
                    style={s.btnLink}
                    onClick={() => setShowNewTutor(true)}
                  >
                    + Crear nuevo tutor
                  </button>
                )}
              </div>
              {!showNewTutor ? (
                <select style={s.input} value={tutorId} onChange={(e) => setTutorId(e.target.value)}>
                  <option value="">Sin tutor</option>
                  {localTutors.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} — {t.email}</option>
                  ))}
                </select>
              ) : (
                <div style={s.miniForm}>
                  <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text)' }}>
                    Nuevo tutor
                  </p>
                  <div style={s.field}>
                    <label style={s.label}>Nombre del tutor</label>
                    <input
                      style={s.input}
                      value={newTutorName}
                      onChange={(e) => setNewTutorName(e.target.value)}
                      required={showNewTutor}
                      minLength={2}
                      placeholder="Ej: Ana García"
                    />
                  </div>
                  <div style={s.field}>
                    <label style={s.label}>Email del tutor</label>
                    <input
                      style={s.input}
                      type="email"
                      value={newTutorEmail}
                      onChange={(e) => setNewTutorEmail(e.target.value)}
                      required={showNewTutor}
                      placeholder="tutor@ejemplo.com"
                    />
                  </div>
                  <div style={s.field}>
                    <label style={s.label}>Contraseña del tutor</label>
                    <input
                      style={s.input}
                      type="password"
                      value={newTutorPassword}
                      onChange={(e) => setNewTutorPassword(e.target.value)}
                      required={showNewTutor}
                      minLength={8}
                    />
                  </div>
                  {tutorError && (
                    <p style={{ color: '#ef4444', fontSize: '0.78rem', marginBottom: '0.5rem' }}>{tutorError}</p>
                  )}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      style={s.btnPrimary}
                      disabled={creatingTutor || !newTutorName || !newTutorEmail || newTutorPassword.length < 8}
                      onClick={(e) => handleCreateTutor(e)}
                    >
                      {creatingTutor ? 'Creando...' : 'Crear tutor'}
                    </button>
                    <button type="button" style={s.btnSecondary} onClick={() => { setShowNewTutor(false); setTutorError(''); }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {mode === 'edit' && role === Role.STUDENT && (
            <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
              El tutor se gestiona desde la columna correspondiente en la tabla.
            </p>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
            <button type="button" style={s.btnSecondary} onClick={onClose}>Cancelar</button>
            <button type="submit" style={s.btnPrimary} disabled={isPending || showNewTutor}>
              {isPending ? 'Guardando...' : mode === 'create' ? 'Crear usuario' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal de matrículas
// ---------------------------------------------------------------------------

function EnrollmentModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const qc = useQueryClient();

  const { data: enrollments = [], isLoading: loadingEnrollments } = useQuery({
    queryKey: ['admin', 'enrollments', user.id],
    queryFn: () => adminApi.getEnrollments(user.id),
  });

  const { data: allCourses, isLoading: loadingCourses } = useQuery({
    queryKey: ['admin', 'courses'],
    queryFn: () => adminApi.listCourses({ limit: 200 }),
  });

  const enrollMut = useMutation({
    mutationFn: (courseId: string) => adminApi.enroll(user.id, courseId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'enrollments', user.id] }),
  });

  const unenrollMut = useMutation({
    mutationFn: (courseId: string) => adminApi.unenroll(user.id, courseId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'enrollments', user.id] }),
  });

  const enrolledIds = new Set(enrollments.map((e) => e.courseId));
  const courses: Course[] = allCourses?.data ?? [];
  const isLoading = loadingEnrollments || loadingCourses;

  return (
    <div style={s.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ ...s.modal, maxWidth: 560 }}>
        <h2 style={s.modalTitle}>📚 Cursos de {user.name}</h2>
        {isLoading ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Cargando...</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '60vh', overflowY: 'auto' }}>
            {courses.map((course) => {
              const enrolled = enrolledIds.has(course.id);
              const isPending = enrollMut.isPending || unenrollMut.isPending;
              return (
                <div
                  key={course.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: `1.5px solid ${enrolled ? '#6366f1' : 'var(--color-border)'}`,
                    background: enrolled ? '#eef2ff' : 'var(--color-bg)',
                  }}
                >
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '0.875rem', margin: 0 }}>{course.title}</p>
                    {course.schoolYear && (
                      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0, marginTop: 2 }}>
                        {course.schoolYear.label}
                      </p>
                    )}
                  </div>
                  <button
                    disabled={isPending}
                    onClick={() => enrolled ? unenrollMut.mutate(course.id) : enrollMut.mutate(course.id)}
                    style={{
                      padding: '5px 14px',
                      borderRadius: 6,
                      border: 'none',
                      cursor: isPending ? 'not-allowed' : 'pointer',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      background: enrolled ? '#ef4444' : '#6366f1',
                      color: '#fff',
                      flexShrink: 0,
                    }}
                  >
                    {enrolled ? 'Quitar' : 'Matricular'}
                  </button>
                </div>
              );
            })}
            {courses.length === 0 && (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>No hay cursos disponibles.</p>
            )}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
          <button style={s.btnSecondary} onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Estilos
// ---------------------------------------------------------------------------

const s: Record<string, React.CSSProperties> = {
  page: { padding: '2rem', maxWidth: 1200, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' },
  title: { fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 },
  filters: { display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap' as const },
  count: { marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--color-text-muted)' },
  input: { padding: '0.45rem 0.75rem', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: '0.875rem', background: 'var(--color-bg)', color: 'var(--color-text)', width: '100%', boxSizing: 'border-box' as const },
  select: { padding: '0.45rem 0.75rem', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: '0.875rem', background: 'var(--color-bg)', color: 'var(--color-text)' },
  tableWrapper: { overflowX: 'auto' as const },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.875rem' },
  th: { textAlign: 'left' as const, padding: '0.6rem 0.75rem', borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' as const, letterSpacing: '0.04em', whiteSpace: 'nowrap' as const },
  row: { borderBottom: '1px solid var(--color-border)' },
  td: { padding: '0.65rem 0.75rem', verticalAlign: 'middle' as const },
  avatar: { width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.7rem', flexShrink: 0, overflow: 'hidden' },
  selectInline: { padding: '0.3rem 0.5rem', border: '1px solid var(--color-border)', borderRadius: 5, fontSize: '0.8rem', background: 'var(--color-bg)', color: 'var(--color-text)', cursor: 'pointer' },
  badge: { display: 'inline-block', padding: '2px 8px', borderRadius: 12, background: 'var(--color-border)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text)' },
  muted: { color: 'var(--color-text-muted)', fontSize: '0.8rem' },
  iconBtn: { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: '2px 4px', borderRadius: 4 },
  btnPrimary: { padding: '0.5rem 1rem', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' },
  btnSecondary: { padding: '0.5rem 1rem', background: 'transparent', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', borderRadius: 6, cursor: 'pointer', fontSize: '0.875rem' },
  btnDanger: { padding: '0.3rem 0.65rem', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: 5, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 },
  btnGhost: { padding: '0.3rem 0.65rem', background: 'transparent', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', borderRadius: 5, cursor: 'pointer', fontSize: '0.78rem' },
  toast: { position: 'fixed' as const, bottom: '1.5rem', right: '1.5rem', padding: '0.75rem 1.25rem', borderRadius: 8, color: '#fff', fontWeight: 600, fontSize: '0.9rem', zIndex: 200 },
  btnLink: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', fontSize: '0.78rem', fontWeight: 600, padding: 0, textDecoration: 'underline' },
  miniForm: { background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '0.875rem', marginTop: '0.25rem' },
  overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' },
  modal: { background: 'var(--color-surface)', borderRadius: 12, padding: '1.5rem', width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto' as const },
  modalTitle: { fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--color-text)', marginTop: 0 },
  field: { marginBottom: '0.875rem' },
  label: { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '0.3rem' },
};
