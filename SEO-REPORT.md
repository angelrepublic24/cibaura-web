# SEO público — 24 septiembre 2026

> Histórico de Tarea 1. El estado posterior de SSR, ratings y fallback de sitemap está en [SEO-TASK2.md](SEO-TASK2.md); ese informe sustituye los pendientes y las decisiones de implementación de este documento.

Alcance: Fases A y B de Tarea 1. Sin i18n, traducciones, cambios de URLs, conversión SSR del contenido, commits, push ni PR. Inventario comunicado antes de escribir código y enviado a Claude lead en `w3:p1` mediante Herdr.

## Fase A: inventario previo a los cambios

Las referencias de esta tabla corresponden al código original inspeccionado. SC = Server Component; CC = componente con `"use client"`. Un CC puede prerenderizar texto estático; lo que falta aquí es la precarga de sus consultas, no simplemente la directiva.

| Ruta pública | Archivo y tipo original | Obtención de datos / HTML sin ejecutar JavaScript |
| --- | --- | --- |
| `/` | `src/app/page.tsx:4`, SC | Texto comercial y buscador renderizados; ciudades con Query en `src/features/cars/components/hero-search.tsx:33`. |
| `/cars/[city]` | `src/app/cars/[city]/page.tsx:20`, SC → CC | Query en `src/features/cars/components/car-search-results.tsx:45`; encabezado/filtros, sin carros. Sin fechas no consulta. |
| `/agencies` | `src/app/agencies/page.tsx:20`, SC → CC | Query en `src/features/agencies/components/agency-directory.tsx:47`; encabezado/filtros, sin agencias. |
| `/agencies/[slug]` | `src/app/agencies/[slug]/page.tsx:23`, SC → CC | Query en `src/features/agencies/components/agency-profile.tsx:54`; `Loading agency` en `:76`. Agencias y hosts individuales comparten esta ruta. |
| `/agencies/[slug]/cars/[carId]` | `src/app/agencies/[slug]/cars/[carId]/page.tsx:15`, SC → CC | Query en `src/features/cars/components/car-detail.tsx:94`; `Loading car` en `:112`. |
| `/become-host` | `src/app/become-host/page.tsx:1`, CC | Propuesta comercial prerenderizada en `:207`; sesión/onboarding en cliente. |
| `/become-agency` | `src/app/become-agency/page.tsx:1`, CC | Propuesta comercial prerenderizada en `:228`; sesión/solicitud en cliente. |
| `/legal/privacy` | `src/app/legal/privacy/page.tsx:39`, SC | Texto local renderizado; versión legal consultada en cliente con fallback local. |
| `/legal/terms` | `src/app/legal/terms/page.tsx:41`, SC | Texto local renderizado; cifras de cancelación dependen de Query a `/legal/current`. |
| `/auth/login` | `src/app/auth/login/page.tsx:11`, SC | Formulario CC prerenderizado; sin consulta de catálogo. |
| `/auth/register` | `src/app/auth/register/page.tsx:7`, SC | Formulario CC; términos actuales consultados en cliente. |
| `/auth/forgot-password` | `src/app/auth/forgot-password/page.tsx:7`, SC | Formulario CC prerenderizado. |
| `/auth/reset-password` | `src/app/auth/reset-password/page.tsx:17`, SC | Token leído en servidor; formulario CC. |
| `/admin/accept-invite` | `src/app/admin/accept-invite/page.tsx:18`, SC | Excepción pública del layout admin; token y formulario CC. |

No hay una ruta pública de perfil de host separada. Los demás descendientes de `/account`, `/agency` y `/admin` están protegidos por guards cliente. Los guards no son autorización de backend ni middleware de rastreo.

### Metadata y configuración originales

