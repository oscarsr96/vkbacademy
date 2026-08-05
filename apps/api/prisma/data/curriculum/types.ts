// Tipos del catálogo curricular de ESO y Bachillerato (Comunidad de Madrid).
// El contenido real vive en los ficheros por nivel de este mismo directorio
// (1eso.ts, 2eso.ts, ..., 2bach-humanidades-artes.ts), que exportan arrays de
// CurriculumSubject; index.ts los agrega en CurriculumLevel[].

// Modalidad de Bachillerato a la que pertenece una asignatura.
// 'general' se reserva para materias comunes no ligadas a una modalidad concreta.
export type BachModality = 'general' | 'ciencias' | 'humanidades-ccss' | 'artes';

// Una asignatura de un nivel educativo, con su temario (unidades didácticas).
export interface CurriculumSubject {
  // Nombre corto de la asignatura, p. ej. "Matemáticas".
  subject: string;
  // Título completo del curso tal y como se creará en Course.title, p. ej. "Matemáticas 3º ESO".
  courseTitle: string;
  // Solo aplica en Bachillerato: modalidad a la que pertenece la asignatura.
  // Las asignaturas comunes de Bachillerato pueden omitirlo.
  modality?: BachModality;
  // Unidades didácticas del temario, en orden curricular.
  modules: string[];
}

// Un nivel educativo completo (curso académico) con todas sus asignaturas.
export interface CurriculumLevel {
  // Debe coincidir con SchoolYear.name del schema de Prisma:
  // "1eso" | "2eso" | "3eso" | "4eso" | "1bach" | "2bach".
  schoolYear: string;
  // Etiqueta legible del nivel, p. ej. "1º ESO", "2º Bachillerato".
  label: string;
  subjects: CurriculumSubject[];
}
