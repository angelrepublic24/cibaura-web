# Despliegue del web Cibaura

## Tarea 6: configuración visible y diferencias con PRODUCCION-SPEC.md §3.2

`GET /health` devuelve `status: "ok"` (liveness HTTP 200) y `baked` con apiUrl,
siteUrl normalizada a origen, stripeKeyPrefix (solo pk_live_/pk_test_, o null),
legalConfigured, mapsConfigured y buildSha. No devuelve claves, identidad legal,
headers del API ni errores internos. `upstream` contiene status HTTP o null,
corsMatched y ok. Sonda GET al API_URL normalizado + /health con Origin del sitio,
sin credenciales, sin seguir redirects y con timeout de 2 segundos. Un API caído
no reinicia el contenedor sano; consultar upstream.ok para disponibilidad funcional.

NEXT_PUBLIC_BUILD_SHA es build-time obligatorio (40 hex), leído en config.ts:116;
Docker lo recibe como ARG y Actions lo rellena con github.sha. En builds nativos o
Compose fijarlo al resultado de `git rev-parse HEAD`, sobre el checkout a desplegar.
No escribir un SHA inventado en .env.example. Las variables públicas siguen sin
poder cambiarse en runtime. legalConfigured significa cuatro valores no vacíos;
no certifica la existencia de la sociedad ni la validez fiscal del RNC.

`npm run build` ejecuta prebuild (`scripts/verify-build-env.mjs`). Next.config
repite la validación para que invocar next build directamente tampoco la evite.
Las cuatro variables legales y Maps son obligatorias; flags build-only
ALLOW_DEFAULT_LEGAL=true / ALLOW_MISSING_MAPS=true permiten excepciones nativas
explícitas para staging. Docker/release no pasa esos flags. BUILD_ENV_PROBE_API=true
activa la sonda opcional de build, timeout 5 segundos: exige HTTP 2xx y ACAO
exactamente igual a SITE_URL.origin. Actions lee vars.BUILD_ENV_PROBE_API.
Una entrada backend FRONTEND_URL con barra final falla esa comparación. La sonda
no prueba toda la sesión ni cookies; comprueba exactamente el contrato solicitado.

Discrepancias resueltas o reportadas, sin editar la especificación del lead:

| Tema | Resolución |
|---|---|
| Legal y Maps opcionales en el inventario anterior | El inventario anterior quedó obsoleto; ahora obligatorias salvo las excepciones explícitas. Plantilla legal vacía, sin identidad inventada. |
| BUILD_SHA ausente | Implementado e incrustado desde Git/Actions. |
| PSL vs aproximación backend | Se porta registrableDomain y los seis labels co/com/net/org/edu/gov, con mensaje backend idéntico. Única adaptación TS: fallback vacío por noUncheckedIndexedAccess en índice garantizado por longitud. Se retira tldts. |
| Sufijos privados | La aproximación compartida acepta tenants distintos de github.io/vercel.app; no equivale a una PSL real. Es una limitación del contrato backend que ahora comparten ambos. Usar el dominio propio decidido, no tenants de proveedores. |
| CANONICAL_HOST opcional / 308 en spec | Spec desactualizada frente al PR #13 aprobado: WEB_REDIRECT_HOST obligatorio en Compose TLS + SITE_URL, con 301 en Caddy. |
| NEXT_PUBLIC_SENTRY_DSN y SSR_SHARED_SECRET | Son trabajos futuros de la spec, no variables implementadas en este web. No se simula que funcionen ni se exigen aún. |
| ALLOW_PLACEHOLDER_BUILD en §3.4 | Contradice la decisión posterior: no existe ni se añade. CI compila en desarrollo; producción rechaza placeholders. |
| Stripe test flag | Se conserva el staging explícito existente. La prohibición de este flag en releases comerciales (F2-5) sigue siendo una diferencia respecto al estado actual; no se declara resuelta por esta tarea. |
| Cantidad de variables en §4 | La instrucción de “diez” quedó obsoleta al añadir BUILD_SHA; Sentry/SSR pendientes no deben confundirse con valores ya consumidos. |

`npm run smoke`, después de build:ci, ejecuta health-config, deploy-config,
platform-config, booking-guards y seo-smoke. SEO usa copia aislada del standalone
de CI y fixtures HTTP: evidencia de SSR y contrato, nunca de inventario real.
Los datos de prueba no contaminan la caché del artefacto de producción.

## Hostinger VPS limpio: camino concreto

