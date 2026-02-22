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

function ChallengeCard({ c }: { c: ChallengeWithProgress }) {
  const pct = c.target > 0 ? Math.min((c.progress / c.target) * 100, 100) : 0;

  const cardStyle: React.CSSProperties = {
    background: c.completed ? 'rgba(245,158,11,0.05)' : 'var(--color-surface)',
    border: c.completed
      ? '1.5px solid rgba(245,158,11,0.4)'
      : '1.5px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    padding: '20px 24px',
    display: 'flex',
    gap: 20,
    alignItems: 'flex-start',
    boxShadow: c.completed
      ? '0 4px 20px rgba(245,158,11,0.10)'
      : 'var(--shadow-card)',
    transition: 'box-shadow 0.25s, transform 0.25s, border-color 0.25s',
  };

  return (
    <div className="vkb-card animate-in" style={cardStyle}>
      {/* Icono grande del reto */}
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          background: c.completed ? c.badgeColor : 'rgba(234,88,12,0.10)',
          border: c.completed ? 'none' : '1.5px solid rgba(234,88,12,0.18)',
          boxShadow: c.completed ? `0 4px 16px ${c.badgeColor}44` : 'none',
        }}
      >
        <span style={{ fontSize: '2rem', lineHeight: 1 }}>{c.badgeIcon}</span>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Cabecera */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' as const }}>
          <span style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '1rem' }}>
            {c.title}
          </span>
          {c.completed && (
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: 20,
                background: 'rgba(245,158,11,0.15)',
                color: '#b45309',
                border: '1px solid rgba(245,158,11,0.35)',
                letterSpacing: '0.03em',
              }}
            >
              Completado
            </span>
          )}
        </div>

        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '0 0 14px' }}>
          {c.description}
        </p>

        {/* Barra de progreso */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div className="progress-bar" style={{ flex: 1 }}>
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' as const, fontWeight: 600 }}>
            {c.progress}/{c.target}
          </span>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span
            style={{
              fontSize: '0.875rem',
              fontWeight: 700,
              background: 'var(--gradient-orange)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            ⭐ {c.points} pts
          </span>
          {c.completedAt && (
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              {new Date(c.completedAt).toLocaleDateString('es-ES')}
            </span>
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
    <div
      className="vkb-card"
      style={{
        opacity: canAfford ? 1 : 0.55,
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 14,
        padding: '20px',
        transition: 'opacity 0.2s, box-shadow 0.25s, transform 0.25s',
      }}
    >
      {/* Icono */}
      <div
        style={{
          width: 60,
          height: 60,
          borderRadius: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: item.color + '18',
          border: `1.5px solid ${item.color}44`,
        }}
      >
        <span style={{ fontSize: '2.2rem', lineHeight: 1 }}>{item.icon}</span>
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text)', marginBottom: 6 }}>
          {item.name}
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
          {item.description}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ fontWeight: 800, fontSize: '1.05rem', color: item.color }}>
          ⭐ {item.cost} pts
        </span>
        <button
          className={canAfford ? 'btn btn-primary' : 'btn'}
          style={
            canAfford
              ? { padding: '7px 16px', fontSize: '0.8rem' }
              : {
                  padding: '7px 16px',
                  fontSize: '0.8rem',
                  background: 'rgba(255,255,255,0.06)',
                  color: 'var(--color-text-muted)',
                  border: '1px solid var(--color-border)',
                  cursor: 'not-allowed',
                  opacity: 0.7,
                }
          }
          disabled={!canAfford}
          onClick={() => onRedeem(item)}
        >
          {canAfford ? 'Canjear' : 'Sin puntos'}
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
    <div
      style={{
        position: 'fixed' as const,
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 24,
      }}
    >
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1.5px solid var(--color-border)',
          borderRadius: 'var(--radius-xl)',
          padding: '36px 32px',
          width: '100%',
          maxWidth: 440,
          textAlign: 'center' as const,
          boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ fontSize: '3.5rem', textAlign: 'center', marginBottom: 16 }}>{item.icon}</div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)', margin: '0 0 8px' }}>
          Confirmar canje
        </h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', margin: '0 0 24px' }}>
          {item.name}
        </p>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 20,
            background: 'rgba(234,88,12,0.06)',
            border: '1px solid rgba(234,88,12,0.15)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 20px',
            marginBottom: 20,
          }}
        >
          <div style={{ textAlign: 'center' as const }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: 2 }}>Tus puntos</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)' }}>{userPoints}</div>
          </div>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '1.2rem' }}>→</div>
          <div style={{ textAlign: 'center' as const }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: 2 }}>Quedarán</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-primary)' }}>
              {userPoints - item.cost}
            </div>
          </div>
        </div>

        <p
          style={{
            fontSize: '0.8rem',
            color: 'var(--color-text-muted)',
            background: 'var(--color-bg)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 14px',
            margin: '0 0 24px',
            lineHeight: 1.6,
            textAlign: 'left' as const,
          }}
        >
          Un responsable del club se pondrá en contacto contigo para entregarte el artículo.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            className="btn btn-ghost"
            onClick={onCancel}
            disabled={isPending}
            style={{ padding: '10px 22px' }}
          >
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            onClick={onConfirm}
            disabled={isPending}
            style={{ padding: '10px 22px', background: item.color }}
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
    <div
      style={{
        position: 'fixed' as const,
        bottom: 28,
        right: 28,
        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        color: '#fff',
        padding: '14px 22px',
        borderRadius: 'var(--radius-md)',
        fontWeight: 700,
        fontSize: '0.9rem',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        boxShadow: '0 8px 32px rgba(16,185,129,0.35)',
        zIndex: 2000,
      }}
    >
      <span>✅ {message}</span>
      <button
        onClick={onClose}
        style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '0.9rem', padding: 0, lineHeight: 1 }}
      >
        ✕
      </button>
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
  const currentStreak = data?.meta.currentStreak ?? 0;
  const longestStreak = data?.meta.longestStreak ?? 0;
  const completedCount = (data?.challenges ?? []).filter((c) => c.completed).length;
  const totalCount = data?.challenges.length ?? 0;

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
    <div style={{ maxWidth: 960, margin: '0 auto' }}>

      {/* Hero */}
      <div className="page-hero animate-in">
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 32, flexWrap: 'wrap' as const }}>
          {/* Puntos totales muy grandes */}
          <div>
            <div
              style={{
                fontSize: '3.5rem',
                fontWeight: 900,
                background: 'var(--gradient-orange)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                lineHeight: 1,
                letterSpacing: '-0.03em',
              }}
            >
              {totalPoints.toLocaleString('es-ES')}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.85rem', marginTop: 4, fontWeight: 500 }}>
              puntos totales
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 56, background: 'rgba(255,255,255,0.12)' }} />

          {/* Stats secundarias */}
          <div style={{ display: 'flex', gap: 28 }}>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff' }}>
                🔥 {currentStreak}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                semanas racha
              </div>
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff' }}>
                ✅ {completedCount}/{totalCount}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                retos completados
              </div>
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff' }}>
                🏅 {longestStreak}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                mejor racha
              </div>
            </div>
          </div>
        </div>

        <h1 className="hero-title" style={{ marginTop: 20, fontSize: '1.6rem' }}>
          Mis Retos
        </h1>
        <p className="hero-subtitle">Tu progreso en retos y tienda de merchandising</p>
      </div>

      {/* ── Tienda de canje ──────────────────────────────────────────────── */}
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1.5px solid var(--color-border)',
          borderRadius: 'var(--radius-xl)',
          padding: '28px 28px 24px',
          marginBottom: 40,
          boxShadow: 'var(--shadow-card)',
        }}
      >
        {/* Cabecera tienda */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 24,
            flexWrap: 'wrap' as const,
            gap: 12,
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-text)', margin: '0 0 4px' }}>
              🛍️ Tienda del club
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: 0 }}>
              Canjea tus puntos por merchandising oficial de Vallekas Basket
            </p>
          </div>

          {/* Puntos disponibles */}
          <div className="stat-card" style={{ padding: '12px 20px', textAlign: 'center' as const }}>
            <div
              style={{
                fontSize: '1.75rem',
                fontWeight: 900,
                background: 'var(--gradient-orange)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                lineHeight: 1,
              }}
            >
              {totalPoints}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 2, fontWeight: 500 }}>
              pts disponibles
            </div>
          </div>
        </div>

        {/* Grid de artículos */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 16,
          }}
        >
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
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: 12 }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>
          Mis retos
        </h2>

        {/* Tabs de filtro */}
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'in-progress', 'completed'] as FilterTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              style={{
                padding: '7px 16px',
                borderRadius: 20,
                border: filter === tab ? 'none' : '1.5px solid var(--color-border)',
                background: filter === tab ? 'var(--gradient-orange)' : 'transparent',
                color: filter === tab ? '#fff' : 'var(--color-text-muted)',
                cursor: 'pointer',
                fontSize: '0.82rem',
                fontWeight: 600,
                boxShadow: filter === tab ? 'var(--shadow-orange)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {tab === 'all' ? 'Todos' : tab === 'in-progress' ? 'En progreso' : 'Completados'}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <p style={{ color: 'var(--color-text-muted)', padding: '32px 0', textAlign: 'center' as const }}>
          Cargando retos...
        </p>
      )}
      {isError && (
        <p style={{ color: 'var(--color-error)', padding: '32px 0', textAlign: 'center' as const }}>
          Error al cargar los retos.
        </p>
      )}
      {!isLoading && !isError && filtered.length === 0 && (
        <p style={{ color: 'var(--color-text-muted)', padding: '32px 0', textAlign: 'center' as const }}>
          No hay retos en esta categoría.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 14 }}>
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
