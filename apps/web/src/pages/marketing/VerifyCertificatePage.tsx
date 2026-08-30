import { useEffect, useState, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { CertificateVerification } from '@vkbacademy/shared';
import { certificatesApi } from '../../api/certificates.api';
import { LP_SHARED_CSS } from './LpSystem';

const TYPE_LABELS: Record<string, string> = {
  MODULE_COMPLETION: 'Módulo completado',
  COURSE_COMPLETION: 'Curso completado',
  MODULE_EXAM: 'Examen de módulo',
  COURSE_EXAM: 'Examen de curso',
};

/**
 * Verificación pública de un certificado.
 *
 * El PDF imprime "Verifica en vkbacademy.com/verify" y hasta ahora esa ruta no
 * existía: quien seguía la instrucción encontraba un 404, justo en la única
 * parte del certificado dirigida a alguien de fuera del club.
 *
 * Va sin sesión, como el endpoint. No muestra el nombre del alumno: el endpoint
 * no lo devuelve (`Omit<Certificate, 'recipientName'>`) y así comprobar un
 * código no permite averiguar de quién es.
 */
export default function VerifyCertificatePage() {
  const { code: codeFromUrl } = useParams<{ code?: string }>();
  const navigate = useNavigate();

  const [code, setCode] = useState(codeFromUrl ?? '');
  const [result, setResult] = useState<CertificateVerification | null>(null);
  const [checking, setChecking] = useState(false);
  const [failed, setFailed] = useState(false);

  // Con código en la URL se comprueba solo: es la forma de imprimirlo como
  // enlace directo en el propio certificado.
  useEffect(() => {
    if (!codeFromUrl) return;
    void check(codeFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeFromUrl]);

  async function check(value: string) {
    const clean = value.trim().toUpperCase();
    if (clean.length < 4) return;

    setChecking(true);
    setFailed(false);
    try {
      setResult(await certificatesApi.verifyCertificate(clean));
    } catch {
      // Un código inexistente responde { valid: false }, así que llegar aquí
      // es un fallo de red o de la API: no se puede decir "no es válido".
      setResult(null);
      setFailed(true);
    } finally {
      setChecking(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (!clean) return;
    navigate(`/verify/${clean}`);
    void check(clean);
  }

  const cert = result?.certificate;

  return (
    <div className="lp-page">
      <style>{LP_SHARED_CSS + CSS}</style>

      <section className="lp-block">
        <div className="lp-shell vc-shell">
          <h1 className="lp-display">Verificar certificado</h1>
          <p className="lp-lead">
            Introduce el código que aparece al pie del certificado para comprobar que lo emitió
            VKB Academy.
          </p>

          <form onSubmit={handleSubmit} className="vc-form">
            <label className="vc-label" htmlFor="code">
              Código de verificación
            </label>
            <div className="vc-row">
              <input
                id="code"
                className="vc-input"
                placeholder="VKB-2026-A1B2C3"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoComplete="off"
              />
              <button type="submit" className="lp-btn lp-btn-primary" disabled={checking}>
                {checking ? 'Comprobando…' : 'Verificar'}
              </button>
            </div>
          </form>

          {failed && (
            <p className="vc-card vc-error">
              No se pudo comprobar el código ahora mismo. Inténtalo de nuevo en un momento.
            </p>
          )}

          {result && !result.valid && (
            <div className="vc-card vc-invalid">
              <p className="vc-verdict">Este código no corresponde a ningún certificado</p>
              <p className="lp-text">
                Revisa que esté copiado tal cual aparece en el documento, con los guiones.
              </p>
            </div>
          )}

          {cert && (
            <div className="vc-card vc-valid">
              <p className="vc-verdict">Certificado válido</p>
              <dl className="vc-data">
                <dt>Tipo</dt>
                <dd>{TYPE_LABELS[cert.type] ?? cert.type}</dd>

                <dt>{cert.courseTitle ? 'Módulo' : 'Curso'}</dt>
                <dd>{cert.scopeTitle}</dd>

                {cert.courseTitle && (
                  <>
                    <dt>Parte del curso</dt>
                    <dd>{cert.courseTitle}</dd>
                  </>
                )}

                {cert.examScore !== null && cert.examScore !== undefined && (
                  <>
                    <dt>Puntuación</dt>
                    <dd>{cert.examScore.toFixed(1)}%</dd>
                  </>
                )}

                <dt>Emitido</dt>
                <dd>
                  {new Date(cert.issuedAt).toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </dd>

                <dt>Código</dt>
                <dd className="vc-code">{cert.verifyCode}</dd>
              </dl>
              <p className="lp-note">
                Por privacidad no se muestra a quién pertenece: este comprobante confirma que el
                certificado existe y qué acredita.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

const CSS = `
.vc-shell { max-width: 680px; }
.vc-form { margin-top: 28px; }
.vc-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.55);
  margin-bottom: 8px;
}
.vc-row { display: flex; gap: 10px; flex-wrap: wrap; }
.vc-input {
  flex: 1 1 260px;
  padding: 13px 16px;
  border-radius: 10px;
  border: 1px solid var(--lp-rule);
  background: var(--lp-surface);
  color: #fff;
  font-size: 1rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.04em;
}
.vc-input::placeholder { color: rgba(255, 255, 255, 0.3); }
.vc-input:focus { outline: 2px solid var(--brand); outline-offset: 1px; }
.vc-card {
  margin-top: 26px;
  padding: 22px 24px;
  border-radius: 14px;
  border: 1px solid var(--lp-rule);
  background: var(--lp-surface);
}
.vc-valid { border-color: rgba(34, 197, 94, 0.45); }
.vc-invalid { border-color: rgba(203, 32, 39, 0.45); }
.vc-error { color: rgba(255, 255, 255, 0.7); }
.vc-verdict { margin: 0 0 14px; font-size: 1.15rem; font-weight: 800; color: #fff; }
.vc-valid .vc-verdict { color: #4ade80; }
.vc-invalid .vc-verdict { color: #f87171; }
.vc-data {
  display: grid;
  grid-template-columns: minmax(120px, auto) 1fr;
  gap: 8px 20px;
  margin: 0 0 16px;
}
.vc-data dt {
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(255, 255, 255, 0.45);
}
.vc-data dd { margin: 0; color: #fff; font-size: 0.95rem; }
.vc-code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
`;
