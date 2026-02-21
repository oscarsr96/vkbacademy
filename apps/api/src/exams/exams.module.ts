import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ExamsController } from './exams.controller';
import { ExamsService } from './exams.service';
import { CertificatesModule } from '../certificates/certificates.module';

@Module({
  imports: [PrismaModule, CertificatesModule],
  controllers: [ExamsController],
  providers: [ExamsService],
})
export class ExamsModule {}
