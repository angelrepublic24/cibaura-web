# Decisiones del web

Reglas que debe preservar cada cambio. Quien cambie una regla actualiza su motivo y pruebas en el mismo PR. Operación: [WEB-DEPLOY.md](WEB-DEPLOY.md); rutas/viewers: [README.md](README.md). Resultados puntuales pertenecen al PR.

## URLs públicas y SSR

Una pausa no es borrado: `paused` conserva HTTP 200, canonical y contenido, con Offer `OutOfStock` y sin formulario de reserva. `draft` devuelve 404. Siguen aplicando agencia verificada y pertenencia a sucursal activa. El sitemap enumera inventario activo, sin fabricar un catálogo de pausados.

La validación de perfil/detalle termina antes de iniciar streaming. Los límites `loading.tsx` retirados permitían una pantalla not-found con HTTP 200; sin ellos se preserva el 404 real. Se acepta perder el skeleton inicial; recuperarlo exige preservar el status antes de enviar encabezados.

El catálogo se precarga con un QueryClient por petición y las mismas query keys del cliente. Metadata y render comparten consultas. No se reenvían cookies en fetch público ni se comparte sesión entre peticiones. La disponibilidad con fechas no hereda caché persistente del catálogo. Sin fechas se muestran ciudad y enlaces, no supuesta disponibilidad.

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
