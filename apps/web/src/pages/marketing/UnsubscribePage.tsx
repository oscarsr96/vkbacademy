import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { guardiansApi } from '../../api/guardians.api';

/**
 * Baja del resumen semanal a la familia.
 *
 * La llamada va detrás de un botón y **nunca al montar la página**: los
 * escáneres de los clientes de correo abren solos los enlaces de un mensaje, y
 * una baja automática al abrir daría de baja a familias que no lo han pedido.
 */
export default function UnsubscribePage() {
  const { token = '' } = useParams<{ token: string }>();
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleUnsubscribe() {
    setPending(true);
    try {
      await guardiansApi.unsubscribe(token);
      setDone(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <h1 style={s.title}>Resumen semanal</h1>

        {done ? (
          <p style={s.text}>
            Listo: no volverás a recibir el resumen semanal. Las cuentas de tus hijos siguen
            funcionando igual.
          </p>
        ) : (
          <>
            <p style={s.text}>
              Si te das de baja dejaremos de mandarte el resumen semanal de lo que estudian tus
              hijos. No afecta a sus cuentas.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              style={{ padding: '10px 20px' }}
              onClick={handleUnsubscribe}
              disabled={pending}
            >
              {pending ? 'Dando de baja...' : 'Darme de baja'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { display: 'flex', justifyContent: 'center', padding: '3rem 1rem' },
  card: { maxWidth: 520, width: '100%' },
  title: { fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.75rem' },
  text: { color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: '1.25rem' },
};
