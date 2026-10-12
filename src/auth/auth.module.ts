import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ApiKeyGuard } from './api-key.guard';
import { AuthConfig } from './auth.config';

@Module({
  providers: [
    { provide: AuthConfig, useFactory: () => AuthConfig.fromEnv() },
    { provide: APP_GUARD, useClass: ApiKeyGuard },
  ],
})
export class AuthModule {}
