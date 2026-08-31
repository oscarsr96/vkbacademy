import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Observable } from 'rxjs';
import { ActivityService } from './activity.service';
import { madridDay } from '../challenges/challenge-periods';

/**
 * Marca como visitado el día de cada alumno que hace cualquier petición
 * autenticada. Los guards corren antes que los interceptores, así que
 * `request.user` ya está resuelto; en las rutas públicas simplemente no hay.
 *
 * La memoria evita una consulta por petición para un dato que cambia una vez
 * al día. Es local al proceso: si hubiera más de una instancia de la API, o si
 * Render reinicia, lo peor que pasa es repetir un upsert idempotente.
 */
@Injectable()
export class ActivityInterceptor implements NestInterceptor {
  private readonly seen = new Map<string, string>();

  constructor(private readonly activity: ActivityService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const { user } = context.switchToHttp().getRequest<{ user?: { id: string; role: Role } }>();

    if (user?.id && user.role === Role.STUDENT) {
      const today = madridDay(new Date());
      if (this.seen.get(user.id) !== today) {
        this.seen.set(user.id, today);
        void this.activity.recordVisit(user.id);
      }
    }

    return next.handle();
  }
}
