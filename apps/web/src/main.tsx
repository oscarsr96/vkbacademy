import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AcademyProvider } from './contexts/AcademyContext';
import { bootstrapSession } from './lib/session-bootstrap';
import './styles/global.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5, // 5 minutos
    },
  },
});

// Antes de pintar: si queda un refresh token de una sesión anterior, renovarla.
// Las guardas de ruta esperan a que esto resuelva (ver sessionReady).
void bootstrapSession();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AcademyProvider>
          <App />
        </AcademyProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
