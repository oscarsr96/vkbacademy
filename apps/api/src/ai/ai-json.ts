// Parseo resiliente de JSON devuelto por modelos de IA.
//
// Los LLM a veces devuelven JSON imperfecto: envuelto en ```fences```, con
// prosa antes/después, o con errores de sintaxis estocásticos (típicamente una
// comilla sin escapar a media cadena). El modo JSON de Gemini es válido por
// construcción, pero el fallback de Haiku no garantiza nada. Aquí:
//
//  - `extractJsonText` localiza el primer valor JSON balanceado, ignorando
//    fences y prosa.
//  - `generateAiJson` envuelve una llamada a la IA con reintento: si el parseo
//    falla, regenera (un error de sintaxis estocástico casi siempre se corrige
//    en el segundo intento). Esto convierte un fallo duro en una recuperación
//    automática (lo que un humano haría reintentando a mano).

interface AiGenerator {
  generate(prompt: string, maxTokens: number): Promise<string>;
}

interface MiniLogger {
  warn(message: string): void;
}

/**
 * Extrae el primer valor JSON balanceado (objeto o array) de un texto que puede
 * venir envuelto en fences markdown o rodeado de prosa. No repara errores
 * internos de sintaxis (comillas sin escapar): para eso está el reintento.
 */
export function extractJsonText(text: string): string {
  let s = text.trim();

  // Quitar fences ```json … ``` o ``` … ``` estén donde estén.
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();

  // Buscar el primer { o [ e ir hasta su cierre balanceado, respetando strings.
  const start = s.search(/[{[]/);
  if (start === -1) return s;

  const open = s[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }

  // Sin cierre balanceado (probable truncamiento): devolver desde el inicio para
  // que JSON.parse lance un error descriptivo.
  return s.slice(start);
}

/** Parsea JSON de IA de forma resiliente (extracción + JSON.parse). Lanza si no es parseable. */
export function parseAiJson<T = unknown>(text: string): T {
  return JSON.parse(extractJsonText(text)) as T;
}

/**
 * Genera y parsea JSON desde la IA con reintento automático ante JSON inválido.
 * No valida el dominio: el llamador valida la forma del objeto resultante.
 *
 * @param attempts número máximo de generaciones (por defecto 2).
 */
export async function generateAiJson<T = unknown>(
  ai: AiGenerator,
  prompt: string,
  maxTokens: number,
  opts: { attempts?: number; logger?: MiniLogger } = {},
): Promise<T> {
  const attempts = Math.max(1, opts.attempts ?? 2);
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const text = await ai.generate(prompt, maxTokens);
    try {
      return parseAiJson<T>(text);
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : 'desconocido';
      opts.logger?.warn(`IA devolvió JSON inválido (intento ${attempt}/${attempts}): ${message}`);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('La IA devolvió JSON inválido tras varios intentos');
}
