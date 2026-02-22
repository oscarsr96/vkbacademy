import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { Role, User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

@Controller('courses')
@UseGuards(JwtAuthGuard)
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('schoolYearId') schoolYearIdParam: string | undefined,
    @CurrentUser() user: User,
  ) {
    return this.coursesService.findAll({
      page: +page,
      limit: +limit,
      role: user.role,
      userId: user.id,
      schoolYearId: user.schoolYearId ?? null,
      schoolYearIdFilter: schoolYearIdParam,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.coursesService.findOne(id, user);
  }

  @Get(':id/progress')
  getCourseProgress(@Param('id') id: string, @CurrentUser() user: User) {
    return this.coursesService.getCourseProgress(id, user.id, user);
  }

  @Get(':id/student-progress/:studentId')
  @UseGuards(RolesGuard)
  @Roles(Role.TUTOR, Role.TEACHER, Role.ADMIN)
  getStudentCourseProgress(
    @Param('id') id: string,
    @Param('studentId') studentId: string,
  ) {
    return this.coursesService.getStudentCourseProgress(id, studentId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  create(@Body() dto: CreateCourseDto) {
    return this.coursesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateCourseDto) {
    return this.coursesService.update(id, dto);
  }
}
