import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Response } from "express";
import { QueryFailedError } from "typeorm";
import { AppError } from "./app-error";
import { StandardErrorResponse } from "./error-response.type";

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const errorResponse: StandardErrorResponse = this.createErrorResponse(exception);

    this.logger.error(
      `Exception: ${JSON.stringify(errorResponse)}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(errorResponse.statusCode).json(errorResponse);
  }

  private createErrorResponse(exception: unknown): StandardErrorResponse {
    if (exception instanceof AppError) {
      return {
        statusCode: exception.statusCode,
        type: exception.type,
        message: exception.message,
        details: exception.details,
      };
    }

    if (exception instanceof HttpException) {
      const response = exception.getResponse() as string | object;
      return {
        statusCode: exception.getStatus(),
        type: exception.name,
        message:
          typeof response === "string" ? response : (response as any).message || exception.message,
        details:
          typeof response === "object"
            ? JSON.stringify(response) // Convert object to string when it's an object
            : typeof response === "string"
              ? response
              : undefined,
      };
    }

    if (exception instanceof QueryFailedError) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        type: "Database Error",
        message: "A database error occurred",
        details: exception.message,
      };
    }

    // Default case for unknown errors
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      type: "Internal Server Error",
      message: "An unexpected error occurred",
    };
  }
}
