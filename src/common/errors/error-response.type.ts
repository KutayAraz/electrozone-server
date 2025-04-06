export interface StandardErrorResponse {
  statusCode: number;
  type: string;
  message: string;
  details?: string;
}
