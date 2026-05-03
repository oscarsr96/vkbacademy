import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { YoutubeModule } from '../youtube/youtube.module';
import { TheoryController } from './theory.controller';
import { TheoryService } from './theory.service';

@Module({
  imports: [PrismaModule, AiModule, YoutubeModule],
  controllers: [TheoryController],
  providers: [TheoryService],
})
export class TheoryModule {}
