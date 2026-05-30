import { ForbiddenException } from '@nestjs/common';
import { of } from 'rxjs';
import { MustChangePasswordInterceptor } from './must-change-password.interceptor';

function makeContext(method: string, user: unknown) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ method, user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any;
}

function makeNext() {
  return { handle: jest.fn(() => of('ok')) } as any;
}

describe('MustChangePasswordInterceptor', () => {
  let interceptor: MustChangePasswordInterceptor;
  let reflector: { getAllAndOverride: jest.Mock };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    interceptor = new MustChangePasswordInterceptor(reflector as any);
  });

  it('bloquea POST mutador cuando mustChangePassword=true y no está permitido', () => {
    const next = makeNext();
    expect(() =>
      interceptor.intercept(makeContext('POST', { mustChangePassword: true }), next),
    ).toThrow(ForbiddenException);
    expect(next.handle).not.toHaveBeenCalled();
  });

  it('permite el endpoint marcado con @AllowWhenMustChange aunque mustChangePassword=true', () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const next = makeNext();
    const result = interceptor.intercept(makeContext('POST', { mustChangePassword: true }), next);
    expect(next.handle).toHaveBeenCalled();
    // Devuelve el observable de next.handle() sin lanzar
    expect(result).toBeDefined();
  });

  it('permite métodos de lectura (GET) aunque mustChangePassword=true', () => {
    const next = makeNext();
    interceptor.intercept(makeContext('GET', { mustChangePassword: true }), next);
    expect(next.handle).toHaveBeenCalled();
  });

  it('permite peticiones sin usuario autenticado (req.user undefined)', () => {
    const next = makeNext();
    interceptor.intercept(makeContext('POST', undefined), next);
    expect(next.handle).toHaveBeenCalled();
  });

  it('permite a usuarios normales (mustChangePassword=false) hacer POST', () => {
    const next = makeNext();
    interceptor.intercept(makeContext('POST', { mustChangePassword: false }), next);
    expect(next.handle).toHaveBeenCalled();
  });
});
