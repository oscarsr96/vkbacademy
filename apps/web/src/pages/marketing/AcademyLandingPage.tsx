import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/axios';
import { useAcademyDomain } from '../../contexts/AcademyContext';
import PublicLayout from '../../layouts/PublicLayout';
import LandingPage from './LandingPage';

interface AcademyPublic {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  isActive: boolean;
}

/**
 * Landing de una academia concreta. Ya no tiene diseño propio: resuelve la
 * academia (por `/a/:slug` o por dominio) y sirve la misma landing que el
 * dominio principal, con su nombre y su logo.
 *
 * El color no se pasa aquí: `BrandSync` llama a `applyBrand(primaryColor)` y
 * toda la página deriva de las variables `--brand*`.
 */
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
          background: '#070d18',
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
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          background: '#070d18',
        }}
      >
        <h2 style={{ color: '#f1f5f9', fontSize: '1.5rem' }}>Academia no encontrada</h2>
        <p style={{ color: '#94a3b8' }}>
          No existe ninguna academia con el identificador "{resolvedSlug}"
        </p>
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'var(--brand)',
            color: 'var(--brand-contrast)',
            border: 'none',
            borderRadius: 999,
            padding: '13px 30px',
            fontSize: '0.9375rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Ir al inicio
        </button>
      </div>
    );
  }

  return (
    <PublicLayout clubName={academy.name} logoUrl={academy.logoUrl}>
      <LandingPage clubName={academy.name} />
    </PublicLayout>
  );
}
