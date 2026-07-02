import { useState } from 'react';
import { useMyChallenges, useRedeemItem } from '../hooks/useChallenges';
import type { ChallengeWithProgress } from '../api/challenges.api';
import { usePageZone } from '../hooks/usePageZone';
import { launchConfetti } from '../utils/confetti';
import Icon from '../components/ui/Icon';
import ScoreValue from '../components/ui/ScoreValue';
import ProgressBar from '../components/ui/ProgressBar';
import EmptyState from '../components/ui/EmptyState';

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
    icon: 'sticker',
    name: 'Pack de stickers VKB',
    description: 'Set de 10 pegatinas exclusivas del club con los logos y jugadores.',
    cost: 100,
    color: '#10b981',
  },
  {
    id: 'bottle',
    icon: 'bottle',
    name: 'Botella termo del club',
    description: 'Botella de acero inoxidable con el escudo de Vallekas Basket. 500 ml.',
    cost: 200,
    color: '#13aff0',
  },
  {
    id: 'cap',
    icon: 'cap',
    name: 'Gorra oficial VKB',
    description: 'Gorra snapback con bordado del logo. Talla única ajustable.',
    cost: 350,
    color: '#ffd24d',
  },
  {
    id: 'shirt',
    icon: 'shirt',
    name: 'Camiseta oficial del club',
    description: 'Camiseta de entrenamiento con tu nombre y el número que elijas.',
    cost: 500,
    color: '#f5911e',
  },
  {
    id: 'ball',
    icon: 'basketball',
    name: 'Balón firmado por el equipo',
    description: 'Balón de baloncesto oficial firmado por todos los jugadores de la plantilla.',
    cost: 1000,
    color: '#cb2027',
  },
];

