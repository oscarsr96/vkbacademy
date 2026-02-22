import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../api/admin.api';

export default function AdminRedemptionsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'redemptions'],
    queryFn: () => adminApi.listRedemptions(),
  });

  const deliverMutation = useMutation({
    mutationFn: (id: string) => adminApi.markRedemptionDelivered(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'redemptions'] }),
  });

  const list = data ?? [];
  const totalPointsSpent = list.reduce((acc, r) => acc + r.cost, 0);
  const pendingCount = list.filter((r) => !r.delivered).length;
  const distinctStudents = new Set(list.map((r) => r.userId)).size;

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
    padding: '0.9rem 1rem',
    fontSize: '0.875rem',
    color: 'var(--color-text)',
    verticalAlign: 'middle',
  };

  const avatarStyle: React.CSSProperties = {
    width: 34,
    height: 34,
    borderRadius: '50%',
    background: 'var(--gradient-orange)',
    color: '#fff',
    fontWeight: 700,
    fontSize: '0.85rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  };

  return (
    <div style={{ maxWidth: 1060, margin: '0 auto', padding: '2rem' }}>

      {/* Hero */}
      <div className="page-hero animate-in">
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="hero-title">Canjes</h1>
            <p className="hero-subtitle">
              {list.length} canjes totales
              {pendingCount > 0 && (
                <span style={{
                  marginLeft: '0.75rem',
                  background: 'rgba(245,158,11,0.2)',
                  color: '#fbbf24',
                  border: '1px solid rgba(245,158,11,0.3)',
                  padding: '2px 10px',
                  borderRadius: 999,
                  fontSize: '0.78rem',
                  fontWeight: 700,
                }}>
                  {pendingCount} pendientes
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '0.875rem', marginBottom: '1.75rem' }}>
        <div className="stat-card">
          <div style={{ fontSize: '1.6rem', marginBottom: '0.4rem' }}>🎁</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1, marginBottom: 4 }}>
            {list.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>Canjes totales</div>
        </div>

        <div className="stat-card">
          <div style={{ fontSize: '1.6rem', marginBottom: '0.4rem' }}>⏳</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, lineHeight: 1, marginBottom: 4, color: pendingCount > 0 ? '#f59e0b' : 'var(--color-text)' }}>
            {pendingCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>Pendientes de entregar</div>
        </div>

        <div className="stat-card">
          <div style={{ fontSize: '1.6rem', marginBottom: '0.4rem' }}>⭐</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f59e0b', lineHeight: 1, marginBottom: 4 }}>
            {totalPointsSpent.toLocaleString('es-ES')}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>Puntos canjeados</div>
        </div>

        <div className="stat-card">
          <div style={{ fontSize: '1.6rem', marginBottom: '0.4rem' }}>👤</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1, marginBottom: 4 }}>
            {distinctStudents}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>Alumnos distintos</div>
        </div>
      </div>

      {/* Estado de carga */}
      {isLoading && (
        <p style={{ color: 'var(--color-text-muted)', padding: '2rem 0', textAlign: 'center' }}>
          Cargando canjes...
        </p>
      )}

      {/* Vacío */}
      {!isLoading && list.length === 0 && (
        <div className="vkb-card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🎁</div>
          <p style={{ color: 'var(--color-text-muted)' }}>
            Todavía no hay ningún canje registrado.
          </p>
        </div>
      )}

      {/* Tabla */}
      {!isLoading && list.length > 0 && (
        <div className="table-wrap">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Alumno</th>
                <th style={thStyle}>Artículo</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Puntos</th>
                <th style={thStyle}>Canjeado</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr
                  key={r.id}
                  style={{
                    borderBottom: '1px solid var(--color-border)',
                    opacity: r.delivered ? 0.65 : 1,
                    transition: 'opacity 0.2s, background 0.12s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Alumno */}
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={avatarStyle}>
                        {r.user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{r.user.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{r.user.email}</div>
                      </div>
                    </div>
                  </td>

                  {/* Artículo */}
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 500 }}>{r.itemName}</span>
                  </td>

                  {/* Puntos */}
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#f59e0b' }}>
                      +{r.cost} pts
                    </span>
                  </td>

                  {/* Fecha */}
                  <td style={tdStyle}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                      {new Date(r.redeemedAt).toLocaleString('es-ES', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </td>

                  {/* Estado / acción */}
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    {r.delivered ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          Entregado
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                          {new Date(r.deliveredAt!).toLocaleDateString('es-ES', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    ) : (
                      <button
                        className="btn btn-primary"
                        style={{ fontSize: '0.8rem', padding: '0.35rem 0.875rem' }}
                        disabled={deliverMutation.isPending}
                        onClick={() => deliverMutation.mutate(r.id)}
                      >
                        Marcar entregado
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
