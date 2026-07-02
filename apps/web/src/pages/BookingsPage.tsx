import { useAuthStore } from '../store/auth.store';
import { Role } from '@vkbacademy/shared';
import { StudentView } from './bookings/StudentView';
import { TutorView } from './bookings/TutorView';
import { TeacherView } from './bookings/TeacherView';
import { AdminView } from './bookings/AdminView';

// ---------------------------------------------------------------------------
// Pagina principal
// ---------------------------------------------------------------------------

export default function BookingsPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div style={{ maxWidth: 920, margin: '0 auto' }}>
      {user?.role === Role.STUDENT && <StudentView />}
      {user?.role === Role.TUTOR   && <TutorView />}
      {user?.role === Role.TEACHER && <TeacherView />}
      {(user?.role === Role.ADMIN || user?.role === Role.SUPER_ADMIN) && <AdminView />}
    </div>
  );
}
