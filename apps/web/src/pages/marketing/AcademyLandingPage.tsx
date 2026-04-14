import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/axios';
import { useAcademyDomain } from '../../contexts/AcademyContext';
import { contrastText, lighten } from '../../utils/color';

interface AcademyPublic {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  isActive: boolean;
}

const FEATURES = [
  {
    icon: '📹',
    title: 'Lecciones en vídeo',
    desc: 'Contenido actualizado con los mejores vídeos de cada temática.',
  },
  {
    icon: '✏️',
    title: 'Aprende jugando',
    desc: 'Lecciones interactivas con ejercicios de emparejamiento, ordenación y rellenar huecos.',
  },
  {
    icon: '🧠',
    title: 'Tests con corrección automática',
    desc: 'Comprueba lo que ha aprendido en el momento, sin esperar a la próxima clase.',
  },
  {
    icon: '🎓',
    title: 'Exámenes y certificados',
    desc: 'Al superar los exámenes, recibe un certificado digital descargable en PDF.',
  },
  {
    icon: '📅',
    title: 'Reserva clases particulares',
    desc: 'Gestiona clases particulares directamente desde la plataforma, presenciales u online.',
  },
  {
    icon: '📊',
    title: 'Seguimiento en tiempo real',
    desc: 'Ve qué lecciones ha completado, sus resultados y los certificados obtenidos.',
  },
];

const STATS = [
  { value: '6', label: 'Niveles: 1º ESO a 2º Bachillerato' },
  { value: '+50', label: 'Cursos disponibles' },
  { value: '+500', label: 'Lecciones interactivas' },
  { value: '24/7', label: 'Disponible siempre' },
];

