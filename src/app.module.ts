import { Module, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { EntriesModule } from './entries/entries.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    EntriesModule,
    HealthModule,
    AuthModule,
    // Per client IP: a turnstile reader sends a few passes a second at most. A flood of
    // made-up card codes would otherwise queue real swipes behind it (the DB pool has 5 connections).
    ThrottlerModule.forRoot([{ ttl: 1000, limit: 10 }]),
  ],
  providers: [
    // Registered here, not in main.ts, so tests built from this module validate the same way.
    // whitelist + forbidNonWhitelisted: a field the DTO does not declare is a 400, not silently passed on.
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
    },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
