import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { useLogout } from '../hooks/useAuth';
import { useAcademyDomain } from '../contexts/AcademyContext';
import { contrastText } from '../utils/color';
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

  if (role === Role.SUPER_ADMIN) {
    return [
      ...base,
      { to: '/admin', label: '⚙️ Dashboard', end: true, divider: true },
      { to: '/admin/academies', label: '🏫 Academias' },
      { to: '/admin/users', label: '👥 Usuarios' },
      { to: '/admin/courses', label: '📚 Cursos' },
      { to: '/admin/billing', label: '💳 Facturación' },
      { to: '/admin/challenges', label: '🎯 Retos' },
      { to: '/admin/redemptions', label: '🎁 Canjes' },
      { to: '/profile', label: '👤 Mi perfil', divider: true },
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
    { to: '/exercises', label: '🧮 Ejercicios' },
    { to: '/theory', label: '📖 Teoría' },
    { to: '/my-exams', label: '🎓 Exámenes' },
    { to: '/challenges', label: '🏆 Retos' },
    { to: '/profile', label: '👤 Mi perfil' },
  ];
}

export default function AppLayout() {
  const user = useAuthStore((s) => s.user);
  const storeAcademy = useAuthStore((s) => s.academy);
  const { academy: domainAcademy } = useAcademyDomain();
  const { mutate: logout, isPending } = useLogout();
  const [menuOpen, setMenuOpen] = useState(false);

  // Prioridad: auth store (post-login) > domain context > fallback VKB
  const academy = storeAcademy ?? domainAcademy;
  const c = academy?.primaryColor ?? '#ea580c'; // color acento
  const brandName = academy?.name ?? 'VKB Academy';
  const brandLogo = academy?.logoUrl ?? null;
  const links = buildNavLinks(user?.role);

  return (
    <div className="app-shell">
      {/* Barra superior móvil */}
      <div className="app-topbar">
        <button className="app-hamburger" onClick={() => setMenuOpen(true)} aria-label="Abrir menú">
          ☰
        </button>
        <span className="app-topbar-brand">
          {brandLogo ? (
            <img
              src={brandLogo}
              alt={brandName}
              style={{ height: 28, width: 'auto', objectFit: 'contain', display: 'block' }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                borderRadius: 8,
                background: `linear-gradient(135deg, ${c}, ${c}cc)`,
                color: contrastText(c),
                fontWeight: 800,
                fontSize: '0.9rem',
              }}
            >
              {brandName.charAt(0)}
            </span>
          )}
          <span style={{ fontWeight: 700 }}>{brandName}</span>
        </span>
        <button
          className="app-topbar-logout"
          onClick={() => logout()}
          disabled={isPending}
          title="Cerrar sesión"
        >
          ↩
        </button>
      </div>

      {menuOpen && <div className="app-overlay" onClick={() => setMenuOpen(false)} />}

      {/* Sidebar */}
      <aside
        className={`app-sidebar${menuOpen ? ' open' : ''}`}
        style={{ ...baseStyles.sidebar, borderRight: `1px solid ${c}26` }}
      >
        <button
          className="app-sidebar-close"
          onClick={() => setMenuOpen(false)}
          aria-label="Cerrar menú"
        >
          ✕
        </button>

        {/* Brand */}
        <div style={{ ...baseStyles.brand, borderBottom: `1px solid ${c}1f` }}>
          {brandLogo ? (
            <img
              src={brandLogo}
              alt={brandName}
              style={baseStyles.brandLogo}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 12,
                background: `linear-gradient(135deg, ${c}, ${c}cc)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: contrastText(c),
                fontWeight: 800,
                fontSize: '1.5rem',
                boxShadow: `0 4px 16px ${c}44`,
              }}
            >
              {brandName.charAt(0)}
            </div>
          )}
          <span style={{ color: c, fontWeight: 800, fontSize: '0.9rem', textAlign: 'center' }}>
            {brandName}
          </span>
        </div>

        {/* Navegación */}
        <nav style={baseStyles.nav}>
          {links.map(({ to, label, end, divider }, i) => (
            <div key={to}>
              {divider && i > 0 && (
                <div style={{ height: 1, background: `${c}1a`, margin: '8px 6px' }} />
              )}
              <NavLink
                to={to}
                end={end}
                onClick={() => setMenuOpen(false)}
                style={({ isActive }) => ({
                  ...baseStyles.navItem,
                  ...(isActive
                    ? {
                        background: `linear-gradient(90deg, ${c}38 0%, ${c}0f 100%)`,
                        color: '#fff',
                        fontWeight: 600,
                        borderLeftColor: c,
                        boxShadow: `inset 0 0 12px ${c}14`,
                      }
                    : {}),
                })}
              >
                {label}
              </NavLink>
            </div>
          ))}
        </nav>

        {/* Usuario / logout */}
        <div style={{ ...baseStyles.userSection, borderTop: `1px solid ${c}1f` }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${c} 0%, ${c}cc 100%)`,
              color: contrastText(c),
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              fontSize: '0.9375rem',
              boxShadow: `0 0 0 3px ${c}40`,
            }}
          >
            {user?.name.charAt(0).toUpperCase()}
          </div>
          <div style={baseStyles.userInfo}>
            <span style={baseStyles.userName}>{user?.name}</span>
            <span className={`role-badge ${user?.role}`}>{user?.role}</span>
          </div>
          <button
            onClick={() => logout()}
            disabled={isPending}
            style={baseStyles.logoutBtn}
            title="Cerrar sesión"
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = c;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.45)';
            }}
          >
            ↩
          </button>
        </div>
      </aside>

      <main className="app-main">
        <Outlet />
      </main>

      {(user?.role === Role.STUDENT || user?.role === Role.TUTOR) && <TutorWidget />}
    </div>
  );
}

const baseStyles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 248,
    flexShrink: 0,
    background: 'linear-gradient(180deg, #080e1a 0%, #0d1b2a 100%)',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px 14px',
    gap: 6,
    height: '100vh',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '0 8px 20px',
    marginBottom: 8,
    flexDirection: 'column',
  },
  brandLogo: { width: '100%', maxWidth: 148, objectFit: 'contain' as const },
  nav: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' },
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
  userSection: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '14px 8px 0',
    marginTop: 8,
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
