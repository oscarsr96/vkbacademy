# Fase 8.6 — Páginas de marketing

## Rutas públicas (sin autenticación)

| Ruta        | Página        | Descripción                                       |
| ----------- | ------------- | ------------------------------------------------- |
| `/`         | `LandingPage` | Home dirigida a padres/tutores de Vallekas Basket |
| `/nosotros` | `AboutPage`   | Historia del club, equipo fundador, valores       |
| `/precios`  | `PricingPage` | 15 EUR/alumno/mes con FAQ y merchandising         |

## Layout público (`PublicLayout`)

Navbar sticky (`#0d1b2a`, 64px): logo + links (Inicio / Sobre nosotros / Precios) + botón "Acceder" naranja → `/login`. Footer con copyright.

## Enfoque de audiencia

Todas las páginas de marketing están dirigidas a **padres y tutores de Vallekas Basket**, no a otros clubes. El pitch es: _"La formación del club, accesible para tu hijo/a desde casa"_.

## Merchandising en las 3 páginas

Sección "El esfuerzo tiene premio" con los 5 artículos del club y sus costes en puntos, presente en Landing, Sobre nosotros y Precios.

## Enrutamiento

- `/` con usuario autenticado → redirige a `/dashboard`
- El dashboard (antes en `/`) ahora está en `/dashboard`
- `PublicOnlyRoute` redirige a `/dashboard` si ya está autenticado
