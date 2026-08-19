import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { Public } from "src/common/decorators/public.decorator";
import { getErrorMessage } from "src/common/errors/get-error-message";
import { RedisService } from "src/redis/redis.service";
import { DataSource } from "typeorm";

type DependencyStatus = { ok: boolean; latencyMs?: number; error?: string };

const PROBE_TIMEOUT_MS = 3000;

@Controller("health")
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Liveness. Deliberately touches no dependencies: it answers "is the process
   * up", which is what a platform health check and an uptime pinger need. Free
   * hosting tiers suspend an instance after a period of inactivity, so this is
   * also the endpoint a keep-warm ping should hit -- keeping it dependency-free
   * means those pings cost no database or Redis calls.
   */
  @Public()
  @SkipThrottle()
  @Get()
  liveness() {
    return {
      status: "ok",
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness. Verifies the process can actually reach MySQL and Redis, and
   * responds 503 when it cannot. Intended for humans diagnosing a deployment
   * (wrong credentials, TLS rejection, unreachable host) rather than for
   * routine polling.
   */
  @Public()
  @SkipThrottle()
  @Get("ready")
  async readiness() {
    const [database, redis] = await Promise.all([this.checkDatabase(), this.checkRedis()]);

    const body = {
      status: database.ok && redis.ok ? "ok" : "degraded",
      database,
      redis,
      timestamp: new Date().toISOString(),
    };

    if (!database.ok || !redis.ok) {
      throw new ServiceUnavailableException(body);
    }

    return body;
  }

  private async checkDatabase(): Promise<DependencyStatus> {
    return this.probe(() => this.dataSource.query("SELECT 1"));
  }

  private async checkRedis(): Promise<DependencyStatus> {
    return this.probe(() => this.redisService.getClient().ping());
  }

  /**
   * Runs a dependency probe under a hard timeout.
   *
   * The timeout is what makes this endpoint useful rather than dangerous: a
   * disconnected ioredis client queues commands instead of rejecting them, so
   * an unreachable Redis makes `ping()` wait indefinitely rather than fail.
   * Without a bound, readiness hangs exactly when it is needed most.
   */
  private async probe(operation: () => Promise<unknown>): Promise<DependencyStatus> {
    const startedAt = Date.now();
    let timer: NodeJS.Timeout;

    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`timed out after ${PROBE_TIMEOUT_MS}ms`)),
        PROBE_TIMEOUT_MS,
      );
    });

    try {
      await Promise.race([operation(), timeout]);
      return { ok: true, latencyMs: Date.now() - startedAt };
    } catch (error) {
      return {
        ok: false,
        latencyMs: Date.now() - startedAt,
        error: getErrorMessage(error),
      };
    } finally {
      // Leaving the timer pending would hold an open handle on every call.
      clearTimeout(timer);
    }
  }
}
