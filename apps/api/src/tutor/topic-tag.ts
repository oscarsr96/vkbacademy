/**
 * «Practicar este tema» elegido por el modelo (#144).
 *
 * El system prompt le da al modelo el temario del nivel del alumno numerado
 * y le pide que empiece su respuesta con `TEMA: <n>`. Aquí viven las dos
 * piezas puras: las líneas del prompt y el filtro que quita esa etiqueta
 * del stream antes de que llegue al alumno o al historial.
 */

export interface CurriculumTopic {
  /** Numeral con el que aparece en el prompt (1-based). */
  index: number;
  title: string;
  courseId: string;
  courseTitle: string;
  moduleId: string;
}

/** Líneas del system prompt con el temario y la instrucción de la etiqueta. */
export function buildCurriculumLines(topics: CurriculumTopic[]): string[] {
  if (topics.length === 0) return [];
  return [
    '',
    'Temario del alumno (número. asignatura — tema):',
    ...topics.map((t) => `${t.index}. ${t.courseTitle} — ${t.title}`),
    '',
    'La primera línea de tu respuesta debe ser exactamente `TEMA: <n>`, con el número del tema del temario que más se ajusta a la duda (por ejemplo, una duda sobre fracciones va al tema de números racionales), o `TEMA: 0` si no encaja en ninguno. Después deja una línea en blanco y escribe la respuesta normal. No menciones la etiqueta ni el temario al alumno.',
  ];
}

/** Más largo que esto sin salto de línea y ya no es una etiqueta. */
const MAX_TAG_LINE = 40;
const TAG_RE = /^\s*[*_`]*\s*TEMA:\s*(\d+)\s*[*_`]*\s*$/i;

/**
 * Filtro de streaming: retiene el texto hasta ver la primera línea completa.
 * Si es la etiqueta, la descarta (y los saltos de línea que la siguen) y
 * guarda el índice; si no, suelta lo retenido tal cual. Después deja pasar
 * todo sin tocarlo.
 */
export class TopicTagFilter {
  private buffer = '';
  private decided = false;
  private index: number | null = null;
  /** Tras la etiqueta, se comen los saltos de línea hasta el primer texto. */
  private skipLeadingNewlines = false;

  /** Índice elegido por el modelo (0 = ninguno) o null si no hubo etiqueta. */
  get topicIndex(): number | null {
    return this.index;
  }

  /** Recibe un trozo del modelo y devuelve lo que puede mostrarse ya. */
  push(chunk: string): string {
    if (this.decided) {
      if (!this.skipLeadingNewlines) return chunk;
      const trimmed = chunk.replace(/^\n+/, '');
      if (trimmed !== '') this.skipLeadingNewlines = false;
      return trimmed;
    }

    this.buffer += chunk;
    const newline = this.buffer.indexOf('\n');
    if (newline === -1) {
      if (this.buffer.length <= MAX_TAG_LINE) return '';
      return this.decide(false);
    }

    const firstLine = this.buffer.slice(0, newline);
    const match = TAG_RE.exec(firstLine);
    if (!match) return this.decide(false);

    this.index = Number(match[1]);
    // Fuera la etiqueta y la línea en blanco que le sigue
    this.buffer = this.buffer.slice(newline + 1).replace(/^\n+/, '');
    return this.decide(true);
  }

  /** Al acabar el stream: lo que quedara retenido (respuesta corta sin salto). */
  flush(): string {
    if (this.decided) return '';
    return this.decide(false);
  }

  private decide(tagged: boolean): string {
    this.decided = true;
    const out = this.buffer;
    this.buffer = '';
    this.skipLeadingNewlines = tagged && out === '';
    return out;
  }
}