// ─── Tipos ────────────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'in-progress' | 'completed';

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function ChallengeCard({ c, index }: { c: ChallengeWithProgress; index: number }) {
  const cardStyle: React.CSSProperties = {
    border: c.completed
      ? '1.5px solid rgba(255, 210, 77, 0.35)'
      : '1px solid var(--panel-border)',
    padding: '20px 24px',
    display: 'flex',
    gap: 20,
    alignItems: 'flex-start',
    boxShadow: c.completed ? '0 4px 20px rgba(255, 210, 77, 0.08)' : undefined,
    animation: `riseIn 0.5s cubic-bezier(0.18, 0.72, 0.24, 1.12) ${index * 50}ms both`,
  };

  return (
    <div className="panel-glass" style={cardStyle}>
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
          background: c.completed ? c.badgeColor : 'var(--brand-soft)',
          border: c.completed ? 'none' : '1.5px solid var(--brand-soft)',
          boxShadow: c.completed ? `0 4px 16px ${c.badgeColor}44` : 'none',
        }}
      >
        <span style={{ fontSize: '2rem', lineHeight: 1 }}>{c.badgeIcon}</span>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Cabecera */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 6,
            flexWrap: 'wrap' as const,
          }}
        >
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
                background: 'rgba(255, 210, 77, 0.14)',
                color: 'var(--amber-led)',
                border: '1px solid rgba(255, 210, 77, 0.35)',
                letterSpacing: '0.03em',
                textTransform: 'uppercase' as const,
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
          <div style={{ flex: 1 }}>
            <ProgressBar
              value={c.progress}
              max={c.target}
              variant={c.completed ? 'amber' : 'brand'}
              label={`Progreso del reto ${c.title}`}
            />
          </div>
          <span
            style={{
              fontSize: '0.8rem',
              color: 'var(--color-text-muted)',
              whiteSpace: 'nowrap' as const,
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {c.progress}/{c.target}
          </span>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.875rem',
              fontWeight: 700,
              color: 'var(--brand-light)',
            }}
          >
            <Icon name="star" size={14} />
            {c.points} pts
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
          color: item.color,
        }}
      >
        <Icon name={item.icon} size={28} />
      </div>

      <div style={{ flex: 1 }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: '0.95rem',
            color: 'var(--color-text)',
            marginBottom: 6,
          }}
        >
          {item.name}
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
          {item.description}
        </div>
      </div>

      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontWeight: 800,
            fontSize: '1.05rem',
            color: item.color,
          }}
        >
          <Icon name="star" size={16} />
          {item.cost} pts
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
          background: 'var(--navy-800)',
          border: '1px solid var(--panel-border)',
          borderRadius: 'var(--radius-xl)',
          padding: '36px 32px',
          width: '100%',
          maxWidth: 440,
          textAlign: 'center' as const,
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          animation: 'popIn 0.25s cubic-bezier(0.18, 0.72, 0.24, 1.12) both',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 76,
            height: 76,
            borderRadius: 20,
            background: item.color + '22',
            color: item.color,
            marginBottom: 16,
          }}
        >
          <Icon name={item.icon} size={38} />
        </div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f1f5f9', margin: '0 0 8px' }}>
          Confirmar canje
        </h2>
        <p style={{ color: 'rgba(241,245,249,0.6)', fontSize: '0.95rem', margin: '0 0 24px' }}>
          {item.name}
        </p>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 20,
            background: 'var(--brand-faint)',
            border: '1px solid var(--brand-soft)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 20px',
            marginBottom: 20,
          }}
        >
          <div style={{ textAlign: 'center' as const }}>
            <div style={{ fontSize: '0.75rem', color: 'rgba(241,245,249,0.6)', marginBottom: 2 }}>
              Tus puntos
            </div>
            <div className="score-number" style={{ fontSize: '1.4rem' }}>
              {userPoints}
            </div>
          </div>
          <div style={{ color: 'rgba(241,245,249,0.6)', fontSize: '1.2rem' }}>→</div>
          <div style={{ textAlign: 'center' as const }}>
            <div style={{ fontSize: '0.75rem', color: 'rgba(241,245,249,0.6)', marginBottom: 2 }}>
              Quedarán
            </div>
            <div className="score-number" style={{ fontSize: '1.4rem' }}>
              {userPoints - item.cost}
            </div>
          </div>
        </div>

        <p
          style={{
            fontSize: '0.8rem',
            color: 'rgba(241,245,249,0.6)',
            background: 'rgba(255,255,255,0.05)',
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
            className="btn btn-dark"
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
            style={{ padding: '10px 22px' }}
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
        animation: 'riseIn 0.35s ease both',
      }}
    >
      <Icon name="check" size={18} />
      <span>{message}</span>
      <button
        onClick={onClose}
        aria-label="Cerrar aviso"
        style={{
          background: 'transparent',
          border: 'none',
          color: '#fff',
          cursor: 'pointer',
          padding: 0,
          lineHeight: 1,
          display: 'inline-flex',
        }}
      >
        <Icon name="close" size={16} />
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
  usePageZone('dark');

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
          launchConfetti();
          setTimeout(() => setSuccessMsg(null), 5000);
        },
      },
    );
  };

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* Hero marcador */}
      <div className="page-hero court-lines sweep-light animate-in">
        <div
          style={{ display: 'flex', alignItems: 'flex-end', gap: 32, flexWrap: 'wrap' as const }}
        >
          {/* Puntos totales en marcador LED */}
          <div>
            <ScoreValue value={totalPoints} size="3.6rem" pulse suffix="pts" />
            <div
              style={{
                color: 'rgba(255,255,255,0.55)',
                fontSize: '0.75rem',
                marginTop: 6,
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase' as const,
              }}
            >
              Puntos totales
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 56, background: 'rgba(255,255,255,0.12)' }} />

          {/* Stats secundarias */}
          <div style={{ display: 'flex', gap: 28 }}>
            <HeroStat icon="flame" value={String(currentStreak)} label="semanas racha" />
            <HeroStat icon="check" value={`${completedCount}/${totalCount}`} label="retos completados" />
            <HeroStat icon="medal" value={String(longestStreak)} label="mejor racha" />
          </div>
        </div>

        <h1 className="hero-title" style={{ marginTop: 22, fontSize: '1.8rem' }}>
          Mis Retos
        </h1>
        <p className="hero-subtitle">Tu progreso en retos y tienda de merchandising</p>
      </div>

      {/* ── Tienda de canje ──────────────────────────────────────────────── */}
      <div className="panel-glass" style={{ padding: '28px 28px 24px', marginBottom: 40 }}>
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
            <h2
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: '1.15rem',
                fontWeight: 800,
                color: 'var(--color-text)',
                margin: '0 0 4px',
              }}
            >
              <Icon name="gift" size={20} color="var(--brand-light)" />
              Tienda del club
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: 0 }}>
              Canjea tus puntos por merchandising oficial de Vallekas Basket
            </p>
          </div>

          {/* Puntos disponibles */}
          <div
            className="panel-glass"
            style={{
              padding: '12px 20px',
              textAlign: 'center' as const,
              border: '1px solid rgba(255, 210, 77, 0.25)',
            }}
          >
            <ScoreValue value={totalPoints} size="1.75rem" />
            <div
              style={{
                fontSize: '0.72rem',
                color: 'var(--color-text-muted)',
                marginTop: 2,
                fontWeight: 500,
              }}
            >
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
            <MerchCard key={item.id} item={item} userPoints={totalPoints} onRedeem={setConfirmItem} />
          ))}
        </div>
      </div>

      {/* ── Retos ────────────────────────────────────────────────────────── */}
      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap' as const,
          gap: 12,
        }}
      >
        <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>
          Mis retos
        </h2>

        {/* Tabs de filtro */}
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'in-progress', 'completed'] as FilterTab[]).map((tab) => (
            <button
              key={tab}
              className={`chip${filter === tab ? ' active' : ''}`}
              onClick={() => setFilter(tab)}
            >
              {tab === 'all' ? 'Todos' : tab === 'in-progress' ? 'En progreso' : 'Completados'}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <p
          style={{
            color: 'var(--color-text-muted)',
            padding: '32px 0',
            textAlign: 'center' as const,
          }}
        >
          Cargando retos...
        </p>
      )}
      {isError && (
        <p style={{ color: 'var(--color-error)', padding: '32px 0', textAlign: 'center' as const }}>
          Error al cargar los retos.
        </p>
      )}
      {!isLoading && !isError && filtered.length === 0 && (
        <EmptyState
          icon="target"
          title="No hay retos en esta categoría"
          message="Cambia de filtro o sigue completando lecciones para desbloquear nuevos retos."
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 14 }}>
        {filtered.map((c, i) => (
          <ChallengeCard key={c.id} c={c} index={i} />
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
      {successMsg && <SuccessToast message={successMsg} onClose={() => setSuccessMsg(null)} />}
    </div>
  );
}

function HeroStat({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: 'var(--amber-led)',
        }}
      >
        <Icon name={icon} size={17} />
        <span className="score-number" style={{ fontSize: '1.5rem' }}>
          {value}
        </span>
      </div>
      <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}
