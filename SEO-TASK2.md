# Tarea 2 — SSR y SEO público

Implementado y comprobado sobre el build. **La prueba con inventario real sigue bloqueada por la API**; la evidencia HTML de abajo usa fixtures sintéticas identificadas como tales. No hay commits, push, PR, cambios de idioma, migraciones ni modificaciones de `.env`.

## Renderizado servidor

| Superficie | Contenido precargado | Referencia |
| --- | --- | --- |
| `/agencies` | Directorio paginado con filtros, ciudades; tarjetas y nombres en HTML | `src/app/agencies/page.tsx:32`, HydrationBoundary `:50` |
| `/agencies/[slug]` | Perfil real, página de carros filtrada y primera página de reviews | `src/app/agencies/[slug]/page.tsx:38`, HydrationBoundary `:68` |
| `/agencies/[slug]/cars/[carId]` | Ficha real y reviews de su agencia; metadata y SSR reutilizan la consulta de carro | `src/app/agencies/[slug]/cars/[carId]/page.tsx:42`, HydrationBoundary `:67` |
| `/cars/[city]` con fechas | Resultados de disponibilidad con los mismos filtros/query keys del cliente; fetch sin caché persistente de disponibilidad | `src/app/cars/[city]/page.tsx:37`; `src/shared/seo/prefetch.ts:51` |
| `/cars/[city]` sin fechas | Nombre real desde `/geo/cities`, copy, enlaces a agencias de esa ciudad; nunca se consulta `/cars/search` sin fechas | `src/app/cars/[city]/page.tsx:42` y sección tras HydrationBoundary `:69` |

Se crea un QueryClient por petición y se entrega `dehydrate(client)` a HydrationBoundary. Las consultas imprescindibles usan `fetchQuery`, de modo que un fallo de API no se oculta como un SSR exitoso vacío. Ciudades de filtros y reviews son complementarias. Los parámetros de vehículos se extraen a `src/features/cars/request-params.ts`, usado tanto por Axios cliente como por fetch servidor, evitando divergencias de filtros o conversiones de centavos.

`generateMetadata` usa nombres reales de agencia, marca/modelo/año/ciudad y tarifa diaria base; `React.cache` comparte las consultas con el render. Se conservan canonical, OG y Twitter. La disponibilidad por fechas no usa la caché de cinco minutos del catálogo. No se modificó el patrón de URLs.

## Reviews y structured data

Se siguió la corrección de la **Tarea 2 consolidada**, que declara reemplazar instrucciones encoladas y cuya afirmación sobre el módulo de reviews fue verificada en el backend. El mensaje posterior repetía la instrucción antigua de omitir ratings; se señaló la contradicción y se solicitó aclaración, sin respuesta durante la implementación.

- El backend sí tiene reviews públicas de **agencia**, no un agregado por vehículo: `src/modules/reviews/reviews.controller.ts:62`; `reviews.service.ts` mantiene contadores transaccionales.
- `src/shared/seo/structured-data.tsx:57`: nodo AutoRental que representa el perfil público de alquiler. Emite AggregateRating solo si `reviewCount > 0` y el promedio publicado está entre 1 y 5.
- `ratingAvg` ya viene calculado por el backend como `round((ratingSum / reviewCount) * 10) / 10` (`src/common/serializers/agency.serializer.ts:194`). **La API no publica `ratingSum`**: se usa su promedio real redondeado y su contador real. No se promedia una página ni se reconstruye una suma ficticia.
- Review individual para las primeras tres reviews con texto dentro de las tres visibles inicialmente; autor anonimizado y fecha de la API. La serialización escapa `<` para impedir cierres de script.
- Perfil: `AgencyJsonLd`, `src/shared/seo/structured-data.tsx:104`.
- Detalle: `VehicleJsonLd`, `src/shared/seo/structured-data.tsx:121`, con rating/reviews en `offers.seller`. **No se adjudica el rating de la agencia al Vehicle**. Se muestra también una sección visible “Reviews of [agencia]”, que explica que son opiniones de alquileres en su flota.
- Contador cero: ningún bloque AggregateRating ni Review. No hay valores de relleno.
- AutoRental describe el perfil de alquiler, incluyendo propietarios individuales, no la identidad privada del dueño. Person no admite la propiedad aggregateRating en Schema.org.

