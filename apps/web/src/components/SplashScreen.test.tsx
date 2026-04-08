import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SplashScreen from './SplashScreen';

describe('SplashScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the splash overlay on mount', () => {
    const onComplete = vi.fn();
    const { container } = render(<SplashScreen onComplete={onComplete} />);

    // El overlay debe ser visible (opacity 1, fixed, z-index alto)
    const overlay = container.firstElementChild as HTMLElement;
    expect(overlay).toBeInTheDocument();
    expect(overlay.style.position).toBe('fixed');
    expect(overlay.style.zIndex).toBe('99999');
    expect(overlay.style.opacity).toBe('1');
  });

  it('shows "VKB Academy" text after the text phase (1200ms)', () => {
    const onComplete = vi.fn();
    render(<SplashScreen onComplete={onComplete} />);

    // Antes de 1200ms el texto no es visible (opacity 0)
    const heading = screen.getByText('VKB Academy');
    expect(heading).toBeInTheDocument();

    // Avanzar al phase 'text' (1200ms)
    act(() => vi.advanceTimersByTime(1200));

    // El texto debe ser visible ahora — comprobamos el contenedor padre
    const textContainer = heading.closest('div')!;
    expect(textContainer.style.opacity).toBe('1');
  });

  it('calls onComplete after the full animation (3600ms)', () => {
    const onComplete = vi.fn();
    render(<SplashScreen onComplete={onComplete} />);

    // No se llama antes de tiempo
    act(() => vi.advanceTimersByTime(3500));
    expect(onComplete).not.toHaveBeenCalled();

    // Se llama al completar
    act(() => vi.advanceTimersByTime(200));
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('transitions to exit phase with opacity 0 at 2800ms', () => {
    const onComplete = vi.fn();
    const { container } = render(<SplashScreen onComplete={onComplete} />);
    const overlay = container.firstElementChild as HTMLElement;

    act(() => vi.advanceTimersByTime(2800));

    expect(overlay.style.opacity).toBe('0');
    expect(overlay.style.pointerEvents).toBe('none');
  });
});
