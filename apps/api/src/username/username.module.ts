import { Global, Module } from '@nestjs/common';
import { UsernameService } from './username.service';

@Global()
@Module({
  providers: [UsernameService],
  exports: [UsernameService],
})
export class UsernameModule {}
