import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useRegisterStudents } from '../hooks/useAuth';
import { useSchoolYears } from '../hooks/useCourses';
import { useAcademyDomain } from '../contexts/AcademyContext';
import { getApiErrorMessage } from '../utils/errorMessage';
import type { RegisteredStudent } from '../api/auth.api';
import Icon from '../components/ui/Icon';

/** Valida formato de email: x@y.z */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Academia por defecto cuando no estamos en un dominio de academia específica. */
const DEFAULT_ACADEMY_SLUG = 'vallekas-basket';

/**
 * Tope de alumnos por solicitud. Replica `MAX_STUDENTS_PER_REQUEST` de
 * `apps/api/src/auth/dto/register-students.dto.ts`: no se importa porque son
 * paquetes distintos, pero debe mantenerse igual — si el backend cambia el
 * límite, este valor hay que actualizarlo a mano.
 */
const MAX_STUDENTS = 10;

interface StudentForm {
  name: string;
  schoolYearId: string;
  password: string;
}

const emptyStudent = (): StudentForm => ({ name: '', schoolYearId: '', password: '' });

export default function RegisterPage() {
  const [searchParams] = useSearchParams();
  const { academy: domainAcademy } = useAcademyDomain();
  // El slug se resuelve sin pedirlo al usuario: dominio de academia → query
  // string → default fijo (Vallekas Basket Academy).
  const academySlug = domainAcademy?.slug ?? searchParams.get('academy') ?? DEFAULT_ACADEMY_SLUG;

  const [guardianEmail, setGuardianEmail] = useState('');
  const [guardianEmailError, setGuardianEmailError] = useState('');
  const [digestConsent, setDigestConsent] = useState(false);
  const [students, setStudents] = useState<StudentForm[]>([emptyStudent()]);
  const [studentErrors, setStudentErrors] = useState<Record<number, string>>({});

  const { mutate, isPending, error, data } = useRegisterStudents();
  const { data: schoolYears = [] } = useSchoolYears();

  // El registro ya no inicia sesión: el padre no tiene cuenta. Al resolver la
  // mutación, la pantalla de confirmación sustituye al formulario para
  // siempre — no hay vuelta atrás, porque los usuarios no se vuelven a
  // mostrar en ningún otro sitio.
  if (data) {
    return <RegistrationDone students={data.students} />;
  }

  function updateStudent(index: number, field: keyof StudentForm, value: string) {
    setStudents((prev) => prev.map((st, i) => (i === index ? { ...st, [field]: value } : st)));
  }

  function addStudent() {
    if (students.length >= MAX_STUDENTS) return;
    setStudents((prev) => [...prev, emptyStudent()]);
  }

  function removeStudent(index: number) {
    if (students.length <= 1) return;
    setStudents((prev) => prev.filter((_, i) => i !== index));
  }

  /** Valida el formulario entero antes de enviar. Devuelve si es válido. */
  function validate(): boolean {
    setGuardianEmailError('');
    setStudentErrors({});
    let ok = true;

    if (!isValidEmail(guardianEmail)) {
      setGuardianEmailError('Email inválido — formato requerido: x@y.z');
      ok = false;
    }

    const nextStudentErrors: Record<number, string> = {};
    students.forEach((st, i) => {
      if (!st.name.trim() || !st.schoolYearId) {
        nextStudentErrors[i] = 'Completa el nombre y el curso del alumno';
      } else if (st.password.length < 8) {
        nextStudentErrors[i] = 'La contraseña debe tener al menos 8 caracteres';
      }
    });
    if (Object.keys(nextStudentErrors).length > 0) {
      setStudentErrors(nextStudentErrors);
      ok = false;
    }

    return ok;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    mutate({
      guardianEmail,
      academySlug,
      guardianDigestConsent: digestConsent,
      students: students.map((st) => ({
        name: st.name.trim(),
        schoolYearId: st.schoolYearId,
        password: st.password,
      })),
    });
  }

  const apiError = error
    ? getApiErrorMessage(error, 'No se pudieron crear las cuentas. Inténtalo de nuevo.')
    : '';
  const atMaxStudents = students.length >= MAX_STUDENTS;

  return (
    <div style={s.page} className="court-lines sweep-light">
      <div style={s.bgGlow} />

      <div style={s.card} className="animate-in">
        {/* Encabezado */}
        <div style={s.header}>
          <div style={s.logoWrap}>
            <Icon name="basketball" size={32} color="var(--brand-contrast)" />
          </div>
          <h1 style={s.title}>Registrar a tus hijos</h1>
          <p style={s.subtitle}>
            {domainAcademy
              ? `Crea las cuentas de tus hijos en ${domainAcademy.name}`
              : 'Crea las cuentas de tus hijos'}
          </p>
        </div>

        {apiError && (
          <div style={s.errorBox}>
            <span style={s.errorIcon}>!</span>
            {apiError}
          </div>
        )}

        <form onSubmit={handleSubmit} style={s.form} noValidate>
          <div className="field field-dark">
            <label htmlFor="guardianEmail">Email del padre, madre o tutor</label>
            <input
              id="guardianEmail"
              type="email"
              autoComplete="email"
              value={guardianEmail}
              onChange={(e) => {
                setGuardianEmail(e.target.value);
                setGuardianEmailError('');
              }}
              placeholder="tu@email.com"
              className={guardianEmailError ? 'error' : ''}
              style={guardianEmailError ? { borderColor: '#dc2626' } : {}}
              required
            />
            {guardianEmailError && <span style={s.fieldError}>{guardianEmailError}</span>}
            <span style={s.fieldHint}>
              No crea una cuenta ni sirve para iniciar sesión. Lo usamos para poder mandarte,
              si quieres, un resumen semanal de lo que estudian tus hijos.
            </span>
            <label htmlFor="digestConsent" style={s.consentRow}>
              <input
                id="digestConsent"
                type="checkbox"
                checked={digestConsent}
                onChange={(e) => setDigestConsent(e.target.checked)}
              />
              <span>
                Quiero recibir el <strong>resumen semanal</strong>. Puedes darte de baja desde
                cualquiera de esos correos.
              </span>
            </label>
          </div>

          {students.map((student, i) => (
            <div key={i} style={s.studentCard}>
              <div style={s.studentHeader}>
                <span style={s.studentLabel}>Alumno {i + 1}</span>
                {students.length > 1 && (
                  <button type="button" onClick={() => removeStudent(i)} style={s.removeBtn}>
                    Eliminar
                  </button>
                )}
              </div>

              <div className="field field-dark">
                <label htmlFor={`student-name-${i}`}>Nombre del alumno</label>
                <input
                  id={`student-name-${i}`}
                  type="text"
                  value={student.name}
                  onChange={(e) => updateStudent(i, 'name', e.target.value)}
                  placeholder="Juan García"
                  required
                />
              </div>

              <div className="field field-dark">
                <label htmlFor={`student-sy-${i}`}>Curso del alumno</label>
                <select
                  id={`student-sy-${i}`}
                  value={student.schoolYearId}
                  onChange={(e) => updateStudent(i, 'schoolYearId', e.target.value)}
                  required
                >
                  <option value="">Selecciona el curso (ej: 3º ESO)</option>
                  {schoolYears.map((sy) => (
                    <option key={sy.id} value={sy.id}>
                      {sy.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field field-dark">
                <label htmlFor={`student-password-${i}`}>Contraseña del alumno</label>
                <input
                  id={`student-password-${i}`}
                  type="password"
                  autoComplete="new-password"
                  value={student.password}
                  onChange={(e) => updateStudent(i, 'password', e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  required
                />
              </div>

              {studentErrors[i] && <span style={s.fieldError}>{studentErrors[i]}</span>}
            </div>
          ))}

          <button
            type="button"
            onClick={addStudent}
            disabled={atMaxStudents}
            style={atMaxStudents ? { ...s.addBtn, ...s.addBtnDisabled } : s.addBtn}
          >
            {atMaxStudents
              ? `Has llegado al máximo de ${MAX_STUDENTS} alumnos por solicitud`
              : '+ Añadir otro alumno'}
          </button>

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={isPending}
            style={{ marginTop: 4, padding: '13px 22px', fontSize: '1rem' }}
          >
            {isPending ? <span className="spinner" /> : 'Crear cuentas'}
          </button>
        </form>

        <p style={s.footerText}>
          <span style={s.footerMuted}>¿Ya tienes cuenta como alumno? </span>
          <Link to="/login" style={s.link}>
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}

/**
 * Pantalla de confirmación tras crear las cuentas. Es la única vez que se
 * muestran los usernames generados: no se envían por email (descartado
 * expresamente) y no se pueden volver a consultar salvo pidiéndoselos a la
 * academia. Por eso el aviso va arriba, antes de la lista.
 */
function RegistrationDone({ students }: { students: RegisteredStudent[] }) {
  const [copied, setCopied] = useState(false);

  const plainText = students.map((st) => `${st.name} — usuario: ${st.username}`).join('\n');

  return (
    <div style={s.page} className="court-lines sweep-light">
      <div style={s.bgGlow} />

      <div style={s.card} className="animate-in">
        <div style={s.header}>
          <div style={s.logoWrap}>
            <Icon name="basketball" size={32} color="var(--brand-contrast)" />
          </div>
          <h1 style={s.title}>Cuentas creadas</h1>
        </div>

        <p role="alert" style={s.warnBox}>
          <strong>Apunta estos datos antes de cerrar esta página.</strong> No te los enviamos por
          email y no se vuelven a mostrar. Si los pierdes, tendrás que pedírselos a la academia.
        </p>

        <ul style={s.studentsList}>
          {students.map((st) => (
            <li key={st.username} style={s.studentsListItem}>
              <span style={s.studentsListName}>{st.name}</span>
              <code style={s.usernameCode}>{st.username}</code>
              {st.schoolYear && <span style={s.studentsListYear}>{st.schoolYear}</span>}
            </li>
          ))}
        </ul>

        <button
          type="button"
          className="btn btn-primary btn-full"
          style={{ padding: '13px 22px', fontSize: '1rem' }}
          onClick={() => {
            void navigator.clipboard.writeText(plainText);
            setCopied(true);
          }}
        >
          {copied ? 'Copiado' : 'Copiar usuarios'}
        </button>

        <p style={s.footerText}>
          <Link to="/login" style={s.link}>
            Ir a iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    background:
      'radial-gradient(120% 80% at 50% -10%, rgba(245,145,30,0.14), transparent 55%), radial-gradient(80% 60% at 90% 110%, rgba(255,210,77,0.07), transparent 60%), linear-gradient(180deg, var(--navy-950) 0%, var(--navy-800) 100%)',
    position: 'relative',
    overflow: 'hidden',
  },
  bgGlow: {
    position: 'fixed',
    top: '-10%',
    right: '-10%',
    width: '600px',
    height: '600px',
    background: 'radial-gradient(circle, var(--brand-soft) 0%, transparent 60%)',
    pointerEvents: 'none',
    zIndex: 0,
  },
  card: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    maxWidth: '480px',
    background: 'rgba(8,14,26,0.88)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1.5px solid rgba(245,145,30,0.20)',
    borderRadius: '20px',
    padding: '40px 36px',
    boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(245,145,30,0.10)',
    display: 'flex',
    flexDirection: 'column',
    gap: '22px',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    textAlign: 'center',
  },
  logoWrap: {
    width: '68px',
    height: '68px',
    borderRadius: '50%',
    background: 'var(--gradient-orange)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 32px rgba(245,145,30,0.35)',
    flexShrink: 0,
  },
  title: {
    fontSize: '1.6rem',
    fontWeight: 800,
    color: '#ffffff',
    fontFamily: 'var(--font-display)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.03em',
    lineHeight: 1.2,
  },
  subtitle: {
    fontSize: '0.9rem',
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 1.5,
  },
  errorBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    background: 'rgba(220,38,38,0.15)',
    borderLeft: '4px solid #dc2626',
    borderRadius: '8px',
    padding: '12px 14px',
    color: '#fca5a5',
    fontSize: '0.875rem',
    lineHeight: 1.5,
  },
  errorIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    background: '#dc2626',
    color: '#fff',
    fontSize: '0.7rem',
    fontWeight: 800,
    flexShrink: 0,
    marginTop: '1px',
  },
  warnBox: {
    background: 'rgba(245,145,30,0.15)',
    borderLeft: '4px solid var(--brand)',
    borderRadius: '8px',
    padding: '12px 14px',
    color: '#ffd699',
    fontSize: '0.875rem',
    lineHeight: 1.5,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  fieldError: {
    fontSize: '0.8125rem',
    color: '#fca5a5',
    marginTop: '2px',
  },
  fieldHint: {
    fontSize: '0.78rem',
    color: 'rgba(255,255,255,0.40)',
    marginTop: '4px',
    display: 'block',
  },
  consentRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.5rem',
    marginTop: '0.6rem',
    fontSize: '0.82rem',
    color: 'rgba(255,255,255,0.72)',
    cursor: 'pointer',
    lineHeight: 1.4,
  },
  studentCard: {
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    background: 'rgba(255,255,255,0.02)',
  },
  studentHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  studentLabel: {
    fontSize: '0.85rem',
    fontWeight: 700,
    color: 'var(--brand-light)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  removeBtn: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.35)',
    fontSize: '0.8rem',
    cursor: 'pointer',
    padding: '4px 8px',
  },
  addBtn: {
    background: 'transparent',
    border: '1px dashed rgba(255,255,255,0.15)',
    borderRadius: 10,
    padding: '12px',
    color: 'rgba(255,255,255,0.5)',
    fontSize: '0.9rem',
    cursor: 'pointer',
    textAlign: 'center' as const,
  },
  addBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  studentsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  studentsListItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    padding: '12px 14px',
  },
  studentsListName: {
    fontWeight: 600,
    color: '#ffffff',
    flexShrink: 0,
  },
  usernameCode: {
    fontFamily: 'var(--font-mono, monospace)',
    background: 'rgba(255,255,255,0.08)',
    color: 'var(--brand-light)',
    padding: '4px 8px',
    borderRadius: 6,
    fontSize: '0.9rem',
  },
  studentsListYear: {
    fontSize: '0.78rem',
    color: 'rgba(255,255,255,0.45)',
  },
  footerText: { textAlign: 'center', fontSize: '0.875rem' },
  footerMuted: { color: 'rgba(255,255,255,0.55)' },
  link: { color: 'var(--brand-light)', fontWeight: 600, textDecoration: 'none' },
};
