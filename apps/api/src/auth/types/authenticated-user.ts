import { Academy, User } from '@prisma/client';

/**
 * Usuario autenticado tal y como lo deja `JwtStrategy` en `request.user`:
 * el `User` de Prisma enriquecido con el `academyId` y la `academy` resueltos
 * desde el payload del JWT o la primera membresía. Evita los `as any` al leer
 * estos campos en guards, decoradores y services.
 */
export interface AuthenticatedUser extends User {
  academyId: string | null;
  academy: Academy | null;
}
