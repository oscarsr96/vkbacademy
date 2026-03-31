-- Crear admin para CB Oscar
INSERT INTO "User" ("id", "email", "passwordHash", "role", "name", "createdAt", "updatedAt")
VALUES ('user_admin_cboscar', 'admin@cboscar.com', '$2b$10$fjB7Njky0SiIOwsWg/sGteBo5hUDL8I75bVIqvw8UCy/k3HHAgfqS', 'ADMIN', 'admin-oscar', NOW(), NOW())
ON CONFLICT ("email") DO NOTHING;

-- Asignar a CB Oscar
INSERT INTO "AcademyMember" ("id", "userId", "academyId", "createdAt")
SELECT 'am_admin_cboscar', 'user_admin_cboscar', "id", NOW()
FROM "Academy" WHERE "slug" = 'cb-oscar'
ON CONFLICT ("userId", "academyId") DO NOTHING;