Usar un VPS Ubuntu 24.04 LTS (no hosting compartido). Entrar por SSH con un usuario
con sudo. La marca y el dominio siguen pendientes: no hay default de producción.

Instalar Docker Engine y Compose desde el repositorio oficial:

```sh
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker version
sudo docker compose version
git clone https://github.com/angelrepublic24/cibaura-web.git
cd cibaura-web
cp .env.example .env.production.local
chmod 600 .env.production.local
```

Pegar valores reales en `.env.production.local`. SITE_URL es el origen canónico
(apex o www), API_URL es `https://api.<dominio>`, WEB_REDIRECT_HOST es el otro
hostname **sin esquema, puerto ni ruta**. No repetir el host canónico: crearía un
conflicto de sitios. Configurar registros A del apex y www hacia la IPv4 del VPS;
AAAA solo si IPv6 está operativo. El registro de api debe apuntar al servidor del
backend. No publicar un AAAA incorrecto: rompe ACME y acceso de clientes IPv6.

En el firewall de Hostinger y del sistema permitir SSH y 80/TCP, 443/TCP (443/UDP
opcional para HTTP/3). Mantener 3000 solo en loopback. Caddy necesita 80/443 libres;
no instalar otro proxy que ocupe esos puertos. El backend debe tener su propio
ingress HTTPS para api.<dominio>; este Compose no despliega ni enruta NestJS.

```sh
sudo docker compose --env-file .env.production.local -f compose.yml -f compose.production.yml up -d --build --wait --wait-timeout 120
sudo docker compose --env-file .env.production.local -f compose.yml -f compose.production.yml logs edge
```

Con DNS propagado y puertos abiertos, Caddy obtiene y renueva los certificados
del canónico y del alternativo automáticamente. HTTP pasa a HTTPS; el alternativo
HTTPS devuelve **301**, preservando ruta y query, hacia SITE_URL. Los volúmenes
caddy_data/caddy_config deben persistir. Comprobar con los hostnames reales:

```sh
curl -I https://HOST_CANONICO/legal/privacy
curl -I 'https://HOST_ALTERNATIVO/cars/city?q=1'
```

El segundo debe devolver Location al canónico y status 301. Estos nombres son
marcadores de instrucciones, nunca valores aceptados para construir producción.

## Cabeceras: responsabilidades y límites

Next (`src/lib/security-headers.ts`, `next.config.ts`) entrega CSP aplicada,
nosniff, Referrer-Policy y Permissions-Policy en las respuestas de aplicación.
Así sobreviven a un cambio de proxy y se prueban contra standalone. Caddy añade
HSTS `max-age=31536000` en ambos hosts HTTPS, donde termina TLS. No se usa
includeSubDomains ni preload: no controlamos todavía todos los subdominios.
No se duplica CSP en Caddy, porque dos políticas se intersectan y pueden bloquear
Stripe o Maps accidentalmente. Si se usa otro ingress, debe añadir HSTS allí.

La CSP permite únicamente scripts de la aplicación, Stripe y (si hay clave) Maps.
Mantiene unsafe-inline para la hidratación/prerenderizado de Next y estilos; no es
una CSP estricta con nonce ni elimina por completo el riesgo de XSS. unsafe-eval
solo se permite en desarrollo o con Maps habilitado, por su allowlist documentada.
Imágenes HTTPS externas siguen permitidas por el fallback acordado. Conexiones a
API usan el origen validado; Stripe/Link y Maps tienen sus orígenes permitidos.
Frame-ancestors none y object-src none bloquean embebido del sitio y plugins.
Los smoke HTTP verifican cabeceras; no equivalen a probar pagos o Maps con claves
reales en un navegador. Un nonce requeriría renderizado dinámico y cambios de
caché que no se introducen en esta entrega.

## Identidad y publicación de releases

Esquema propuesto y cableado: tags Git **vMAJOR.MINOR.PATCH**, versiones independientes
por repositorio. Primer release propuesto: v0.1.0; no se ha creado ningún tag.
PATCH para correcciones compatibles, MINOR para funciones compatibles, MAJOR para
rupturas del contrato. El tag Git es la identidad de despliegue (package.json es
privado y no se publica en npm). No mover/reutilizar tags; proteger v* mediante un
ruleset de GitHub contra actualización/borrado. No se crean reglas remotamente aquí.

