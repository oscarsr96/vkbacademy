import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/axios';
import { useAuthStore } from '../../store/auth.store';
import { Role } from '@vkbacademy/shared';

interface Academy {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  domain: string | null;
  isActive: boolean;
  createdAt: string;
  _count: { members: number };
}

interface AcademyMember {
  id: string;
  userId: string;
  academyId: string;
  user: { id: string; name: string; email: string; role: string; avatarUrl: string | null };
}

interface CreateForm {
  name: string;
  slug: string;
  logoUrl: string;
  primaryColor: string;
}

const EMPTY_FORM: CreateForm = { name: '', slug: '', logoUrl: '', primaryColor: '#6366f1' };

export default function AdminAcademiesPage() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [selectedAcademy, setSelectedAcademy] = useState<string | null>(null);

  // Solo SUPER_ADMIN puede ver esta página
  if (user?.role !== Role.SUPER_ADMIN) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Acceso restringido a Super Admin</div>;
  }

  const { data: academies = [], isLoading } = useQuery<Academy[]>({
    queryKey: ['academies'],
    queryFn: () => api.get('/academies').then((r) => r.data),
  });

  const { data: members = [] } = useQuery<AcademyMember[]>({
    queryKey: ['academy-members', selectedAcademy],
    queryFn: () => api.get(`/academies/${selectedAcademy}/members`).then((r) => r.data),
    enabled: !!selectedAcademy,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateForm) => api.post('/academies', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academies'] });
      setShowCreate(false);
      setForm(EMPTY_FORM);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/academies/${id}`, { isActive: !isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['academies'] }),
  });

  const removeMemberMutation = useMutation({
    mutationFn: ({ academyId, userId }: { academyId: string; userId: string }) =>
      api.delete(`/academies/${academyId}/members/${userId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['academy-members', selectedAcademy] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/academies/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academies'] });
      setSelectedAcademy(null);
    },
  });

  const set = (k: keyof CreateForm, v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f1f5f9' }}>Academias</h1>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            background: 'linear-gradient(135deg, #ea580c, #f97316)',
            color: '#fff',
            border: 'none',
            padding: '10px 20px',
            borderRadius: 8,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + Nueva Academia
        </button>
      </div>

      {isLoading ? (
        <p style={{ color: '#94a3b8' }}>Cargando...</p>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {academies.map((a) => (
            <div
              key={a.id}
              style={{
                background: '#0f172a',
                borderRadius: 12,
                padding: 20,
                border: selectedAcademy === a.id ? '2px solid #ea580c' : '1px solid rgba(234,88,12,0.15)',
                cursor: 'pointer',
              }}
              onClick={() => setSelectedAcademy(selectedAcademy === a.id ? null : a.id)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 40, height: 40, borderRadius: 8,
                      background: a.primaryColor ?? '#6366f1',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontWeight: 700, fontSize: '1.1rem',
                    }}
                  >
                    {a.name.charAt(0)}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <h3 style={{ color: '#f1f5f9', fontWeight: 600, margin: 0 }}>{a.name}</h3>
                    <span style={{ color: '#64748b', fontSize: '0.8rem' }}>/{a.slug}</span>
                    {a.domain && <span style={{ color: '#475569', fontSize: '0.75rem' }}>{a.domain}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                    {a._count.members} miembros
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMutation.mutate({ id: a.id, isActive: a.isActive });
                    }}
                    style={{
                      background: a.isActive ? '#065f46' : '#7f1d1d',
                      color: '#fff',
                      border: 'none',
                      padding: '4px 12px',
                      borderRadius: 6,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    {a.isActive ? 'Activa' : 'Inactiva'}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`¿Eliminar "${a.name}"? Se eliminará el dominio de Vercel y todos los miembros.`)) {
                        deleteMutation.mutate(a.id);
                      }
                    }}
                    style={{
                      background: 'transparent',
                      color: '#ef4444',
                      border: '1px solid #ef444466',
                      padding: '4px 12px',
                      borderRadius: 6,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    Eliminar
                  </button>
                </div>
              </div>

              {/* Panel de miembros expandido */}
              {selectedAcademy === a.id && (
                <div style={{ marginTop: 16, borderTop: '1px solid rgba(234,88,12,0.1)', paddingTop: 12 }}>
                  <h4 style={{ color: '#cbd5e1', fontSize: '0.9rem', marginBottom: 8 }}>Miembros</h4>
                  {members.length === 0 ? (
                    <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Sin miembros</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {members.map((m) => (
                        <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: '#1e293b', borderRadius: 6 }}>
                          <div>
                            <span style={{ color: '#f1f5f9', fontSize: '0.85rem' }}>{m.user.name}</span>
                            <span style={{ color: '#64748b', fontSize: '0.8rem', marginLeft: 8 }}>{m.user.email}</span>
                            <span className={`role-badge ${m.user.role}`} style={{ marginLeft: 8, fontSize: '0.7rem' }}>{m.user.role}</span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeMemberMutation.mutate({ academyId: a.id, userId: m.user.id });
                            }}
                            style={{ background: '#7f1d1d', color: '#fff', border: 'none', padding: '3px 10px', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem' }}
                          >
                            Quitar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal crear academia */}
      {showCreate && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
          onClick={() => setShowCreate(false)}
        >
          <div
            style={{ background: '#1e293b', borderRadius: 12, padding: 28, width: 420, maxWidth: '90vw' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ color: '#f1f5f9', marginBottom: 16 }}>Nueva Academia</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                placeholder="Nombre"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                style={inputStyle}
              />
              <input
                placeholder="Slug (ej: cb-oscar)"
                value={form.slug}
                onChange={(e) => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                style={inputStyle}
              />
              {form.slug && (
                <div style={{ background: '#0f172a', borderRadius: 6, padding: '8px 12px', fontSize: '0.8rem' }}>
                  <span style={{ color: '#64748b' }}>Dominio: </span>
                  <span style={{ color: '#38bdf8' }}>{form.slug.replace(/-/g, '')}academy.vercel.app</span>
                </div>
              )}
              <input
                placeholder="URL del logo (opcional)"
                value={form.logoUrl}
                onChange={(e) => set('logoUrl', e.target.value)}
                style={inputStyle}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Color primario:</label>
                <input
                  type="color"
                  value={form.primaryColor}
                  onChange={(e) => set('primaryColor', e.target.value)}
                  style={{ width: 40, height: 32, border: 'none', borderRadius: 4, cursor: 'pointer' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button
                onClick={() => setShowCreate(false)}
                style={{ background: '#334155', color: '#cbd5e1', border: 'none', padding: '8px 16px', borderRadius: 6, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={() => createMutation.mutate(form)}
                disabled={!form.name || !form.slug || createMutation.isPending}
                style={{
                  background: 'linear-gradient(135deg, #ea580c, #f97316)',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: 6,
                  fontWeight: 600,
                  cursor: 'pointer',
                  opacity: !form.name || !form.slug ? 0.5 : 1,
                }}
              >
                {createMutation.isPending ? 'Creando...' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: '#0f172a',
  border: '1px solid rgba(234,88,12,0.2)',
  borderRadius: 6,
  padding: '10px 12px',
  color: '#f1f5f9',
  fontSize: '0.9rem',
  outline: 'none',
};
