import type { CurriculumSubject } from './types';
import { MATES_3ESO_MODULES } from '../mates-3eso-modules';

// Asignaturas y temarios de 3º ESO — Decreto 65/2022 (Comunidad de Madrid).
// Materias verificadas contra el anexo I del decreto (horario semanal de 3º):
// en Madrid, 3º ESO NO incluye Educación Plástica, Visual y Audiovisual (se
// imparte en 1º y 2º) ni Educación en Valores Cívicos y Éticos (2º), por lo que
// se excluyen de este catálogo. Música sí se imparte en 3º.
// Temarios basados en índices de libros de texto LOMLOE (Anaya, Santillana,
// SM Savia, entre otros).
export const SUBJECTS_3ESO: CurriculumSubject[] = [
  {
    // Fuente única del temario: mates-3eso-modules.ts (ya usado por los seeds).
    subject: 'Matemáticas',
    courseTitle: 'Matemáticas 3º ESO',
    modules: MATES_3ESO_MODULES,
  },
  {
    // Índices Anaya y Santillana: cuerpo humano, salud, relieve y medio ambiente.
    subject: 'Biología y Geología',
    courseTitle: 'Biología y Geología 3º ESO',
    modules: [
      'La organización del cuerpo humano',
      'La alimentación y la dieta saludable',
      'La nutrición: aparatos digestivo y respiratorio',
      'La nutrición: aparatos circulatorio y excretor',
      'La relación: el sistema nervioso y los sentidos',
      'El sistema endocrino y el aparato locomotor',
      'La reproducción humana y la sexualidad',
      'La salud y la enfermedad: el sistema inmunitario',
      'El relieve y sus cambios',
      'Los paisajes de la Tierra',
      'La actividad humana y el medio ambiente',
    ],
  },
  {
    subject: 'Física y Química',
    courseTitle: 'Física y Química 3º ESO',
    modules: [
      'El trabajo científico y la medida',
      'Los estados de la materia y la teoría cinética',
      'Las leyes de los gases',
      'Mezclas, disoluciones y sustancias puras',
      'El átomo y los modelos atómicos',
      'La tabla periódica de los elementos',
      'El enlace químico: elementos y compuestos',
      'Formulación y nomenclatura inorgánica',
      'Las reacciones químicas',
      'Química, sociedad y medio ambiente',
      'Las fuerzas y sus efectos',
      'La electricidad y los circuitos eléctricos',
      'La energía y sus fuentes',
    ],
  },
  {
    subject: 'Educación Física',
    courseTitle: 'Educación Física 3º ESO',
    modules: [
      'La condición física y la salud',
      'El calentamiento y la vuelta a la calma',
      'La resistencia y la flexibilidad',
      'La fuerza y la velocidad',
      'Deportes colectivos: baloncesto',
      'Deportes colectivos: voleibol y balonmano',
      'Deportes de raqueta: bádminton',
      'Expresión corporal y danza',
      'Actividades físicas en el medio natural y orientación',
      'Alimentación, hidratación y hábitos saludables',
      'Primeros auxilios y prevención de lesiones',
    ],
  },
  {
    // En Madrid 3º combina Edad Moderna y geografía política y económica
    // (índices Anaya y Santillana 3º ESO).
    subject: 'Geografía e Historia',
    courseTitle: 'Geografía e Historia 3º ESO',
    modules: [
      'El inicio de la Edad Moderna: humanismo y descubrimientos',
      'Nuevas formas de pensar: Renacimiento y Reforma',
      'La formación del Imperio español',
      'La Europa del Barroco',
      'La organización política del mundo',
      'La organización política y territorial de España',
      'La población mundial y española',
      'Las actividades económicas y los recursos naturales',
      'El sector primario: los espacios agrarios',
      'El sector secundario: minería, energía e industria',
      'El sector terciario: los servicios',
      'Un mundo globalizado: desigualdades y desarrollo sostenible',
    ],
  },
  {
    // Literatura de 3º: de la Edad Media al Barroco; gramática: la oración simple.
    subject: 'Lengua Castellana y Literatura',
    courseTitle: 'Lengua Castellana y Literatura 3º ESO',
    modules: [
      'La comunicación y las variedades de la lengua',
      'Los textos narrativos, descriptivos y dialogados',
      'Los textos expositivos y argumentativos',
      'Los medios de comunicación y la publicidad',
      'Las clases de palabras',
      'Los sintagmas y la oración simple',
      'El análisis de la oración simple: los complementos del verbo',
      'La literatura medieval: lírica y épica',
      'El Mester de Clerecía y la prosa medieval',
      'La literatura del siglo XV: La Celestina',
      'La lírica y la narrativa del Renacimiento',
      'Cervantes y el Quijote',
      'La poesía y el teatro del Barroco',
    ],
  },
  {
    subject: 'Lengua Extranjera (Inglés)',
    courseTitle: 'Lengua Extranjera (Inglés) 3º ESO',
    modules: [
      'Present simple y present continuous',
      'Past simple y past continuous',
      'Present perfect y past perfect',
      'Los tiempos de futuro: will y be going to',
      'Comparativos y superlativos',
      'Los verbos modales',
      'Las oraciones condicionales',
      'La voz pasiva',
      'El estilo indirecto (reported speech)',
      'Las oraciones de relativo',
      'Gerundio e infinitivo',
      'Phrasal verbs y vocabulario temático',
    ],
  },
  {
    subject: 'Tecnología y Digitalización',
    courseTitle: 'Tecnología y Digitalización 3º ESO',
    modules: [
      'El proceso de resolución de problemas tecnológicos',
      'Expresión gráfica: bocetos, croquis y vistas',
      'Diseño e impresión 3D',
      'Mecanismos y máquinas',
      'Electricidad: circuitos y magnitudes eléctricas',
      'Introducción a la electrónica',
      'Iniciación a la programación',
      'Sistemas de control y robótica',
      'Hardware, software y seguridad digital',
      'Tecnología sostenible y sociedad',
    ],
  },
  {
    // En 3º la materia se centra en la historia de la música.
    subject: 'Música',
    courseTitle: 'Música 3º ESO',
    modules: [
      'Los elementos del lenguaje musical',
      'La música en la Antigüedad y la Edad Media',
      'La música del Renacimiento',
      'La música del Barroco',
      'El Clasicismo musical',
      'El Romanticismo musical',
      'Nacionalismos e impresionismo',
      'La música del siglo XX y las vanguardias',
      'El jazz y la música popular urbana',
      'La música tradicional española y las músicas del mundo',
      'La música y las nuevas tecnologías',
    ],
  },
  {
    // Optativa de 3º en Madrid (Orden 1736/2023). Nivel A2.
    subject: 'Segunda Lengua Extranjera (Francés)',
    courseTitle: 'Segunda Lengua Extranjera (Francés) 3º ESO',
    modules: [
      'Describir personas: físico y carácter',
      'El passé composé: contar el pasado',
      'El imperfecto y los recuerdos',
      'El futuro simple: hacer planes',
      'Los pronombres COD y COI',
      'La comparación',
      'La ciudad y las indicaciones',
      'Los alimentos y las cantidades',
      'La salud y el cuerpo',
      'Los viajes y las vacaciones',
    ],
  },
  {
    subject: 'Religión Católica',
    courseTitle: 'Religión Católica 3º ESO',
    modules: [
      'Las grandes preguntas del ser humano',
      'La dignidad de la persona',
      'El pueblo de Israel y la Alianza',
      'Jesús de Nazaret: vida y mensaje',
      'El Reino de Dios y las bienaventuranzas',
      'La Iglesia: origen y misión',
      'Los sacramentos y la liturgia',
      'La moral cristiana y la conciencia',
      'El compromiso social del cristiano',
      'Fe, ciencia y cultura',
    ],
  },
];
