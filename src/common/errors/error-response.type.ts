export interface StandardErrorResponse {
  statusCode: number;
  type: string;
  message: string;
  details?: Record<string, any>;
}
