export interface StandardErrorResponse {
  statusCode: number;
  error: string;
  message: string;
  details?: Record<string, any>;
}
