# Despliegue del web Cibaura

## Ruta construida

Next genera `output: "standalone"`. El Dockerfile instala con `npm ci`, compila
con valores públicos explícitos y copia únicamente standalone, `.next/static`,
`public` y el healthcheck a la imagen final. Usa Node 22 Debian slim fijado por
digest y usuario `node` (no root). Sharp está declarado como dependencia directa.
`.dockerignore` excluye `.env*`, node_modules, builds previos y git.

`compose.yml` ejecuta el web en loopback del host para usarlo detrás de un ingress.
`compose.production.yml` añade Caddy con HTTPS y renovación automática de certificados,
sin tener que escribir una configuración de proxy. Su Caddyfile usa el origen del sitio
y el puerto de las variables. Certificados se conservan en volúmenes Docker.

Requisitos de infraestructura: host Linux con Docker Engine y Compose v2, DNS del
sitio apuntando al host, puertos 80/443 accesibles para Caddy, y API pública operativa
con HTTPS. El repo no compra dominios ni provisiona un servidor. Sitio y API deben
compartir dominio registrable por las cookies SameSite=Lax; el backend debe configurar
su FRONTEND_URL/API_PUBLIC_URL/CORS con esos mismos orígenes. No usar dominios distintos
de Vercel/Render esperando que cambiar una variable habilite cookies entre sitios.

## Variables públicas: todas son de BUILD

Inventario completo de lecturas ejecutables `process.env` de `src`, tras este cambio.
Todas las `NEXT_PUBLIC_*` se incrustan al compilar; cambiar `docker run -e` después
**no modifica** API, SEO, medios, Stripe, Maps o identidad legal. Hay que reconstruir
la imagen por entorno. No pasar claves secretas de Stripe ni credenciales de backend.

| Variable                           | Referencia                             | Obligatoria en producción                         | Comportamiento / .env.example                                                                                            |
| ---------------------------------- | -------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| NEXT_PUBLIC_API_URL | src/lib/config.ts:24 | Si | HTTPS, mismo dominio registrable que SITE_URL. Sin default en production. Documentada. |
| NEXT_PUBLIC_SITE_URL               | src/lib/config.ts:34                   | Sí, validada al cargar next.config                | Origen HTTPS sin path; metadataBase, canonical, OG, Twitter, robots y sitemap. Nueva; documentada.                       |
| NEXT_PUBLIC_MEDIA_URL | src/lib/config.ts:46 | No | Host/prefijo adicional para optimizar medios. Sin valor, otros hosts siguen visibles con unoptimized. Documentada. |
| NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY | src/lib/config.ts:67                   | Sí                                                | `pk_live_...`; sin clave no hay tarjetas/reservas. Rechaza claves secretas y placeholders. Documentada.                  |
| NEXT_PUBLIC_STRIPE_ALLOW_TEST_KEY  | src/lib/config.ts:90                   | No                                                | Solo `true` habilita clave test en staging. No usar en producción comercial. Documentada.                                |
| NEXT_PUBLIC_GOOGLE_MAPS_API_KEY    | src/shared/hooks/use-google-maps.ts:40 | Para entrega a domicilio con autocomplete         | Ausente: UI declara Maps no configurado. Configurar Places/Maps y restricción de referrer al dominio final. Documentada. |
| NEXT_PUBLIC_LEGAL_COMPANY_NAME     | src/shared/config/legal.ts:20          | No lo impone el build; completar para lanzamiento | Fallback Cibaura. Identidad del operador. Documentada.                                                                   |
| NEXT_PUBLIC_LEGAL_RNC              | src/shared/config/legal.ts:22          | No lo impone el build                             | Línea omitida si vacío; aportar identificación real si corresponde al operador. Documentada.                             |
| NEXT_PUBLIC_LEGAL_ADDRESS          | src/shared/config/legal.ts:24          | No lo impone el build; completar para lanzamiento | Fallback Santo Domingo, Dominican Republic. Documentada.                                                                 |
| NEXT_PUBLIC_LEGAL_CONTACT_EMAIL    | src/shared/config/legal.ts:27          | No lo impone el build; completar para lanzamiento | Fallback legal@cibaura.com. Documentada.                                                                                 |
| NODE_ENV | src/lib/config.ts:21,68 | Gestionada por Next / Docker | production para deploy; development solo en build:ci. No figura en .env.example. |

