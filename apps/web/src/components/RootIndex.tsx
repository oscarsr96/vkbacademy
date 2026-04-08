import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { useAcademyDomain } from '../contexts/AcademyContext';
import SplashScreen from './SplashScreen';
import PublicLayout from '../layouts/PublicLayout';
import LandingPage from '../pages/marketing/LandingPage';
import AcademyLandingPage from '../pages/marketing/AcademyLandingPage';

/**
 * Ruta raíz: landing pública si no autenticado, dashboard si autenticado.
 * Si estamos en un dominio de academia, muestra la landing de esa academia.
 * Si no, muestra la landing de VKB envuelta en PublicLayout con splash.
 */
export default function RootIndex() {
  const isAuthenticated = useAuthStore((s) => !!s.accessToken);
  const { academy, isAcademyDomain, isLoading } = useAcademyDomain();
  const [showSplash, setShowSplash] = useState(!isAuthenticated);

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  // El splash es un overlay fijo (z-index 99999) que cubre toda la pantalla.
  // El contenido se carga detrás y se revela cuando el splash termina.
  return (
    <>
      {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
      {!isLoading &&
        (isAcademyDomain && academy ? (
          <AcademyLandingPage />
        ) : (
          <PublicLayout>
            <LandingPage />
          </PublicLayout>
        ))}
    </>
  );
}
