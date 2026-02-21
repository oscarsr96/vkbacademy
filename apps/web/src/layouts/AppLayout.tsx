import { NavLink, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { useLogout } from '../hooks/useAuth';
import { Role } from '@vkbacademy/shared';

type NavLink = { to: string; label: string; end?: boolean };

function buildNavLinks(role: Role | undefined): NavLink[] {
  const base: NavLink[] = [{ to: '/dashboard', label: '🏠 Inicio', end: true }];

  if (role === Role.TUTOR) {
    return [
      ...base,
      { to: '/tutor/students', label: '👥 Mis alumnos' },
      { to: '/bookings', label: '📅 Reservas' },
      { to: '/challenges', label: '🏆 Retos' },
      { to: '/certificates', label: '📜 Certificados' },
    ];
  }

  if (role === Role.ADMIN) {
    return [
      ...base,
      { to: '/admin', label: '⚙️ Dashboard', end: true },
      { to: '/admin/users', label: '   👥 Usuarios' },
      { to: '/admin/courses', label: '   📚 Gestión de Cursos' },
      { to: '/admin/billing', label: '   💳 Facturación' },
      { to: '/admin/challenges', label: '   🎯 Retos' },
      { to: '/admin/redemptions', label: '   🎁 Canjes' },
    ];
  }

  const links: NavLink[] = [
    ...base,
    { to: '/courses', label: '📚 Cursos' },
    { to: '/bookings', label: '📅 Reservas' },
    // Solo visible para STUDENT
    ...(role === Role.STUDENT
      ? [
          { to: '/my-exams', label: '🎓 Exámenes' },
          { to: '/challenges', label: '🏆 Retos' },
          { to: '/certificates', label: '📜 Certificados' },
        ]
      : []),
  ];

  return links;
}

export default function AppLayout() {
  const user = useAuthStore((s) => s.user);
  const { mutate: logout, isPending } = useLogout();

  const links = buildNavLinks(user?.role);

  return (
    <div style={styles.shell}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.brand}>
          <img
            src="https://vallekasbasket.com/wp-content/uploads/2022/04/logotipo-vallekas-basket.png"
            alt="Vallekas Basket"
            style={styles.brandLogo}
          />
        </div>

        <nav style={styles.nav}>
          {links.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              style={({ isActive }) => ({
                ...styles.navItem,
                ...(isActive ? styles.navItemActive : {}),
              })}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Usuario */}
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
          >
            ↩
          </button>
        </div>
      </aside>

      {/* Contenido */}
      <main style={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: { display: 'flex', minHeight: '100vh' },
  sidebar: {
    width: 240,
    flexShrink: 0,
    background: 'var(--color-dark)',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px 16px',
    gap: 8,
    position: 'sticky',
    top: 0,
    height: '100vh',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '0 8px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    marginBottom: 8,
  },
  brandLogo: { width: '100%', maxWidth: 160, objectFit: 'contain' as const },
  nav: { flex: 1, display: 'flex', flexDirection: 'column', gap: 4 },
  navItem: {
    display: 'block',
    padding: '10px 12px',
    borderRadius: 'var(--radius-sm)',
    color: 'rgba(255,255,255,0.65)',
    textDecoration: 'none',
    fontSize: '0.9rem',
    fontWeight: 500,
    transition: 'background 0.15s, color 0.15s',
  },
  navItemActive: {
    background: 'var(--color-primary)',
    color: '#fff',
  },
  userSection: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '16px 8px 0',
    borderTop: '1px solid rgba(255,255,255,0.1)',
    marginTop: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: 'var(--color-primary)',
    color: '#fff',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontSize: '0.9rem',
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
    color: 'rgba(255,255,255,0.5)',
    cursor: 'pointer',
    fontSize: '1.1rem',
    padding: 4,
    borderRadius: 4,
    flexShrink: 0,
    transition: 'color 0.15s',
  },
  main: { flex: 1, padding: 32, overflowY: 'auto' },
};
