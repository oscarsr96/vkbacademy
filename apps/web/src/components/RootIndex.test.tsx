import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

// ── Mocks ──

const mockAcademyDomain = vi.fn();
vi.mock('../contexts/AcademyContext', () => ({
  useAcademyDomain: () => mockAcademyDomain(),
}));

vi.mock('../store/auth.store', () => ({
  useAuthStore: (selector: (s: { accessToken: string | null }) => unknown) =>
    selector({ accessToken: null }),
}));

vi.mock('./SplashScreen', () => ({
  default: ({ onComplete }: { onComplete: () => void }) => (
    <div data-testid="splash-screen" onClick={onComplete}>
      Splash
    </div>
  ),
}));

vi.mock('../pages/marketing/LandingPage', () => ({
  default: () => <div data-testid="landing-page">Landing</div>,
}));

vi.mock('../pages/marketing/AcademyLandingPage', () => ({
  default: () => <div data-testid="academy-landing">Academy Landing</div>,
}));

vi.mock('../layouts/PublicLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import RootIndex from './RootIndex';

// ── Tests ──

describe('RootIndex — splash visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra el splash mientras se resuelve el dominio de academia', () => {
    mockAcademyDomain.mockReturnValue({
      academy: null,
      isAcademyDomain: true,
      isLoading: true,
    });

    render(
      <MemoryRouter>
        <RootIndex />
      </MemoryRouter>,
    );

    // El splash DEBE ser visible incluso durante la carga
    expect(screen.queryByTestId('splash-screen')).toBeInTheDocument();
  });

  it('muestra el splash en el dominio principal (sin academia)', () => {
    mockAcademyDomain.mockReturnValue({
      academy: null,
      isAcademyDomain: false,
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <RootIndex />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('splash-screen')).toBeInTheDocument();
    expect(screen.getByTestId('landing-page')).toBeInTheDocument();
  });

  it('muestra AcademyLandingPage cuando la academia se resuelve (sin splash)', () => {
    mockAcademyDomain.mockReturnValue({
      academy: { id: '1', slug: 'test', name: 'Test Academy' },
      isAcademyDomain: true,
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <RootIndex />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('academy-landing')).toBeInTheDocument();
    expect(screen.queryByTestId('splash-screen')).not.toBeInTheDocument();
  });

  it('no muestra la landing detrás del splash durante la carga', () => {
    mockAcademyDomain.mockReturnValue({
      academy: null,
      isAcademyDomain: true,
      isLoading: true,
    });

    render(
      <MemoryRouter>
        <RootIndex />
      </MemoryRouter>,
    );

    // Durante la carga, solo el splash — la landing no debe mostrarse aún
    expect(screen.queryByTestId('splash-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('landing-page')).not.toBeInTheDocument();
  });

  it('muestra la landing cuando la carga completa sin academia', () => {
    mockAcademyDomain.mockReturnValue({
      academy: null,
      isAcademyDomain: true,
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <RootIndex />
      </MemoryRouter>,
    );

    // Sin academia encontrada → muestra VKB landing con splash
    expect(screen.getByTestId('splash-screen')).toBeInTheDocument();
    expect(screen.getByTestId('landing-page')).toBeInTheDocument();
  });
});