Al hacer push de vX.Y.Z, `production-image.yml` comprueba SemVer estable y que el
commit pertenece a main, exige las variables Actions, construye y prueba la imagen,
y publica **la misma imagen probada** en GHCR con `vX.Y.Z` y `sha-<SHA completo>`.
Añade labels OCI de versión, revisión y repositorio. Usa GITHUB_TOKEN con
packages:write; no requiere credenciales nuevas para publicar. El dispatch manual
valida sin publicar si se ejecuta sobre una rama. No se publica latest ni se hace
despliegue automático al VPS. Tampoco se reusa el build sintético de CI.

Tras revisión y CI verde, el responsable ejecuta (ejemplo de primera versión):

```sh
git switch main
git pull --ff-only
git tag -a v0.1.0 -m 'Web v0.1.0'
git push origin v0.1.0
```

El paquete GHCR puede ser privado. Para descargarlo en el VPS, autenticarse con
un token de lectura de packages mediante `docker login ghcr.io --password-stdin`,
o configurar el paquete como público si esa es la decisión del propietario.
En el archivo de valores fijar WEB_IMAGE_REPOSITORY=ghcr.io/angelrepublic24/cibaura-web
y WEB_IMAGE_TAG=v0.1.0 (o sha-<SHA>). SITE_URL y demás valores deben corresponder al
build publicado; la imagen no se reconfigura cambiando NEXT_PUBLIC_* al arrancar.

```sh
sudo docker compose --env-file .env.production.local -f compose.yml -f compose.production.yml pull
sudo docker compose --env-file .env.production.local -f compose.yml -f compose.production.yml up -d --no-build --wait --wait-timeout 120
```

Rollback: restaurar la etiqueta anterior y sus valores, pull y up --no-build.
Variables nuevas fuera de src: WEB_REDIRECT_HOST (runtime Caddy, obligatoria con
TLS), WEB_IMAGE_REPOSITORY (Compose), WEB_VERSION y WEB_REVISION (build, labels OCI;
workflow los rellena). Todas las NEXT_PUBLIC_* conservan su inventario de abajo.

