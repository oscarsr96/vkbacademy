import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { CourseGeneratorService } from './course-generator.service';
import { BillingService } from './billing.service';
import { CertificatesModule } from '../certificates/certificates.module';

@Module({
  imports: [CertificatesModule],
  controllers: [AdminController],
  providers: [AdminService, CourseGeneratorService, BillingService],
})
export class AdminModule {}
