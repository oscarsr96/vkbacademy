import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TutorsService } from './tutors.service';
import { User } from '@prisma/client';

@Controller('tutors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TutorsController {
  constructor(private readonly tutorsService: TutorsService) {}

  @Get('my-students')
  @Roles(Role.TUTOR, Role.ADMIN)
  getMyStudents(@CurrentUser() user: User) {
    return this.tutorsService.getMyStudents(user.id);
  }

  @Get('my-students/:studentId/courses')
  @Roles(Role.TUTOR, Role.ADMIN)
  getStudentCourses(
    @Param('studentId') studentId: string,
    @CurrentUser() user: User,
  ) {
    return this.tutorsService.getStudentCourses(user.id, studentId);
  }
}
