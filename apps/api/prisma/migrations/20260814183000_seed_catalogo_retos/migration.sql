-- Catálogo inicial de retos para entornos desplegados.
--
-- Por qué existe esta migración: los retos son datos de seed, y `prisma/seed.ts`
-- solo se ejecuta en local — el pipeline aplica migraciones (`prisma migrate
-- deploy`) pero nunca siembra. La migración `20260814115518_retos_v2` tuvo que
-- borrar los Challenge de los cinco tipos retirados (Postgres no permite
-- eliminar valores de un enum mientras haya filas que los usen), y en PRE y PROD
-- nada insertó el catálogo nuevo: la vista de Retos del alumno quedó vacía.
--
-- Es idempotente por doble guarda (id fijo y título), así que puede aplicarse
-- sobre un entorno que ya tenga parte del catálogo sin duplicar nada. Los ids
-- son deterministas (`seed-<slug>`) para que reaplicarla nunca cree gemelos.
--
-- A partir de aquí el catálogo se mantiene desde el panel de admin
-- (/admin/challenges), que ya permite crear, editar y desactivar retos.

INSERT INTO "Challenge" (id, title, description, type, cadence, target, points, "badgeIcon", "badgeColor", "isActive", "createdAt", "updatedAt")
SELECT 'seed-primer-plan', 'Primer plan', 'Crea tu primer plan de estudio.',
       'STUDY_PLAN_CREATED'::"ChallengeType", 'PERMANENT'::"ChallengeCadence", 1, 15, '🚀', '#10b981', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Challenge" WHERE id = 'seed-primer-plan' OR title = 'Primer plan');

INSERT INTO "Challenge" (id, title, description, type, cadence, target, points, "badgeIcon", "badgeColor", "isActive", "createdAt", "updatedAt")
SELECT 'seed-primer-examen', 'Primer examen', 'Entrega tu primer examen.',
       'EXAM_COMPLETED'::"ChallengeType", 'PERMANENT'::"ChallengeCadence", 1, 20, '📝', '#13aff0', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Challenge" WHERE id = 'seed-primer-examen' OR title = 'Primer examen');

INSERT INTO "Challenge" (id, title, description, type, cadence, target, points, "badgeIcon", "badgeColor", "isActive", "createdAt", "updatedAt")
SELECT 'seed-primeros-aciertos', 'Primeros aciertos', 'Acierta 10 ejercicios.',
       'EXERCISES_SOLVED'::"ChallengeType", 'PERMANENT'::"ChallengeCadence", 10, 30, '✏️', '#22c55e', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Challenge" WHERE id = 'seed-primeros-aciertos' OR title = 'Primeros aciertos');

INSERT INTO "Challenge" (id, title, description, type, cadence, target, points, "badgeIcon", "badgeColor", "isActive", "createdAt", "updatedAt")
SELECT 'seed-planificador', 'Planificador', 'Crea 5 planes de estudio.',
       'STUDY_PLAN_CREATED'::"ChallengeType", 'PERMANENT'::"ChallengeCadence", 5, 50, '🗺️', '#059669', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Challenge" WHERE id = 'seed-planificador' OR title = 'Planificador');

INSERT INTO "Challenge" (id, title, description, type, cadence, target, points, "badgeIcon", "badgeColor", "isActive", "createdAt", "updatedAt")
SELECT 'seed-diez-temas', 'Diez temas', 'Estudia 10 temas distintos.',
       'TOPICS_STUDIED'::"ChallengeType", 'PERMANENT'::"ChallengeCadence", 10, 60, '📚', '#0ea5e9', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Challenge" WHERE id = 'seed-diez-temas' OR title = 'Diez temas');

INSERT INTO "Challenge" (id, title, description, type, cadence, target, points, "badgeIcon", "badgeColor", "isActive", "createdAt", "updatedAt")
SELECT 'seed-pregunta-sin-miedo', 'Pregunta sin miedo', 'Hazle 25 preguntas al tutor.',
       'TUTOR_QUESTIONS'::"ChallengeType", 'PERMANENT'::"ChallengeCadence", 25, 60, '💬', '#a855f7', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Challenge" WHERE id = 'seed-pregunta-sin-miedo' OR title = 'Pregunta sin miedo');

INSERT INTO "Challenge" (id, title, description, type, cadence, target, points, "badgeIcon", "badgeColor", "isActive", "createdAt", "updatedAt")
SELECT 'seed-notable', 'Notable', 'Consigue un 80% o más en un examen.',
       'EXAM_SCORE'::"ChallengeType", 'PERMANENT'::"ChallengeCadence", 80, 70, '⭐', '#ffd24d', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Challenge" WHERE id = 'seed-notable' OR title = 'Notable');

