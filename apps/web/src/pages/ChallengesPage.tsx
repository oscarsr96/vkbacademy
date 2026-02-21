import { useState } from 'react';
import { useMyChallenges, useRedeemItem } from '../hooks/useChallenges';
import type { ChallengeWithProgress } from '../api/challenges.api';

// ─── Artículos de merchandising ───────────────────────────────────────────────

interface MerchItem {
  id: string;
  icon: string;
  name: string;
  description: string;
  cost: number;
  color: string;
}

const MERCH_ITEMS: MerchItem[] = [
  {
    id: 'stickers',
    icon: '🎨',
    name: 'Pack de stickers VKB',
    description: 'Set de 10 pegatinas exclusivas del club con los logos y jugadores.',
    cost: 100,
    color: '#10b981',
  },
  {
    id: 'bottle',
    icon: '💧',
    name: 'Botella termo del club',
    description: 'Botella de acero inoxidable con el escudo de Vallekas Basket. 500 ml.',
    cost: 200,
    color: '#3b82f6',
  },
  {
    id: 'cap',
    icon: '🧢',
    name: 'Gorra oficial VKB',
    description: 'Gorra snapback con bordado del logo. Talla única ajustable.',
    cost: 350,
    color: '#f59e0b',
  },
  {
    id: 'shirt',
    icon: '👕',
    name: 'Camiseta oficial del club',
    description: 'Camiseta de entrenamiento con tu nombre y el número que elijas.',
    cost: 500,
    color: '#6366f1',
  },
  {
    id: 'ball',
    icon: '🏀',
    name: 'Balón firmado por el equipo',
    description: 'Balón de baloncesto oficial firmado por todos los jugadores de la plantilla.',
    cost: 1000,
    color: '#ef4444',
  },
];

// ─── Tipos ────────────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'in-progress' | 'completed';

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={barStyles.track}>
      <div style={{ ...barStyles.fill, width: `${pct}%`, background: color }} />
    </div>
  );
}

