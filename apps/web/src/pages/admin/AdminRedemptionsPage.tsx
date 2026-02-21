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

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Canjes de puntos</h1>

      {/* KPIs */}
      <div style={styles.kpiRow}>
        <div style={styles.kpiCard}>
          <span style={styles.kpiIcon}>🎁</span>
          <div>
            <div style={styles.kpiValue}>{list.length}</div>
            <div style={styles.kpiLabel}>Canjes totales</div>
          </div>
        </div>
        <div style={styles.kpiCard}>
          <span style={styles.kpiIcon}>⏳</span>
          <div>
            <div style={{ ...styles.kpiValue, color: pendingCount > 0 ? '#f59e0b' : 'var(--color-text)' }}>
              {pendingCount}
            </div>
            <div style={styles.kpiLabel}>Pendientes de entregar</div>
          </div>
        </div>
        <div style={styles.kpiCard}>
          <span style={styles.kpiIcon}>⭐</span>
          <div>
            <div style={styles.kpiValue}>{totalPointsSpent}</div>
            <div style={styles.kpiLabel}>Puntos canjeados</div>
          </div>
        </div>
        <div style={styles.kpiCard}>
          <span style={styles.kpiIcon}>👤</span>
          <div>
            <div style={styles.kpiValue}>{new Set(list.map((r) => r.userId)).size}</div>
            <div style={styles.kpiLabel}>Alumnos distintos</div>
          </div>
        </div>
      </div>

      {isLoading && <p style={styles.empty}>Cargando canjes...</p>}

      {!isLoading && list.length === 0 && (
        <p style={styles.empty}>Todavía no hay ningún canje registrado.</p>
      )}

      {!isLoading && list.length > 0 && (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Alumno</th>
                <th style={styles.th}>Artículo</th>
                <th style={styles.th}>Puntos</th>
                <th style={styles.th}>Canjeado</th>
                <th style={styles.th}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} style={{ ...styles.tr, opacity: r.delivered ? 0.6 : 1 }}>
                  {/* Alumno */}
                  <td style={styles.td}>
                    <div style={styles.userCell}>
                      <div style={styles.avatar}>{r.user.name.charAt(0).toUpperCase()}</div>
                      <div>
                        <div style={styles.userName}>{r.user.name}</div>
                        <div style={styles.userEmail}>{r.user.email}</div>
                      </div>
                    </div>
                  </td>

                  {/* Artículo */}
                  <td style={styles.td}>
                    <span style={styles.itemName}>{r.itemName}</span>
                  </td>

                  {/* Puntos */}
                  <td style={styles.td}>
                    <span style={styles.costBadge}>⭐ {r.cost} pts</span>
                  </td>

                  {/* Fecha de canje */}
                  <td style={styles.td}>
                    <span style={styles.date}>
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
                  <td style={styles.td}>
                    {r.delivered ? (
                      <div style={styles.deliveredCell}>
                        <span style={styles.deliveredBadge}>✓ Entregado</span>
                        <span style={styles.deliveredDate}>
                          {new Date(r.deliveredAt!).toLocaleDateString('es-ES', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    ) : (
                      <button
                        style={styles.deliverBtn}
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

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 1000, margin: '0 auto' },
  title: { fontSize: '1.6rem', fontWeight: 700, marginBottom: 24, color: 'var(--color-text)' },

  kpiRow: { display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' as const },
  kpiCard: {
    flex: '1 1 160px',
    background: 'var(--color-surface)',
    borderRadius: 'var(--radius)',
    padding: '20px 24px',
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    border: '1px solid var(--color-border)',
  },
  kpiIcon: { fontSize: '2rem', lineHeight: 1 },
  kpiValue: { fontSize: '1.6rem', fontWeight: 700, color: 'var(--color-text)' },
  kpiLabel: { fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: 2 },

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
  tr: { borderBottom: '1px solid var(--color-border)', transition: 'opacity 0.2s' },
  td: { padding: '14px 16px', fontSize: '0.9rem', color: 'var(--color-text)', verticalAlign: 'middle' as const },

  userCell: { display: 'flex', alignItems: 'center', gap: 12 },
  avatar: {
    width: 34, height: 34, borderRadius: '50%',
    background: 'var(--color-primary)', color: '#fff',
    fontWeight: 700, fontSize: '0.85rem',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  userName: { fontWeight: 500, fontSize: '0.9rem' },
  userEmail: { fontSize: '0.75rem', color: 'var(--color-muted)' },

  itemName: { fontWeight: 500 },
  costBadge: { fontSize: '0.82rem', fontWeight: 700, color: '#f59e0b' },
  date: { fontSize: '0.82rem', color: 'var(--color-muted)' },

  deliveredCell: { display: 'flex', flexDirection: 'column' as const, gap: 2 },
  deliveredBadge: {
    fontSize: '0.78rem', fontWeight: 700,
    color: '#10b981',
    display: 'inline-flex', alignItems: 'center', gap: 4,
  },
  deliveredDate: { fontSize: '0.72rem', color: 'var(--color-muted)' },

  deliverBtn: {
    padding: '6px 14px',
    background: 'rgba(16,185,129,0.12)',
    color: '#10b981',
    border: '1px solid rgba(16,185,129,0.3)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 600,
    transition: 'all 0.15s',
    whiteSpace: 'nowrap' as const,
  },

  empty: { color: 'var(--color-muted)', padding: '48px 0', textAlign: 'center' as const },
};
