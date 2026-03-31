import { createContext, useContext, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/axios';

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
    retry: false,
  });

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
