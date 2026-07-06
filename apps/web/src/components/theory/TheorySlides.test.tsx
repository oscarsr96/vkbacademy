// Tests de regresión del deck: el overlay debe colgar de <body> (un ancestro
// con transform, como .vkb-card:hover, se convertiría en containing block del
// position:fixed y encogería el deck) y debe ofrecer pantalla completa real.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { TheoryModuleWithLessons } from '@vkbacademy/shared';
import TheorySlides from './TheorySlides';

const theoryModule: TheoryModuleWithLessons = {
  id: 'm1',
  userId: 'u1',
  courseId: 'c1',
  topic: 'fracciones',
  title: 'Fracciones',
  summary: 'Resumen.',
  createdAt: '2026-07-06T00:00:00.000Z',
  lessons: [],
};

beforeEach(() => {
  // jsdom no implementa matchMedia (auto-fit) ni la Fullscreen API.
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({ matches: false, addListener: vi.fn(), removeListener: vi.fn() }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete (HTMLElement.prototype as { requestFullscreen?: unknown }).requestFullscreen;
});

describe('TheorySlides', () => {
  it('se monta como portal directo en <body>, aunque el padre tenga transform', () => {
    render(
      <div style={{ transform: 'translateY(-3px)' }}>
        <TheorySlides module={theoryModule} onClose={() => undefined} />
      </div>,
    );
    const dialog = screen.getByRole('dialog', { name: /Presentación: Fracciones/ });
    expect(dialog.parentElement).toBe(document.body);
  });

  it('sin Fullscreen API no muestra el botón de pantalla completa', () => {
    render(<TheorySlides module={theoryModule} onClose={() => undefined} />);
    expect(screen.queryByRole('button', { name: 'Pantalla completa' })).toBeNull();
  });

  it('con Fullscreen API, el botón pide pantalla completa sobre el deck', () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      writable: true,
      value: requestFullscreen,
    });

    render(<TheorySlides module={theoryModule} onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pantalla completa' }));
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
  });
});
