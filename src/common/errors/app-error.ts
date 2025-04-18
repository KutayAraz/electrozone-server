import { HttpStatus } from "@nestjs/common";
import { ErrorType } from "./error-type";

export class AppError extends Error {
  constructor(
    public type: ErrorType,
    public message: string,
    public statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
    public details?: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}
