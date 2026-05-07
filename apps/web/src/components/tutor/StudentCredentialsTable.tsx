import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { tutorsApi, type StudentCredential } from '../../api/tutors.api';
import { authApi } from '../../api/auth.api';

const ORANGE = '#ea580c';

export function StudentCredentialsTable() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['tutor', 'students', 'credentials'],
    queryFn: () => tutorsApi.getStudentsCredentials(),
    staleTime: 0,
  });

  const resetMutation = useMutation({
    mutationFn: (email: string) => authApi.forgotPassword(email),
  });

  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (isLoading) return <div style={{ padding: 16 }}>Cargando credenciales…</div>;
  if (isError)
    return <div style={{ padding: 16, color: '#b91c1c' }}>Error al cargar credenciales.</div>;
  if (!data || data.length === 0) return null;

  const onCopy = async (item: StudentCredential) => {
    if (!item.password) return;
    await navigator.clipboard.writeText(item.password);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId((id) => (id === item.id ? null : id)), 1500);
  };

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
        Credenciales de mis alumnos
      </h2>
      <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0, marginBottom: 16 }}>
        Estas credenciales son privadas. No las compartas en sitios públicos.
      </p>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '0.9rem',
          color: '#0f172a',
        }}
      >
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
            <th style={{ padding: '8px 4px', fontWeight: 600, color: '#334155' }}>Nombre</th>
            <th style={{ padding: '8px 4px', fontWeight: 600, color: '#334155' }}>Email</th>
            <th style={{ padding: '8px 4px', fontWeight: 600, color: '#334155' }}>Contraseña</th>
            <th style={{ padding: '8px 4px', fontWeight: 600, width: 140, color: '#334155' }}>
              Acciones
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '8px 4px', color: '#0f172a' }}>{item.name}</td>
              <td style={{ padding: '8px 4px', fontFamily: 'monospace', color: '#0f172a' }}>
                {item.email}
              </td>
              <td style={{ padding: '8px 4px', fontFamily: 'monospace', color: '#0f172a' }}>
                {item.password ? (
                  <>
                    {item.password}
                    <button
                      type="button"
                      onClick={() => onCopy(item)}
                      title="Copiar al portapapeles"
                      style={{
                        marginLeft: 8,
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: ORANGE,
                      }}
                    >
                      {copiedId === item.id ? '✓ copiada' : '📋'}
                    </button>
                  </>
                ) : (
                  <span style={{ color: '#94a3b8' }}>—</span>
                )}
              </td>
              <td style={{ padding: '8px 4px' }}>
                {!item.password && (
                  <button
                    type="button"
                    onClick={() => resetMutation.mutate(item.email)}
                    disabled={resetMutation.isPending}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: `1px solid ${ORANGE}`,
                      background: 'transparent',
                      color: ORANGE,
                      cursor: resetMutation.isPending ? 'wait' : 'pointer',
                      fontSize: '0.8rem',
                    }}
                  >
                    Restablecer
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {resetMutation.isSuccess && (
        <p style={{ marginTop: 12, fontSize: '0.85rem', color: '#16a34a' }}>
          Email de restablecimiento enviado. Revisa la bandeja del alumno.
        </p>
      )}
      {resetMutation.isError && (
        <p style={{ marginTop: 12, fontSize: '0.85rem', color: '#b91c1c' }}>
          Error al solicitar el restablecimiento. Inténtalo de nuevo.
        </p>
      )}
    </section>
  );
}
