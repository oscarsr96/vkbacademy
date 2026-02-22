import { useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';

// Navbar fija superior para las páginas públicas de marketing
export default function PublicLayout() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div style={styles.shell}>
      {/* ── Navbar ── */}
      <header style={styles.navbar}>
        <div style={styles.navInner}>
          {/* Logo izquierda */}
          <Link to="/" style={styles.brand}>
            <span style={styles.brandEmoji}>🏀</span>
            <span style={styles.brandText}>VKB Academy</span>
          </Link>

          {/* Links centro — solo visibles en desktop (CSS los oculta en móvil) */}
          <nav className="pub-nav-links-desktop">
            <NavItem to="/" label="Inicio" />
            <NavItem to="/nosotros" label="Sobre nosotros" />
            <NavItem to="/precios" label="Precios" />
          </nav>

          {/* CTA derecha — solo visible en desktop */}
          <span className="pub-cta-desktop">
            <button
              onClick={() => navigate('/login')}
              style={styles.ctaButton}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = '#c94e00';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = '#ea580c';
              }}
            >
              Acceder
            </button>
          </span>

          {/* Hamburger — solo visible en móvil */}
          <button
            className="pub-hamburger"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>

        {/* Menú móvil desplegable */}
        {menuOpen && (
          <div className="pub-mobile-menu">
            <Link to="/" className="pub-mobile-link" onClick={() => setMenuOpen(false)}>
              Inicio
            </Link>
            <Link to="/nosotros" className="pub-mobile-link" onClick={() => setMenuOpen(false)}>
              Sobre nosotros
            </Link>
            <Link to="/precios" className="pub-mobile-link" onClick={() => setMenuOpen(false)}>
              Precios
            </Link>
            <button
              className="pub-mobile-cta"
              onClick={() => { setMenuOpen(false); navigate('/login'); }}
            >
              Acceder
            </button>
          </div>
        )}
      </header>

      {/* ── Contenido de la página ── */}
      <main style={styles.main}>
        <Outlet />
      </main>

      {/* ── Footer ── */}
      <footer style={styles.footer}>
        <p style={styles.footerText}>
          © 2026 Vallekas Basket · VKB Academy
        </p>
      </footer>
    </div>
  );
}

// Componente auxiliar para los links de navegación con hover
function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      style={styles.navLink}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.opacity = '1';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.opacity = '0.8';
      }}
    >
      {label}
    </Link>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
  },

  // Navbar
  navbar: {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    background: '#0d1b2a',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  navInner: {
    width: '100%',
    maxWidth: 1200,
    margin: '0 auto',
    padding: '0 2rem',
    height: 64,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '2rem',
  },

  // Brand
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    textDecoration: 'none',
    flexShrink: 0,
  },
  brandEmoji: {
    fontSize: '1.5rem',
    lineHeight: 1,
  },
  brandText: {
    color: '#ffffff',
    fontWeight: 700,
    fontSize: '1.125rem',
    letterSpacing: '-0.01em',
  },

  // Nav link (individual)
  navLink: {
    color: '#ffffff',
    textDecoration: 'none',
    fontSize: '0.9375rem',
    fontWeight: 500,
    opacity: 0.8,
    transition: 'opacity 0.15s',
  },

  // CTA button
  ctaButton: {
    background: '#ea580c',
    color: '#ffffff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 20px',
    fontSize: '0.9375rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.15s',
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },

  // Main content
  main: {
    flex: 1,
  },

  // Footer
  footer: {
    background: '#0d1b2a',
    padding: '2rem',
    textAlign: 'center',
  },
  footerText: {
    color: '#ffffff',
    opacity: 0.5,
    fontSize: '0.8rem',
    margin: 0,
  },
};