INSERT INTO "Challenge" (id, title, description, type, cadence, target, points, "badgeIcon", "badgeColor", "isActive", "createdAt", "updatedAt")
SELECT 'seed-todoterreno', 'Todoterreno', 'Estudia temas de 3 asignaturas distintas.',
       'SUBJECT_VARIETY'::"ChallengeType", 'PERMANENT'::"ChallengeCadence", 3, 70, '🎒', '#8b5cf6', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Challenge" WHERE id = 'seed-todoterreno' OR title = 'Todoterreno');

INSERT INTO "Challenge" (id, title, description, type, cadence, target, points, "badgeIcon", "badgeColor", "isActive", "createdAt", "updatedAt")
SELECT 'seed-teoria-al-dia', 'Teoría al día', 'Genera 15 mazos de teoría.',
       'THEORY_COMPLETED'::"ChallengeType", 'PERMANENT'::"ChallengeCadence", 15, 80, '📖', '#6366f1', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Challenge" WHERE id = 'seed-teoria-al-dia' OR title = 'Teoría al día');

INSERT INTO "Challenge" (id, title, description, type, cadence, target, points, "badgeIcon", "badgeColor", "isActive", "createdAt", "updatedAt")
SELECT 'seed-sin-fallar', 'Sin fallar', 'Encadena 10 aciertos seguidos.',
       'EXERCISES_CORRECT_STREAK'::"ChallengeType", 'PERMANENT'::"ChallengeCadence", 10, 90, '⚡', '#f59e0b', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Challenge" WHERE id = 'seed-sin-fallar' OR title = 'Sin fallar');

INSERT INTO "Challenge" (id, title, description, type, cadence, target, points, "badgeIcon", "badgeColor", "isActive", "createdAt", "updatedAt")
SELECT 'seed-semana-perfecta', 'Semana perfecta', 'Estudia 7 días seguidos.',
       'STREAK_DAILY'::"ChallengeType", 'PERMANENT'::"ChallengeCadence", 7, 120, '📅', '#ec4899', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Challenge" WHERE id = 'seed-semana-perfecta' OR title = 'Semana perfecta');

INSERT INTO "Challenge" (id, title, description, type, cadence, target, points, "badgeIcon", "badgeColor", "isActive", "createdAt", "updatedAt")
SELECT 'seed-veterano', 'Veterano', 'Entrega 20 exámenes.',
       'EXAM_COMPLETED'::"ChallengeType", 'PERMANENT'::"ChallengeCadence", 20, 140, '🗂️', '#0369a1', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Challenge" WHERE id = 'seed-veterano' OR title = 'Veterano');

INSERT INTO "Challenge" (id, title, description, type, cadence, target, points, "badgeIcon", "badgeColor", "isActive", "createdAt", "updatedAt")
SELECT 'seed-treinta-temas', 'Treinta temas', 'Estudia 30 temas distintos.',
       'TOPICS_STUDIED'::"ChallengeType", 'PERMANENT'::"ChallengeCadence", 30, 150, '🧠', '#0284c7', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Challenge" WHERE id = 'seed-treinta-temas' OR title = 'Treinta temas');

INSERT INTO "Challenge" (id, title, description, type, cadence, target, points, "badgeIcon", "badgeColor", "isActive", "createdAt", "updatedAt")
SELECT 'seed-un-mes-en-racha', 'Un mes en racha', 'Mantén 4 semanas seguidas de actividad.',
       'STREAK_WEEKLY'::"ChallengeType", 'PERMANENT'::"ChallengeCadence", 4, 150, '🔗', '#14b8a6', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Challenge" WHERE id = 'seed-un-mes-en-racha' OR title = 'Un mes en racha');

INSERT INTO "Challenge" (id, title, description, type, cadence, target, points, "badgeIcon", "badgeColor", "isActive", "createdAt", "updatedAt")
SELECT 'seed-sin-miedo', 'Sin miedo', 'Acierta 20 ejercicios difíciles.',
       'HARD_EXERCISES_SOLVED'::"ChallengeType", 'PERMANENT'::"ChallengeCadence", 20, 160, '🧗', '#dc2626', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Challenge" WHERE id = 'seed-sin-miedo' OR title = 'Sin miedo');

INSERT INTO "Challenge" (id, title, description, type, cadence, target, points, "badgeIcon", "badgeColor", "isActive", "createdAt", "updatedAt")
SELECT 'seed-pleno', 'Pleno', 'Consigue 3 exámenes con el 100%.',
       'EXAM_PERFECT'::"ChallengeType", 'PERMANENT'::"ChallengeCadence", 3, 180, '💯', '#facc15', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Challenge" WHERE id = 'seed-pleno' OR title = 'Pleno');

