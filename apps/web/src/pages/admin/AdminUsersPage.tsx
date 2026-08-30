import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  adminApi,
  type AdminUser,
  type CreateUserPayload,
  type UpdateUserPayload,
} from '../../api/admin.api';
import { Role } from '@vkbacademy/shared';
import type { Course } from '@vkbacademy/shared';
import AcademyFilter from '../../components/AcademyFilter';
import { useAcademyFilterStore } from '../../store/academy-filter.store';

const ROLE_LABELS: Record<Role, string> = {
  [Role.STUDENT]: 'Alumno',
  [Role.ADMIN]: 'Admin',
  [Role.SUPER_ADMIN]: 'Super Admin',
};

const ROLE_COLORS: Record<Role, string> = {
  [Role.STUDENT]: '#6366f1',
  [Role.ADMIN]: '#ef4444',
  [Role.SUPER_ADMIN]: '#dc2626',
};

const ALL_ROLES = Object.values(Role);

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------

/** Criterios de ordenación de la tabla. `registro` es el orden que da la API. */
type SortBy = 'registro' | 'racha' | 'puntos';

const SORT_LABELS: Record<SortBy, string> = {
  registro: 'Registro',
  racha: 'Racha',
  puntos: 'Puntos',
};

export default function AdminUsersPage() {
  const selectedAcademyId = useAcademyFilterStore((s) => s.selectedAcademyId);
  const qc = useQueryClient();
  const [sortBy, setSortBy] = useState<SortBy>('registro');

  const { data: usersPage, isLoading } = useQuery({
    queryKey: ['admin', 'users', selectedAcademyId],
    // Límite alto: la página filtra/busca en cliente y necesita el listado completo
    queryFn: () => adminApi.getUsers({ limit: 1000 }),
  });
  const users = usersPage?.data;

  const { data: schoolYears } = useQuery({
    queryKey: ['school-years'],
    queryFn: adminApi.listSchoolYears,
  });

  const updateRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Role }) =>
      adminApi.updateRole(userId, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  const createUser = useMutation({
    mutationFn: (payload: CreateUserPayload) => adminApi.createUser(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      setShowCreate(false);
    },
  });

  const updateUser = useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: UpdateUserPayload }) =>
      adminApi.updateUser(userId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      setEditTarget(null);
    },
  });

  const deleteUser = useMutation({
    mutationFn: (userId: string) => adminApi.deleteUser(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      setDeleteId(null);
    },
  });

  const resetPassword = useMutation({
    mutationFn: ({ userId, password }: { userId: string; password: string }) =>
      adminApi.resetUserPassword(userId, password),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
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
    } catch {
      showToast('Error al cambiar el rol', false);
    }
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
    } catch {
      showToast('Error al eliminar el usuario', false);
    }
  }

  async function handleResetPassword(userId: string) {
    const password = window.prompt('Nueva contraseña (mínimo 8 caracteres):');
    if (!password) return;
    if (password.length < 8) {
      showToast('La contraseña debe tener al menos 8 caracteres', false);
      return;
    }
    const confirmation = window.prompt('Repite la contraseña para confirmar:');
    if (confirmation !== password) {
      showToast('Las contraseñas no coinciden', false);
      return;
    }
    try {
      await resetPassword.mutateAsync({ userId, password });
      showToast('Contraseña restablecida', true);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      showToast(err?.response?.data?.message ?? 'Error al restablecer la contraseña', false);
    }
  }

  const filtered =
    users?.filter((u) => {
      const matchesSearch =
        !search ||
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        (u.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (u.username ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (u.guardianEmail ?? '').toLowerCase().includes(search.toLowerCase());
      const matchesRole = !filterRole || u.role === filterRole;
      return matchesSearch && matchesRole;
    }) ?? [];

  // Ordenación en cliente: la página ya trae el listado completo (limit 1000)
  // y filtra aquí mismo, así que ordenar no necesita ida y vuelta a la API.
  const sorted =
    sortBy === 'registro'
      ? filtered
      : [...filtered].sort((a, b) =>
          sortBy === 'racha'
            ? b.currentDailyStreak - a.currentDailyStreak || b.totalPoints - a.totalPoints
            : b.totalPoints - a.totalPoints || b.currentDailyStreak - a.currentDailyStreak,
        );

  return (
    <div style={s.page}>
      <AcademyFilter />
      {/* Hero */}
      <div className="page-hero animate-in" style={{ marginBottom: 24 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap' as const,
          }}
        >
          <div>
            <h1 className="hero-title">Gestión de Usuarios</h1>
            <p className="hero-subtitle">
              {usersPage
                ? `${usersPage.total} usuario${usersPage.total !== 1 ? 's' : ''} registrados`
                : 'Cargando…'}
            </p>
          </div>
          <button
            className="btn btn-primary"
            style={{ flexShrink: 0, marginTop: 4 }}
            onClick={() => setShowCreate(true)}
          >
            + Nuevo usuario
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div style={s.filters}>
        <input
          style={s.input}
          placeholder="Buscar por nombre, email, username o email del tutor..."
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
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <select
          style={s.select}
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          aria-label="Ordenar por"
        >
          {(Object.keys(SORT_LABELS) as SortBy[]).map((key) => (
            <option key={key} value={key}>
              Ordenar por: {SORT_LABELS[key]}
            </option>
          ))}
        </select>
        <span style={s.count}>
          {filtered.length} usuario{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {isLoading && <p style={s.muted}>Cargando usuarios...</p>}

      {!isLoading && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Actividad</th>
                <th>Registro</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  deleteId={deleteId}
                  onRoleChange={handleRoleChange}
                  onEdit={() => setEditTarget(user)}
                  onDelete={() => setDeleteId(user.id)}
                  onDeleteConfirm={() => handleDelete(user.id)}
                  onDeleteCancel={() => setDeleteId(null)}
                  onEnrollments={() => setEnrollmentTarget(user)}
                  onResetPassword={() => handleResetPassword(user.id)}
                  isPending={
                    updateRole.isPending || deleteUser.isPending || resetPassword.isPending
                  }
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
          isPending={createUser.isPending}
          onClose={() => setShowCreate(false)}
          onSubmit={(data) => handleCreate(data as CreateUserPayload)}
          mode="create"
        />
      )}

      {/* Modal editar */}
      {editTarget && (
        <UserModal
          title="Editar usuario"
          initial={editTarget}
          schoolYears={schoolYears ?? []}
          isPending={updateUser.isPending}
          onClose={() => setEditTarget(null)}
          onSubmit={(data) => handleUpdate(editTarget.id, data as UpdateUserPayload)}
          mode="edit"
        />
      )}

      {/* Modal matrículas */}
      {enrollmentTarget && (
        <EnrollmentModal user={enrollmentTarget} onClose={() => setEnrollmentTarget(null)} />
      )}

      {toast && (
        <div style={{ ...s.toast, background: toast.ok ? '#22c55e' : '#ef4444' }}>{toast.msg}</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Actividad del alumno
// ---------------------------------------------------------------------------

/**
 * Racha diaria y puntos en formato compacto: `🔥 12d · 340 pts`.
 *
 * La racha va delante porque es el dato accionable: dice a quién mencionar
 * hoy. Solo se pinta para alumnos — un admin no juega, y un `0d · 0 pts` en
 * cada fila de personal sería ruido.
 */
function ActivityCell({ user }: { user: AdminUser }) {
  if (user.role !== Role.STUDENT) {
    return <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>—</span>;
  }

  const streak = user.currentDailyStreak;
  const title = [
    `Racha diaria actual: ${streak} día${streak !== 1 ? 's' : ''}`,
    `Mejor racha diaria: ${user.longestDailyStreak}`,
    `Semanas seguidas activo: ${user.currentStreak}`,
    `Puntos acumulados: ${user.totalPoints}`,
  ].join('\n');

  return (
    <div style={s.activity} title={title}>
      <span style={{ ...s.streak, opacity: streak > 0 ? 1 : 0.45 }}>🔥 {streak}d</span>
      <span style={s.activitySep}>·</span>
      <span style={s.points}>{user.totalPoints} pts</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fila de usuario
// ---------------------------------------------------------------------------

function UserRow({
  user,
  deleteId,
  onRoleChange,
  onEdit,
  onDelete,
  onDeleteConfirm,
  onDeleteCancel,
  onEnrollments,
  onResetPassword,
  isPending,
}: {
  user: AdminUser;
  deleteId: string | null;
  onRoleChange: (id: string, role: Role) => void;
  onEdit: () => void;
  onDelete: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  onEnrollments: () => void;
  onResetPassword: () => void;
  isPending: boolean;
}) {
  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const createdAt = new Date(user.createdAt).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const isDeleting = deleteId === user.id;

  return (
    <tr>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div style={{ ...s.avatar, background: ROLE_COLORS[user.role] }}>
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  objectFit: 'cover' as const,
                }}
              />
            ) : (
              initials
            )}
          </div>
          <span style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '0.875rem' }}>
            {user.name}
          </span>
        </div>
      </td>
      <td style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
        {user.email}
        {user.username && (
          <div style={{ fontSize: '0.72rem', opacity: 0.75 }}>@{user.username}</div>
        )}
        {user.guardianEmail && (
          <div style={{ fontSize: '0.72rem', opacity: 0.75 }}>Tutor: {user.guardianEmail}</div>
        )}
      </td>
      <td>
        <select
          style={{
            ...s.selectInline,
            borderColor: ROLE_COLORS[user.role],
            color: ROLE_COLORS[user.role],
          }}
          value={user.role}
          disabled={isPending}
          onChange={(e) => onRoleChange(user.id, e.target.value as Role)}
        >
          {ALL_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </td>
      <td>
        <ActivityCell user={user} />
      </td>
      <td style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>{createdAt}</td>
      <td>
        {isDeleting ? (
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>¿Seguro?</span>
            <button
              className="btn btn-ghost"
              style={{
                padding: '3px 10px',
                fontSize: '0.78rem',
                color: '#ef4444',
                borderColor: '#ef4444',
              }}
              onClick={onDeleteConfirm}
              disabled={isPending}
            >
              Sí, eliminar
            </button>
            <button
              className="btn btn-ghost"
              style={{ padding: '3px 10px', fontSize: '0.78rem' }}
              onClick={onDeleteCancel}
            >
              Cancelar
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {user.role === Role.STUDENT && (
              <button style={s.iconBtn} title="Gestionar cursos" onClick={onEnrollments}>
                📚
              </button>
            )}
            <button
              style={s.iconBtn}
              title="Restablecer contraseña"
              disabled={isPending}
              onClick={onResetPassword}
            >
              🔑
            </button>
            <button style={s.iconBtn} title="Editar" onClick={onEdit}>
              ✏️
            </button>
            <button style={{ ...s.iconBtn, color: '#ef4444' }} title="Eliminar" onClick={onDelete}>
              🗑️
            </button>
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
  title,
  initial,
  schoolYears,
  isPending,
  onClose,
  onSubmit,
  mode,
}: {
  title: string;
  initial?: AdminUser;
  schoolYears: { id: string; name: string; label: string }[];
  isPending: boolean;
  onClose: () => void;
  onSubmit: (data: CreateUserPayload | UpdateUserPayload) => void;
  mode: 'create' | 'edit';
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>(initial?.role ?? Role.STUDENT);
  const [schoolYearId, setSchoolYearId] = useState(
    (initial as (AdminUser & { schoolYearId?: string }) | undefined)?.schoolYearId ?? '',
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === 'create') {
      const payload: CreateUserPayload = { name, email, password, role };
      if (role === Role.STUDENT && schoolYearId) payload.schoolYearId = schoolYearId;
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

  return (
    <div
      style={s.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={s.modal}>
        <h2 style={s.modalTitle}>{title}</h2>
        <form onSubmit={handleSubmit}>
          <div className="field" style={{ marginBottom: '0.875rem' }}>
            <label>Nombre</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
          </div>
          <div className="field" style={{ marginBottom: '0.875rem' }}>
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field" style={{ marginBottom: '0.875rem' }}>
            <label>{mode === 'create' ? 'Contraseña' : 'Nueva contraseña (opcional)'}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={mode === 'create'}
              minLength={8}
              placeholder={mode === 'edit' ? 'Dejar en blanco para no cambiar' : ''}
            />
          </div>
          {mode === 'create' && (
            <div className="field" style={{ marginBottom: '0.875rem' }}>
              <label>Rol</label>
              <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {ALL_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
          )}
          {role === Role.STUDENT && (
            <div className="field" style={{ marginBottom: '0.875rem' }}>
              <label>Nivel educativo</label>
              <select value={schoolYearId} onChange={(e) => setSchoolYearId(e.target.value)}>
                <option value="">Sin asignar</option>
                {schoolYears.map((sy) => (
                  <option key={sy.id} value={sy.id}>
                    {sy.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              justifyContent: 'flex-end',
              marginTop: '1.25rem',
            }}
          >
            <button
              type="button"
              className="btn btn-ghost"
              style={{ padding: '8px 16px' }}
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ padding: '8px 16px' }}
              disabled={isPending}
            >
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
    <div
      style={s.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={{ ...s.modal, maxWidth: 560 }}>
        <h2 style={s.modalTitle}>Cursos de {user.name}</h2>
        {isLoading ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Cargando...</p>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              maxHeight: '60vh',
              overflowY: 'auto',
            }}
          >
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
                    border: `1.5px solid ${enrolled ? 'rgba(234,88,12,0.3)' : 'var(--color-border)'}`,
                    background: enrolled ? 'rgba(234,88,12,0.06)' : 'var(--color-bg)',
                  }}
                >
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '0.875rem', margin: 0 }}>
                      {course.title}
                    </p>
                    {course.schoolYear && (
                      <p
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--color-text-muted)',
                          margin: 0,
                          marginTop: 2,
                        }}
                      >
                        {course.schoolYear.label}
                      </p>
                    )}
                  </div>
                  <button
                    disabled={isPending}
                    onClick={() =>
                      enrolled ? unenrollMut.mutate(course.id) : enrollMut.mutate(course.id)
                    }
                    style={{
                      padding: '5px 14px',
                      borderRadius: 6,
                      border: 'none',
                      cursor: isPending ? 'not-allowed' : 'pointer',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      background: enrolled ? '#ef4444' : 'var(--gradient-orange)',
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
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                No hay cursos disponibles.
              </p>
            )}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
          <button className="btn btn-ghost" style={{ padding: '8px 16px' }} onClick={onClose}>
            Cerrar
          </button>
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
  filters: {
    display: 'flex',
    gap: '0.75rem',
    alignItems: 'center',
    marginBottom: '1.25rem',
    flexWrap: 'wrap' as const,
  },
  count: { marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--color-text-muted)' },
  activity: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    fontSize: '0.8rem',
    whiteSpace: 'nowrap',
  },
  streak: { fontWeight: 600, color: 'var(--color-text)' },
  activitySep: { color: 'var(--color-text-muted)', opacity: 0.6 },
  points: { color: 'var(--color-text-muted)' },
  input: {
    padding: '0.45rem 0.75rem',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    fontSize: '0.875rem',
    background: 'var(--color-bg)',
    color: 'var(--color-text)',
    minWidth: 240,
  },
  select: {
    padding: '0.45rem 0.75rem',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    fontSize: '0.875rem',
    background: 'var(--color-bg)',
    color: 'var(--color-text)',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontWeight: 700,
    fontSize: '0.7rem',
    flexShrink: 0,
    overflow: 'hidden',
  },
  selectInline: {
    padding: '0.3rem 0.5rem',
    border: '1px solid var(--color-border)',
    borderRadius: 5,
    fontSize: '0.8rem',
    background: 'var(--color-bg)',
    color: 'var(--color-text)',
    cursor: 'pointer',
  },
  muted: { color: 'var(--color-text-muted)', fontSize: '0.8rem' },
  iconBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '1rem',
    padding: '2px 4px',
    borderRadius: 4,
  },
  toast: {
    position: 'fixed' as const,
    bottom: '1.5rem',
    right: '1.5rem',
    padding: '0.75rem 1.25rem',
    borderRadius: 8,
    color: '#fff',
    fontWeight: 600,
    fontSize: '0.9rem',
    zIndex: 200,
  },
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
  },
  modal: {
    background: 'var(--color-surface)',
    borderRadius: 'var(--radius-md)',
    border: '1.5px solid var(--color-border)',
    boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
    padding: '1.75rem',
    width: '100%',
    maxWidth: 460,
    maxHeight: '90vh',
    overflowY: 'auto' as const,
  },
  modalTitle: {
    fontSize: '1.1rem',
    fontWeight: 700,
    marginBottom: '1.25rem',
    color: 'var(--color-text)',
    marginTop: 0,
  },
};
