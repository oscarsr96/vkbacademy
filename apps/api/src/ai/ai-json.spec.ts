import { extractJsonText, generateAiJson, parseAiJson } from './ai-json';

describe('extractJsonText', () => {
  it('devuelve el JSON tal cual si ya está limpio', () => {
    expect(extractJsonText('{"a":1}')).toBe('{"a":1}');
  });

  it('quita fences ```json```', () => {
    expect(extractJsonText('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('ignora prosa antes y después', () => {
    expect(extractJsonText('Aquí tienes:\n{"a":1}\n¡Listo!')).toBe('{"a":1}');
  });

  it('extrae el objeto balanceado y respeta llaves dentro de strings', () => {
    const src = '{"text":"esto } no cierra","b":{"c":2}}';
    expect(extractJsonText(src)).toBe(src);
  });

  it('soporta arrays de nivel superior', () => {
    expect(extractJsonText('prefijo [1,2,3] sufijo')).toBe('[1,2,3]');
  });
});

describe('parseAiJson', () => {
  it('parsea JSON envuelto en fences', () => {
    expect(parseAiJson('```json\n{"x":true}\n```')).toEqual({ x: true });
  });

  it('lanza ante JSON irrecuperable', () => {
    expect(() => parseAiJson('{"x": "sin cerrar }')).toThrow();
  });
});

describe('generateAiJson', () => {
  it('parsea a la primera cuando el JSON es válido', async () => {
    const generate = jest.fn().mockResolvedValue('{"ok":1}');
    const out = await generateAiJson({ generate }, 'prompt', 1000);
    expect(out).toEqual({ ok: 1 });
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('reintenta y se recupera cuando el primer JSON es inválido (caso del bug)', async () => {
    const generate = jest
      .fn()
      .mockResolvedValueOnce('{"text": "comilla "rota" aquí"}') // JSON inválido (comilla sin escapar)
      .mockResolvedValueOnce('{"text":"válido"}');
    const warn = jest.fn();

    const out = await generateAiJson({ generate }, 'prompt', 1000, { logger: { warn } });

    expect(out).toEqual({ text: 'válido' });
    expect(generate).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('lanza tras agotar los intentos si siempre devuelve JSON inválido', async () => {
    const generate = jest.fn().mockResolvedValue('no es json {');
    await expect(generateAiJson({ generate }, 'prompt', 1000, { attempts: 3 })).rejects.toThrow();
    expect(generate).toHaveBeenCalledTimes(3);
  });
});
