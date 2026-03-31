import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Role } from '@prisma/client';

/**
 * Guard que resuelve el academyId y lo adjunta a request.academyId.
 *
 * Fuentes (por prioridad):
 *  1. Header X-Academy-Id (solo SUPER_ADMIN)
 *  2. user.academyId (inyectado por JwtStrategy desde la primera membresía)
 *
 * Usar siempre DESPUÉS de JwtAuthGuard.
 */
@Injectable()
export class AcademyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) return true;

    // SUPER_ADMIN puede operar en cualquier academia vía header
    if (user.role === Role.SUPER_ADMIN) {
      const headerAcademyId = request.headers['x-academy-id'];
      request.academyId = headerAcademyId ?? user.academyId ?? null;
    } else {
      request.academyId = user.academyId ?? null;
    }

    return true;
  }
}
