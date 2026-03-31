-- Seed: crear academias por defecto
INSERT INTO "Academy" ("id", "slug", "name", "logoUrl", "primaryColor", "isActive", "createdAt", "updatedAt")
VALUES
  ('acad_vallekas', 'vallekas-basket', 'Vallekas Basket Academy', 'https://vallekasbasket.com/wp-content/uploads/2022/04/logotipo-vallekas-basket.png', '#ea580c', true, NOW(), NOW()),
  ('acad_cboscar', 'cb-oscar', 'CB Oscar Academy', NULL, '#3b82f6', true, NOW(), NOW())
ON CONFLICT ("slug") DO NOTHING;

-- Seed: crear SUPER_ADMIN si no existe
INSERT INTO "User" ("id", "email", "passwordHash", "role", "name", "createdAt", "updatedAt")
VALUES
  ('user_superadmin', 'superadmin@vkbacademy.com', '$2b$10$HCmhiCHo66FSXNRttHvCSecrMSo4dFB5nZUD7I7orOuKzKnILHvta', 'SUPER_ADMIN', 'super-admin', NOW(), NOW())
ON CONFLICT ("email") DO UPDATE SET "role" = 'SUPER_ADMIN';

-- Asignar los admins existentes a Vallekas Basket (si existen y no están ya asignados)
INSERT INTO "AcademyMember" ("id", "userId", "academyId", "createdAt")
SELECT
  'am_' || "id",
  "id",
  'acad_vallekas',
  NOW()
FROM "User"
WHERE "role" IN ('ADMIN', 'STUDENT', 'TUTOR')
  AND "id" NOT IN (SELECT "userId" FROM "AcademyMember")
ON CONFLICT ("userId", "academyId") DO NOTHING;
