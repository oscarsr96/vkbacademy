import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminUsersService } from './admin-users.service';
import { AdminContentService } from './admin-content.service';
import { AdminAnalyticsService } from './admin-analytics.service';
import { AdminRetentionService } from './admin-retention.service';
import { AdminGamificationService } from './admin-gamification.service';
import { AdminExamsService } from './admin-exams.service';
import { CourseGeneratorService } from './course-generator.service';
import { CertificatesModule } from '../certificates/certificates.module';
import { YoutubeModule } from '../youtube/youtube.module';

@Module({
  imports: [CertificatesModule, YoutubeModule],
  controllers: [AdminController],
  providers: [
    AdminUsersService,
    AdminContentService,
    AdminAnalyticsService,
    AdminRetentionService,
    AdminGamificationService,
    AdminExamsService,
    CourseGeneratorService,
  ],
})
export class AdminModule {}
