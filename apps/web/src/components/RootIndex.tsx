import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { useAcademyDomain } from '../contexts/AcademyContext';
import SplashScreen from './SplashScreen';
import PublicLayout from '../layouts/PublicLayout';
import LandingPage from '../pages/marketing/LandingPage';
import AcademyLandingPage from '../pages/marketing/AcademyLandingPage';

/**
 * Spinner de carga mientras la API resuelve la academia.
 * Se muestra cuando la API está despertando (cold start de Render ~30s).
 */
function LoadingSpinner() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        background: '#080e1a',
        zIndex: 9999,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          border: '4px solid rgba(255,255,255,0.1)',
          borderTop: '4px solid #ea580c',
          borderRadius: '50%',
          animation: 'rootSpin 0.8s linear infinite',
        }}
      />
      <p
        style={{
          color: 'rgba(255,255,255,0.4)',
          marginTop: 20,
          fontSize: '0.9rem',
          letterSpacing: '0.05em',
        }}
      >
        Cargando...
      </p>
      <style>{`
        @keyframes rootSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

/**
 * Ruta raíz: landing pública si no autenticado, dashboard si autenticado.
 *
 * Comportamiento:
 *  1. Si autenticado → redirige a /dashboard
 *  2. Si isLoading (API resolviendo academia, cold start) → spinner
 *  3. Si academia resuelta → AcademyLandingPage
 *  4. Si error o no es dominio de academia → LandingPage genérica (fallback)
 */
export default function RootIndex() {
  const isAuthenticated = useAuthStore((s) => !!s.accessToken);
  const { academy, isAcademyDomain, isLoading } = useAcademyDomain();
  const [showSplash, setShowSplash] = useState(!isAuthenticated);

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  // Splash overlay (se muestra encima del contenido)
  const splash = showSplash ? <SplashScreen onComplete={() => setShowSplash(false)} /> : null;

  // Mientras la API resuelve la academia, mostrar spinner
  if (isLoading) {
    return (
      <>
        {splash}
        <LoadingSpinner />
      </>
    );
  }

  // Academia resuelta → landing específica
  if (isAcademyDomain && academy) {
    return (
      <>
        {splash}
        <AcademyLandingPage />
      </>
    );
  }

  // Fallback: landing genérica (dominio principal, o API caída/error)
  return (
    <>
      {splash}
      <PublicLayout>
        <LandingPage />
      </PublicLayout>
    </>
  );
}