## Sitemap y visibilidad

- `src/app/sitemap.ts:60`: catch **dentro** de la función cacheada; conserva rutas estáticas y páginas completadas antes de un fallo. Se detiene en el primer error, incluido 429, sin continuar disparando consultas ni reintentar.
- `src/shared/seo/public-api.ts:55`: paginación con callback por página para conservar progreso anterior a una excepción.
- `src/app/sitemap.ts:74`: el resultado completo **o parcial** se cachea 300 segundos. Cambió respecto de Tarea 1, que fallaba ante errores y usaba 3600 s.
- Se recorren las páginas de `/agencies` y de `/agencies/:slug/cars`; se consulta el perfil una vez por agencia para cruzar IDs de sucursales activas. **No hay una petición de detalle por carro**.
- Solo carros activos de agencias verificadas y sucursales activas. No se inventan `lastModified` ni disponibilidad.
- Protección de formato a 50.000 URLs, con warning y sitemap parcial válido si se supera; antes de ese volumen hay que partirlo en varios archivos.
- `robots.ts` sigue permitiendo las superficies incluidas; `/agency` privado no bloquea `/agencies` público.

Enum comprobado en `backend/src/modules/fleet/entities/car.entity.ts:58`: **draft | active | paused**, sin maintenance. Se conserva el criterio active-only aprobado en el punto B (`src/shared/seo/public-api.ts:24`). **Paused también produce notFound y desaparece del sitemap**; por tanto, una URL indexada puede perder indexación al pausarse. Si la pausa debe preservar posicionamiento, hace falta acordar una página de indisponibilidad sin Offer y sin reserva, distinta de la política de despublicación aplicada aquí.

## Imágenes

La causa original de `unoptimized` era `remotePatterns: []`. El backend sirve fotos públicas e inmutables, sin autenticación, en `/api/cars/photos/:photoId`; no requiere reenviar cookies al optimizador.

- `next.config.ts:22`: allowlist limitada a protocolo/host/puerto de `NEXT_PUBLIC_API_URL`, prefijo API y `/cars/photos/*`, sin query strings. No se permiten documentos privados ni hosts arbitrarios.
- `src/features/cars/photos.ts:28`: distingue esas fotos de las URLs externas legacy.
- Tarjetas y galería optimizan las fotos del stream público, mantienen `sizes` y `priority` en la principal. Las URLs externas antiguas mantienen carga directa hasta conocer y autorizar su proveedor. Logos de agencias no se ampliaron a una allowlist genérica.
- La prueba HTTP del optimizador devolvió imagen válida y la ficha emitió `srcSet` y `/_next/image`.

## Evidencia y gates

Node 22.11.0, Next 15.5.22. Último build: compilación **14,1 s**, **51/51 páginas**, exit **0**. Se usó `NEXT_PUBLIC_STRIPE_ALLOW_TEST_KEY=true` exclusivamente en el proceso, sin alterar `.env` ni el guard de producción.

| Gate | Resultado |
| --- | --- |
| `npm run build` | exit 0; 51/51 |
| `npx tsc --noEmit` | exit 0; 0 errores |
| `npm run lint` | exit 0; 0 errores, 0 warnings |
| `npm run lint:suppressions` | exit 0; 218 archivos; 0 supresiones |
| `node scripts/seo-smoke.mjs` | exit 0; **34 comprobaciones** |
| `git diff --check` | exit 0; avisos del entorno sobre LF/CRLF |

