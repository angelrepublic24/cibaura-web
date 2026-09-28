# Decisiones del web

Reglas que debe preservar cada cambio. Quien cambie una regla actualiza su motivo y pruebas en el mismo PR. Operación: [WEB-DEPLOY.md](WEB-DEPLOY.md); rutas/viewers: [README.md](README.md). Resultados puntuales pertenecen al PR.

## URLs públicas y SSR

Una pausa no es borrado: `paused` conserva HTTP 200, canonical y contenido, con Offer `OutOfStock` y sin formulario de reserva. `draft` devuelve 404. Siguen aplicando agencia verificada y pertenencia a sucursal activa. El sitemap enumera inventario activo, sin fabricar un catálogo de pausados.

La validación de perfil/detalle y destino del catálogo termina antes de iniciar streaming. Los límites `loading.tsx` retirados permitían una pantalla not-found con HTTP 200; sin ellos se preserva el 404 real, también para una ciudad ambigua sin país. Se acepta perder el skeleton inicial; recuperarlo exige preservar el status antes de enviar encabezados.

El catálogo se precarga con un QueryClient por petición y las mismas query keys del cliente. Metadata y render comparten consultas. No se reenvían cookies en fetch público ni se comparte sesión entre peticiones. La disponibilidad con fechas no hereda caché persistente del catálogo. Sin fechas se muestra el catálogo publicado y enlaces, sin afirmar disponibilidad.

Referencias: `src/shared/seo/public-api.ts`, `prefetch.ts`, rutas públicas; regresión: `scripts/seo-smoke.mjs`.

## Reviews de agencia, no de carro

Se usan `ratingAvg` y `reviewCount` publicados por el API; no se promedia una página ni se atribuye su promedio al carro. AggregateRating pertenece al AutoRental del perfil; en Vehicle aparece en `offers.seller`. Sin contador positivo y promedio válido se omite. Reviews individuales solo con texto de las visibles inicialmente. El marcado debe describir la entidad realmente valorada y coincidir con contenido visible.

Referencia: `src/shared/seo/structured-data.tsx`; regresión: SEO smoke.

## Sitemap parcial ante fallos

Se paginan agencias y carros, cruzando sucursales activas sin pedir un detalle por carro. Un error, incluido 429, detiene enumeración y conserva rutas completadas. El resultado parcial se cachea igual que el completo para evitar que cada crawler repita una tormenta de peticiones. No se inventa `lastModified`. Debe implementarse partición antes de superar el límite de un sitemap; el código limita la salida para mantenerla válida.

Referencia: `src/app/sitemap.ts`; regresión: SEO smoke.

## Build sin escape para destinos falsos

Un placeholder incrustado produciría una imagen imposible de reparar con variables runtime. API/sitio requieren valores válidos, sin default productivo ni bypass. CI compila un artefacto separado, no publicable. Sitio/API comparten dominio registrable por SameSite=Lax; la aproximación compartida con backend no es una lista pública completa de sufijos y no distingue tenants privados. Usar dominio propio.

Staging Stripe test es explícito. Release exige live y rechaza el flag test incluso con valor `false`. Excepciones de Legal/Maps y monitoring son limitadas según el runbook; no desactivan validación de URLs.

Referencias: `src/lib/config.ts`, `deployment-policy.ts`, `public-url.ts`, `scripts/check-release-stripe.mjs`; regresiones: deploy-config y release-stripe smoke.

## Errores observables, mapas privados

La UI ofrece mensaje humano/reintento; Sentry recibe excepción y stack con redacción de contexto sensible. DSN público y token privado de subida cumplen funciones distintas. DSN configurado no demuestra entrega, alertas ni symbolication.

Los sourcemaps permiten leer stacks, pero servirlos expone código fuente original. Se suben durante build y se eliminan mapas de cliente del artefacto servido. Upload habilitado que falla aborta el build; producción exige credenciales. El token entra por secret de build, nunca ARG público ni runtime. Entrega real requiere validación en Sentry operativo.

Referencias: `next.config.ts`, `src/lib/sentry-build.ts`; regresiones: sentry-build y error-reporting smoke.

## Importes y viewers

