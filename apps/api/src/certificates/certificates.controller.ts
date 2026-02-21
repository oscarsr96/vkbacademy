import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CertificatesService } from './certificates.service';

@Controller('certificates')
export class CertificatesController {
  constructor(private readonly certificatesService: CertificatesService) {}

  /** Verificación pública por código — sin JWT */
  @Get('verify/:code')
  verify(@Param('code') code: string) {
    return this.certificatesService.verify(code);
  }

  /** Mis certificados [JWT] */
  @Get()
  @UseGuards(JwtAuthGuard)
  getMyCertificates(@CurrentUser() user: { id: string }) {
    return this.certificatesService.getMyCertificates(user.id);
  }

  /** Un certificado por ID [JWT] */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  getOne(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.certificatesService.getOne(id, user.id);
  }
}
