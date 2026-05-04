import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsString } from 'class-validator';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TutorsService } from './tutors.service';
import { User } from '@prisma/client';

class EnrollDto {
  @IsString()
  courseId!: string;
}

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
  getStudentCourses(@Param('studentId') studentId: string, @CurrentUser() user: User) {
    return this.tutorsService.getStudentCourses(user.id, studentId);
  }

  @Get('my-students/:studentId/stats')
  @Roles(Role.TUTOR, Role.ADMIN)
  getStudentStats(
    @Param('studentId') studentId: string,
    @CurrentUser() user: User,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.tutorsService.getStudentStats(
      user.id,
      studentId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  @Get('my-students/:studentId/available-courses')
  @Roles(Role.TUTOR, Role.ADMIN)
  getAvailableCourses(@Param('studentId') studentId: string, @CurrentUser() user: User) {
    return this.tutorsService.getAvailableCoursesForStudent(user.id, studentId);
  }

  @Post('my-students/:studentId/enrollments')
  @Roles(Role.TUTOR, Role.ADMIN)
  enroll(
    @Param('studentId') studentId: string,
    @Body() body: EnrollDto,
    @CurrentUser() user: User,
  ) {
    return this.tutorsService.enrollStudent(user.id, studentId, body.courseId);
  }

  @Delete('my-students/:studentId/enrollments/:courseId')
  @Roles(Role.TUTOR, Role.ADMIN)
  unenroll(
    @Param('studentId') studentId: string,
    @Param('courseId') courseId: string,
    @CurrentUser() user: User,
  ) {
    return this.tutorsService.unenrollStudent(user.id, studentId, courseId);
  }
}
