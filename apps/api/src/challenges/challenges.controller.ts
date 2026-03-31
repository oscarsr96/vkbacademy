import { Controller, Get, Post, Body, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AcademyGuard } from '../auth/guards/academy.guard';
import { CurrentAcademy } from '../auth/decorators/current-academy.decorator';
import { ChallengesService } from './challenges.service';
import { RedeemItemDto } from './dto/redeem-item.dto';

@Controller('challenges')
@UseGuards(JwtAuthGuard, AcademyGuard)
export class ChallengesController {
  constructor(private readonly challengesService: ChallengesService) {}

  @Get('summary')
  getSummary(@Request() req: { user: { id: string } }) {
    return this.challengesService.getSummary(req.user.id);
  }

  @Get()
  getMyProgress(@Request() req: { user: { id: string } }) {
    return this.challengesService.getMyProgress(req.user.id);
  }

  @Post('redeem')
  async redeemItem(
    @Request() req: { user: { id: string } },
    @Body() dto: RedeemItemDto,
    @CurrentAcademy() academyId: string | null,
  ) {
    try {
      return await this.challengesService.redeemItem(req.user.id, dto.itemName, dto.cost, academyId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al canjear el artículo';
      throw new BadRequestException(msg);
    }
  }
}
