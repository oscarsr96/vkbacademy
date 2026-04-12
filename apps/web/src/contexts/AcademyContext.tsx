import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/axios';
import { contrastText } from '../utils/color';

interface AcademyPublic {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  isActive: boolean;
}

interface AcademyContextValue {
  /** Academia resuelta desde el hostname (null si es el dominio principal) */
  academy: AcademyPublic | null;
  /** Slug derivado del hostname (null si es el dominio principal) */
  slug: string | null;
  /** true mientras se resuelve la academia */
  isLoading: boolean;
  /** true si estamos en un dominio de academia (no el principal) */
  isAcademyDomain: boolean;
}

const AcademyCtx = createContext<AcademyContextValue>({
  academy: null,
  slug: null,
  isLoading: false,
  isAcademyDomain: false,
});

/**
 * Extrae el slug de la academia del hostname.
 *
 * Convención: {slug}academy.vercel.app → slug se obtiene quitando "academy.vercel.app"
 * Ejemplos:
 *   - cboscaracademy.vercel.app → "cb-oscar" (se busca por dominio)
 *   - vkbacademy.vercel.app → null (dominio principal, no es una academia específica)
 *   - localhost:5173 → null (desarrollo local)
 *
 * También soporta dominios custom via campo `domain` en BD.
 */
function resolveFromHostname(): { slug: string | null; domain: string | null } {
  const hostname = window.location.hostname;

  // Desarrollo local — sin resolución
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return { slug: null, domain: null };
  }

  // Dominio principal de la app (configurable, pero por defecto ignorar)
  const mainDomains = (import.meta.env.VITE_MAIN_DOMAIN ?? '').split(',').filter(Boolean);
  const fullHost = window.location.host; // incluye puerto
  if (mainDomains.some((d: string) => hostname === d || fullHost === d)) {
    return { slug: null, domain: null };
  }

  // Convención Vercel: Xacademy.vercel.app
  // Intentar resolver por dominio completo (soporta custom domains y Vercel)
  return { slug: null, domain: hostname };
}

export function AcademyProvider({ children }: { children: ReactNode }) {
  const { domain } = resolveFromHostname();

  const { data, isLoading } = useQuery<AcademyPublic>({
    queryKey: ['academy-domain', domain],
    queryFn: () => api.get(`/academies/by-domain/${domain}`).then((r) => r.data),
    enabled: !!domain,
    staleTime: Infinity,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
  });

  // Actualizar título y favicon según la academia
  useEffect(() => {
    if (data) {
      document.title = data.name;
      const link = document.getElementById('favicon') as HTMLLinkElement | null;
      if (link) {
        if (data.logoUrl) {
          link.href = data.logoUrl;
        } else {
          // Generar favicon SVG con la inicial y el color primario
          const initial = data.name.charAt(0).toUpperCase();
          const color = data.primaryColor ?? '#6366f1';
          const textColor = contrastText(color);
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="${color}"/><text x="16" y="22" text-anchor="middle" fill="${textColor}" font-size="18" font-weight="bold" font-family="system-ui">${initial}</text></svg>`;
          link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
          link.type = 'image/svg+xml';
        }
      }
    } else if (!domain) {
      // Dominio principal: título por defecto
      document.title = 'VKB Academy';
    }
  }, [data, domain]);

  const value: AcademyContextValue = {
    academy: data ?? null,
    slug: data?.slug ?? null,
    isLoading: !!domain && isLoading,
    isAcademyDomain: !!domain,
  };

  return <AcademyCtx.Provider value={value}>{children}</AcademyCtx.Provider>;
}

export function useAcademyDomain() {
  return useContext(AcademyCtx);
}
