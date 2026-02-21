import { Module } from '@nestjs/common';
import { ProgressController } from './progress.controller';
import { ProgressService } from './progress.service';
import { ChallengesModule } from '../challenges/challenges.module';
import { CertificatesModule } from '../certificates/certificates.module';

@Module({
  imports: [ChallengesModule, CertificatesModule],
  controllers: [ProgressController],
  providers: [ProgressService],
})
export class ProgressModule {}