La prueba `scripts/seo-smoke.mjs` copia el build a un directorio temporal, sin su caché, y levanta Next producción con un fetch interceptado únicamente en ese proceso. Los datos sintéticos no entran en el bundle ni en la caché del build real. `scripts/seo-fixture-fetch.cjs` es un preload exclusivo de pruebas. Todos los procesos de prueba se detienen al terminar.

Fragmentos obtenidos por HTTP del build aislado; **NO son nombres de inventario real**:

```html
<h1 class="font-display text-3xl text-foreground md:text-4xl">Toyota<!-- --> <!-- -->Corolla<!-- --> <!-- -->2024</h1>
<h1 class="font-display text-3xl text-foreground">SEO Fixture Agency</h1>
```

Las comprobaciones eliminan scripts antes de buscar nombres para evitar confundir datos de hidratación/JSON-LD con contenido visible. Cubren las cuatro superficies, parámetros y centavos, una sola consulta de carro entre metadata/render, reviews escapadas, cero reviews, paused sin Offer, imágenes optimizadas y paginación del sitemap. Sitemap completo de fixtures: **12 URLs**; 429 en segunda página: **10 URLs** conservadas; segunda solicitud: **0 llamadas API nuevas**.

Verificación **con entorno real sin interceptación**:

```text
curl http://localhost:4300/api/agencies?sort=name
curl: (7) Failed to connect ... HTTP 000

GET http://127.0.0.1:3105/sitemap.xml
HTTP 200; 7 URLs; primera respuesta 156 ms; respuesta cacheada 15 ms; cuerpo idéntico

GET http://127.0.0.1:3105/agencies (Twitterbot)
HTTP 500 — API inaccesible
```

Por tanto, **NO se declara aprobada la exigencia de un fragmento HTML con inventario real**. El lead diagnosticó al intentar arrancar backend que la base compartida está atrasada (`agency.kind` ausente); no se migró ni modificó esa base. Hace falta una API compatible operativa para cerrar esa verificación.

## Dependencias entregadas al backend

1. **Bloqueante de validación:** API operativa con esquema compatible y datos reales. Repetir curl de directorio, perfil, detalle y ciudad tras resolverlo.
2. **Catálogo por ciudad sin fechas inexistente:** `GET /cars/search` utiliza `SearchCarsDto.start` y `.end` obligatorios (`backend/src/modules/fleet/dto/search-cars.dto.ts:35` y `:38`); el catálogo sin fechas existente está limitado por agencia. Firma propuesta, **no implementada ni consumida**:

   ```ts
   GET /cars/catalog?city=<slug>&page=<int>&pageSize=<int>
     &make=<slug>&model=<slug>&yearMin=<int>&yearMax=<int>
     &color=<enum>&category=<enum>&transmission=<enum>
     &priceMinCents=<int>&priceMaxCents=<int>
   // Promise<Paginated<Car>> = { items: Car[], total, page, pageSize }
   // Sin start/end; city opcional para todas las ciudades.
   // active car + active branch + verified agency; orden estable con desempate por ID.
   // Es catálogo publicado, NO una afirmación de disponibilidad para fechas.
   ```

3. **Visibilidad:** unificar catálogo y detalle en backend; se mantiene el cruce defensivo de sucursales activas en SEO/sitemap. No es parte de esta tarea modificar backend.
4. **Promedio exacto, si se requiere sin redondeo:** exponer `ratingSum: number` en AgencyPublicProfileDto o un `ratingAvg` sin redondear. Actualmente se usa el promedio real publicado a un decimal, coherente con la UI.
5. **Semántica de paused:** confirmar si despublica o representa indisponibilidad temporal que debe conservar la URL indexable. La implementación actual mantiene la política active-only aprobada.

Referencias: [SSR avanzado de TanStack Query](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr), [next/image en Next 15](https://nextjs.org/docs/15/app/api-reference/components/image), [dominios de aggregateRating](https://schema.org/aggregateRating).
