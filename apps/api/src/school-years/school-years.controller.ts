import { Controller, Get } from '@nestjs/common';
import { SchoolYearsService } from './school-years.service';

/**
 * Endpoint público: el formulario de registro (`RegisterPage`) lo consulta sin
 * sesión iniciada para poblar el selector "Curso del alumno". Los datos no son
 * sensibles (sólo etiquetas tipo "1º ESO").
 */
@Controller('school-years')
export class SchoolYearsController {
  constructor(private readonly schoolYearsService: SchoolYearsService) {}

  @Get()
  findAll() {
    return this.schoolYearsService.findAll();
  }
}
