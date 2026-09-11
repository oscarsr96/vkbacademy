import { Controller, Param, Post } from '@nestjs/common';
import { GuardiansService } from './guardians.service';

@Controller('guardians')
export class GuardiansController {
  constructor(private readonly guardians: GuardiansService) {}

  /**
   * Baja del resumen semanal — pública, sin JWT: el padre o la madre no tiene
   * cuenta. Es POST y no GET a propósito: los escáneres de los clientes de
   * correo abren solos los enlaces, y con un GET darían de baja a familias que
   * no lo han pedido.
   */
  @Post('unsubscribe/:token')
  unsubscribe(@Param('token') token: string) {
    return this.guardians.unsubscribe(token);
  }
}
