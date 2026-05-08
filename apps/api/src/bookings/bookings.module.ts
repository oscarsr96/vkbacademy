import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { DailyModule } from '../daily/daily.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [DailyModule, NotificationsModule],
  controllers: [BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