const barStyles: Record<string, React.CSSProperties> = {
  track: { height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', flex: 1 },
  fill: { height: '100%', borderRadius: 4, transition: 'width 0.4s ease' },
};

function ChallengeCard({ c }: { c: ChallengeWithProgress }) {
  return (
    <div style={{ ...styles.card, ...(c.completed ? styles.cardCompleted : {}) }}>
      <div style={{ ...styles.iconBox, background: c.completed ? c.badgeColor : 'rgba(255,255,255,0.06)' }}>
        <span style={{ fontSize: '2rem', lineHeight: 1 }}>{c.badgeIcon}</span>
      </div>
      <div style={styles.content}>
        <div style={styles.cardHeader}>
          <span style={styles.cardTitle}>{c.title}</span>
          {c.completed && (
            <span style={{ ...styles.completedBadge, background: c.badgeColor }}>✓ Completado</span>
          )}
        </div>
        <p style={styles.cardDesc}>{c.description}</p>
        <div style={styles.progressRow}>
          <ProgressBar value={c.progress} max={c.target} color={c.badgeColor} />
          <span style={styles.progressText}>{c.progress}/{c.target}</span>
        </div>
        <div style={styles.cardFooter}>
          <span style={styles.pointsLabel}>⭐ {c.points} pts</span>
          {c.completedAt && (
            <span style={styles.dateLabel}>{new Date(c.completedAt).toLocaleDateString('es-ES')}</span>
          )}
        </div>
      </div>
    </div>
  );
}

interface MerchCardProps {
  item: MerchItem;
  userPoints: number;
  onRedeem: (item: MerchItem) => void;
}

function MerchCard({ item, userPoints, onRedeem }: MerchCardProps) {
  const canAfford = userPoints >= item.cost;
  return (
    <div style={{ ...styles.merchCard, opacity: canAfford ? 1 : 0.55 }}>
      <div style={{ ...styles.merchIcon, background: item.color + '22', border: `1px solid ${item.color}44` }}>
        <span style={{ fontSize: '2.2rem', lineHeight: 1 }}>{item.icon}</span>
      </div>
      <div style={styles.merchBody}>
        <div style={styles.merchName}>{item.name}</div>
        <div style={styles.merchDesc}>{item.description}</div>
      </div>
      <div style={styles.merchFooter}>
        <span style={{ ...styles.merchCost, color: item.color }}>⭐ {item.cost} pts</span>
        <button
          style={{
            ...styles.redeemBtn,
            background: canAfford ? item.color : 'rgba(255,255,255,0.06)',
            color: canAfford ? '#fff' : 'var(--color-muted)',
            cursor: canAfford ? 'pointer' : 'not-allowed',
          }}
          disabled={!canAfford}
          onClick={() => onRedeem(item)}
        >
          {canAfford ? 'Canjear' : 'Puntos insuficientes'}
        </button>
      </div>
    </div>
  );
}

// ─── Modal de confirmación ────────────────────────────────────────────────────

interface ConfirmModalProps {
  item: MerchItem;
  userPoints: number;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmModal({ item, userPoints, isPending, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={{ fontSize: '3rem', textAlign: 'center', marginBottom: 12 }}>{item.icon}</div>
        <h2 style={styles.modalTitle}>¿Canjear este artículo?</h2>
        <p style={styles.modalDesc}>{item.name}</p>
        <div style={styles.modalPointsRow}>
          <span style={styles.modalPointsBefore}>Tus puntos: <strong>{userPoints}</strong></span>
          <span style={styles.modalArrow}>→</span>
          <span style={styles.modalPointsAfter}>Quedarán: <strong>{userPoints - item.cost}</strong></span>
        </div>
        <p style={styles.modalNote}>
          Una vez canjeado, un responsable del club se pondrá en contacto contigo para entregarte el artículo.
        </p>
        <div style={styles.modalActions}>
          <button style={styles.btnSecondary} onClick={onCancel} disabled={isPending}>
            Cancelar
          </button>
          <button
            style={{ ...styles.btnPrimary, background: item.color }}
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? 'Canjeando...' : `Confirmar (−${item.cost} pts)`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Toast de éxito ───────────────────────────────────────────────────────────

function SuccessToast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div style={styles.toast}>
      <span>✅ {message}</span>
      <button onClick={onClose} style={styles.toastClose}>✕</button>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ChallengesPage() {
  const [filter, setFilter] = useState<FilterTab>('all');
  const [confirmItem, setConfirmItem] = useState<MerchItem | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const { data, isLoading, isError } = useMyChallenges();
  const redeemMutation = useRedeemItem();

  const totalPoints = data?.meta.totalPoints ?? 0;

  const filtered = (data?.challenges ?? []).filter((c) => {
    if (filter === 'completed') return c.completed;
    if (filter === 'in-progress') return !c.completed;
    return true;
  });

  const handleConfirmRedeem = () => {
    if (!confirmItem) return;
    redeemMutation.mutate(
      { itemName: confirmItem.name, cost: confirmItem.cost },
      {
        onSuccess: (result) => {
          setConfirmItem(null);
          setSuccessMsg(result.message);
          setTimeout(() => setSuccessMsg(null), 5000);
        },
      },
    );
  };

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Mis Retos</h1>

      {/* KPIs */}
      {data && (
        <div style={styles.kpiRow}>
          <div style={styles.kpiCard}>
            <span style={styles.kpiIcon}>🏆</span>
            <div>
              <div style={styles.kpiValue}>{data.meta.totalPoints}</div>
              <div style={styles.kpiLabel}>Puntos</div>
            </div>
          </div>
          <div style={styles.kpiCard}>
            <span style={styles.kpiIcon}>🔥</span>
            <div>
              <div style={styles.kpiValue}>{data.meta.currentStreak} semanas</div>
              <div style={styles.kpiLabel}>Racha actual</div>
            </div>
          </div>
          <div style={styles.kpiCard}>
            <span style={styles.kpiIcon}>✅</span>
            <div>
              <div style={styles.kpiValue}>
                {data.challenges.filter((c) => c.completed).length}/{data.challenges.length}
              </div>
              <div style={styles.kpiLabel}>Retos</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tienda de canje ──────────────────────────────────────────────── */}
      <div style={styles.shopSection}>
        <div style={styles.shopHeader}>
          <div>
            <h2 style={styles.shopTitle}>🛍️ Tienda del club</h2>
            <p style={styles.shopSubtitle}>Canjea tus puntos por merchandising oficial de Vallekas Basket</p>
          </div>
          <div style={styles.shopPoints}>
            <span style={styles.shopPointsValue}>{totalPoints}</span>
            <span style={styles.shopPointsLabel}>pts disponibles</span>
          </div>
        </div>

        <div style={styles.merchGrid}>
          {MERCH_ITEMS.map((item) => (
            <MerchCard
              key={item.id}
              item={item}
              userPoints={totalPoints}
              onRedeem={setConfirmItem}
            />
          ))}
        </div>
      </div>

      {/* ── Retos ────────────────────────────────────────────────────────── */}
      <h2 style={styles.sectionTitle}>Mis retos</h2>

      <div style={styles.tabs}>
        {(['all', 'in-progress', 'completed'] as FilterTab[]).map((tab) => (
          <button
            key={tab}
            style={{ ...styles.tab, ...(filter === tab ? styles.tabActive : {}) }}
            onClick={() => setFilter(tab)}
          >
            {tab === 'all' ? 'Todos' : tab === 'in-progress' ? 'En progreso' : 'Completados'}
          </button>
        ))}
      </div>

      {isLoading && <p style={styles.empty}>Cargando retos...</p>}
      {isError && <p style={styles.empty}>Error al cargar los retos.</p>}
      {!isLoading && !isError && filtered.length === 0 && (
        <p style={styles.empty}>No hay retos en esta categoría.</p>
      )}

      <div style={styles.grid}>
        {filtered.map((c) => (
          <ChallengeCard key={c.id} c={c} />
        ))}
      </div>

      {/* Modal de confirmación */}
      {confirmItem && (
        <ConfirmModal
          item={confirmItem}
          userPoints={totalPoints}
          isPending={redeemMutation.isPending}
          onConfirm={handleConfirmRedeem}
          onCancel={() => setConfirmItem(null)}
        />
      )}

      {/* Toast de éxito */}
      {successMsg && (
        <SuccessToast message={successMsg} onClose={() => setSuccessMsg(null)} />
      )}
    </div>
  );
}

// ─── Estilos ─────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 900, margin: '0 auto' },
  title: { fontSize: '1.6rem', fontWeight: 700, marginBottom: 24, color: 'var(--color-text)' },
  sectionTitle: { fontSize: '1.2rem', fontWeight: 700, marginBottom: 16, color: 'var(--color-text)' },

  // KPIs
  kpiRow: { display: 'flex', gap: 16, marginBottom: 32, flexWrap: 'wrap' as const },
  kpiCard: {
    flex: '1 1 180px',
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

  // Tienda
  shopSection: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius)',
    padding: '24px',
    marginBottom: 40,
  },
  shopHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    flexWrap: 'wrap' as const,
    gap: 12,
  },
  shopTitle: { fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 },
  shopSubtitle: { fontSize: '0.85rem', color: 'var(--color-muted)', margin: '4px 0 0' },
  shopPoints: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-end',
    gap: 2,
  },
  shopPointsValue: { fontSize: '1.6rem', fontWeight: 700, color: 'var(--color-primary)', lineHeight: 1 },
  shopPointsLabel: { fontSize: '0.75rem', color: 'var(--color-muted)' },

  merchGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: 16,
  },
  merchCard: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
    transition: 'opacity 0.2s',
  },
  merchIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  merchBody: { flex: 1 },
  merchName: { fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text)', marginBottom: 4 },
  merchDesc: { fontSize: '0.8rem', color: 'var(--color-muted)', lineHeight: 1.4 },
  merchFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  merchCost: { fontWeight: 700, fontSize: '0.9rem' },
  redeemBtn: {
    padding: '7px 14px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    fontSize: '0.8rem',
    fontWeight: 600,
    transition: 'opacity 0.15s',
    whiteSpace: 'nowrap' as const,
  },

  // Filtros
  tabs: { display: 'flex', gap: 8, marginBottom: 24 },
  tab: {
    padding: '8px 18px',
    borderRadius: 20,
    border: '1px solid var(--color-border)',
    background: 'transparent',
    color: 'var(--color-muted)',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: 500,
    transition: 'all 0.15s',
  },
  tabActive: { background: 'var(--color-primary)', borderColor: 'var(--color-primary)', color: '#fff' },

  // Cards de reto
  grid: { display: 'flex', flexDirection: 'column' as const, gap: 16 },
  card: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius)',
    padding: '20px 24px',
    display: 'flex',
    gap: 20,
    alignItems: 'flex-start',
    transition: 'border-color 0.15s',
  },
  cardCompleted: { borderColor: 'rgba(99,102,241,0.4)' },
  iconBox: {
    width: 60,
    height: 60,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'background 0.15s',
  },
  content: { flex: 1, minWidth: 0 },
  cardHeader: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' as const },
  cardTitle: { fontWeight: 600, color: 'var(--color-text)', fontSize: '1rem' },
  completedBadge: { fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20, color: '#fff', letterSpacing: '0.03em' },
  cardDesc: { fontSize: '0.875rem', color: 'var(--color-muted)', margin: '0 0 12px' },
  progressRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 },
  progressText: { fontSize: '0.8rem', color: 'var(--color-muted)', whiteSpace: 'nowrap' as const },
  cardFooter: { display: 'flex', alignItems: 'center', gap: 16 },
  pointsLabel: { fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text)' },
  dateLabel: { fontSize: '0.75rem', color: 'var(--color-muted)' },

  empty: { color: 'var(--color-muted)', padding: '32px 0', textAlign: 'center' as const },

  // Modal
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
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
    padding: '32px',
    width: '100%',
    maxWidth: 420,
    textAlign: 'center' as const,
  },
  modalTitle: { fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text)', margin: '0 0 8px' },
  modalDesc: { color: 'var(--color-muted)', fontSize: '0.9rem', margin: '0 0 20px' },
  modalPointsRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 'var(--radius-sm)',
    padding: '12px 16px',
    marginBottom: 16,
  },
  modalPointsBefore: { fontSize: '0.9rem', color: 'var(--color-muted)' },
  modalArrow: { fontSize: '1rem', color: 'var(--color-muted)' },
  modalPointsAfter: { fontSize: '0.9rem', color: 'var(--color-text)' },
  modalNote: {
    fontSize: '0.8rem',
    color: 'var(--color-muted)',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: 'var(--radius-sm)',
    padding: '10px 14px',
    margin: '0 0 24px',
    lineHeight: 1.5,
    textAlign: 'left' as const,
  },
  modalActions: { display: 'flex', gap: 12, justifyContent: 'center' },
  btnPrimary: {
    padding: '10px 20px',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.875rem',
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

  // Toast
  toast: {
    position: 'fixed' as const,
    bottom: 24,
    right: 24,
    background: '#10b981',
    color: '#fff',
    padding: '14px 20px',
    borderRadius: 'var(--radius-sm)',
    fontWeight: 600,
    fontSize: '0.9rem',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
    zIndex: 2000,
  },
  toastClose: {
    background: 'transparent',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.85rem',
    padding: 0,
    lineHeight: 1,
  },
};
