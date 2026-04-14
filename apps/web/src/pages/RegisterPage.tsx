import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useRegisterTutor } from '../hooks/useAuth';
import { useSchoolYears } from '../hooks/useCourses';
import { useAcademyDomain } from '../contexts/AcademyContext';
import api from '../lib/axios';

/** Valida formato de email: x@y.z */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

interface PublicAcademy {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
}

interface StudentForm {
  name: string;
  email: string;
  schoolYearId: string;
}

const emptyStudent = (): StudentForm => ({ name: '', email: '', schoolYearId: '' });

export default function RegisterPage() {
  const [searchParams] = useSearchParams();
  const { academy: domainAcademy } = useAcademyDomain();
  const preselectedAcademy = domainAcademy?.slug ?? searchParams.get('academy') ?? '';

  // Paso 1: datos del tutor
  const [step, setStep] = useState<1 | 2>(1);
  const [tutorName, setTutorName] = useState('');
  const [tutorEmail, setTutorEmail] = useState('');
  const [password, setPassword] = useState('');
  const [academySlug, setAcademySlug] = useState(preselectedAcademy);
  const [passwordError, setPasswordError] = useState('');
  const [tutorEmailError, setTutorEmailError] = useState('');

  // Paso 2: datos de los alumnos
  const [students, setStudents] = useState<StudentForm[]>([emptyStudent()]);
  const [studentEmailErrors, setStudentEmailErrors] = useState<string[]>([]);

  const { mutate, isPending, error } = useRegisterTutor();
  const { data: schoolYears = [] } = useSchoolYears();
  const { data: academies = [] } = useQuery<PublicAcademy[]>({
    queryKey: ['academies-public'],
    queryFn: () => api.get('/academies/public').then((r) => r.data),
  });

  const selectedAcademy = academies.find((a) => a.slug === academySlug);

  function handleStep1(e: FormEvent) {
    e.preventDefault();
    setPasswordError('');
    setTutorEmailError('');

    if (!isValidEmail(tutorEmail)) {
      setTutorEmailError('Email inválido — formato requerido: x@y.z');
      return;
    }
    if (password.length < 8) {
      setPasswordError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (!academySlug) {
      return;
    }
    setStep(2);
  }

  function updateStudent(index: number, field: keyof StudentForm, value: string) {
    setStudents((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  }

  function addStudent() {
    setStudents((prev) => [...prev, emptyStudent()]);
  }

  function removeStudent(index: number) {
    if (students.length <= 1) return;
    setStudents((prev) => prev.filter((_, i) => i !== index));
  }

  function handleStep2(e: FormEvent) {
    e.preventDefault();
    // Validar que todos los alumnos tengan nombre y email válido
    const errors = students.map((s) =>
      !s.email.trim()
        ? 'Email requerido'
        : !isValidEmail(s.email.trim())
          ? 'Email inválido — formato requerido: x@y.z'
          : '',
    );
    setStudentEmailErrors(errors);

    const valid = students.every((s) => s.name.trim() && isValidEmail(s.email.trim()));
    if (!valid) return;

    mutate({
      name: tutorName,
      email: tutorEmail,
      password,
      academySlug,
      students: students.map((s) => ({
        name: s.name.trim(),
        email: s.email.trim(),
        ...(s.schoolYearId ? { schoolYearId: s.schoolYearId } : {}),
      })),
    });
  }

  const apiError = (error as { response?: { data?: { message?: string } } } | null)?.response?.data
    ?.message;

  return (
    <div style={s.page}>
      <div style={s.bgGlow} />

      <div style={s.card} className="animate-in">
        {/* Encabezado */}
        <div style={s.header}>
          <div style={s.logoWrap}>
            <span style={s.logoEmoji}>🏀</span>
          </div>
          <h1 style={s.title}>{step === 1 ? 'Crear cuenta de tutor' : 'Añadir alumnos'}</h1>
          <p style={s.subtitle}>
            {step === 1
              ? selectedAcademy
                ? `Regístrate como tutor en ${selectedAcademy.name}`
                : 'Regístrate como tutor de la academia'
              : `Añade los datos de tus alumnos (mínimo 1)`}
          </p>
          {/* Indicador de paso */}
          <div style={s.steps}>
            <div style={{ ...s.stepDot, ...(step >= 1 ? s.stepDotActive : {}) }} />
            <div style={s.stepLine} />
            <div style={{ ...s.stepDot, ...(step >= 2 ? s.stepDotActive : {}) }} />
          </div>
        </div>

        {apiError && (
          <div style={s.errorBox}>
            <span style={s.errorIcon}>!</span>
            {apiError}
          </div>
        )}

        {/* ── Paso 1: Datos del tutor ── */}
        {step === 1 && (
          <form onSubmit={handleStep1} style={s.form} noValidate>
            <div className="field field-dark">
              <label htmlFor="tutorName">Tu nombre completo</label>
              <input
                id="tutorName"
                type="text"
                autoComplete="name"
                value={tutorName}
                onChange={(e) => setTutorName(e.target.value)}
                placeholder="María López"
                required
              />
            </div>

            <div className="field field-dark">
              <label htmlFor="tutorEmail">Tu email</label>
              <input
                id="tutorEmail"
                type="email"
                autoComplete="email"
                value={tutorEmail}
                onChange={(e) => {
                  setTutorEmail(e.target.value);
                  setTutorEmailError('');
                }}
                placeholder="tu@email.com"
                className={tutorEmailError ? 'error' : ''}
                style={tutorEmailError ? { borderColor: '#dc2626' } : {}}
                required
              />
              {tutorEmailError && <span style={s.fieldError}>{tutorEmailError}</span>}
            </div>

            <div className="field field-dark">
              <label htmlFor="password">Contraseña</label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className={passwordError ? 'error' : ''}
                required
              />
              {passwordError && <span style={s.fieldError}>{passwordError}</span>}
            </div>

            {academies.length > 0 && (
              <div className="field field-dark">
                <label htmlFor="academy">Academia</label>
                <select
                  id="academy"
                  value={academySlug}
                  onChange={(e) => setAcademySlug(e.target.value)}
                  required
                >
                  <option value="">Selecciona tu academia</option>
                  {academies.map((a) => (
                    <option key={a.id} value={a.slug}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-full"
              style={{ marginTop: 4, padding: '13px 22px', fontSize: '1rem' }}
            >
              Siguiente: añadir alumnos
            </button>
          </form>
        )}

        {/* ── Paso 2: Datos de los alumnos ── */}
        {step === 2 && (
          <form onSubmit={handleStep2} style={s.form} noValidate>
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
                  <label htmlFor={`student-email-${i}`}>Email del alumno</label>
                  <input
                    id={`student-email-${i}`}
                    type="email"
                    value={student.email}
                    onChange={(e) => {
                      updateStudent(i, 'email', e.target.value);
                      setStudentEmailErrors((prev) => prev.map((err, j) => (j === i ? '' : err)));
                    }}
                    placeholder="alumno@email.com"
                    className={studentEmailErrors[i] ? 'error' : ''}
                    style={studentEmailErrors[i] ? { borderColor: '#dc2626' } : {}}
                    required
                  />
                  {studentEmailErrors[i] && (
                    <span style={s.fieldError}>{studentEmailErrors[i]}</span>
                  )}
                  <span style={s.fieldHint}>
                    Recibirá un email con su contraseña generada automáticamente.
                  </span>
                </div>

                {schoolYears.length > 0 && (
                  <div className="field field-dark">
                    <label htmlFor={`student-sy-${i}`}>Nivel educativo</label>
                    <select
                      id={`student-sy-${i}`}
                      value={student.schoolYearId}
                      onChange={(e) => updateStudent(i, 'schoolYearId', e.target.value)}
                    >
                      <option value="">Selecciona el curso</option>
                      {schoolYears.map((sy) => (
                        <option key={sy.id} value={sy.id}>
                          {sy.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ))}

            <button type="button" onClick={addStudent} style={s.addBtn}>
              + Añadir otro alumno
            </button>

            <div style={s.step2Actions}>
              <button type="button" onClick={() => setStep(1)} style={s.backBtn}>
                Volver
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isPending}
                style={{ flex: 1, padding: '13px 22px', fontSize: '1rem' }}
              >
                {isPending ? <span className="spinner" /> : 'Crear cuentas'}
              </button>
            </div>
          </form>
        )}

        <p style={s.footerText}>
          <span style={s.footerMuted}>¿Ya tienes cuenta? </span>
          <Link to="/login" style={s.link}>
            Inicia sesión
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
    background: 'linear-gradient(135deg, #080e1a 0%, #0d1b2a 60%, #152233 100%)',
    position: 'relative',
    overflow: 'hidden',
  },
  bgGlow: {
    position: 'fixed',
    top: '-10%',
    right: '-10%',
    width: '600px',
    height: '600px',
    background: 'radial-gradient(circle, rgba(234,88,12,0.12) 0%, transparent 60%)',
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
    border: '1.5px solid rgba(234,88,12,0.20)',
    borderRadius: '20px',
    padding: '40px 36px',
    boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(234,88,12,0.10)',
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
    background: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 32px rgba(234,88,12,0.35)',
    flexShrink: 0,
  },
  logoEmoji: { fontSize: '32px', lineHeight: 1 },
  title: {
    fontSize: '1.6rem',
    fontWeight: 800,
    color: '#ffffff',
    letterSpacing: '-0.01em',
    lineHeight: 1.2,
  },
  subtitle: {
    fontSize: '0.9rem',
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 1.5,
  },
  steps: {
    display: 'flex',
    alignItems: 'center',
    gap: 0,
    marginTop: 8,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.15)',
    transition: 'background 0.3s',
  },
  stepDotActive: {
    background: '#ea580c',
  },
  stepLine: {
    width: 40,
    height: 2,
    background: 'rgba(255,255,255,0.1)',
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
    color: '#f97316',
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
  step2Actions: {
    display: 'flex',
    gap: 12,
    marginTop: 4,
  },
  backBtn: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10,
    padding: '13px 20px',
    color: 'rgba(255,255,255,0.7)',
    fontSize: '0.95rem',
    cursor: 'pointer',
  },
  footerText: { textAlign: 'center', fontSize: '0.875rem' },
  footerMuted: { color: 'rgba(255,255,255,0.55)' },
  link: { color: '#f97316', fontWeight: 600, textDecoration: 'none' },
};