- `src/app/layout.tsx:20`: metadataBase `https://cibaura.com`, título por defecto, template `%s · Cibaura`, descripción, OG y Twitter con `/brand/og.png`.
- `generateMetadata` solo en ciudad (`src/app/cars/[city]/page.tsx:15`) y agencia (`src/app/agencies/[slug]/page.tsx:17`): títulos derivados del slug, sin datos reales de API.
- Metadata estática parcial en directorio, páginas legales, auth e invitación admin. Detalle de carro y captación heredaban la metadata genérica.
- No se encontraron canonical, `robots.ts`/`robots.txt`, `sitemap.ts`/`sitemap.xml`, `application/ld+json` ni `schema.org`.
- `next.config.ts:13`: solo configuración de imágenes, `remotePatterns: []`. Sin rewrites, redirects ni headers; no hay middleware/proxy. Esto no audita las reglas del CDN o del hosting.
- `next/image` con `unoptimized`: `src/features/cars/components/car-card.tsx:39`, `car-detail.tsx:239` y `:267`; `src/features/agencies/components/agency-profile.tsx:218`, `agency-public-card.tsx:24`; `src/shared/components/logo.tsx:32`.
- Único `<img>` crudo en esas superficies: decoración de home, `src/app/page.tsx:19`. Los demás encontrados pertenecen a áreas privadas.
- Fuentes Geist y Geist Mono mediante `next/font/google`: `src/app/layout.tsx:3`, configuración en `:10` y `:15`.

## Fase B: implementación

Referencias siguientes: código resultante de esta tarea.

| Cambio | Referencia |
| --- | --- |
| Origen compartido, canonical absoluto, description, OG y Twitter | `src/shared/seo/metadata.ts:4`, `:13`; metadataBase en `src/app/layout.tsx:22`, template existente conservado |
| Home | `src/app/page.tsx:6` |
| Directorio | `src/app/agencies/page.tsx:13` |
| Agencia: nombre/descripcion reales | `src/app/agencies/[slug]/page.tsx:20` |
| Carro: nombre, ciudad, canonical de su agencia, foto real para OG/Twitter | `src/app/agencies/[slug]/cars/[carId]/page.tsx:19` |
| Ciudad: nombre validado contra catálogo real `/geo/cities` | `src/app/cars/[city]/page.tsx:18` |
| Captación: metadata desde layouts servidor, sin mover el contenido cliente | `src/app/become-host/layout.tsx:3`, `src/app/become-agency/layout.tsx:3` |
| Legal | `src/app/legal/privacy/page.tsx:8`, `src/app/legal/terms/page.tsx:9` |
| Auth e invitación: metadata completa y noindex, sin tokens en canonical | `src/app/auth/login/page.tsx:10`, `register/page.tsx:6`, `forgot-password/page.tsx:6`, `reset-password/page.tsx:10`; `src/app/admin/accept-invite/page.tsx:10` |
| robots: permite público, excluye zonas privadas sin bloquear `/agencies` | `src/app/robots.ts:4` |
| Sitemap completo paginado, rutas estáticas, ciudades, agencias y carros publicados | `src/app/sitemap.ts:10` |
| Fetch público servidor sin cookies, caché 300 s, timeout 10 s | `src/shared/seo/public-api.ts:9` |
| Visibilidad de carro y referencias reales; desconocidos no indexables | `src/shared/seo/public-api.ts:20`, `:31`, `:37` |
| JSON-LD escapado contra cierre de script | `src/shared/seo/structured-data.tsx:8` |
| Organization en home; BreadcrumbList en directorio, ciudad, agencia, carro y legal | `src/shared/seo/structured-data.tsx:14`, `:25` |
| Vehicle + Offer de alquiler, tarifa diaria base real en USD, sin inventar disponibilidad | `src/shared/seo/structured-data.tsx:35` |
| AggregateRating preparado y comentado | `src/shared/seo/structured-data.tsx:73` |

La imagen social del carro se selecciona de sus fotos reales; no se genera una imagen ficticia. Sin fotos se usa la imagen de marca solo en metadata social; no se presenta como foto del vehículo en JSON-LD. La moneda USD coincide con el contrato y la UI existentes (`src/shared/utils/money.ts:11`). La oferta especifica unidad diaria y aclara que las comisiones se calculan al reservar; no es una cotización final.

El sitemap se genera en runtime (`connection()`), guarda el resultado completo durante 3600 s con `unstable_cache`, recorre todas las páginas y deduplica URLs. No inventa `lastModified`. Si falla la API, no devuelve un sitemap aparentemente correcto que omita todos los carros; conserva la última entrada válida de caché cuando existe. Primer acceso sin API: error. Límite explícito 50.000 URLs: dividir antes de superarlo.

## Dependencias y limitaciones

