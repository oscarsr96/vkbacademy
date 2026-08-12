/*
  Warnings:

  - The values [TUTOR] on the enum `Role` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `mustChangePassword` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `tutorId` on the `User` table. All the data in the column will be lost.

*/

-- Rescate del contacto familiar. IMPRESCINDIBLE antes del DELETE de más abajo:
-- si se invierte el orden, el email de cada familia se pierde para siempre y no
-- hay migración de vuelta. La columna "guardianEmail" ya existe desde la
-- migración 20260812160919_add_guardian_email; aquí solo se rellena.
-- Los alumnos sin tutor se quedan con "guardianEmail" nulo: es lo esperado.
UPDATE "User" s SET "guardianEmail" = t.email
  FROM "User" t
  WHERE s."tutorId" = t.id AND t.role = 'TUTOR';

-- Ahora sí, eliminar las cuentas con rol TUTOR.
-- Va DESPUÉS del UPDATE de rescate (ver arriba) y ANTES de recrear el enum Role:
-- Postgres no permite eliminar un valor de un enum que siga en uso en alguna fila.
-- Qué arrastra el borrado: las relaciones dependientes de User (UserProgress,
-- QuizAttempt, RefreshToken, Enrollment, UserChallenge, Redemption, ExamAttempt,
-- Certificate, TutorMessage, AcademyMember, TheoryModule, AiExamBank, StudyPlan)
-- son onDelete: Cascade y caen con el usuario. La excepción es User.tutorId, que
-- es ON DELETE SET NULL: los hijos no se borran, solo pierden la referencia — y
-- para entonces su "guardianEmail" ya está a salvo.
-- Datos afectados: PRE tiene 1 tutor con 1 hijo y 2 alumnos sin tutor (volcado en
-- data/exports/tutors-pre-2026-08-12.json); en PROD los tutores son cuentas de
-- prueba, por lo que no se hizo volcado.
DELETE FROM "User" WHERE role = 'TUTOR';

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_tutorId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "User_tutorId_idx";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "tutorId";
ALTER TABLE "User" DROP COLUMN "mustChangePassword";

-- AlterEnum
-- Al final del todo: ya no queda ninguna fila con role = 'TUTOR'.
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('STUDENT', 'ADMIN', 'SUPER_ADMIN');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'STUDENT';
COMMIT;

-- ⚠️ NO AÑADIR SENTENCIAS DESPUÉS DE ESTE COMMIT.
-- Prisma envuelve el fichero completo en una transacción; el COMMIT de arriba
-- (generado por Prisma para el bloque AlterEnum) la cierra. Cualquier sentencia
-- posterior se ejecutaría fuera de esa transacción y no haría rollback si fallara.
-- El bloque AlterEnum debe ser siempre lo último del fichero.
