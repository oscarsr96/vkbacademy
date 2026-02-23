import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { useLogout } from '../hooks/useAuth';
import { Role } from '@vkbacademy/shared';
import TutorWidget from '../components/TutorWidget';

type NavLink = { to: string; label: string; end?: boolean; divider?: boolean };

function buildNavLinks(role: Role | undefined): NavLink[] {
  const base: NavLink[] = [{ to: '/dashboard', label: '🏠 Inicio', end: true }];

  if (role === Role.TUTOR) {
    return [
      ...base,
      { to: '/tutor/students', label: '👥 Mis alumnos' },
      { to: '/bookings', label: '📅 Reservas' },
      { to: '/challenges', label: '🏆 Retos' },
      { to: '/certificates', label: '📜 Certificados' },
      { to: '/profile', label: '👤 Mi perfil' },
    ];
  }

  if (role === Role.ADMIN) {
    return [
      ...base,
      { to: '/admin', label: '⚙️ Dashboard', end: true, divider: true },
      { to: '/admin/users', label: '👥 Usuarios' },
      { to: '/admin/courses', label: '📚 Cursos' },
      { to: '/admin/billing', label: '💳 Facturación' },
      { to: '/admin/challenges', label: '🎯 Retos' },
      { to: '/admin/redemptions', label: '🎁 Canjes' },
      { to: '/profile', label: '👤 Mi perfil', divider: true },
    ];
  }

  if (role === Role.TEACHER) {
    return [
      ...base,
      { to: '/teacher', label: '🏫 Portal Docente' },
      { to: '/courses', label: '📚 Cursos' },
      { to: '/profile', label: '👤 Mi perfil' },
    ];
  }

  // STUDENT por defecto
  return [
    ...base,
    { to: '/courses', label: '📚 Cursos' },
    { to: '/bookings', label: '📅 Reservas' },
    { to: '/my-exams', label: '🎓 Exámenes' },
    { to: '/challenges', label: '🏆 Retos' },
    { to: '/certificates', label: '📜 Certificados' },
    { to: '/profile', label: '👤 Mi perfil' },
  ];
}

export default function AppLayout() {
  const user = useAuthStore((s) => s.user);
  const { mutate: logout, isPending } = useLogout();
  const [menuOpen, setMenuOpen] = useState(false);

  const links = buildNavLinks(user?.role);

  return (
    <div className="app-shell">
      {/* Barra superior móvil */}
      <div className="app-topbar">
        <button
          className="app-hamburger"
          onClick={() => setMenuOpen(true)}
          aria-label="Abrir menú"
        >
          ☰
        </button>
        <span className="app-topbar-brand">🏀 VKB Academy</span>
        <button
          className="app-topbar-logout"
          onClick={() => logout()}
          disabled={isPending}
          title="Cerrar sesión"
        >
          ↩
        </button>
      </div>

      {/* Overlay oscuro al abrir el sidebar en móvil */}
      {menuOpen && (
        <div className="app-overlay" onClick={() => setMenuOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`app-sidebar${menuOpen ? ' open' : ''}`} style={styles.sidebar}>
        {/* Botón cerrar (solo visible en móvil) */}
        <button
          className="app-sidebar-close"
          onClick={() => setMenuOpen(false)}
          aria-label="Cerrar menú"
        >
          ✕
        </button>

        {/* Brand */}
        <div style={styles.brand}>
          <img
            src="https://vallekasbasket.com/wp-content/uploads/2022/04/logotipo-vallekas-basket.png"
            alt="Vallekas Basket"
            style={styles.brandLogo}
            onError={(e) => {
              // Fallback si la imagen no carga
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
          <span style={styles.brandFallback}>🏀 VKB Academy</span>
        </div>

        {/* Navegación */}
        <nav style={styles.nav}>
          {links.map(({ to, label, end, divider }, i) => (
            <div key={to}>
              {divider && i > 0 && <div style={styles.navDivider} />}
              <NavLink
                to={to}
                end={end}
                onClick={() => setMenuOpen(false)}
                style={({ isActive }) => ({
                  ...styles.navItem,
                  ...(isActive ? styles.navItemActive : {}),
                })}
              >
                {label}
              </NavLink>
            </div>
          ))}
        </nav>

        {/* Usuario / logout */}
        <div style={styles.userSection}>
          <div style={styles.avatar}>
            {user?.name.charAt(0).toUpperCase()}
          </div>
          <div style={styles.userInfo}>
            <span style={styles.userName}>{user?.name}</span>
            <span className={`role-badge ${user?.role}`}>{user?.role}</span>
          </div>
          <button
            onClick={() => logout()}
            disabled={isPending}
            style={styles.logoutBtn}
            title="Cerrar sesión"
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = '#ea580c';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.45)';
            }}
          >
            ↩
          </button>
        </div>
      </aside>

      {/* Contenido principal */}
      <main className="app-main">
        <Outlet />
      </main>

      {/* Tutor virtual — solo para STUDENT y TUTOR */}
      {(user?.role === Role.STUDENT || user?.role === Role.TUTOR) && <TutorWidget />}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 248,
    flexShrink: 0,
    background: 'linear-gradient(180deg, #080e1a 0%, #0d1b2a 100%)',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px 14px',
    gap: 6,
    position: 'sticky',
    top: 0,
    height: '100vh',
    borderRight: '1px solid rgba(234,88,12,0.15)',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '0 8px 20px',
    borderBottom: '1px solid rgba(234,88,12,0.12)',
    marginBottom: 8,
    flexDirection: 'column',
  },
  brandLogo: {
    width: '100%',
    maxWidth: 148,
    objectFit: 'contain' as const,
  },
  brandFallback: {
    display: 'none',
    color: '#f97316',
    fontWeight: 800,
    fontSize: '1rem',
  },
  nav: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    overflowY: 'auto',
  },
  navItem: {
    display: 'block',
    padding: '10px 14px',
    borderRadius: '8px',
    color: 'rgba(255,255,255,0.60)',
    textDecoration: 'none',
    fontSize: '0.875rem',
    fontWeight: 500,
    transition: 'background 0.18s, color 0.18s, box-shadow 0.18s',
    borderLeft: '3px solid transparent',
  },
  navItemActive: {
    background: 'linear-gradient(90deg, rgba(234,88,12,0.22) 0%, rgba(234,88,12,0.06) 100%)',
    color: '#fff',
    fontWeight: 600,
    borderLeftColor: '#ea580c',
    boxShadow: 'inset 0 0 12px rgba(234,88,12,0.08)',
  },
  navDivider: {
    height: 1,
    background: 'rgba(234,88,12,0.10)',
    margin: '8px 6px',
  },
  userSection: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '14px 8px 0',
    borderTop: '1px solid rgba(234,88,12,0.12)',
    marginTop: 8,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
    color: '#fff',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontSize: '0.9375rem',
    boxShadow: '0 0 0 3px rgba(234,88,12,0.25)',
  },
  userInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    overflow: 'hidden',
  },
  userName: {
    color: '#fff',
    fontSize: '0.8125rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  logoutBtn: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.45)',
    cursor: 'pointer',
    fontSize: '1.125rem',
    padding: 4,
    borderRadius: 6,
    flexShrink: 0,
    transition: 'color 0.18s',
  },
};
