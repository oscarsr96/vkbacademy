import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, type BillingConfigPayload } from '../../api/admin.api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function fmtEur(value: number): string {
  return value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
}

type BillingPreset = 'current-month' | 'prev-month' | 'last-3m' | 'current-year';

function presetRange(p: BillingPreset): { from: string; to: string } {
  const now = new Date();

  if (p === 'current-month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: fmtDate(from), to: fmtDate(now) };
  }

  if (p === 'prev-month') {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: fmtDate(from), to: fmtDate(to) };
  }

  if (p === 'last-3m') {
    const from = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    return { from: fmtDate(from), to: fmtDate(now) };
  }

  // current-year
  const from = new Date(now.getFullYear(), 0, 1);
  return { from: fmtDate(from), to: fmtDate(now) };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminBillingPage() {
  const init = presetRange('current-month');
  const [from, setFrom] = useState(init.from);
  const [to, setTo] = useState(init.to);
  const [activePreset, setActivePreset] = useState<BillingPreset | ''>('current-month');

  // Estado local del formulario de configuración
  const [configForm, setConfigForm] = useState<BillingConfigPayload | null>(null);
  const [configSaved, setConfigSaved] = useState(false);

  const queryClient = useQueryClient();

  const params = { from, to };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin', 'billing', params],
    queryFn: () => adminApi.getBilling(params),
    staleTime: 60_000,
  });

  // Inicializar formulario cuando llegan los datos por primera vez
  React.useEffect(() => {
    if (data?.config && configForm === null) {
      const c = data.config;
      setConfigForm({
        studentMonthlyPrice: c.studentMonthlyPrice,
        classOnlineRatePerHour: c.classOnlineRatePerHour,
        classInPersonRatePerHour: c.classInPersonRatePerHour,
        clubCommissionRate: c.clubCommissionRate,
        infrastructureMonthlyCost: c.infrastructureMonthlyCost,
        s3MonthlyCost: c.s3MonthlyCost,
        anthropicMonthlyCost: c.anthropicMonthlyCost,
      });
    }
  }, [data, configForm]);

  const { mutate: saveConfig, isPending: isSaving } = useMutation({
    mutationFn: (payload: BillingConfigPayload) => adminApi.updateBillingConfig(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'billing'] });
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 2500);
    },
  });

  function applyPreset(p: BillingPreset) {
    const range = presetRange(p);
    setFrom(range.from);
    setTo(range.to);
    setActivePreset(p);
  }

  const PRESETS: { key: BillingPreset; label: string }[] = [
    { key: 'current-month', label: 'Mes actual' },
    { key: 'prev-month', label: 'Mes anterior' },
    { key: 'last-3m', label: 'Últimos 3m' },
    { key: 'current-year', label: 'Año actual' },
  ];

  function handleConfigChange(field: keyof BillingConfigPayload, value: string) {
    const num = parseFloat(value);
    setConfigForm((prev) => ({ ...prev, [field]: isNaN(num) ? 0 : num }));
  }

  function handleSaveConfig() {
    if (configForm) {
      saveConfig(configForm);
    }
  }

  return (
    <div style={s.page}>
      {/* CSS de impresión */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-title { display: block !important; }
          body { background: #fff !important; }
          @page { margin: 1.5cm; size: A4 portrait; }
          section { break-inside: avoid; }
          h2 { break-after: avoid; }
        }
        .print-title { display: none; }
      `}</style>

      {/* Cabecera */}
      <div style={s.pageHeader}>
        <h1 style={s.title}>Facturación</h1>
        {isFetching && <span style={s.fetchBadge}>Actualizando…</span>}
        <div style={{ flex: 1 }} />
        <button className="no-print" style={s.exportBtn} onClick={() => window.print()}>
          Exportar PDF
        </button>
      </div>

      {/* Título visible solo al imprimir */}
      <div
        className="print-title"
        style={{ marginBottom: '0.5rem', fontSize: '0.85rem', color: '#666' }}
      >
        Período: {from} → {to} · Exportado {new Date().toLocaleDateString('es-ES')}
      </div>

      {/* Filtros de período */}
      <div className="no-print" style={s.filterCard}>
        <div style={s.filterRow}>
          <span style={s.filterLabel}>Período</span>
          <div style={s.presets}>
            {PRESETS.map((p) => (
              <button
                key={p.key}
                style={{ ...s.presetBtn, ...(activePreset === p.key ? s.presetBtnActive : {}) }}
                onClick={() => applyPreset(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div style={s.dateRange}>
            <input
              type="date"
              style={s.dateInput}
              value={from}
              max={to}
              onChange={(e) => { setFrom(e.target.value); setActivePreset(''); }}
            />
            <span style={s.arrow}>→</span>
            <input
              type="date"
              style={s.dateInput}
              value={to}
              min={from}
              onChange={(e) => { setTo(e.target.value); setActivePreset(''); }}
            />
          </div>
        </div>
      </div>

      {isLoading && <p style={s.loading}>Cargando informe de facturación…</p>}

      {data && (
        <>
          {/* KPIs principales */}
          <div style={s.kpiGrid}>
            <KpiCard
              label="Ingresos totales"
              value={fmtEur(data.revenue.total)}
              color="#10b981"
              icon="💰"
            />
            <KpiCard
              label="Costes estimados"
              value={fmtEur(data.costs.total)}
              color="#f97316"
              icon="🧾"
            />
            <KpiCard
              label="Beneficio neto"
              value={fmtEur(data.net)}
              color={data.net >= 0 ? '#6366f1' : '#ef4444'}
              icon="📈"
            />
            <KpiCard
              label="Margen"
              value={`${data.margin}%`}
              color={data.margin >= 50 ? '#10b981' : data.margin >= 20 ? '#f59e0b' : '#ef4444'}
              icon="📊"
            />
          </div>

          {/* Ingresos + Costes en dos columnas */}
          <div style={s.twoCol}>
            {/* ── Ingresos ── */}
            <section style={s.section}>
              <h2 style={s.sectionTitle}>Ingresos</h2>
              <div style={s.card}>
                {/* Suscripciones */}
                <div style={s.revenueBlock}>
                  <div style={s.revenueBlockHeader}>
                    <span style={s.revenueBlockTitle}>Suscripciones</span>
                    <span style={{ ...s.revenueAmount, color: '#10b981' }}>
                      {fmtEur(data.revenue.subscriptions.total)}
                    </span>
                  </div>
                  <div style={s.revenueDetail}>
                    <RevenueRow
                      label={`${data.revenue.subscriptions.activeStudents} alumnos`}
                      suffix={`× ${fmtEur(data.revenue.subscriptions.monthlyPrice)}/mes × ${data.revenue.subscriptions.months}m`}
                    />
                  </div>
                </div>

                <div style={s.divider} />

                {/* Clases (comisión) */}
                <div style={s.revenueBlock}>
                  <div style={s.revenueBlockHeader}>
                    <span style={s.revenueBlockTitle}>
                      Clases{' '}
                      <span style={s.commissionBadge}>
                        comisión {(data.revenue.classes.commissionRate * 100).toFixed(0)}%
                      </span>
                    </span>
                    <span style={{ ...s.revenueAmount, color: '#10b981' }}>
                      {fmtEur(data.revenue.classes.commission)}
                    </span>
                  </div>
                  <div style={s.revenueDetail}>
                    {data.revenue.classes.onlineHours > 0 && (
                      <RevenueRow
                        label={`${data.revenue.classes.onlineHours}h online`}
                        suffix={`× ${fmtEur(data.config.classOnlineRatePerHour)}/h`}
                      />
                    )}
                    {data.revenue.classes.inPersonHours > 0 && (
                      <RevenueRow
                        label={`${data.revenue.classes.inPersonHours}h presencial`}
                        suffix={`× ${fmtEur(data.config.classInPersonRatePerHour)}/h`}
                      />
                    )}
                    {data.revenue.classes.confirmedCount === 0 && (
                      <span style={s.emptyDetail}>Sin clases confirmadas en el período</span>
                    )}
                    <div style={s.subTotal}>
                      <span>Bruto clases:</span>
                      <span>{fmtEur(data.revenue.classes.grossRevenue)}</span>
                    </div>
                  </div>
                </div>

                <div style={s.divider} />

                {/* Total ingresos */}
                <div style={s.totalRow}>
                  <span>Total ingresos</span>
                  <span style={{ color: '#10b981', fontWeight: 800 }}>
                    {fmtEur(data.revenue.total)}
                  </span>
                </div>
              </div>
            </section>

            {/* ── Costes ── */}
            <section style={s.section}>
              <h2 style={s.sectionTitle}>Costes detallados</h2>
              <div style={s.card}>
                <CostRow
                  service="Resend"
                  usage={`${data.costs.resend.estimatedEmails} emails estimados`}
                  tier={data.costs.resend.tier}
                  cost={data.costs.resend.estimated}
                />
                <CostRow
                  service="Daily.co"
                  usage={`${data.costs.dailyCo.participantMinutes} min participante`}
                  tier={data.costs.dailyCo.tier}
                  cost={data.costs.dailyCo.estimated}
                />
                <CostRow
                  service="AWS S3"
                  usage="almacenamiento"
                  tier={null}
                  cost={data.costs.s3.estimated}
                />
                <CostRow
                  service="Anthropic"
                  usage="generación IA"
                  tier={null}
                  cost={data.costs.anthropic.estimated}
                />
                <CostRow
                  service="Infraestructura"
                  usage="servidores"
                  tier={null}
                  cost={data.costs.infrastructure.estimated}
                />

                <div style={s.divider} />

                <div style={s.totalRow}>
                  <span>Total costes</span>
                  <span style={{ color: '#f97316', fontWeight: 800 }}>
                    {fmtEur(data.costs.total)}
                  </span>
                </div>

                <div style={s.divider} />

                <div style={s.totalRow}>
                  <span style={{ fontWeight: 700 }}>Beneficio neto</span>
                  <span
                    style={{
                      color: data.net >= 0 ? '#10b981' : '#ef4444',
                      fontWeight: 800,
                      fontSize: '1.1rem',
                    }}
                  >
                    {fmtEur(data.net)}
                  </span>
                </div>
              </div>
            </section>
          </div>

          {/* Configuración de tarifas */}
          {configForm !== null && (
            <section style={s.section} className="no-print">
              <h2 style={s.sectionTitle}>Configuración de tarifas</h2>
              <div style={s.card}>
                <div style={s.configGrid}>
                  <ConfigField
                    label="Precio/mes alumno"
                    value={configForm.studentMonthlyPrice ?? 0}
                    suffix="€/mes"
                    onChange={(v) => handleConfigChange('studentMonthlyPrice', v)}
                  />
                  <ConfigField
                    label="Tarifa clase online"
                    value={configForm.classOnlineRatePerHour ?? 0}
                    suffix="€/h"
                    onChange={(v) => handleConfigChange('classOnlineRatePerHour', v)}
                  />
                  <ConfigField
                    label="Tarifa clase presencial"
                    value={configForm.classInPersonRatePerHour ?? 0}
                    suffix="€/h"
                    onChange={(v) => handleConfigChange('classInPersonRatePerHour', v)}
                  />
                  <ConfigField
                    label="Comisión del club"
                    value={(configForm.clubCommissionRate ?? 0) * 100}
                    suffix="%"
                    onChange={(v) => handleConfigChange('clubCommissionRate', String(parseFloat(v) / 100))}
                  />
                </div>

                <div style={{ ...s.configGrid, marginTop: '0.75rem' }}>
                  <ConfigField
                    label="Infraestructura"
                    value={configForm.infrastructureMonthlyCost ?? 0}
                    suffix="€/mes"
                    onChange={(v) => handleConfigChange('infrastructureMonthlyCost', v)}
                  />
                  <ConfigField
                    label="AWS S3"
                    value={configForm.s3MonthlyCost ?? 0}
                    suffix="€/mes"
                    onChange={(v) => handleConfigChange('s3MonthlyCost', v)}
                  />
                  <ConfigField
                    label="Anthropic"
                    value={configForm.anthropicMonthlyCost ?? 0}
                    suffix="€/mes"
                    onChange={(v) => handleConfigChange('anthropicMonthlyCost', v)}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1.25rem' }}>
                  <button
                    style={{ ...s.saveBtn, ...(isSaving ? s.saveBtnDisabled : {}) }}
                    onClick={handleSaveConfig}
                    disabled={isSaving}
                  >
                    {isSaving ? 'Guardando…' : 'Guardar configuración'}
                  </button>
                  {configSaved && (
                    <span style={s.savedBadge}>✓ Guardado correctamente</span>
                  )}
                </div>

                <p style={s.configNote}>
                  Los costes de Resend y Daily.co se calculan automáticamente según el uso estimado del período.
                </p>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function KpiCard({ label, value, color, icon }: {
  label: string;
  value: string;
  color: string;
  icon: string;
}) {
  return (
    <div style={s.kpiCard}>
      <div style={{ ...s.kpiAccent, background: color }} />
      <div style={s.kpiBody}>
        <span style={s.kpiIcon}>{icon}</span>
        <div style={{ ...s.kpiValue, color }}>{value}</div>
        <div style={s.kpiLabel}>{label}</div>
      </div>
    </div>
  );
}

function RevenueRow({ label, suffix }: { label: string; suffix: string }) {
  return (
    <div style={s.revenueRow}>
      <span style={s.revenueRowLabel}>{label}</span>
      <span style={s.revenueRowSuffix}>{suffix}</span>
    </div>
  );
}

function CostRow({
  service,
  usage,
  tier,
  cost,
}: {
  service: string;
  usage: string;
  tier: 'free' | 'paid' | null;
  cost: number;
}) {
  return (
    <div style={s.costRow}>
      <span style={s.costService}>{service}</span>
      <span style={s.costUsage}>{usage}</span>
      {tier !== null ? (
        <span style={{ ...s.tierBadge, ...(tier === 'free' ? s.tierFree : s.tierPaid) }}>
          {tier.toUpperCase()}
        </span>
      ) : (
        <span style={s.tierEmpty}>—</span>
      )}
      <span style={s.costAmount}>{cost === 0 ? '0,00 €' : cost.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
    </div>
  );
}

function ConfigField({
  label,
  value,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  suffix: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={s.configField}>
      <label style={s.configLabel}>{label}</label>
      <div style={s.configInputWrap}>
        <input
          type="number"
          min={0}
          step={0.01}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={s.configInput}
        />
        <span style={s.configSuffix}>{suffix}</span>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page: { padding: '2rem', maxWidth: 1100, margin: '0 auto' },
  pageHeader: { display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' },
  title: { fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 },
  fetchBadge: { fontSize: '0.75rem', color: 'var(--color-text-muted)', background: 'var(--color-border)', padding: '2px 8px', borderRadius: 12 },
  exportBtn: { padding: '0.45rem 1rem', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 },

  // ── Filtros
  filterCard: { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '1rem 1.25rem', marginBottom: '1.5rem' },
  filterRow: { display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' as const },
  filterLabel: { fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.05em', width: 76, flexShrink: 0 },
  presets: { display: 'flex', gap: '0.35rem' },
  presetBtn: { padding: '0.3rem 0.65rem', borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 500 },
  presetBtnActive: { background: 'var(--color-primary)', color: '#fff', borderColor: 'var(--color-primary)' },
  dateRange: { display: 'flex', alignItems: 'center', gap: '0.4rem' },
  dateInput: { padding: '0.3rem 0.5rem', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: '0.82rem', background: 'var(--color-bg)', color: 'var(--color-text)' },
  arrow: { color: 'var(--color-text-muted)', fontSize: '0.8rem' },

  // ── KPI grid
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.875rem', marginBottom: '1.75rem' },
  kpiCard: { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column' as const },
  kpiAccent: { height: 4 },
  kpiBody: { padding: '1rem 1.1rem' },
  kpiIcon: { fontSize: '1.1rem', display: 'block', marginBottom: '0.4rem' },
  kpiValue: { fontSize: '1.5rem', fontWeight: 800, lineHeight: 1, marginBottom: 3 },
  kpiLabel: { fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 },

  // ── Layout
  twoCol: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem', marginBottom: '1.5rem' },
  section: { marginBottom: '1.5rem' },
  sectionTitle: { fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '0.6rem' },
  card: { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '1.25rem' },

  // ── Ingresos
  revenueBlock: { marginBottom: '0.5rem' },
  revenueBlockHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' },
  revenueBlockTitle: { fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.4rem' },
  revenueAmount: { fontSize: '1.1rem', fontWeight: 800 },
  revenueDetail: { paddingLeft: '0.5rem' },
  revenueRow: { display: 'flex', gap: '0.35rem', alignItems: 'baseline', marginBottom: '0.2rem' },
  revenueRowLabel: { fontSize: '0.82rem', color: 'var(--color-text)', fontWeight: 600 },
  revenueRowSuffix: { fontSize: '0.78rem', color: 'var(--color-text-muted)' },
  commissionBadge: { fontSize: '0.68rem', fontWeight: 600, background: '#f0fdf4', color: '#16a34a', padding: '1px 6px', borderRadius: 8, border: '1px solid #bbf7d0' },
  emptyDetail: { fontSize: '0.78rem', color: 'var(--color-text-muted)', fontStyle: 'italic' as const },
  subTotal: { display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px dashed var(--color-border)' },
  divider: { height: 1, background: 'var(--color-border)', margin: '0.875rem 0' },
  totalRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '0.9rem', color: 'var(--color-text)', fontWeight: 600 },

  // ── Costes
  costRow: { display: 'grid', gridTemplateColumns: '110px 1fr auto 80px', alignItems: 'center', gap: '0.5rem', paddingBottom: '0.6rem', marginBottom: '0.6rem', borderBottom: '1px solid var(--color-border)' },
  costService: { fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' },
  costUsage: { fontSize: '0.78rem', color: 'var(--color-text-muted)' },
  tierBadge: { fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: 8, letterSpacing: '0.03em', textAlign: 'center' as const },
  tierFree: { background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' },
  tierPaid: { background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa' },
  tierEmpty: { fontSize: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'center' as const },
  costAmount: { fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)', textAlign: 'right' as const },

  // ── Config form
  configGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' },
  configField: { display: 'flex', flexDirection: 'column' as const, gap: '0.3rem' },
  configLabel: { fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.04em' },
  configInputWrap: { display: 'flex', alignItems: 'center', border: '1px solid var(--color-border)', borderRadius: 6, overflow: 'hidden', background: 'var(--color-bg)' },
  configInput: { flex: 1, padding: '0.35rem 0.6rem', border: 'none', background: 'transparent', color: 'var(--color-text)', fontSize: '0.9rem', outline: 'none', width: '100%' },
  configSuffix: { padding: '0.35rem 0.6rem', fontSize: '0.78rem', color: 'var(--color-text-muted)', background: 'var(--color-border)', borderLeft: '1px solid var(--color-border)', whiteSpace: 'nowrap' as const },
  saveBtn: { padding: '0.5rem 1.25rem', borderRadius: 8, border: 'none', background: 'var(--color-primary)', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 },
  saveBtnDisabled: { opacity: 0.6, cursor: 'not-allowed' },
  savedBadge: { fontSize: '0.82rem', color: '#16a34a', fontWeight: 600 },
  configNote: { fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.875rem', marginBottom: 0 },

  // ── Misc
  loading: { textAlign: 'center' as const, color: 'var(--color-text-muted)', padding: '3rem' },
};
