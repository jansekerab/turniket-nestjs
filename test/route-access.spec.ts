import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { CALLER_KEY, PUBLIC } from '../src/auth/api-key.guard';
import { HealthController } from '../src/health/health.controller';
import { EntriesController } from '../src/entries/ui/entries.controller';

/**
 * Every route says who may call it: @CallerOnly('reader' | 'staff') or @Public('reason').
 * A route with neither is open by accident — the classic way an endpoint leaks.
 * Add every new controller to the list below.
 */
const controllers = [EntriesController, HealthController];

const routes = controllers.flatMap((c) =>
  Object.getOwnPropertyNames(c.prototype)
    .map((name) => ({ name, handler: (c.prototype as unknown as Record<string, unknown>)[name] }))
    .filter(
      (r): r is { name: string; handler: object } =>
        typeof r.handler === 'function' && Reflect.hasMetadata(METHOD_METADATA, r.handler),
    )
    .map(({ name, handler }) => ({
      route: `${RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler) as number]} ${String(Reflect.getMetadata(PATH_METADATA, c))}/${String(Reflect.getMetadata(PATH_METADATA, handler))} (${c.name}.${name})`,
      caller: Reflect.getMetadata(CALLER_KEY, handler) as string | undefined,
      isPublic: Reflect.getMetadata(PUBLIC, handler) as string | undefined,
    })),
);

describe('route access', () => {
  it('finds the routes (positive control for the metadata lookup)', () => {
    expect(routes.length).toBeGreaterThanOrEqual(4);
  });

  it.each(routes.map((r) => [r.route, r] as const))('%s declares who may call it', (_route, r) => {
    expect(r.caller !== undefined || r.isPublic !== undefined).toBe(true);
  });

  it('no route is both restricted and public', () => {
    expect(routes.filter((r) => r.caller && r.isPublic).map((r) => r.route)).toEqual([]);
  });
});
