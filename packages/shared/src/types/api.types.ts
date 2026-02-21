/** Respuesta de error estándar de la API */
export interface ApiError {
  message: string;
  statusCode: number;
}

/** Respuesta de éxito genérica */
export interface ApiResponse<T = void> {
  data: T;
  message?: string;
}