Referencias oficiales: [Docker Ubuntu](https://docs.docker.com/engine/install/ubuntu/),
[Caddy HTTPS](https://caddyserver.com/docs/automatic-https),
[Caddy redir](https://caddyserver.com/docs/caddyfile/directives/redir),
[Next CSP](https://nextjs.org/docs/app/guides/content-security-policy),
[Stripe CSP](https://docs.stripe.com/security/guide),
[Maps CSP](https://developers.google.com/maps/documentation/javascript/content-security-policy).

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
| NEXT_PUBLIC_GOOGLE_MAPS_API_KEY    | src/shared/hooks/use-google-maps.ts:40; src/lib/config.ts:114 | Si, salvo ALLOW_MISSING_MAPS en staging nativo | Ausente: UI declara Maps no configurado. Configurar Places/Maps y restricción de referrer al dominio final. Documentada. |
| NEXT_PUBLIC_LEGAL_COMPANY_NAME     | src/shared/config/legal.ts:20          | Si, salvo ALLOW_DEFAULT_LEGAL en staging nativo | Publica/build; tambien leida en src/lib/config.ts:105-108 para baked y guard. Documentada. |
| NEXT_PUBLIC_LEGAL_RNC              | src/shared/config/legal.ts:22          | Si, salvo ALLOW_DEFAULT_LEGAL en staging nativo | Publica/build; tambien leida en src/lib/config.ts:105-108 para baked y guard. Documentada. |
| NEXT_PUBLIC_LEGAL_ADDRESS          | src/shared/config/legal.ts:24          | Si, salvo ALLOW_DEFAULT_LEGAL en staging nativo | Publica/build; tambien leida en src/lib/config.ts:105-108 para baked y guard. Documentada. |
| NEXT_PUBLIC_LEGAL_CONTACT_EMAIL    | src/shared/config/legal.ts:27          | Si, salvo ALLOW_DEFAULT_LEGAL en staging nativo | Publica/build; tambien leida en src/lib/config.ts:105-108 para baked y guard. Documentada. |
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
  --build-arg NEXT_PUBLIC_API_URL --build-arg NEXT_PUBLIC_SITE_URL --build-arg NEXT_PUBLIC_BUILD_SHA --build-arg BUILD_ENV_PROBE_API \
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

`GET /health` mantiene HTTP 200 como liveness y reporta configuración baked y sonda upstream.
La imagen comprueba el puerto configurado cada 30s y marca unhealthy tras tres fallos.
Validar además `/robots.txt`, una página pública con datos reales y sesión de reserva
contra la API antes de habilitar tráfico comercial. Health no certifica cobros ni datos.

## CI y protección contra destinos de ejemplo

El workflow `CI` compila con `npm run build:ci`: NODE_ENV=development y destinos
sintéticos .ci.invalid. Next 15 requiere `experimental.allowDevelopmentBuild` para
esta compilación (puede emitir el aviso de NODE_ENV no estándar). Se activa solo
en esa fase/modo y escribe en `.next-ci`, excluido de Docker y git. El smoke arranca
el server.js generado sin modificarlo. Ese artefacto NO se publica ni despliega;
no prueba la API real, pagos ni un build comercial.

El workflow manual **Production image** (`production-image.yml`, workflow_dispatch)
lee `vars.*`. Crear en Settings > Secrets and variables > Actions > Variables:

- Obligatorias: API_URL, SITE_URL, STRIPE_PUBLISHABLE_KEY, GOOGLE_MAPS_API_KEY y las
  cuatro LEGAL_* (todas con prefijo NEXT_PUBLIC_).
- NEXT_PUBLIC_BUILD_SHA: automatico desde github.sha, no variable manual de Actions.
- Opcionales: NEXT_PUBLIC_MEDIA_URL, NEXT_PUBLIC_STRIPE_ALLOW_TEST_KEY (staging)
  y BUILD_ENV_PROBE_API (sonda HTTP de build).


El preflight enumera cada variable obligatoria ausente y falla. Docker fuerza
NODE_ENV=production en el builder y ejecuta `npm run build`; nunca consume `.next-ci`.
El job construye la imagen y verifica usuario no root, health, assets, optimizador
y robots. En un tag SemVer publica en GHCR; en una rama solo valida. No despliega
al VPS automáticamente. No se han creado variables
Actions en nombre del dueño. Para probar cuando exista daemon: ejecutar los comandos
Compose anteriores; CI de producción proporciona su propio daemon.

`src/lib/public-url.ts` se ejecuta desde next.config antes de compilar. En producción
rechaza valores ausentes, localhost, IPs, nombres locales, .invalid, .example, .test,
example.com/net/org, marcadores, HTTP, credenciales, query/hash y wildcards. SITE_URL
rechaza paths y no tiene dominio por defecto. `src/lib/deployment-policy.ts` compara
los dominios registrables con la misma aproximación del backend (ver Tarea 6).
No distingue tenants de sufijos privados. Se aplica a
producción; no existe ALLOW_PLACEHOLDER ni bypass equivalente en producción. Esto
valida configuración, no DNS, propiedad del dominio ni disponibilidad de API.

No reusar una imagen de staging en producción esperando corregirla con `-e`.
Para actualizar: cambiar valores si hace falta, reconstruir y `up -d --wait`.
Conservar una etiqueta anterior permite rollback con `docker compose ... up -d --no-build`
usando su WEB_IMAGE_TAG y **los valores de su build**, incluidos dominio TLS y puerto.

## Imágenes y constantes encontradas

- Fotos API ya tenían remotePatterns y optimización condicional. El bypass restante
  era para URLs externas heredadas. NEXT_PUBLIC_MEDIA_URL añade un host/prefijo
  público autorizado; fotos y logos coincidentes usan el optimizador. Query strings
  permitidas bajo ese prefijo. Sin la variable, o con otro host, se conserva la URL
  externa con unoptimized para que siga visible; esa alternativa no mejora LCP.
  No hay wildcard global ni autorización de documentos/KYC privados.
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

## Verificación reproducible

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

Los guards tienen 114 comprobaciones con valores sintéticos, incluidos dominios
co.uk/com.do y sufijos privados. El smoke standalone comprueba seis respuestas HTTP:
health JSON, asset público, optimizador Sharp, robots, HTML con canonical y CSS.
Se informa el resultado final real de estos comandos en el PR.

El build de producción se prueba por separado con `npm run build` y valores reales:
los placeholders/localhost deben fallar antes de compilar. El daemon local permanece
apagado por instrucción del responsable. La imagen de producción queda verificable
mediante el workflow manual cuando se peguen las variables; no se presenta el smoke
de desarrollo como evidencia de una imagen Docker ni de inventario real.

Resultados locales de esta revisión: build:ci exit 0 (51/51 páginas), standalone
6/6 más cinco cabeceras, edge Caddy 6/6, guards 114/114, tsc 0 errores,
ESLint 0 errores/0 warnings, supresiones 224 archivos
limpios, npm audit 0 vulnerabilidades. Un npm run build con dominios registrables
distintos salió con código 1 antes de compilar, como se exige. El preflight sin
variables salió con código 1 enumerando API_URL, SITE_URL y la clave pública Stripe.
