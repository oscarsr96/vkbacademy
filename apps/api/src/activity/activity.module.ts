import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ActivityService } from './activity.service';
import { ActivityInterceptor } from './activity.interceptor';

@Module({
  providers: [ActivityService, { provide: APP_INTERCEPTOR, useClass: ActivityInterceptor }],
  exports: [ActivityService],
})
export class ActivityModule {}
