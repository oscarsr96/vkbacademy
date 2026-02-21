import { useMyStudents } from '../hooks/useTutors';

const s: Record<string, React.CSSProperties> = {
  page:        { padding: '2rem', maxWidth: 800, margin: '0 auto' },
  title:       { fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--color-text)' },
  grid:        { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' },
  card:        { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: 6 },
  avatar:      { width: 44, height: 44, borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', fontWeight: 700, fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  name:        { fontWeight: 600, fontSize: '0.95rem', color: 'var(--color-text)' },
  email:       { fontSize: '0.8rem', color: 'var(--color-text-muted)' },
  badge:       { display: 'inline-block', marginTop: 4, padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600, background: '#dbeafe', color: '#1e40af' },
  empty:       { color: 'var(--color-text-muted)', fontStyle: 'italic' },
};

import React from 'react';

export default function TutorStudentsPage() {
  const { data: students, isLoading } = useMyStudents();

  return (
    <div style={s.page}>
      <h1 style={s.title}>Mis alumnos</h1>

      {isLoading && <p style={s.empty}>Cargando alumnos...</p>}

      {!isLoading && (!students || students.length === 0) && (
        <p style={s.empty}>Aún no tienes alumnos asignados. Contacta con el administrador.</p>
      )}

      <div style={s.grid}>
        {students?.map((st) => (
          <div key={st.id} style={s.card}>
            <div style={s.avatar}>{st.name.charAt(0).toUpperCase()}</div>
            <span style={s.name}>{st.name}</span>
            <span style={s.email}>{st.email}</span>
            {st.schoolYear && (
              <span style={s.badge}>{st.schoolYear.label}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
