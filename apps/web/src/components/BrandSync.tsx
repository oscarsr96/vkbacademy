import { useEffect } from 'react';
import { useAuthStore } from '../store/auth.store';
import { useAcademyDomain } from '../contexts/AcademyContext';
import { applyBrand } from '../utils/applyBrand';

/**
 * Sincroniza el color de marca de la academia con las CSS variables.
 * Prioridad: academia del auth store (post-login) > academia por dominio
 * (pre-login) > default VKB. Cubre login, logout y carga inicial.
 * No renderiza nada.
 */
export default function BrandSync() {
  const storeAcademy = useAuthStore((s) => s.academy);
  const { academy: domainAcademy } = useAcademyDomain();

  const primaryColor = storeAcademy?.primaryColor ?? domainAcademy?.primaryColor ?? null;

  useEffect(() => {
    applyBrand(primaryColor);
  }, [primaryColor]);

  return null;
}
