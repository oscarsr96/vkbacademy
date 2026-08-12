import { IsIn } from 'class-validator';
import { Role } from '@prisma/client';

export class UpdateRoleDto {
  @IsIn([Role.STUDENT, Role.TUTOR, Role.ADMIN, Role.SUPER_ADMIN], {
    message: 'Rol no válido',
  })
  role: Role;
}