No hay lecturas de otras variables runtime de aplicación en `src`. Las menciones de
`process.env.CONFIG_ENCRYPTION_KEY` en `src/features/admin/integrations.ts:53` y de
`process.env` en la pantalla de integraciones son comentarios sobre **el backend**;
no son variables del frontend y no deben copiarse aquí.

## Runtime e infraestructura

| Variable                | Uso                                              | Default           | Dónde                                                      |
| ----------------------- | ------------------------------------------------ | ----------------- | ---------------------------------------------------------- |
| PORT                    | Puerto HTTP del standalone y healthcheck         | 3000              | Dockerfile, compose.yml, scripts/container-healthcheck.mjs |
| HOSTNAME                | Interfaz del servidor                            | 0.0.0.0 en Docker | Dockerfile / standalone generado por Next                  |
| NEXT_TELEMETRY_DISABLED | Desactivar telemetría Next                       | 1 en Docker/CI    | Dockerfile y .github/workflows/ci.yml                      |
| WEB_HOST_PORT           | Puerto loopback publicado por Compose            | 3000              | compose.yml; no entra al bundle                            |
| WEB_IMAGE_TAG           | Etiqueta local para identificar/retener imágenes | local             | compose.yml; no entra al bundle                            |

Estas cinco opciones están documentadas como comentarios en `.env.example`.
En Caddy, SITE_URL también se usa en runtime para seleccionar el dominio TLS: debe
ser el mismo valor usado al compilar. PORT se pasa a ambos servicios. No establecer
HOSTNAME a un nombre de dominio externo: es una interfaz de escucha, no el canonical.

## Compilar y arrancar

1. Copiar `.env.example` a `.env.production.local` (ignorado por git y Docker).
2. Pegar URLs reales API/sitio, clave pública Stripe y los demás valores necesarios.
   Los valores de desarrollo de la plantilla **no pasan el build de producción**.
   Para staging: URLs públicas HTTPS de staging y clave Stripe test con flag explícito.
3. En el host de despliegue ejecutar:

```sh
docker compose --env-file .env.production.local build --pull
docker compose --env-file .env.production.local up -d --wait --wait-timeout 90
```

Lo anterior sirve detrás de un ingress HTTPS ya existente. Para host sin ingress,
el arranque exacto con TLS incluido es:

```sh
docker compose --env-file .env.production.local -f compose.yml -f compose.production.yml up -d --build --wait --wait-timeout 90
```

El archivo de valores no entra en la imagen: Compose pasa únicamente los build args
enumerados en Dockerfile. Los valores públicos sí quedan en las capas de build y el
bundle por diseño. No usar este mecanismo para secretos. Los certificados de Caddy
viven en `caddy_data`; no borrar ese volumen al actualizar.

Equivalente para un entorno que exporta las variables del inventario:

```sh
docker build --pull -t cibaura-web:release \
  --build-arg NEXT_PUBLIC_API_URL --build-arg NEXT_PUBLIC_SITE_URL \
  --build-arg NEXT_PUBLIC_MEDIA_URL --build-arg NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY \
  --build-arg NEXT_PUBLIC_STRIPE_ALLOW_TEST_KEY --build-arg NEXT_PUBLIC_GOOGLE_MAPS_API_KEY \
  --build-arg NEXT_PUBLIC_LEGAL_COMPANY_NAME --build-arg NEXT_PUBLIC_LEGAL_RNC \
  --build-arg NEXT_PUBLIC_LEGAL_ADDRESS --build-arg NEXT_PUBLIC_LEGAL_CONTACT_EMAIL .
docker run -d --name cibaura-web --restart unless-stopped --init \
  --security-opt no-new-privileges:true -e PORT=3000 -p 127.0.0.1:3000:3000 cibaura-web:release
```

