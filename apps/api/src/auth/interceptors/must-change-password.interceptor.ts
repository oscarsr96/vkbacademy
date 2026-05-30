import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { ALLOW_WHEN_MUST_CHANGE } from '../decorators/allow-when-must-change.decorator';

const MUTATING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Bloquea cualquier endpoint mutador para usuarios con mustChangePassword=true,
 * salvo los marcados con @AllowWhenMustChange (p.ej. el propio cambio de contraseña).
 * Se ejecuta después de los guards, por lo que request.user ya está poblado.
 */
@Injectable()
export class MustChangePasswordInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const user = req.user as { mustChangePassword?: boolean } | undefined;
    const allow = this.reflector.getAllAndOverride<boolean>(ALLOW_WHEN_MUST_CHANGE, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (user?.mustChangePassword && MUTATING_METHODS.includes(req.method) && !allow) {
      throw new ForbiddenException('Debes cambiar tu contraseña antes de continuar');
    }
    return next.handle();
  }
}