export default function AcademyLandingPage() {
  const { slug: paramSlug } = useParams<{ slug: string }>();
  const { academy: domainAcademy } = useAcademyDomain();
  const navigate = useNavigate();

  // Prioridad: slug de la URL (/a/:slug), luego academia resuelta por dominio
  const resolvedSlug = paramSlug ?? domainAcademy?.slug;

  const {
    data: fetchedAcademy,
    isLoading,
    error,
  } = useQuery<AcademyPublic>({
    queryKey: ['academy-public', resolvedSlug],
    queryFn: () => api.get(`/academies/by-slug/${resolvedSlug}`).then((r) => r.data),
    enabled: !!resolvedSlug && !domainAcademy,
  });

  // Usar la academia del dominio si ya la tenemos, sino la del fetch
  const academy = domainAcademy ?? fetchedAcademy;

  if (isLoading && !academy) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#080e1a',
        }}
      >
        <span className="spinner" />
      </div>
    );
  }

  if ((error && !domainAcademy) || !academy) {
    return (
      <div
        style={{
          minHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
        }}
      >
        <h2 style={{ color: '#f1f5f9', fontSize: '1.5rem' }}>Academia no encontrada</h2>
        <p style={{ color: '#94a3b8' }}>
          No existe ninguna academia con el identificador "{resolvedSlug}"
        </p>
        <button onClick={() => navigate('/')} style={btnPrimary(null)}>
          Ir al inicio
        </button>
      </div>
    );
  }

  const slug = academy.slug;

  const color = academy.primaryColor ?? '#ea580c';

  return (
    <div style={{ background: '#080e1a' }}>
      {/* ── Navbar simplificada ── */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: 'rgba(8,14,26,0.97)',
          borderBottom: `1px solid ${color}22`,
          backdropFilter: 'blur(14px)',
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            padding: '0 2rem',
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {academy.logoUrl && (
              <img
                src={academy.logoUrl}
                alt={academy.name}
                style={{ height: 36, width: 'auto', objectFit: 'contain' }}
              />
            )}
            <span
              style={{
                background: `linear-gradient(135deg, ${color}, ${lighten(color)})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontWeight: 800,
                fontSize: '1.125rem',
              }}
            >
              {academy.name}
            </span>
          </div>
          {/* Nav links */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <a
              href="#features"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
              }}
              style={navLinkStyle}
            >
              Inicio
            </a>
            <a
              href="/nosotros"
              onClick={(e) => {
                e.preventDefault();
                navigate('/nosotros');
              }}
              style={navLinkStyle}
            >
              Sobre nosotros
            </a>
            <a
              href="/precios"
              onClick={(e) => {
                e.preventDefault();
                navigate('/precios');
              }}
              style={navLinkStyle}
            >
              Precios
            </a>
          </nav>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={() => navigate('/login')}
              style={{
                background: 'transparent',
                border: `1px solid ${color}66`,
                color: '#fff',
                padding: '8px 18px',
                borderRadius: 8,
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Acceder
            </button>
            <button onClick={() => navigate(`/register?academy=${slug}`)} style={btnPrimary(color)}>
              Registrarse
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section
        style={{
          position: 'relative',
          padding: '100px 2rem 80px',
          textAlign: 'center',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '-20%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 800,
            height: 800,
            background: `radial-gradient(circle, ${color}18 0%, transparent 60%)`,
            pointerEvents: 'none',
          }}
        />

        <div style={{ position: 'relative', maxWidth: 720, margin: '0 auto' }}>
          <span
            style={{
              display: 'inline-block',
              background: `${color}18`,
              border: `1px solid ${color}33`,
              borderRadius: 20,
              padding: '6px 18px',
              fontSize: '0.85rem',
              color,
              fontWeight: 600,
              marginBottom: 24,
            }}
          >
            🏀 {academy.name}
          </span>

          <h1
            style={{
              fontSize: 'clamp(2rem, 5vw, 3.2rem)',
              fontWeight: 800,
              color: '#f1f5f9',
              lineHeight: 1.15,
              marginBottom: 20,
            }}
          >
            Metodología {academy.slug === 'vallekas-basket' ? 'VKB' : academy.name.split(' ')[0]}{' '}
            para el <span style={{ color }}>rendimiento académico</span>
          </h1>

          <p
            style={{
              fontSize: '1.1rem',
              color: 'rgba(255,255,255,0.6)',
              lineHeight: 1.7,
              maxWidth: 600,
              margin: '0 auto 32px',
            }}
          >
            La metodología real de {academy.name} en formato digital. Cursos, lecciones
            interactivas, exámenes con certificado y clases particulares — todo en un solo lugar,
            supervisado por ti.
          </p>

          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate(`/register?academy=${slug}`)}
              style={{ ...btnPrimary(color), padding: '14px 32px', fontSize: '1.05rem' }}
            >
              Registrarse gratis
            </button>
            <button
              onClick={() => {
                const el = document.getElementById('features');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.35)',
                color: '#fff',
                padding: '14px 28px',
                borderRadius: 10,
                fontSize: '1rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Qué incluye ↓
            </button>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section style={{ padding: '40px 2rem 60px' }}>
        <div
          style={{
            maxWidth: 900,
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 24,
          }}
        >
          {STATS.map((stat) => (
            <div
              key={stat.label}
              style={{
                textAlign: 'center',
                padding: '24px 16px',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div style={{ fontSize: '2rem', fontWeight: 800, color, marginBottom: 4 }}>
                {stat.value}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" style={{ padding: '60px 2rem 80px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <h2
            style={{
              textAlign: 'center',
              fontSize: '1.8rem',
              fontWeight: 800,
              color: '#f1f5f9',
              marginBottom: 48,
            }}
          >
            Todo lo que necesita tu hijo/a
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 20,
            }}
          >
            {FEATURES.map((f) => (
              <div
                key={f.title}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 14,
                  padding: '28px 24px',
                }}
              >
                <div style={{ fontSize: '2rem', marginBottom: 12 }}>{f.icon}</div>
                <h3
                  style={{
                    color: '#f1f5f9',
                    fontWeight: 700,
                    fontSize: '1.05rem',
                    marginBottom: 8,
                  }}
                >
                  {f.title}
                </h3>
                <p
                  style={{
                    color: 'rgba(255,255,255,0.5)',
                    fontSize: '0.9rem',
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section style={{ padding: '60px 2rem 80px', textAlign: 'center' }}>
        <div
          style={{
            maxWidth: 600,
            margin: '0 auto',
            background: `${color}0a`,
            border: `1px solid ${color}22`,
            borderRadius: 20,
            padding: '48px 32px',
          }}
        >
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f1f5f9', marginBottom: 12 }}>
            Empieza hoy
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.55)', marginBottom: 28, fontSize: '1rem' }}>
            Crea una cuenta gratis y accede a todo el contenido de {academy.name}.
          </p>
          <button
            onClick={() => navigate(`/register?academy=${slug}`)}
            style={{ ...btnPrimary(color), padding: '14px 36px', fontSize: '1.05rem' }}
          >
            Crear cuenta gratis
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer
        style={{
          background: '#060b15',
          padding: '2rem',
          borderTop: `1px solid ${color}15`,
          textAlign: 'center',
        }}
      >
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.8125rem', margin: 0 }}>
          © 2026 {academy.name} · Formación deportiva y académica
        </p>
      </footer>
    </div>
  );
}

const navLinkStyle: React.CSSProperties = {
  color: '#ffffff',
  textDecoration: 'none',
  fontSize: '0.9375rem',
  fontWeight: 500,
  opacity: 0.8,
  cursor: 'pointer',
};

function btnPrimary(color?: string | null): React.CSSProperties {
  const c = color ?? '#ea580c';
  return {
    background: `linear-gradient(135deg, ${c} 0%, ${lighten(c)} 100%)`,
    color: contrastText(c),
    border: 'none',
    borderRadius: 10,
    padding: '10px 24px',
    fontSize: '0.9375rem',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: `0 6px 24px ${c}55`,
  };
}
