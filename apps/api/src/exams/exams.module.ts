import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ExamsController } from './exams.controller';
import { ExamsService } from './exams.service';
import { AiExamsService } from './ai-exams.service';
import { CertificatesModule } from '../certificates/certificates.module';
import { ChallengesModule } from '../challenges/challenges.module';

@Module({
  imports: [PrismaModule, CertificatesModule, ChallengesModule],
  controllers: [ExamsController],
  providers: [ExamsService, AiExamsService],
})
export class ExamsModule {}
