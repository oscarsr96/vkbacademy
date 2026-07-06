import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateStudyPlanDto } from './create-study-plan.dto';

// Valida el payload igual que el ValidationPipe global (criterio 3).
async function validateDto(payload: Record<string, unknown>) {
  const dto = plainToInstance(CreateStudyPlanDto, payload);
  return validate(dto);
}

const validPayload = {
  courseId: 'course-1',
  topics: [{ title: 'Fracciones' }],
  exercisesPerTopic: { easy: 2, medium: 2, hard: 1 },
};

describe('CreateStudyPlanDto', () => {
  it('acepta un payload válido con tema propio', async () => {
    const errors = await validateDto(validPayload);
    expect(errors).toHaveLength(0);
  });

  it('acepta un payload válido con tema oficial (moduleId) y mezcla', async () => {
    const errors = await validateDto({
      ...validPayload,
      topics: [{ moduleId: 'mod-1' }, { title: 'Proporcionalidad' }],
    });
    expect(errors).toHaveLength(0);
  });

  it('rechaza topics vacío (ArrayMinSize)', async () => {
    const errors = await validateDto({ ...validPayload, topics: [] });
    expect(errors.some((e) => e.property === 'topics')).toBe(true);
  });

  it('rechaza 7 temas (ArrayMaxSize 6)', async () => {
    const errors = await validateDto({
      ...validPayload,
      topics: Array.from({ length: 7 }, (_, i) => ({ title: `tema número ${i}` })),
    });
    expect(errors.some((e) => e.property === 'topics')).toBe(true);
  });

  it('rechaza un tema sin moduleId ni title', async () => {
    const errors = await validateDto({ ...validPayload, topics: [{}] });
    expect(errors.some((e) => e.property === 'topics')).toBe(true);
  });

  it('rechaza un title de menos de 3 caracteres', async () => {
    const errors = await validateDto({ ...validPayload, topics: [{ title: 'ab' }] });
    expect(errors.some((e) => e.property === 'topics')).toBe(true);
  });

  // BUG conocido (reportado, no corregido aquí): `exercisesPerTopic` solo lleva
  // @ValidateNested + @Type, sin @IsDefined/@IsNotEmptyObject. class-validator
  // no valida NESTED_VALIDATION cuando el valor es undefined, así que un
  // payload sin este campo pasa la validación (y luego el service explota con
  // un TypeError al leer `.easy` de undefined, en vez de un 422 limpio).
  it('NO rechaza (bug conocido) un payload sin exercisesPerTopic', async () => {
    const payload = { ...validPayload } as Record<string, unknown>;
    delete payload.exercisesPerTopic;
    const errors = await validateDto(payload);
    expect(errors).toHaveLength(0);
  });

  it('rechaza exercisesPerTopic con easy negativo', async () => {
    const errors = await validateDto({
      ...validPayload,
      exercisesPerTopic: { easy: -1, medium: 2, hard: 1 },
    });
    expect(errors.some((e) => e.property === 'exercisesPerTopic')).toBe(true);
  });

  it('rechaza exercisesPerTopic con hard > 10', async () => {
    const errors = await validateDto({
      ...validPayload,
      exercisesPerTopic: { easy: 2, medium: 2, hard: 11 },
    });
    expect(errors.some((e) => e.property === 'exercisesPerTopic')).toBe(true);
  });

  it('acepta {easy:2, medium:2, hard:1} como reparto válido', async () => {
    const errors = await validateDto({
      ...validPayload,
      exercisesPerTopic: { easy: 2, medium: 2, hard: 1 },
    });
    expect(errors).toHaveLength(0);
  });
});
