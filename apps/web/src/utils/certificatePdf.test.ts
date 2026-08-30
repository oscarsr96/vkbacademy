import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock de jsPDF: interesa qué se dibuja, no el binario resultante ──

const doc = {
  rect: vi.fn(),
  roundedRect: vi.fn(),
  circle: vi.fn(),
  line: vi.fn(),
  text: vi.fn(),
  addImage: vi.fn(),
  save: vi.fn(),
  setFontSize: vi.fn(),
  setFont: vi.fn(),
  setTextColor: vi.fn(),
  setDrawColor: vi.fn(),
  setFillColor: vi.fn(),
  setLineWidth: vi.fn(),
  getTextWidth: vi.fn(() => 30),
  splitTextToSize: vi.fn((t: string) => [t]),
};

// jsPDF se usa con `new`, y una arrow no es constructor: hace falta una clase
vi.mock('jspdf', () => ({
  default: class {
    constructor() {
      return doc;
    }
  },
}));

import { downloadCertificatePdf } from './certificatePdf';

const cert = {
  id: 'c1',
  type: 'COURSE_EXAM',
  recipientName: 'Juan García',
  scopeTitle: 'Matemáticas 3º ESO',
  courseTitle: 'Matemáticas 3º ESO',
  examScore: 92.5,
  issuedAt: '2026-08-30T10:00:00.000Z',
  verifyCode: 'VKB-2026-A1B2C3',
} as never;

/** Todo el texto que el PDF llega a escribir. */
function textoEscrito(): string {
  return doc.text.mock.calls.map((c) => String(c[0])).join(' | ');
}

describe('certificatePdf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3]).buffer) }),
    ) as unknown as typeof fetch;
  });

  it('pinta el logo del club: en la cabecera y como sello', async () => {
    await downloadCertificatePdf(cert);

    expect(doc.addImage).toHaveBeenCalledTimes(2);
    expect(doc.addImage.mock.calls[0][0]).toMatch(/^data:image\/png;base64,/);
  });

  it('no escribe emojis: jsPDF solo tiene fuentes estándar y salen como basura', async () => {
    await downloadCertificatePdf(cert);

    // El 📜 del chip salía "ø=Üü" y el 🏅 del sello "Ø<ßÅ", en medio del
    // documento que el alumno se descarga y enseña.
    expect(textoEscrito()).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it('descarga igual si el logo no se puede cargar', async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('sin red'))) as unknown as typeof fetch;

    await downloadCertificatePdf(cert);

    // Un certificado sin sello sigue siendo válido; quedarse sin descarga no
    expect(doc.save).toHaveBeenCalled();
    expect(doc.addImage).not.toHaveBeenCalled();
  });

  it('usa la paleta de la app: navy de fondo y naranja de marca', async () => {
    await downloadCertificatePdf(cert);

    const rellenos = doc.setFillColor.mock.calls.map((c) => c.join(','));
    expect(rellenos).toContain('10,22,40'); // --navy-900, la banda
    expect(rellenos).toContain('245,145,30'); // --brand, el acento
    // El mostaza #ca8a04 de antes no salía de ningún token de la app
    expect(doc.setDrawColor.mock.calls.map((c) => c.join(','))).not.toContain('202,138,4');
  });
});
