# Cibaura — Web

Marketplace de alquiler de carros en República Dominicana, con marca provisional.
Next.js 15 App Router, React 19, TypeScript, TanStack Query y Tailwind CSS 4.

- Clientes: catálogo, reservas, pagos, inspecciones y respuesta a reclamaciones.
- Agencias y hosts individuales: flota, calendario, reservas, sucursales, zonas y wallet; personal según tipo de host y permisos.
- Administración: órdenes, reclamaciones, verificaciones, pagos y configuración.

Repositorios relacionados: [API NestJS](https://github.com/angelrepublic24/cibaura-server) y [app Expo](https://github.com/angelrepublic24/cibaura-app).

## Desarrollo local

Usar Node 22.13 o superior dentro de 22.x (`.nvmrc`, `package.json`) y el backend en marcha. Su repositorio documenta base de datos, migraciones y usuarios de prueba.

```sh
npm ci
cp .env.example .env.local
```

En PowerShell, usar `Copy-Item .env.example .env.local`. Reemplazar los placeholders de URL en `.env.local`:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:4300
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

```sh
npm run dev
```

Abrir `http://localhost:3000`. El cliente añade `/api` a la URL del backend si falta. Configurar el CORS del backend para ese origen exacto. Búsqueda y catálogo SSR requieren API accesible desde el navegador **y desde Next**.

Para probar tarjetas/reservas, añadir la clave pública Stripe de pruebas correspondiente al backend. Sin ella, desarrollo muestra pagos no configurados. Maps habilita direcciones de entrega; el DSN de Sentry habilita reporte de errores. Sin DSN, desarrollo advierte que no reportará errores. No copiar claves secretas al bundle ni guardar tokens Sentry en archivos de entorno.

## Configuración y operación

[WEB-DEPLOY.md](WEB-DEPLOY.md) es el runbook de variables, Hostinger VPS, Docker/Compose, TLS, staging, release y diagnóstico. [.env.example](.env.example) es la plantilla, sin valores de producción.

`NEXT_PUBLIC_SITE_URL` y `NEXT_PUBLIC_API_URL` son obligatorias en producción, sin defaults productivos. Deben ser HTTPS y compartir dominio registrable por las cookies `SameSite=Lax`. El guard rechaza destinos locales/de ejemplo. Todas las `NEXT_PUBLIC_*` se incrustan al compilar: cambiarlas exige reconstruir. Variables privadas de build/runtime se enumeran por separado en el runbook.

Los releases requieren identidad legal, Maps, SHA real de Git, Stripe live y Sentry con credenciales de subida de sourcemaps. Las excepciones explícitas de staging están en el runbook; no hay bypass para publicar destinos de ejemplo. `/health` informa configuración incrustada sin secretos y sonda al API; no certifica pagos ni entrega de eventos.

Sentry captura errores de navegador, límites React y SSR. `error.tsx` y `global-error.tsx` muestran mensajes humanos. Los mapas de cliente se eliminan tras subirlos. Motivos: [DECISIONS.md](DECISIONS.md).

## Superficies y renderizado

| Rutas | Audiencia y comportamiento |
|---|---|
| `/` | Pública: buscador país → ciudad → fechas; destinos del API en cliente. |
| `/agencies` | Pública: directorio precargado en servidor e hidratación TanStack Query. |
| `/agencies/[slug]` | Pública: perfil, flota y reviews de agencia/host, con precarga e hidratación. |
| `/agencies/[slug]/cars/[carId]` | Pública: ficha y reviews de su agencia, con precarga e hidratación. |
| `/cars/[city]` | Pública: disponibilidad SSR con fechas; sin fechas, catálogo publicado SSR y enlaces a agencias, sin afirmar disponibilidad. `all` representa todas las ciudades. |
| `/become-host`, `/become-agency` | Captación pública; incorporación depende de sesión. |
| `/legal/terms`, `/legal/privacy` | Texto servidor; versión/política dinámica consultadas en cliente. |
| `/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password`, `/admin/accept-invite` | Acceso público, `noindex`; invitación admin es excepción al área privada. |
| `/account/*` | Cliente autenticado: perfil, favoritos, verificación, tarjetas y reservas. |
| `/agency/*` | Dashboard del host/personal con permisos y restricciones de sucursal. |
| `/admin/*` | Administración protegida; `/admin/bookings/[[...slug]]` redirige a órdenes. |

Las cuatro superficies de catálogo usan Server Components y `HydrationBoundary`; los componentes cliente mantienen filtros y acciones. Metadata usa datos públicos del API, canonical, OG y Twitter. Robots, sitemap y JSON-LD se generan en servidor. El SSR depende de la API: un fallo de contenido imprescindible no se presenta como inventario vacío exitoso.

Los guards y filtros visuales no sustituyen autorización del backend. Ocultar Staff al host individual tampoco constituye una barrera del servidor.

| Detalle de reserva | Datos y acciones |
|---|---|
| `/account/bookings/[id]` | Depósito, inspecciones, liquidación, contrato y reclamación; respuesta según `respondBy`. Cotización de cancelación solo cuando el API la incluye para el dueño. |
| `/agency/requests/[bookingId]` | Inspecciones, depósito, reclamación y liquidación; operaciones según permisos. Sin formulario de respuesta del cliente. |
| `/admin/orders/[id]` | Desglose y ciclo de vida; enlace a la reclamación administrativa para decidir. |

El espejo de tipos está en `src/shared/types/domain.ts`; el backend es dueño del contrato HTTP. Importes desde sus snapshots, sin recalcular un total de reserva.

## Verificación

```sh
npm run typecheck
npm run lint
npm run lint:suppressions
npm run build:ci
npm run smoke
node scripts/standalone-smoke.mjs
```

Smoke requiere que build:ci haya terminado: utiliza `.next-ci/standalone`. CI valida además Caddy. El build CI es no productivo y usa fixtures; no acredita inventario, cobros ni credenciales reales. Producción: `npm run build` con valores del runbook. CI está en `.github/workflows/ci.yml`; publicación de imágenes, en `production-image.yml`.

## Organización y mantenimiento

`src/app`: rutas; `src/features`: API, hooks y componentes por función; `src/shared`: tipos, UI, auth y SEO; `src/lib`: guards y monitoring. Tokens de diseño en `src/app/globals.css`; assets en `public/brand`.

Actualizar esta guía al cambiar superficies/requisitos locales, el runbook junto con variables/workflows y las decisiones junto con sus reglas/pruebas. Resultados puntuales de gates y entregas pertenecen al PR, no a informes permanentes.
