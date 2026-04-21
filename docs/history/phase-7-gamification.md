# Fase 7 — Gamificación

## Retos

- 7 tipos de reto (`ChallengeType`): LESSON_COMPLETED, MODULE_COMPLETED, COURSE_COMPLETED, QUIZ_SCORE, BOOKING_ATTENDED, STREAK_WEEKLY, TOTAL_HOURS
- Los retos se evalúan de forma asíncrona tras cada evento relevante (sin bloquear HTTP)
- El progreso se guarda en `UserChallenge`; al completarse se incrementa `User.totalPoints`
- La racha semanal (`currentStreak`) se actualiza en cada llamada a `checkAndAward` usando semanas ISO

## Tienda de merchandising

| Artículo                       | Coste    |
| ------------------------------ | -------- |
| 🎨 Pack de stickers VKB        | 100 pts  |
| 💧 Botella termo del club      | 200 pts  |
| 🧢 Gorra oficial VKB           | 350 pts  |
| 👕 Camiseta oficial del club   | 500 pts  |
| 🏀 Balón firmado por el equipo | 1000 pts |

- El canje descuenta puntos en transacción atómica y crea un registro `Redemption`
- Los admins ven todos los canjes en `/admin/redemptions` y pueden marcar cada uno como entregado

## Visibilidad por rol

- `🏆 Retos` en el sidebar: solo STUDENT y TUTOR
- `🎯 Retos` y `🎁 Canjes` en el sidebar: solo ADMIN
