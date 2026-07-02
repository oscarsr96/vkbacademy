import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tutorsApi, type StudentSummary } from '../../api/tutors.api';
import { useSchoolYears } from '../../hooks/useCourses';

const ORANGE = 'var(--brand-deep)';

export function StudentAccessPanel() {
  const qc = useQueryClient();
  const { data: students } = useQuery({
    queryKey: ['tutor', 'students'],
    queryFn: tutorsApi.getMyStudents,
  });
  const { data: schoolYears = [] } = useSchoolYears();

  const [name, setName] = useState('');
  const [schoolYearId, setSchoolYearId] = useState('');
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['tutor', 'students'] });

  const addMut = useMutation({
    mutationFn: () => tutorsApi.addStudent(name.trim(), schoolYearId),
    onSuccess: () => {
      setName('');
      setSchoolYearId('');
      void invalidate();
    },
  });

  const resetMut = useMutation({
    mutationFn: (student: StudentSummary) => tutorsApi.resetStudentPassword(student.id),
    onSuccess: (_data, student) =>
      setResetMsg(
        `Contraseña de ${student.name} restablecida a "cambiar123". La cambiará al entrar.`,
      ),
  });

  // Pide confirmación: un reset accidental obliga al alumno a volver a cambiar la contraseña.
  function handleReset(student: StudentSummary) {
    setResetMsg(null);
    if (window.confirm(`¿Restablecer la contraseña de ${student.name} a "cambiar123"?`)) {
      resetMut.mutate(student);
    }
  }

  return (
    <section
      style={{
        background: '#fff',
        borderRadius: 12,
        padding: 20,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        color: '#0f172a',
      }}
    >
      <h2
        style={{
          fontSize: '1.1rem',
          fontWeight: 700,
          margin: 0,
          marginBottom: 4,
          color: '#0d1b2a',
        }}
      >
        Accesos de mis alumnos
      </h2>
      <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0, marginBottom: 16 }}>
        Cada alumno entra con su usuario. La primera vez usa la contraseña <code>cambiar123</code> y
        deberá cambiarla.
      </p>

      <table
        style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', color: '#0f172a' }}
      >
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
            <th style={{ padding: '8px 4px', fontWeight: 600, color: '#334155' }}>Nombre</th>
            <th style={{ padding: '8px 4px', fontWeight: 600, color: '#334155' }}>Usuario</th>
            <th style={{ padding: '8px 4px', fontWeight: 600, width: 180, color: '#334155' }}>
              Acciones
            </th>
          </tr>
        </thead>
        <tbody>
          {students?.map((s: StudentSummary) => (
            <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '8px 4px' }}>{s.name}</td>
              <td style={{ padding: '8px 4px', fontFamily: 'monospace' }}>{s.username ?? '—'}</td>
              <td style={{ padding: '8px 4px' }}>
                <button
                  type="button"
                  onClick={() => handleReset(s)}
                  disabled={resetMut.isPending}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: `1px solid ${ORANGE}`,
                    background: 'transparent',
                    color: ORANGE,
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                  }}
                >
                  Restablecer contraseña
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {resetMsg && (
        <p style={{ marginTop: 12, fontSize: '0.85rem', color: '#16a34a' }}>{resetMsg}</p>
      )}
      {resetMut.isError && (
        <p style={{ marginTop: 12, fontSize: '0.85rem', color: '#b91c1c' }}>
          No se pudo restablecer la contraseña. Inténtalo de nuevo.
        </p>
      )}

      <div style={{ marginTop: 20, borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, marginBottom: 10 }}>
          Añadir alumno
        </h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre del alumno"
            style={{
              flex: 1,
              minWidth: 160,
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              fontSize: 16,
            }}
          />
          <select
            value={schoolYearId}
            onChange={(e) => setSchoolYearId(e.target.value)}
            style={{
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              fontSize: 16,
            }}
          >
            <option value="">Curso</option>
            {schoolYears.map((sy) => (
              <option key={sy.id} value={sy.id}>
                {sy.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!name.trim() || !schoolYearId || addMut.isPending}
            onClick={() => addMut.mutate()}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--gradient-orange)',
              color: 'var(--brand-contrast)',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Añadir
          </button>
        </div>
        {addMut.isError && (
          <p style={{ marginTop: 8, fontSize: '0.85rem', color: '#b91c1c' }}>
            No se pudo añadir el alumno.
          </p>
        )}
      </div>
    </section>
  );
}
