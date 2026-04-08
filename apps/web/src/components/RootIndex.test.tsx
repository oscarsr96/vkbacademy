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

  it('muestra el splash TAMBIÉN cuando la academia se resuelve', () => {
    // CASO CLAVE: vkbacademy.vercel.app resuelve como academia,
    // pero el splash debe verse igualmente como overlay
    mockAcademyDomain.mockReturnValue({
      academy: { id: '1', slug: 'vkb', name: 'VKB Academy' },
      isAcademyDomain: true,
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <RootIndex />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('splash-screen')).toBeInTheDocument();
    expect(screen.getByTestId('academy-landing')).toBeInTheDocument();
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

    expect(screen.queryByTestId('splash-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('landing-page')).not.toBeInTheDocument();
    expect(screen.queryByTestId('academy-landing')).not.toBeInTheDocument();
  });

  it('muestra la landing VKB cuando la carga completa sin academia', () => {
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

    expect(screen.getByTestId('splash-screen')).toBeInTheDocument();
    expect(screen.getByTestId('landing-page')).toBeInTheDocument();
  });
});
