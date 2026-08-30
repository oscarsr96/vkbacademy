-- Reescribe las descripciones del catálogo de retos para que digan sin
-- ambigüedad a QUÉ se refieren: cursos de estudio, temas, asignaturas,
-- ejercicios, apuntes o exámenes.
--
-- Por qué ahora: las descripciones han pasado a verse en todas partes (tooltip
-- de las insignias del perfil, rail del dashboard y panel de admin), así que
-- una redacción confusa deja de ser un detalle. Y por qué en migración: el
-- pipeline aplica migraciones pero no siembra, así que un cambio solo en
-- seed.ts no llegaría a PRE ni a PROD (lección de #74).
--
-- Tres clases de arreglo:
--
-- 1. Vocabulario de la app. StudyPlan se llama "curso de estudio" en toda la
--    pantalla de Estudiar ("Crear curso de estudio", "Mis cursos de estudio"),
--    pero las descripciones decían "plan de estudio", que es el nombre interno.
--    TheoryModule es "Apuntes" en la pestaña del curso, no "mazos de teoría".
--
-- 2. Desambiguar el tutor. "el tutor" a secas se confunde con el padre, madre o
--    tutor legal, que es otra figura del producto: pasa a "tutor IA".
--
-- 3. Promesas que el código no cumple. TOPICS_STUDIED cuenta filas de
--    StudyPlanTopic, no temas únicos: repetir el mismo tema en dos cursos suma
--    dos veces. Las descripciones prometían "temas distintos" / "temas nuevos",
--    así que se ajusta el texto a lo que de verdad se mide en vez de cambiar
--    las reglas a mitad de partida a quien ya está jugando.

UPDATE "Challenge" SET description = 'Crea tu primer curso de estudio.' WHERE id = 'seed-primer-plan';
UPDATE "Challenge" SET description = 'Crea 5 cursos de estudio.' WHERE id = 'seed-planificador';
UPDATE "Challenge" SET description = 'Crea cursos de estudio de 3 asignaturas distintas.' WHERE id = 'seed-todoterreno';

UPDATE "Challenge" SET description = 'Estudia 10 temas, sumando los de todos tus cursos.' WHERE id = 'seed-diez-temas';
UPDATE "Challenge" SET description = 'Estudia 30 temas, sumando los de todos tus cursos.' WHERE id = 'seed-treinta-temas';
UPDATE "Challenge" SET description = 'Genera los apuntes de 15 temas.' WHERE id = 'seed-teoria-al-dia';

UPDATE "Challenge" SET description = 'Entrega tu primer examen, de cualquier nivel.' WHERE id = 'seed-primer-examen';
UPDATE "Challenge" SET description = 'Entrega 20 exámenes en total.' WHERE id = 'seed-veterano';
UPDATE "Challenge" SET description = 'Saca un 80% o más en un examen.' WHERE id = 'seed-notable';
UPDATE "Challenge" SET description = 'Saca un 70% o más en un examen de nivel difícil.' WHERE id = 'seed-nivel-experto';
UPDATE "Challenge" SET description = 'Saca un 100% en 3 exámenes.' WHERE id = 'seed-pleno';

UPDATE "Challenge" SET description = 'Acierta 10 ejercicios en total.' WHERE id = 'seed-primeros-aciertos';
UPDATE "Challenge" SET description = 'Acierta 100 ejercicios en total.' WHERE id = 'seed-cien-dianas';
UPDATE "Challenge" SET description = 'Acierta 20 ejercicios de nivel difícil.' WHERE id = 'seed-sin-miedo';
UPDATE "Challenge" SET description = 'Acierta 10 ejercicios seguidos sin fallar ninguno.' WHERE id = 'seed-sin-fallar';
UPDATE "Challenge" SET description = 'Acierta 25 ejercicios seguidos sin fallar ninguno.' WHERE id = 'seed-imparable';

UPDATE "Challenge" SET description = 'Hazle 25 preguntas al tutor IA.' WHERE id = 'seed-pregunta-sin-miedo';

UPDATE "Challenge" SET description = 'Estudia algo 7 días seguidos.' WHERE id = 'seed-semana-perfecta';
UPDATE "Challenge" SET description = 'Estudia algo 30 días seguidos.' WHERE id = 'seed-mes-constante';
UPDATE "Challenge" SET description = 'Estudia algo 4 semanas seguidas.' WHERE id = 'seed-un-mes-en-racha';

UPDATE "Challenge" SET description = 'Hazle 5 preguntas al tutor IA esta semana.' WHERE id = 'seed-mision-pregunta-al-tutor';
UPDATE "Challenge" SET description = 'Entrega 2 exámenes esta semana.' WHERE id = 'seed-mision-2-examenes';
UPDATE "Challenge" SET description = 'Acierta 20 ejercicios esta semana.' WHERE id = 'seed-mision-20-ejercicios';
UPDATE "Challenge" SET description = 'Estudia 3 temas esta semana.' WHERE id = 'seed-mision-3-temas';
UPDATE "Challenge" SET description = 'Acierta 5 ejercicios de nivel difícil esta semana.' WHERE id = 'seed-mision-5-dificiles';
