import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth.store';
import { useAcademyFilterStore } from '../store/academy-filter.store';
import { Role } from '@vkbacademy/shared';
import api from '../lib/axios';

interface AcademyOption {
  id: string;
  slug: string;
  name: string;
  primaryColor: string | null;
  _count: { members: number };
}

/**
 * Dropdown de filtro por academia. Solo visible para SUPER_ADMIN.
 * Cuando cambia, las queries de React Query se invalidan automáticamente
 * via el queryKey que incluye el selectedAcademyId.
 */
export default function AcademyFilter() {
  const user = useAuthStore((s) => s.user);
  const { selectedAcademyId, setSelectedAcademyId } = useAcademyFilterStore();

  const { data: academies = [] } = useQuery<AcademyOption[]>({
    queryKey: ['academies'],
    queryFn: () => api.get('/academies').then((r) => r.data),
    enabled: user?.role === Role.SUPER_ADMIN,
  });

  if (user?.role !== Role.SUPER_ADMIN) return null;

  const selected = academies.find((a) => a.id === selectedAcademyId);

  return (
    <div style={styles.wrapper}>
      <div style={styles.pill}>
        <span style={styles.label}>Academia:</span>
        <select
          value={selectedAcademyId ?? ''}
          onChange={(e) => setSelectedAcademyId(e.target.value || null)}
          style={styles.select}
        >
          <option value="">Todas las academias</option>
          {academies.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a._count.members})
            </option>
          ))}
        </select>
        {selected && (
          <span
            style={{ ...styles.dot, background: selected.primaryColor ?? '#6366f1' }}
          />
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    marginBottom: 20,
  },
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    background: '#0f172a',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    padding: '6px 14px',
  },
  label: {
    color: '#64748b',
    fontSize: '0.8rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  select: {
    background: 'transparent',
    border: 'none',
    color: '#f1f5f9',
    fontSize: '0.85rem',
    fontWeight: 600,
    outline: 'none',
    cursor: 'pointer',
    padding: '2px 0',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    flexShrink: 0,
  },
};