INSERT INTO "Challenge" (id, title, description, type, cadence, target, points, "badgeIcon", "badgeColor", "isActive", "createdAt", "updatedAt")
SELECT 'seed-cien-dianas', 'Cien dianas', 'Acierta 100 ejercicios.',
       'EXERCISES_SOLVED'::"ChallengeType", 'PERMANENT'::"ChallengeCadence", 100, 200, '🎯', '#16a34a', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Challenge" WHERE id = 'seed-cien-dianas' OR title = 'Cien dianas');

INSERT INTO "Challenge" (id, title, description, type, cadence, target, points, "badgeIcon", "badgeColor", "isActive", "createdAt", "updatedAt")
SELECT 'seed-nivel-experto', 'Nivel experto', 'Consigue un 70% o más en un examen de nivel difícil.',
       'EXAM_HARD_SCORE'::"ChallengeType", 'PERMANENT'::"ChallengeCadence", 70, 200, '🏆', '#f5911e', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Challenge" WHERE id = 'seed-nivel-experto' OR title = 'Nivel experto');

INSERT INTO "Challenge" (id, title, description, type, cadence, target, points, "badgeIcon", "badgeColor", "isActive", "createdAt", "updatedAt")
SELECT 'seed-imparable', 'Imparable', 'Encadena 25 aciertos seguidos.',
       'EXERCISES_CORRECT_STREAK'::"ChallengeType", 'PERMANENT'::"ChallengeCadence", 25, 220, '🔥', '#ea580c', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Challenge" WHERE id = 'seed-imparable' OR title = 'Imparable');

INSERT INTO "Challenge" (id, title, description, type, cadence, target, points, "badgeIcon", "badgeColor", "isActive", "createdAt", "updatedAt")
SELECT 'seed-mes-constante', 'Mes constante', 'Estudia 30 días seguidos.',
       'STREAK_DAILY'::"ChallengeType", 'PERMANENT'::"ChallengeCadence", 30, 400, '🗓️', '#db2777', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Challenge" WHERE id = 'seed-mes-constante' OR title = 'Mes constante');

INSERT INTO "Challenge" (id, title, description, type, cadence, target, points, "badgeIcon", "badgeColor", "isActive", "createdAt", "updatedAt")
SELECT 'seed-mision-pregunta-al-tutor', 'Misión: pregunta al tutor', 'Hazle 5 preguntas al tutor esta semana.',
       'TUTOR_QUESTIONS'::"ChallengeType", 'WEEKLY'::"ChallengeCadence", 5, 20, '🙋', '#a855f7', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Challenge" WHERE id = 'seed-mision-pregunta-al-tutor' OR title = 'Misión: pregunta al tutor');

INSERT INTO "Challenge" (id, title, description, type, cadence, target, points, "badgeIcon", "badgeColor", "isActive", "createdAt", "updatedAt")
SELECT 'seed-mision-2-examenes', 'Misión: 2 exámenes', 'Entrega 2 exámenes esta semana.',
       'EXAM_COMPLETED'::"ChallengeType", 'WEEKLY'::"ChallengeCadence", 2, 25, '🧾', '#13aff0', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Challenge" WHERE id = 'seed-mision-2-examenes' OR title = 'Misión: 2 exámenes');

INSERT INTO "Challenge" (id, title, description, type, cadence, target, points, "badgeIcon", "badgeColor", "isActive", "createdAt", "updatedAt")
SELECT 'seed-mision-20-ejercicios', 'Misión: 20 ejercicios', 'Acierta 20 ejercicios esta semana.',
       'EXERCISES_SOLVED'::"ChallengeType", 'WEEKLY'::"ChallengeCadence", 20, 25, '🗡️', '#22c55e', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Challenge" WHERE id = 'seed-mision-20-ejercicios' OR title = 'Misión: 20 ejercicios');

INSERT INTO "Challenge" (id, title, description, type, cadence, target, points, "badgeIcon", "badgeColor", "isActive", "createdAt", "updatedAt")
SELECT 'seed-mision-3-temas', 'Misión: 3 temas', 'Estudia 3 temas nuevos esta semana.',
       'TOPICS_STUDIED'::"ChallengeType", 'WEEKLY'::"ChallengeCadence", 3, 25, '📗', '#0ea5e9', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Challenge" WHERE id = 'seed-mision-3-temas' OR title = 'Misión: 3 temas');

INSERT INTO "Challenge" (id, title, description, type, cadence, target, points, "badgeIcon", "badgeColor", "isActive", "createdAt", "updatedAt")
SELECT 'seed-mision-5-dificiles', 'Misión: 5 difíciles', 'Acierta 5 ejercicios difíciles esta semana.',
       'HARD_EXERCISES_SOLVED'::"ChallengeType", 'WEEKLY'::"ChallengeCadence", 5, 30, '⛰️', '#dc2626', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Challenge" WHERE id = 'seed-mision-5-dificiles' OR title = 'Misión: 5 difíciles');