Build nativo (diagnóstico, mismo guard): `npm ci` y `npm run build`, leyendo los
valores de `.env.production.local` o del entorno. Para ejecutar el artefacto standalone,
copiar `public` a `.next/standalone/public` y `.next/static` a
`.next/standalone/.next/static`, y ejecutar `node .next/standalone/server.js`.
La imagen Docker hace esas copias automáticamente; no usar `next start` en la imagen.

`GET /health` comprueba solo que el proceso HTTP responde, sin depender de API/DB.
La imagen comprueba el puerto configurado cada 30s y marca unhealthy tras tres fallos.
Validar además `/robots.txt`, una página pública con datos reales y sesión de reserva
contra la API antes de habilitar tráfico comercial. Health no certifica cobros ni datos.

## CI y protección contra destinos de ejemplo

El workflow `CI` compila con `npm run build:ci`: NODE_ENV=development y destinos
sint?ticos .ci.invalid. Next 15 requiere `experimental.allowDevelopmentBuild` para
esta compilaci?n (puede emitir el aviso de NODE_ENV no est?ndar). Se activa solo
en esa fase/modo y escribe en `.next-ci`, excluido de Docker y git. El smoke arranca
el server.js generado sin modificarlo. Ese artefacto NO se publica ni despliega;
no prueba la API real, pagos ni un build comercial.

El workflow manual **Production image** (`production-image.yml`, workflow_dispatch)
lee `vars.*`. Crear en Settings > Secrets and variables > Actions > Variables:

- Obligatorias: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL`,
  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
- Seg?n funciones usadas: `NEXT_PUBLIC_MEDIA_URL`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`,
  `NEXT_PUBLIC_STRIPE_ALLOW_TEST_KEY`, `NEXT_PUBLIC_LEGAL_COMPANY_NAME`,
  `NEXT_PUBLIC_LEGAL_RNC`, `NEXT_PUBLIC_LEGAL_ADDRESS`, `NEXT_PUBLIC_LEGAL_CONTACT_EMAIL`.

El preflight enumera cada variable obligatoria ausente y falla. Docker fuerza
NODE_ENV=production en el builder y ejecuta `npm run build`; nunca consume `.next-ci`.
El job construye la imagen y verifica usuario no root, health, assets, optimizador
y robots. No sube ni despliega la imagen autom?ticamente. No se han creado variables
Actions en nombre del due?o. Para probar cuando exista daemon: ejecutar los comandos
Compose anteriores; CI de producci?n proporciona su propio daemon.

`src/lib/public-url.ts` se ejecuta desde next.config antes de compilar. En producci?n
rechaza valores ausentes, localhost, IPs, nombres locales, .invalid, .example, .test,
example.com/net/org, marcadores, HTTP, credenciales, query/hash y wildcards. SITE_URL
rechaza paths y no tiene dominio por defecto. `src/lib/deployment-policy.ts` compara
los dominios registrables usando tldts y la Public Suffix List, incluidos sufijos
privados: tenants distintos de github.io/vercel.app NO son same-site. Se aplica a
producci?n; no existe ALLOW_PLACEHOLDER ni bypass equivalente en producci?n. Esto
valida configuraci?n, no DNS, propiedad del dominio ni disponibilidad de API.

No reusar una imagen de staging en producción esperando corregirla con `-e`.
Para actualizar: cambiar valores si hace falta, reconstruir y `up -d --wait`.
Conservar una etiqueta anterior permite rollback con `docker compose ... up -d --no-build`
usando su WEB_IMAGE_TAG y **los valores de su build**, incluidos dominio TLS y puerto.

## Imágenes y constantes encontradas

- Fotos API ya ten?an remotePatterns y optimizaci?n condicional. El bypass restante
  era para URLs externas heredadas. NEXT_PUBLIC_MEDIA_URL a?ade un host/prefijo
  p?blico autorizado; fotos y logos coincidentes usan el optimizador. Query strings
  permitidas bajo ese prefijo. Sin la variable, o con otro host, se conserva la URL
  externa con unoptimized para que siga visible; esa alternativa no mejora LCP.
  No hay wildcard global ni autorizaci?n de documentos/KYC privados.
