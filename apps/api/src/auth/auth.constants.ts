/**
 * Contraseña por defecto con la que nace o se restablece la cuenta de un alumno.
 * No es un secreto: el alumno está obligado a cambiarla en el primer login
 * (flag User.mustChangePassword). Cumple el mínimo de 8 caracteres del DTO.
 */
export const DEFAULT_STUDENT_PASSWORD = 'cambiar123';
