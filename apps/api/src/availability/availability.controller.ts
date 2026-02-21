import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@prisma/client';
import { AvailabilityService } from './availability.service';
import { CreateAvailabilitySlotDto } from './dto/create-availability-slot.dto';

@Controller('teachers')
@UseGuards(JwtAuthGuard)
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get()
  findAllTeachers() {
    return this.availabilityService.findAllTeachers();
  }

  @Get(':id/slots')
  getFreeSlots(
    @Param('id') teacherId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.availabilityService.getFreeSlots(teacherId, new Date(from), new Date(to));
  }
}

@Controller('availability')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MyAvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  /** GET /availability/mine — slots propios del profesor */
  @Get('mine')
  @Roles('TEACHER', 'ADMIN')
  getMySlots(@CurrentUser() user: User) {
    return this.availabilityService.getMySlots(user.id);
  }

  /** POST /availability — añadir un slot de disponibilidad */
  @Post()
  @Roles('TEACHER', 'ADMIN')
  addSlot(@CurrentUser() user: User, @Body() dto: CreateAvailabilitySlotDto) {
    return this.availabilityService.addSlot(user.id, dto);
  }

  /** DELETE /availability/:id — eliminar un slot de disponibilidad */
  @Delete(':id')
  @Roles('TEACHER', 'ADMIN')
  removeSlot(@Param('id') slotId: string, @CurrentUser() user: User) {
    return this.availabilityService.removeSlot(slotId, user.id);
  }
}
