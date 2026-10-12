import { CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { timingSafeEqual } from 'node:crypto';
import { Request } from 'express';
import { AuthConfig } from './auth.config';

export type Caller = 'reader' | 'staff';
const CALLER = 'caller';

/** Marks a route as allowed only for the given caller, e.g. @CallerOnly('reader'). */
export const CallerOnly = (caller: Caller) => SetMetadata(CALLER, caller);

export const PUBLIC = 'public';
/**
 * Marks a route as deliberately open. Every route must carry @CallerOnly or @Public —
 * a test checks it, so a new endpoint cannot end up open by being forgotten.
 */
export const Public = (reason: string) => SetMetadata(PUBLIC, reason);
export const CALLER_KEY = CALLER;

/**
 * Global guard: a route marked @CallerOnly needs that caller's key in the x-api-key header.
 * Unmarked routes (/health) stay open.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly cfg: AuthConfig,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const caller = this.reflector.getAllAndOverride<Caller | undefined>(CALLER, [ctx.getHandler(), ctx.getClass()]);
    if (caller === undefined) return true;

    const expected = caller === 'reader' ? this.cfg.readerKey : this.cfg.staffKey;
    const given = ctx.switchToHttp().getRequest<Request>().header('x-api-key') ?? '';
    if (!sameSecret(given, expected)) throw new UnauthorizedException();
    return true;
  }
}

/** Constant-time comparison — a plain === leaks through timing how much of the key was right. */
function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