- Los cuatro `unoptimized` incondicionales son PNG locales de marca pequeños en
  `src/shared/components/logo.tsx:38,52,68,77`, no inventario ni peticiones externas.
- Dominio fijo SEO eliminado de `src/shared/seo/metadata.ts`; todos sus consumidores
  usan SITE_URL validada. Los ejemplos cibaura.com/api.cibaura.com en comentarios de
  next.config y config no deciden destinos.
- `src/app/layout.tsx:92`: https://drts.us es el crédito editorial del desarrollador,
  no un endpoint ni dominio SEO. Se conserva y se reporta explícitamente.
- `src/shared/config/legal.ts:20-30`: Cibaura, Santo Domingo y legal@cibaura.com son
  fallbacks sustituibles por las cuatro variables legales existentes. Jurisdicción
  Dominican Republic y versión fallback 2026-09-08 son contenido/contrato legal;
  la versión real pertenece a GET /legal/current. No se traducen ni cambian aquí.
- `src/shared/hooks/use-google-maps.ts:24`: maps.googleapis.com es el endpoint oficial
  del proveedor. schema.org y purl.org en structured-data son vocabularios, no servidores
  del despliegue; w3.org en el SVG del select es un namespace.
- Correos example.com/customer@email.com/jane@agency.com son placeholders de inputs
  (`admin/roots/page.tsx:171`, `agency/walk-in/page.tsx:109`, `staff-form.tsx:146`).
  No hay teléfonos fijos en src: enlaces tel/mailto usan datos de la API.

## Dependencias y fuentes

Se fija Next/eslint-config-next 15.5.26 y Sharp 0.35.4. Se actualizan dependencias
compatibles y PostCSS de Next a 8.5.28 mediante override acotado: el audit inicial
detectó vulnerabilidades, incluido Next/Sharp; el audit posterior devuelve cero.
No se migra a Next 16. El lockfile y digests de imágenes permiten repetir las versiones.

- [Next standalone y copia de assets](https://nextjs.org/docs/15/app/api-reference/config/next-config-js/output).
- [Remote patterns e imágenes](https://nextjs.org/docs/15/app/api-reference/components/image).
- [Sharp en standalone](https://nextjs.org/docs/messages/sharp-missing-in-production).
- [Build args y variables Docker](https://docs.docker.com/build/building/variables/).
- [HTTPS automático Caddy](https://caddyserver.com/docs/automatic-https).

## Verificaci?n reproducible

```sh
npm ci
node scripts/deploy-config-smoke.mjs
npm run build:ci
node scripts/standalone-smoke.mjs
npx tsc --noEmit
npm run lint
npm run lint:suppressions
npm audit
```

Los guards tienen 58 comprobaciones con valores sint?ticos, incluidos dominios
co.uk/com.do y sufijos privados. El smoke standalone comprueba seis respuestas HTTP:
health JSON, asset p?blico, optimizador Sharp, robots, HTML con canonical y CSS.
Se informa el resultado final real de estos comandos en el PR.

El build de producci?n se prueba por separado con `npm run build` y valores reales:
los placeholders/localhost deben fallar antes de compilar. El daemon local permanece
apagado por instrucci?n del responsable. La imagen de producci?n queda verificable
mediante el workflow manual cuando se peguen las variables; no se presenta el smoke
de desarrollo como evidencia de una imagen Docker ni de inventario real.

Resultados locales de esta revisi?n: build:ci exit 0 (51/51 p?ginas), standalone
6/6, guards 58/58, tsc 0 errores, ESLint 0 errores/0 warnings, supresiones 222 archivos
limpios, npm audit 0 vulnerabilidades. Un npm run build con dominios registrables
distintos sali? con c?digo 1 antes de compilar, como se exige. El preflight sin
variables sali? con c?digo 1 enumerando API_URL, SITE_URL y la clave p?blica Stripe.
