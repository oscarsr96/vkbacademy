import { useState, useEffect, useCallback } from 'react';

/**
 * Splash screen con animación espectacular de partículas, balón de basket
 * y logo VKB Academy que se revela antes de mostrar la landing.
 */

// Partícula flotante
interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
  opacity: number;
}

// Genera partículas aleatorias
function generateParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 4 + 1,
    delay: Math.random() * 2,
    duration: Math.random() * 3 + 2,
    opacity: Math.random() * 0.6 + 0.2,
  }));
}

const PARTICLES = generateParticles(60);

// Líneas orbitales
const ORBIT_LINES = [
  { rx: 120, ry: 40, rotation: -20, delay: 0 },
  { rx: 160, ry: 50, rotation: 25, delay: 0.3 },
  { rx: 200, ry: 35, rotation: -45, delay: 0.6 },
];

export default function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<'enter' | 'logo' | 'text' | 'exit'>('enter');

  const handleComplete = useCallback(onComplete, [onComplete]);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase('logo'), 400),
      setTimeout(() => setPhase('text'), 1200),
      setTimeout(() => setPhase('exit'), 2800),
      setTimeout(() => handleComplete(), 3600),
    ];
    return () => timers.forEach(clearTimeout);
  }, [handleComplete]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        background: '#080e1a',
        overflow: 'hidden',
        opacity: phase === 'exit' ? 0 : 1,
        transition: 'opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
        pointerEvents: phase === 'exit' ? 'none' : 'auto',
      }}
    >
      {/* Fondo degradado animado */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(234, 88, 12, 0.12) 0%, transparent 70%)',
          animation: 'splashPulse 3s ease-in-out infinite',
        }}
      />

      {/* Partículas flotantes */}
      {PARTICLES.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            background:
              p.id % 3 === 0 ? '#ea580c' : p.id % 3 === 1 ? '#f97316' : 'rgba(255,255,255,0.6)',
            opacity: phase === 'enter' ? 0 : p.opacity,
            animation: `splashFloat ${p.duration}s ease-in-out ${p.delay}s infinite alternate`,
            transition: 'opacity 1s ease',
            boxShadow: p.id % 3 !== 2 ? `0 0 ${p.size * 3}px rgba(234, 88, 12, 0.4)` : 'none',
          }}
        />
      ))}

      {/* Anillo de energía expandiéndose */}
      <div
        style={{
          position: 'absolute',
          width: 500,
          height: 500,
          borderRadius: '50%',
          border: '1px solid rgba(234, 88, 12, 0.15)',
          opacity: phase === 'enter' ? 0 : 0.6,
          animation: 'splashRingExpand 3s ease-out infinite',
          transition: 'opacity 0.5s',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 500,
          height: 500,
          borderRadius: '50%',
          border: '1px solid rgba(249, 115, 22, 0.1)',
          opacity: phase === 'enter' ? 0 : 0.4,
          animation: 'splashRingExpand 3s ease-out 0.8s infinite',
          transition: 'opacity 0.5s',
        }}
      />

      {/* SVG central: balón con órbitas */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          transform:
            phase === 'enter'
              ? 'scale(0) rotate(-180deg)'
              : phase === 'exit'
                ? 'scale(1.2)'
                : 'scale(1) rotate(0deg)',
          opacity: phase === 'enter' ? 0 : 1,
          transition: 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.5s ease',
        }}
      >
        {/* Glow detrás del balón */}
        <div
          style={{
            position: 'absolute',
            inset: -60,
            background: 'radial-gradient(circle, rgba(234, 88, 12, 0.35) 0%, transparent 70%)',
            borderRadius: '50%',
            animation: 'splashGlow 2s ease-in-out infinite alternate',
          }}
        />

        <svg
          width="160"
          height="160"
          viewBox="0 0 160 160"
          fill="none"
          style={{ position: 'relative', zIndex: 1 }}
        >
          {/* Órbitas animadas */}
          {ORBIT_LINES.map((orbit, i) => (
            <ellipse
              key={i}
              cx="80"
              cy="80"
              rx={orbit.rx}
              ry={orbit.ry}
              transform={`rotate(${orbit.rotation} 80 80)`}
              stroke="url(#orbitGrad)"
              strokeWidth="0.8"
              fill="none"
              opacity="0.4"
              style={{
                animation: `splashOrbitSpin ${6 + i * 2}s linear ${orbit.delay}s infinite`,
                transformOrigin: '80px 80px',
              }}
            />
          ))}

          {/* Balón de basket */}
          <circle cx="80" cy="80" r="52" fill="url(#ballGrad)" />
          <circle cx="80" cy="80" r="52" fill="url(#ballShine)" />

          {/* Líneas del balón */}
          <path d="M28 80 Q80 60 132 80" stroke="rgba(0,0,0,0.25)" strokeWidth="2" fill="none" />
          <path d="M28 80 Q80 100 132 80" stroke="rgba(0,0,0,0.25)" strokeWidth="2" fill="none" />
          <line x1="80" y1="28" x2="80" y2="132" stroke="rgba(0,0,0,0.25)" strokeWidth="2" />

          {/* Borde brillante */}
          <circle
            cx="80"
            cy="80"
            r="52"
            fill="none"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="1.5"
          />

          {/* Destello */}
          <circle cx="62" cy="58" r="8" fill="rgba(255,255,255,0.2)" />
          <circle cx="62" cy="58" r="4" fill="rgba(255,255,255,0.35)" />

          {/* Gradientes */}
          <defs>
            <radialGradient id="ballGrad" cx="40%" cy="35%">
              <stop offset="0%" stopColor="#f97316" />
              <stop offset="50%" stopColor="#ea580c" />
              <stop offset="100%" stopColor="#c2410c" />
            </radialGradient>
            <radialGradient id="ballShine" cx="35%" cy="30%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
            <linearGradient id="orbitGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="transparent" />
              <stop offset="50%" stopColor="#ea580c" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Texto VKB Academy */}
      <div
        style={{
          marginTop: 36,
          textAlign: 'center',
          zIndex: 2,
          opacity: phase === 'text' ? 1 : phase === 'exit' ? 0 : 0,
          transform:
            phase === 'text'
              ? 'translateY(0)'
              : phase === 'exit'
                ? 'translateY(-20px)'
                : 'translateY(30px)',
          transition: 'all 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        <h1
          style={{
            fontSize: 'clamp(2rem, 5vw, 3.2rem)',
            fontWeight: 900,
            letterSpacing: '-0.03em',
            lineHeight: 1,
            background: 'linear-gradient(135deg, #ea580c 0%, #f97316 40%, #fbbf24 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          VKB Academy
        </h1>
        <p
          style={{
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: 'clamp(0.85rem, 2vw, 1.05rem)',
            fontWeight: 500,
            marginTop: 10,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
          }}
        >
          La formación del club, en tus manos
        </p>
      </div>

      {/* Barra de carga decorativa */}
      <div
        style={{
          position: 'absolute',
          bottom: 60,
          width: 200,
          height: 3,
          borderRadius: 999,
          background: 'rgba(255,255,255,0.06)',
          overflow: 'hidden',
          zIndex: 2,
        }}
      >
        <div
          style={{
            height: '100%',
            borderRadius: 999,
            background: 'linear-gradient(90deg, #ea580c, #f97316, #fbbf24)',
            animation: 'splashLoader 2.8s ease-in-out forwards',
            boxShadow: '0 0 12px rgba(234, 88, 12, 0.6)',
          }}
        />
      </div>

      {/* Keyframes inyectados */}
      <style>{`
        @keyframes splashFloat {
          from { transform: translateY(0px) scale(1); }
          to   { transform: translateY(-20px) scale(1.3); }
        }

        @keyframes splashPulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50%      { opacity: 1; transform: scale(1.05); }
        }

        @keyframes splashRingExpand {
          0%   { transform: scale(0.2); opacity: 0.8; }
          100% { transform: scale(2); opacity: 0; }
        }

        @keyframes splashGlow {
          from { opacity: 0.5; transform: scale(0.95); }
          to   { opacity: 1; transform: scale(1.1); }
        }

        @keyframes splashOrbitSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }

        @keyframes splashLoader {
          0%   { width: 0%; }
          60%  { width: 70%; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  );
}
