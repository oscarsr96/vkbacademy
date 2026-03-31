import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AcademiesService } from './academies.service';
import { CreateAcademyDto, UpdateAcademyDto, AddMemberDto } from './dto/create-academy.dto';

@Controller('academies')
export class AcademiesController {
  constructor(private readonly academiesService: AcademiesService) {}

  // Endpoint público: lista de academias activas (para registro y landing)
  @Get('public')
  findPublic() {
    return this.academiesService.findPublic();
  }

  // Endpoint público: obtener datos de una academia por slug (para branding)
  @Get('by-slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.academiesService.findBySlug(slug);
  }

  // Endpoint público: resolver academia por dominio
  @Get('by-domain/:domain')
  findByDomain(@Param('domain') domain: string) {
    return this.academiesService.findByDomain(domain);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  findAll() {
    return this.academiesService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  findById(@Param('id') id: string) {
    return this.academiesService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  create(@Body() dto: CreateAcademyDto) {
    return this.academiesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateAcademyDto) {
    return this.academiesService.update(id, dto);
  }

  @Get(':id/members')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  getMembers(@Param('id') id: string) {
    return this.academiesService.getMembers(id);
  }

  @Post(':id/members')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  addMember(@Param('id') id: string, @Body() dto: AddMemberDto) {
    return this.academiesService.addMember(id, dto.userId);
  }

  @Delete(':id/members/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    return this.academiesService.removeMember(id, userId);
  }
}
