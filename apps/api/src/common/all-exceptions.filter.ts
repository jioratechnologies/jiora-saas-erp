import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Response } from "express";

const SERVER_ERROR = "Something went wrong on the server. Please try again in a moment.";

/**
 * Global filter: maps Prisma errors to friendly HTTP errors, passes
 * HttpExceptions through, and hides everything else behind a generic 500.
 * Real errors are logged server-side only.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("ExceptionFilter");

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = SERVER_ERROR;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      const raw = typeof body === "string" ? body : (body as { message?: string | string[] }).message;
      if (status >= 500) {
        this.logger.error(exception.message, exception.stack);
      } else if (raw) {
        // Validation pipe arrays are passed through; web formatter handles them.
        message = raw;
      } else {
        message = status === 404 ? "The requested item could not be found." : "Request could not be completed.";
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case "P2002":
          status = HttpStatus.CONFLICT;
          message = "A record with this name already exists. Please choose a different one.";
          break;
        case "P2025":
          status = HttpStatus.NOT_FOUND;
          message = "The requested item could not be found.";
          break;
        case "P2003":
          status = HttpStatus.BAD_REQUEST;
          message = "This action refers to an item that does not exist or is still in use.";
          break;
        default:
          this.logger.error(`${exception.code}: ${exception.message}`, exception.stack);
      }
      if (status === HttpStatus.INTERNAL_SERVER_ERROR) message = SERVER_ERROR;
      else this.logger.warn(`${exception.code}: ${exception.message}`);
    } else {
      this.logger.error(
        exception instanceof Error ? exception.message : String(exception),
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    res.status(status).json({ statusCode: status, message });
  }
}
