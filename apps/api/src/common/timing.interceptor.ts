import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";

const SLOW_MS = 500;

/** Logs (debug level) any request slower than 500ms: method, route, duration. Registered globally in AppModule. */
@Injectable()
export class TimingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("RequestTiming");

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") return next.handle();
    const started = Date.now();
    const req = context.switchToHttp().getRequest();
    const log = () => {
      const ms = Date.now() - started;
      if (ms > SLOW_MS) this.logger.debug(`${req.method} ${req.route?.path ?? req.url} ${ms}ms`);
    };
    return next.handle().pipe(tap({ next: log, error: log, complete: undefined }));
  }
}
