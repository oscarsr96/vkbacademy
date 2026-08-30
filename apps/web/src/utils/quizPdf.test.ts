import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock de jsPDF: interesa qué se dibuja, no el binario ──

const doc = {
  rect: vi.fn(),
  roundedRect: vi.fn(),
  circle: vi.fn(),
  line: vi.fn(),
  text: vi.fn(),
  addImage: vi.fn(),
  addPage: vi.fn(),
  save: vi.fn(),
  setFontSize: vi.fn(),
  setFont: vi.fn(),
  setTextColor: vi.fn(),
  setDrawColor: vi.fn(),
  setFillColor: vi.fn(),
  setLineWidth: vi.fn(),
  getTextWidth: vi.fn(() => 30),
  splitTextToSize: vi.fn((t: string) => [t]),
  setPage: vi.fn(),
  // El pie usa doc.internal.getNumberOfPages() para numerar
  internal: { getNumberOfPages: () => 1 },
};

// jsPDF se usa con `new`: el mock tiene que ser constructor
vi.mock('jspdf', () => ({
  default: class {
    constructor() {
      return doc;
    }
  },
}));

import { generateQuizPdf } from './quizPdf';

const data = {
  courseTitle: 'Matemáticas 3º ESO',
  schoolYearLabel: '3º ESO',
  lessonTitle: 'Fracciones equivalentes',
  score: 66.7,
  completedAt: new Date('2026-08-30T10:00:00.000Z'),
  corrections: [
    { questionText: '¿2/4 equivale a 1/2?', selectedAnswerText: 'Sí', isCorrect: true, correctAnswerText: 'Sí' },
    { questionText: '¿3/9 equivale a 1/2?', selectedAnswerText: 'Sí', isCorrect: false, correctAnswerText: 'No' },
  ],
};

function textoEscrito(): string {
  return doc.text.mock.calls.map((c) => String(c[0])).join(' | ');
}

describe('quizPdf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3]).buffer),
      }),
    ) as unknown as typeof fetch;
  });

  it('lleva el logo del club en la cabecera', async () => {
    await generateQuizPdf(data);

    expect(doc.addImage).toHaveBeenCalledTimes(1);
    expect(doc.addImage.mock.calls[0][0]).toMatch(/^data:image\/png;base64,/);
  });

  it('usa la paleta de la app y marca el fallo en rojo, no en naranja', async () => {
    await generateQuizPdf(data);

    const rellenos = doc.setFillColor.mock.calls.map((c) => c.join(','));
    expect(rellenos).toContain('10,22,40'); // --navy-900
    expect(rellenos).toContain('245,145,30'); // --brand
    expect(rellenos).toContain('220,38,38'); // el fallo en rojo, no en naranja de marca
  });

  it('dibuja los aciertos y fallos en vez de escribir ✓ y ✗', async () => {
    await generateQuizPdf(data);

    // Helvetica no tiene esos glifos: jsPDF los imprimía como una comilla suelta
    expect(textoEscrito()).not.toMatch(/[✓✗✔✖]/);
    // Dos marcas × dos líneas cada una, más las reglas del documento
    expect(doc.line.mock.calls.length).toBeGreaterThanOrEqual(4);
    const trazos = doc.setDrawColor.mock.calls.map((c) => c.join(','));
    expect(trazos).toContain('5,150,105'); // verde del acierto
    expect(trazos).toContain('220,38,38'); // rojo del fallo
  });

  it('descarga igual si el logo no se puede cargar', async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('sin red'))) as unknown as typeof fetch;

    await generateQuizPdf(data);

    expect(doc.save).toHaveBeenCalled();
    expect(doc.addImage).not.toHaveBeenCalled();
  });
});
