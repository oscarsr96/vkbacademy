import { Global, Module } from '@nestjs/common';
import { AiProviderService } from './ai-provider.service';
import { AiUsageService } from './ai-usage.service';

@Global()
@Module({
  providers: [AiProviderService, AiUsageService],
  exports: [AiProviderService, AiUsageService],
})
export class AiModule {}
