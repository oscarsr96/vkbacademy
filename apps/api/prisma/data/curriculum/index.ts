// Punto de entrada del catálogo curricular: agrega los ficheros por nivel/modalidad
// en la estructura CurriculumLevel[] usada por el seed y por el validador estático.
import type { CurriculumLevel } from './types';
import { SUBJECTS_1ESO } from './1eso';
import { SUBJECTS_2ESO } from './2eso';
import { SUBJECTS_3ESO } from './3eso';
import { SUBJECTS_4ESO } from './4eso';
import { SUBJECTS_1BACH_A } from './1bach-ciencias';
import { SUBJECTS_1BACH_B } from './1bach-humanidades-artes';
import { SUBJECTS_2BACH_A } from './2bach-ciencias';
import { SUBJECTS_2BACH_B } from './2bach-humanidades-artes';

// Catálogo completo, de 1º de ESO a 2º de Bachillerato.
// En Bachillerato cada nivel junta la modalidad de Ciencias con la de Humanidades/CCSS/Artes.
export const CURRICULUM: CurriculumLevel[] = [
  { schoolYear: '1eso', label: '1º ESO', subjects: SUBJECTS_1ESO },
  { schoolYear: '2eso', label: '2º ESO', subjects: SUBJECTS_2ESO },
  { schoolYear: '3eso', label: '3º ESO', subjects: SUBJECTS_3ESO },
  { schoolYear: '4eso', label: '4º ESO', subjects: SUBJECTS_4ESO },
  {
    schoolYear: '1bach',
    label: '1º Bachillerato',
    subjects: [...SUBJECTS_1BACH_A, ...SUBJECTS_1BACH_B],
  },
  {
    schoolYear: '2bach',
    label: '2º Bachillerato',
    subjects: [...SUBJECTS_2BACH_A, ...SUBJECTS_2BACH_B],
  },
];

// Busca un nivel por su schoolYear (p. ej. "3eso"). Devuelve undefined si no existe.
export function getLevel(schoolYear: string): CurriculumLevel | undefined {
  return CURRICULUM.find((level) => level.schoolYear === schoolYear);
}

export * from './types';