El servidor es dueño de precios/plazos. Se muestran `booking.depositCents` congelado, impuesto/tasa de pricing y el impuesto propio de liquidación; no se recomponen totales de reserva. Delivery pertenece al subtotal; depósito queda separado. Impuesto cero se muestra para distinguir tasa válida de ausencia. Retención existente muestra su importe real, no configuración posterior. HTML/PDF contractual permanece como lo entrega el servidor.

El quote consumido solo trae pricing: antes de crear la reserva, depósito de ficha/checkout es estimación del API del carro. Garantizar igualdad entre preview y creación ante cambios concurrentes requiere snapshot vinculante del backend. Los agregados de órdenes visibles en admin suman importes recibidos, no recalculan reservas.

Tipos reflejan wire: depósito de reserva e inspecciones requeridos; depósito operativo, reclamación y liquidación de detalle admiten null. `cancellationQuote` es opcional por viewer/estado. Guardas toleran payloads incompletos sin inventar dinero. Responder reclamaciones corresponde al cliente y usa `respondBy`, no 48 horas fijas en UI. El backend autoriza operaciones; filtros visuales no lo reemplazan.

Referencias: `src/shared/types/domain.ts`, `src/shared/components/price-breakdown.tsx`, componentes de bookings/agencia/admin; regresiones: booking-lifecycle, booking-guards y branch-scope smoke.

## Guardar exige confirmación

Comisión y política se guardan por separado en sus rutas específicas; se validan respuesta y valores antes de anunciar éxito. Respuesta incompleta significa resultado no confirmado: pudo persistir sin devolver un contrato válido. No se reintenta por otro endpoint. Opciones no conectadas aparecen no disponibles; reconocer un campo GET no habilita edición.

La UI conserva límite 0–7 de `earlyReturnPenaltyDays`, aunque su adaptador admite lectura hasta 30. Resolver con el contrato del servidor, no truncando datos. `checkinAdvancePct` se conserva si llega, incluido cero, pero es de solo lectura; confirmar reserva y confirmar check-in no se presumen el mismo evento de pago.

Referencias: `src/features/admin/platform-config-contract.ts`, `platform-config-api.ts`, `components/platform-config-form.tsx`; regresión: platform-config smoke.

## Destino elegido, no ubicación asumida

País y ciudad describen dónde se alquila, no dónde está el visitante.
Un país se muestra preseleccionado como control de solo lectura con el mismo
tratamiento que los campos editables; varios habilitan selector. Cambiar país
limpia ciudad. La portada no solicita ubicación: el visitante puede reservar
antes de viajar y su posición no representa el destino.
Fechas opcionales usan el calendario compartido y formato día/mes/año;
recogida y devolución se editan desde botones independientes, con foco en la
fecha elegida. Una recogida que invalida la devolución conserva la nueva recogida
y pide otra devolución con aviso: no inventamos duración ni borramos ambas fechas.
«Any dates» recupera el catálogo sin fechas. Se mantiene el intervalo `[from,to)`.
La UI muestra qué falta en el botón. País es obligatorio; región, ciudad y
fechas son opcionales. Cambiar país limpia región/ciudad y cambiar región limpia
ciudad. Ciudades sin región siguen disponibles al buscar en todo el país.
El API recibe country (código) y region (slug); no se filtra una sola página de
resultados en el cliente. Las tarjetas muestran location.city y countryCode.
El selector presenta el kind recibido con mayúscula inicial y espacios, en el
idioma inglés actual de la UI, sin mapa por país. Si conviven varios tipos,
la etiqueta genérica es Region hasta seleccionar uno; entonces usa su tipo
exacto (incluido Capital district). Una futura traducción del enum pertenece
al idioma de la UI, no a una condición por país.
Los listados amplios usan /cars/all?country=...&region=... y canonical propio.
Una ciudad con slug único conserva /cars/[city] como canonical; una colisión
entre países requiere country. Fechas y facetas no crean otro canonical.
Las variantes de portada /?searchLayout=A (botón compacto en fila de escritorio)
y /?searchLayout=B (botón en fila propia) comparten canonical /. Ambas se apilan
en móvil. El dueño eligió B: es la presentación predeterminada en `/`.
Reseñas bajo la flota, con valoración enlazada en cabecera: primero los carros,
luego evidencia de confianza, sin alterar a quién pertenece el AggregateRating.
