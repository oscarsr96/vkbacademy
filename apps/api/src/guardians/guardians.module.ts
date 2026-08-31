import { Module } from '@nestjs/common';
import { GuardiansController } from './guardians.controller';
import { GuardiansService } from './guardians.service';
import { GuardianDigestService } from './guardian-digest.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [GuardiansController],
  providers: [GuardiansService, GuardianDigestService],
  exports: [GuardiansService, GuardianDigestService],
})
export class GuardiansModule {}
