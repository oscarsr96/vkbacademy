import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { User } from '@prisma/client';

@Controller('bookings')
@UseGuards(JwtAuthGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get('mine')
  getMyBookings(@CurrentUser() user: User) {
    return this.bookingsService.getMyBookings(user.id, user.role);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.TUTOR, Role.ADMIN)
  create(@Body() dto: CreateBookingDto, @CurrentUser() user: User) {
    return this.bookingsService.create(dto, user.id, user.role);
  }

  @Patch(':id/confirm')
  @UseGuards(RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  confirm(@Param('id') id: string, @CurrentUser() user: User) {
    return this.bookingsService.confirm(id, user.id);
  }

  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: User) {
    return this.bookingsService.cancel(id, user.id, user.role);
  }
}
