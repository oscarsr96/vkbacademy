-- AlterTable: añade username y mustChangePassword, y hace email opcional.
-- El DROP de viewablePassword se hace al final, tras el backfill.
ALTER TABLE "User" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "username" TEXT,
ALTER COLUMN "email" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- Backfill: los alumnos existentes adoptan como username el local-part de su email falso
-- (ya es un slug único) y quedan obligados a cambiar la contraseña.
UPDATE "User"
SET "username" = split_part("email", '@', 1),
    "mustChangePassword" = true
WHERE "role" = 'STUDENT' AND "email" IS NOT NULL;

-- Los alumnos dejan de tener email (su login es el username)
UPDATE "User"
SET "email" = NULL
WHERE "role" = 'STUDENT' AND "email" LIKE '%@vkbacademy.com';

-- AlterTable: elimina viewablePassword tras el backfill.
ALTER TABLE "User" DROP COLUMN "viewablePassword";
