import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SchoolYearsController } from './school-years.controller';

/**
 * El formulario público de registro (`RegisterPage`) consulta `/school-years`
 * antes de existir un token. Por tanto, ni la clase ni el método `findAll`
 * deben estar protegidos por `JwtAuthGuard`.
 */
describe('SchoolYearsController — public access contract', () => {
  function readGuards(target: object | Function): unknown[] {
    return (Reflect.getMetadata(GUARDS_METADATA, target) as unknown[]) ?? [];
  }

  it('no aplica JwtAuthGuard a nivel de clase', () => {
    const classGuards = readGuards(SchoolYearsController);

    expect(classGuards).not.toContain(JwtAuthGuard);
  });

  it('no aplica JwtAuthGuard a `findAll`', () => {
    const handlerGuards = readGuards(SchoolYearsController.prototype.findAll);

    expect(handlerGuards).not.toContain(JwtAuthGuard);
  });
});