1. Endpoints existentes confirmados en el repo backend: `GET /agencies` (`src/modules/agencies/agencies.controller.ts:219`), `/agencies/:slug` (`:254`), `/agencies/:slug/cars` (`:269`), `/agencies/available-cities` (`:246`), `/cars/:carId` (`src/modules/fleet/fleet.controller.ts:78`), `/geo/cities` (`src/modules/geo/geo.controller.ts:24`). No se inventó ningún endpoint.
2. `/cars/search` requiere fechas (`src/modules/fleet/dto/search-cars.dto.ts:35`); no sirve para enumerar todo el inventario. El sitemap utiliza el catálogo de cada agencia, sin fechas.
3. En el backend auditado, `listActiveAgencyCars` no filtra sucursales inactivas (`src/modules/agencies/agencies.service.ts:865`). El detalle `findCarDetailOrFail` y `isPubliclyVisible` verifican la agencia, sin exigir carro activo/sucursal activa (`src/modules/fleet/fleet.service.ts:209`). La protección SEO cruza `status=active` con los IDs de sucursales activas del perfil público. El backend debe unificar estos criterios; reportado al lead.
4. La API configurada no acepta conexión durante la verificación, incluso fuera del sandbox. No se pudo comprobar sitemap completo, títulos de entidades, imágenes OG ni Vehicle/Offer con inventario real en vivo. Sí se verificaron los contratos fuente, tipos, build y HTML de las rutas sin dependencia de API.
5. La paginación del directorio debería añadir un desempate por ID para agencias con el mismo nombre; una futura exportación SEO dedicada reduciría peticiones al crecer el inventario. No es necesaria para la integración actual.
6. AggregateRating queda comentado por instrucción expresa de esta tarea. El lead comunicó posteriormente que hay un módulo de reviews y prepara otra tarea; no se reutilizan ratings de agencia como si fueran del carro.
7. El origen conserva `https://cibaura.com`, ya configurado en el proyecto. El despliegue debe confirmar ese dominio y configurar la URL pública de API y fotografías accesibles por crawlers.

## Contenido pendiente de SSR

Siguen ausentes del HTML inicial los resultados de `/cars/[city]`, las tarjetas de `/agencies`, el perfil/flota de `/agencies/[slug]` y la ficha visible de `/agencies/[slug]/cars/[carId]`. Ahora estas páginas pueden entregar metadata y JSON-LD servidor, pero no se precargó el contenido de sus componentes cliente. Un crawler que ejecute JavaScript puede llegar a cargarlo; no es correcto declarar toda la página invisible para todos los crawlers.

Propuesta para la tarea siguiente: fetch público servidor y precarga de las mismas query keys en un QueryClient por petición, entregado mediante `dehydrate`/`HydrationBoundary`. En búsqueda, precargar únicamente con fechas válidas; definir por separado la experiencia sin fechas, sin inventar disponibilidad. Mantener formularios y filtros interactivos en cliente. En legal, las cifras dinámicas de cancelación también siguen pendientes de precarga.

## Verificación

- Node `22.11.0`, Next `15.5.22`.
- `npm run build`: exit 0, **51/51** páginas generadas. Se usa `NEXT_PUBLIC_STRIPE_ALLOW_TEST_KEY=true` solo en el proceso porque `.env` contiene una clave de prueba; es la misma política de staging del CI. Primer intento sin esa bandera: exit 1 por el guard existente de Stripe. No se modificó `.env` ni se debilitó el guard.
- `npx tsc --noEmit`: exit 0, **0 errores**.
- `npm run lint`: exit 0, **0 errores, 0 advertencias**.
- `npm run lint:suppressions`: exit 0, **216 archivos**, sin directivas ni desactivaciones prohibidas.
- HTTP de build local con User-Agent Googlebot: **12/12** rutas devuelven 200 y canonical/description/OG/Twitter. Incluye home, directorio, `/cars/all`, captación, legal, cuatro auth e invitación. `robots.txt` y JSON-LD Organization de home comprobados.
- `git diff --check`: exit 0; solo avisos de conversión LF/CRLF del entorno.
- Cambios concurrentes ajenos encontrados en solicitudes de agencia, componentes de identidad/contratos y `src/shared/types/domain.ts`; preservados. Se repitió el build después de su aparición.

Referencia de implementación: [Next.js 15 connection](https://nextjs.org/docs/15/app/api-reference/functions/connection), [sitemap](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap), [Schema.org UnitPriceSpecification](https://schema.org/UnitPriceSpecification).
