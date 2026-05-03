import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TheoryService } from './theory.service';
import { GenerateTheoryDto } from './dto/generate-theory.dto';

@Controller('theory')
@UseGuards(JwtAuthGuard)
export class TheoryController {
  constructor(private readonly theory: TheoryService) {}

  /** Genera un temario nuevo y lo guarda en la biblioteca privada del alumno. */
  @Post('generate')
  generate(@CurrentUser() user: User, @Body() dto: GenerateTheoryDto) {
    return this.theory.generate(user.id, dto);
  }

  /** Lista los temarios del alumno (opcionalmente filtrados por curso). */
  @Get('mine')
  listMine(@CurrentUser() user: User, @Query('courseId') courseId?: string) {
    return this.theory.listMine(user.id, courseId);
  }

  /** Devuelve un temario completo con sus lecciones (solo el dueño). */
  @Get(':id')
  getById(@CurrentUser() user: User, @Param('id') id: string) {
    return this.theory.getById(user.id, id);
  }

  /** Elimina un temario de la biblioteca (solo el dueño). */
  @Delete(':id')
  @HttpCode(204)
  async deleteById(@CurrentUser() user: User, @Param('id') id: string) {
    await this.theory.deleteById(user.id, id);
  }
}
