import { useState } from 'react';
import { useChallengeSummary, useRedeemItem } from '../hooks/useChallenges';
import { usePageZone } from '../hooks/usePageZone';
import { launchConfetti } from '../utils/confetti';
import Icon from '../components/ui/Icon';
import ScoreValue from '../components/ui/ScoreValue';

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

// ─── Subcomponentes ───────────────────────────────────────────────────────────

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

export default function ShopPage() {
  const [confirmItem, setConfirmItem] = useState<MerchItem | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  // El resumen basta: solo necesitamos los puntos, no la lista completa de retos
  const { data, isLoading, isError } = useChallengeSummary();
  const redeemMutation = useRedeemItem();
  usePageZone('dark');

  const totalPoints = data?.totalPoints ?? 0;

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
            Puntos disponibles
          </div>
        </div>

        <h1 className="hero-title" style={{ marginTop: 22, fontSize: '1.8rem' }}>
          Tienda del club
        </h1>
        <p className="hero-subtitle">
          Canjea tus puntos por merchandising oficial de Vallekas Basket
        </p>
      </div>

      {isLoading && (
        <p
          style={{
            color: 'var(--color-text-muted)',
            padding: '32px 0',
            textAlign: 'center' as const,
          }}
        >
          Cargando tus puntos...
        </p>
      )}
      {isError && (
        <p style={{ color: 'var(--color-error)', padding: '32px 0', textAlign: 'center' as const }}>
          Error al cargar tus puntos.
        </p>
      )}

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

      <p
        style={{
          fontSize: '0.8rem',
          color: 'var(--color-text-muted)',
          marginTop: 24,
          textAlign: 'center' as const,
        }}
      >
        Los puntos se ganan completando retos. Un responsable del club te entregará en mano lo que
        canjees.
      </p>

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
