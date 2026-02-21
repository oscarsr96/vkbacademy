/** Respuesta paginada genérica */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Parámetros de paginación */
export interface PaginationParams {
  page?: number;
  limit?: number;
}
