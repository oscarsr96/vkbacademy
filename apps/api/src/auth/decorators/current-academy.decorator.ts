import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Extrae el academyId del request.
 * Se resuelve desde:
 *  1. Header X-Academy-Id (para SUPER_ADMIN)
 *  2. El primer AcademyMember del usuario (inyectado por JwtStrategy)
 */
export const CurrentAcademy = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest();
    return request.academyId ?? null;
  },
);
