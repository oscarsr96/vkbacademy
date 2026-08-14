import { Module } from '@nestjs/common';
import { ChallengesModule } from '../challenges/challenges.module';
import { TutorController } from './tutor.controller';
import { TutorService } from './tutor.service';

@Module({
  imports: [ChallengesModule],
  controllers: [TutorController],
  providers: [TutorService],
})
export class TutorModule {}
