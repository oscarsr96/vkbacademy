import { useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';

// Navbar fija con glassmorphism para las páginas públicas de marketing
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
            <img
              src="https://vallekasbasket.com/wp-content/uploads/2022/04/logotipo-vallekas-basket.png"
              alt="Vallekas Basket"
              style={styles.brandLogo}
            />
            <span style={styles.brandText}>VKB Academy</span>
          </Link>

          {/* Links centro — solo visibles en desktop */}
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
                const el = e.currentTarget as HTMLButtonElement;
                el.style.boxShadow = '0 0 28px rgba(234,88,12,0.55)';
                el.style.transform = 'translateY(-1px)';
                el.style.filter = 'brightness(1.08)';
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.boxShadow = '0 4px 18px rgba(234,88,12,0.35)';
                el.style.transform = 'translateY(0)';
                el.style.filter = 'none';
              }}
            >
              Acceder →
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
              Acceder →
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
        <div style={styles.footerInner}>
          <div style={styles.footerBrand}>
            <img
              src="https://vallekasbasket.com/wp-content/uploads/2022/04/logotipo-vallekas-basket.png"
              alt="Vallekas Basket"
              style={styles.footerLogo}
            />
          </div>
          <p style={styles.footerText}>
            © 2026 Vallekas Basket · Formación deportiva y académica
          </p>
          <div style={styles.footerLinks}>
            <Link to="/" style={styles.footerLink}>Inicio</Link>
            <span style={styles.footerSep}>·</span>
            <Link to="/nosotros" style={styles.footerLink}>Sobre nosotros</Link>
            <span style={styles.footerSep}>·</span>
            <Link to="/precios" style={styles.footerLink}>Precios</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      style={styles.navLink}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLAnchorElement;
        el.style.color = '#f97316';
        el.style.opacity = '1';
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLAnchorElement;
        el.style.color = '#ffffff';
        el.style.opacity = '0.80';
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

  // Navbar con glassmorphism
  navbar: {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    background: 'linear-gradient(180deg, rgba(8,14,26,0.97) 0%, rgba(13,27,42,0.95) 100%)',
    borderBottom: '1px solid rgba(234,88,12,0.14)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
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
    gap: '0.625rem',
    textDecoration: 'none',
    flexShrink: 0,
  },
  brandLogo: {
    height: 36,
    width: 'auto',
    objectFit: 'contain' as const,
  },
  brandText: {
    background: 'linear-gradient(135deg, #ea580c, #f97316)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    fontWeight: 800,
    fontSize: '1.125rem',
    letterSpacing: '-0.01em',
  },

  // Nav link
  navLink: {
    color: '#ffffff',
    textDecoration: 'none',
    fontSize: '0.9375rem',
    fontWeight: 500,
    opacity: 0.80,
    transition: 'color 0.18s, opacity 0.18s',
  },

  // CTA button
  ctaButton: {
    background: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: 8,
    padding: '9px 22px',
    fontSize: '0.9375rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'box-shadow 0.18s, transform 0.18s, filter 0.18s',
    flexShrink: 0,
    whiteSpace: 'nowrap',
    boxShadow: '0 4px 18px rgba(234,88,12,0.35)',
    letterSpacing: '0.01em',
  },

  // Main content
  main: {
    flex: 1,
  },

  // Footer mejorado
  footer: {
    background: 'linear-gradient(135deg, #080e1a 0%, #0d1b2a 100%)',
    padding: '2.5rem 2rem',
    borderTop: '1px solid rgba(234,88,12,0.10)',
  },
  footerInner: {
    maxWidth: 1200,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  footerBrand: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  footerLogo: {
    height: 52,
    width: 'auto',
    objectFit: 'contain' as const,
    opacity: 0.85,
  },
  footerText: {
    color: 'rgba(255,255,255,0.40)',
    fontSize: '0.8125rem',
    margin: 0,
  },
  footerLinks: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  footerLink: {
    color: 'rgba(255,255,255,0.50)',
    textDecoration: 'none',
    fontSize: '0.8125rem',
    transition: 'color 0.15s',
  },
  footerSep: {
    color: 'rgba(255,255,255,0.20)',
    fontSize: '0.75rem',
  },
};
