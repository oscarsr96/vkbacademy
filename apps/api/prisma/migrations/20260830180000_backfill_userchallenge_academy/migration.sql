-- Rellena `UserChallenge.academyId` en las filas que se escribieron a null.
--
-- Por qué existe esta migración: `CLAUDE.md` §14 declara `UserChallenge` como
-- scoped por academia, pero el `create` del upsert de `checkAndAward` nunca
-- pasaba el campo, así que todas las filas históricas quedaron a null y
-- cualquier métrica de gamificación filtrada por academia daba cero en
-- silencio. El código ya escribe la academia (y rellena la fila al pasar por
-- ella), pero un reto permanente ya completado no vuelve a pasar por
-- `checkAndAward` nunca más: sin este backfill su atribución se perdería.
--
-- La fuente es la misma que usa el código: la membresía más antigua del
-- alumno (`AcademyMember` ordenada por `createdAt`), que es también de donde
-- `JwtStrategy` saca el `academyId` del token.
--
-- Solo toca filas con academyId IS NULL, así que es idempotente y no pisa
-- ninguna atribución ya escrita.

UPDATE "UserChallenge" uc
SET "academyId" = m."academyId"
FROM (
  SELECT DISTINCT ON ("userId") "userId", "academyId"
  FROM "AcademyMember"
  ORDER BY "userId", "createdAt" ASC, id ASC
) m
WHERE uc."userId" = m."userId"
  AND uc."academyId" IS NULL;
