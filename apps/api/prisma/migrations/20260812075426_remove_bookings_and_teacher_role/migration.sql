/*
  Warnings:

  - The values [TEACHER] on the enum `Role` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the `AvailabilitySlot` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Booking` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TeacherProfile` table. If the table is not empty, all the data it contains will be lost.

*/

-- DropForeignKey
ALTER TABLE "AvailabilitySlot" DROP CONSTRAINT "AvailabilitySlot_teacherId_fkey";

-- DropForeignKey
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_academyId_fkey";

-- DropForeignKey
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_courseId_fkey";

-- DropForeignKey
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_studentId_fkey";

-- DropForeignKey
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_teacherId_fkey";

-- DropForeignKey
ALTER TABLE "TeacherProfile" DROP CONSTRAINT "TeacherProfile_userId_fkey";

-- DropTable
-- Orden hijo → padre: Booking y AvailabilitySlot referencian a TeacherProfile.
DROP TABLE "Booking";

-- DropTable
DROP TABLE "AvailabilitySlot";

-- DropTable
DROP TABLE "TeacherProfile";

-- DropEnum
-- Los enums quedan huérfanos solo después de borrar la tabla Booking.
DROP TYPE "BookingMode";

-- DropEnum
DROP TYPE "BookingStatus";

-- Elimina los usuarios con rol TEACHER.
-- Va DESPUÉS de los DROP TABLE a propósito: Booking.studentId y Booking.teacherId
-- eran ON DELETE RESTRICT, así que borrar un TEACHER con reservas asociadas habría
-- abortado la migración entera. Con la tabla Booking ya eliminada esa clase de
-- fallo no existe, y el resultado final es el mismo.
-- Va ANTES de recrear el enum Role: Postgres no permite eliminar un valor de un
-- enum que siga en uso en alguna fila.
-- Qué arrastra el borrado: las relaciones dependientes de User (UserProgress,
-- QuizAttempt, RefreshToken, Enrollment, UserChallenge, Redemption, ExamAttempt,
-- Certificate, TutorMessage, AcademyMember, TheoryModule, AiExamBank, StudyPlan)
-- son onDelete: Cascade y caen con el usuario. La excepción es User.tutorId, que
-- es SET NULL: unos alumnos que tuvieran a un TEACHER como tutor quedarían sin
-- tutor en lugar de borrarse — no ocurre, porque los tutores son rol TUTOR.
-- Datos afectados: se verificó que PRE y PROD tienen 0 reservas y que el único
-- usuario con rol TEACHER en ambos entornos es teacher@vkbacademy.com, la cuenta
-- de demo que crea el seed. El volcado previo de PRE está en
-- data/exports/legacy-pre-2026-08-12.json; no se hizo volcado de PROD porque no
-- había datos reales que preservar.
DELETE FROM "User" WHERE role = 'TEACHER';

-- AlterEnum
-- Al final del todo: ya no queda ninguna fila con role = 'TEACHER'.
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('STUDENT', 'TUTOR', 'ADMIN', 'SUPER_ADMIN');
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
