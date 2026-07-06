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
  numExercises: 5,
  difficulty: 'MEDIUM',
  numQuestions: 5,
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

  it('rechaza numQuestions fuera de {5, 10}', async () => {
    const errors = await validateDto({ ...validPayload, numQuestions: 7 });
    expect(errors.some((e) => e.property === 'numQuestions')).toBe(true);
  });

  it('rechaza numExercises fuera de rango (0 y 21)', async () => {
    expect((await validateDto({ ...validPayload, numExercises: 0 })).length).toBeGreaterThan(0);
    expect((await validateDto({ ...validPayload, numExercises: 21 })).length).toBeGreaterThan(0);
  });

  it('rechaza difficulty desconocida', async () => {
    const errors = await validateDto({ ...validPayload, difficulty: 'EXTREME' });
    expect(errors.some((e) => e.property === 'difficulty')).toBe(true);
  });

  it('rechaza timeLimit fuera de rango', async () => {
    expect((await validateDto({ ...validPayload, timeLimit: 30 })).length).toBeGreaterThan(0);
    expect((await validateDto({ ...validPayload, timeLimit: 20000 })).length).toBeGreaterThan(0);
  });
});
