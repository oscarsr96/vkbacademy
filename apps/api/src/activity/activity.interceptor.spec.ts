import { of } from 'rxjs';
import { Role } from '@prisma/client';
import { ActivityInterceptor } from './activity.interceptor';
import { ActivityService } from './activity.service';

describe('ActivityInterceptor', () => {
  let interceptor: ActivityInterceptor;
  let activity: { recordVisit: jest.Mock };

  const next = { handle: () => of('ok') };

  const ctxFor = (user: unknown) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as never;

  const run = async (user: unknown) => {
    const result$ = interceptor.intercept(ctxFor(user), next as never);
    await new Promise<void>((resolve) => result$.subscribe({ complete: () => resolve() }));
  };

  beforeEach(() => {
    activity = { recordVisit: jest.fn().mockResolvedValue(undefined) };
    interceptor = new ActivityInterceptor(activity as unknown as ActivityService);
  });

  it('registra la visita de un alumno autenticado', async () => {
    await run({ id: 'user1', role: Role.STUDENT });

    expect(activity.recordVisit).toHaveBeenCalledWith('user1');
  });

  it('no escribe dos veces el mismo día para el mismo alumno', async () => {
    await run({ id: 'user1', role: Role.STUDENT });
    await run({ id: 'user1', role: Role.STUDENT });
    await run({ id: 'user1', role: Role.STUDENT });

    // Sin esta memoria, cada petición de la app sería una consulta más a la BD
    // para un dato que solo cambia una vez al día.
    expect(activity.recordVisit).toHaveBeenCalledTimes(1);
  });

  it('distingue entre alumnos', async () => {
    await run({ id: 'user1', role: Role.STUDENT });
    await run({ id: 'user2', role: Role.STUDENT });

    expect(activity.recordVisit).toHaveBeenCalledTimes(2);
  });

  it('vuelve a escribir cuando cambia el día', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-31T10:00:00.000Z'));
    await run({ id: 'user1', role: Role.STUDENT });

    jest.setSystemTime(new Date('2026-09-01T10:00:00.000Z'));
    await run({ id: 'user1', role: Role.STUDENT });

    expect(activity.recordVisit).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it('ignora las rutas públicas, sin usuario', async () => {
    await run(undefined);

    expect(activity.recordVisit).not.toHaveBeenCalled();
  });

  it('ignora a quien no es alumno', async () => {
    await run({ id: 'admin1', role: Role.ADMIN });

    // La retención que se mide es la de los alumnos; un admin entrando a
    // diario inflaría las cohortes sin significar nada.
    expect(activity.recordVisit).not.toHaveBeenCalled();
  });

  it('deja pasar la respuesta intacta', async () => {
    const values: unknown[] = [];
    const result$ = interceptor.intercept(
      ctxFor({ id: 'user1', role: Role.STUDENT }),
      next as never,
    );
    await new Promise<void>((resolve) =>
      result$.subscribe({ next: (v) => values.push(v), complete: () => resolve() }),
    );

    expect(values).toEqual(['ok']);
  });
});
