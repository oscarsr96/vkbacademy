/**
 * Confeti propio en canvas (sin dependencias). Colores de marca VKB:
 * naranja, cyan y ámbar. Respeta prefers-reduced-motion (no hace nada).
 */
const COLORS = ['#f5911e', '#fbb04a', '#13aff0', '#ffd24d', '#ffffff'];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  vr: number;
  opacity: number;
}

export function launchConfetti(durationMs = 2200, count = 140): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (document.getElementById('vkb-confetti')) return; // ya hay uno activo

  const canvas = document.createElement('canvas');
  canvas.id = 'vkb-confetti';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    pointerEvents: 'none',
    zIndex: '9999',
  } as Partial<CSSStyleDeclaration>);
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.remove();
    return;
  }

  const particles: Particle[] = Array.from({ length: count }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * canvas.height * 0.3,
    vx: (Math.random() - 0.5) * 3,
    vy: 2.2 + Math.random() * 3.2,
    size: 5 + Math.random() * 6,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    rotation: Math.random() * Math.PI * 2,
    vr: (Math.random() - 0.5) * 0.22,
    opacity: 1,
  }));

  const start = performance.now();

  function frame(now: number) {
    if (!ctx) return;
    const elapsed = now - start;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const fadeOut = elapsed > durationMs;
    for (const p of particles) {
      p.x += p.vx + Math.sin(p.y * 0.02) * 0.6;
      p.y += p.vy;
      p.rotation += p.vr;
      if (fadeOut) p.opacity = Math.max(0, p.opacity - 0.03);

      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }

    const alive = particles.some((p) => p.opacity > 0 && p.y < canvas.height + 20);
    if (alive) {
      requestAnimationFrame(frame);
    } else {
      canvas.remove();
    }
  }

  requestAnimationFrame(frame);
}
