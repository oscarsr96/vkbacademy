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

  // Estilos compartidos de celdas de costes
  const costRowStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '120px 1fr auto 90px',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 0',
    borderBottom: '1px solid var(--color-border)',
  };

  const totalRowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    fontSize: '0.9rem',
    fontWeight: 600,
    color: 'var(--color-text)',
    paddingTop: '0.5rem',
  };

  const dividerStyle: React.CSSProperties = {
    height: 1,
    background: 'var(--color-border)',
    margin: '0.75rem 0',
  };

  const presetBtnBase: React.CSSProperties = {
    padding: '0.3rem 0.7rem',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--color-border)',
    background: 'transparent',
    color: 'var(--color-text-muted)',
    cursor: 'pointer',
    fontSize: '0.82rem',
    fontWeight: 500,
    transition: 'all 0.15s',
  };

  const presetBtnActive: React.CSSProperties = {
    ...presetBtnBase,
    background: 'var(--color-primary)',
    color: '#fff',
    borderColor: 'var(--color-primary)',
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem' }}>
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

      {/* Hero */}
      <div className="page-hero animate-in no-print">
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="hero-title">Facturación</h1>
            <p className="hero-subtitle">
              {data
                ? `${fmtEur(data.revenue.total)} ingresos · ${fmtEur(data.costs.total)} costes · Margen ${data.margin}%`
                : 'Informe de ingresos, costes y beneficio neto'}
              {isFetching && (
                <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                  Actualizando…
                </span>
              )}
            </p>
          </div>
          <button className="btn btn-dark" onClick={() => window.print()}>
            Exportar PDF
          </button>
        </div>
      </div>

      {/* Título de impresión */}
      <div
        className="print-title"
        style={{ marginBottom: '0.5rem', fontSize: '0.85rem', color: '#666' }}
      >
        Período: {from} → {to} · Exportado {new Date().toLocaleDateString('es-ES')}
      </div>

      {/* Filtros de período */}
      <div className="vkb-card no-print" style={{ marginBottom: '1.75rem', padding: '1.25rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
            Período
          </span>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {PRESETS.map((p) => (
              <button
                key={p.key}
                style={activePreset === p.key ? presetBtnActive : presetBtnBase}
                onClick={() => applyPreset(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>
            <input
              type="date"
              className="field"
              style={{ padding: '0.3rem 0.5rem', fontSize: '0.82rem' }}
              value={from}
              max={to}
              onChange={(e) => { setFrom(e.target.value); setActivePreset(''); }}
            />
            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>→</span>
            <input
              type="date"
              className="field"
              style={{ padding: '0.3rem 0.5rem', fontSize: '0.82rem' }}
              value={to}
              min={from}
              onChange={(e) => { setTo(e.target.value); setActivePreset(''); }}
            />
          </div>
        </div>
      </div>

      {isLoading && (
        <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '3rem' }}>
          Cargando informe de facturación…
        </p>
      )}

      {data && (
        <>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.875rem', marginBottom: '1.75rem' }}>
            <KpiCard label="Ingresos totales" value={fmtEur(data.revenue.total)} color="#10b981" icon="💰" />
            <KpiCard label="Costes estimados" value={fmtEur(data.costs.total)} color="#f97316" icon="🧾" />
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>

            {/* ── Ingresos ── */}
            <section>
              <h2 style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.6rem' }}>
                Ingresos
              </h2>
              <div className="vkb-card" style={{ padding: '1.25rem' }}>
                {/* Suscripciones */}
                <div style={{ marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text)' }}>Suscripciones</span>
                    <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#10b981' }}>
                      {fmtEur(data.revenue.subscriptions.total)}
                    </span>
                  </div>
                  <div style={{ paddingLeft: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'baseline', marginBottom: '0.2rem' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                        {data.revenue.subscriptions.activeStudents} alumnos
                      </span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                        × {fmtEur(data.revenue.subscriptions.monthlyPrice)}/mes × {data.revenue.subscriptions.months}m
                      </span>
                    </div>
                  </div>
                </div>

                <div style={dividerStyle} />

                {/* Clases (comisión) */}
                <div style={{ marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      Clases
                      <span style={{ fontSize: '0.68rem', fontWeight: 600, background: '#f0fdf4', color: '#16a34a', padding: '1px 6px', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                        comisión {(data.revenue.classes.commissionRate * 100).toFixed(0)}%
                      </span>
                    </span>
                    <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#10b981' }}>
                      {fmtEur(data.revenue.classes.commission)}
                    </span>
                  </div>
                  <div style={{ paddingLeft: '0.5rem' }}>
                    {data.revenue.classes.onlineHours > 0 && (
                      <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'baseline', marginBottom: '0.2rem' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{data.revenue.classes.onlineHours}h online</span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>× {fmtEur(data.config.classOnlineRatePerHour)}/h</span>
                      </div>
                    )}
                    {data.revenue.classes.inPersonHours > 0 && (
                      <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'baseline', marginBottom: '0.2rem' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{data.revenue.classes.inPersonHours}h presencial</span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>× {fmtEur(data.config.classInPersonRatePerHour)}/h</span>
                      </div>
                    )}
                    {data.revenue.classes.confirmedCount === 0 && (
                      <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                        Sin clases confirmadas en el período
                      </span>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px dashed var(--color-border)' }}>
                      <span>Bruto clases:</span>
                      <span>{fmtEur(data.revenue.classes.grossRevenue)}</span>
                    </div>
                  </div>
                </div>

                <div style={dividerStyle} />

                <div style={totalRowStyle}>
                  <span>Total ingresos</span>
                  <span style={{ color: '#10b981', fontWeight: 800 }}>{fmtEur(data.revenue.total)}</span>
                </div>
              </div>
            </section>

            {/* ── Costes ── */}
            <section>
              <h2 style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.6rem' }}>
                Costes detallados
              </h2>
              <div className="vkb-card" style={{ padding: '1.25rem' }}>
                <div style={costRowStyle}>
                  <CostRow service="Resend" usage={`${data.costs.resend.estimatedEmails} emails est.`} tier={data.costs.resend.tier} cost={data.costs.resend.estimated} />
                </div>
                <div style={costRowStyle}>
                  <CostRow service="Daily.co" usage={`${data.costs.dailyCo.participantMinutes} min participante`} tier={data.costs.dailyCo.tier} cost={data.costs.dailyCo.estimated} />
                </div>
                <div style={costRowStyle}>
                  <CostRow service="AWS S3" usage="almacenamiento" tier={null} cost={data.costs.s3.estimated} />
                </div>
                <div style={costRowStyle}>
                  <CostRow service="Anthropic" usage="generación IA" tier={null} cost={data.costs.anthropic.estimated} />
                </div>
                <div style={{ ...costRowStyle, borderBottom: 'none' }}>
                  <CostRow service="Infraestructura" usage="servidores" tier={null} cost={data.costs.infrastructure.estimated} />
                </div>

                <div style={dividerStyle} />

                <div style={totalRowStyle}>
                  <span>Total costes</span>
                  <span style={{ color: '#f97316', fontWeight: 800 }}>{fmtEur(data.costs.total)}</span>
                </div>

                <div style={dividerStyle} />

                <div style={totalRowStyle}>
                  <span style={{ fontWeight: 700 }}>Beneficio neto</span>
                  <span style={{ color: data.net >= 0 ? '#10b981' : '#ef4444', fontWeight: 800, fontSize: '1.05rem' }}>
                    {fmtEur(data.net)}
                  </span>
                </div>
              </div>
            </section>
          </div>

          {/* Configuración de tarifas */}
          {configForm !== null && (
            <section className="no-print" style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.6rem' }}>
                Configuración de tarifas
              </h2>
              <div className="vkb-card" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.875rem', marginBottom: '0.875rem' }}>
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

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.875rem', marginBottom: '1.25rem' }}>
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

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <button
                    className="btn btn-primary"
                    style={{ opacity: isSaving ? 0.6 : 1, cursor: isSaving ? 'not-allowed' : 'pointer' }}
                    onClick={handleSaveConfig}
                    disabled={isSaving}
                  >
                    {isSaving ? 'Guardando…' : 'Guardar configuración'}
                  </button>
                  {configSaved && (
                    <span style={{ fontSize: '0.82rem', color: '#16a34a', fontWeight: 600 }}>
                      Guardado correctamente
                    </span>
                  )}
                </div>

                <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.875rem' }}>
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
    <div className="stat-card" style={{ borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{icon}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 800, color, lineHeight: 1, marginBottom: 4 }}>
        {value}
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
        {label}
      </div>
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
  const tierFreeStyle: React.CSSProperties = {
    fontSize: '0.65rem',
    fontWeight: 700,
    padding: '2px 7px',
    borderRadius: 8,
    background: '#f0fdf4',
    color: '#16a34a',
    border: '1px solid #bbf7d0',
    textAlign: 'center',
  };
  const tierPaidStyle: React.CSSProperties = {
    fontSize: '0.65rem',
    fontWeight: 700,
    padding: '2px 7px',
    borderRadius: 8,
    background: '#fff7ed',
    color: '#c2410c',
    border: '1px solid #fed7aa',
    textAlign: 'center',
  };
  return (
    <>
      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>{service}</span>
      <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{usage}</span>
      {tier !== null ? (
        <span style={tier === 'free' ? tierFreeStyle : tierPaidStyle}>
          {tier.toUpperCase()}
        </span>
      ) : (
        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>—</span>
      )}
      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)', textAlign: 'right' }}>
        {cost === 0 ? '0,00 €' : cost.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
      </span>
    </>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </label>
      <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: 'var(--color-bg)' }}>
        <input
          type="number"
          min={0}
          step={0.01}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            flex: 1,
            padding: '0.4rem 0.6rem',
            border: 'none',
            background: 'transparent',
            color: 'var(--color-text)',
            fontSize: '0.9rem',
            outline: 'none',
            width: '100%',
          }}
        />
        <span style={{ padding: '0.4rem 0.6rem', fontSize: '0.78rem', color: 'var(--color-text-muted)', background: 'var(--color-border)', borderLeft: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>
          {suffix}
        </span>
      </div>
    </div>
  );
}
