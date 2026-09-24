# Tarea 3 — Pausas y contratos parciales de reservas

## Cambio de criterio SEO

Una pausa no equivale a borrar un carro. `getPublicCar` permite `active` y
`paused`; `draft` mantiene `notFound()`. Se conservan agencia verificada y
sucursal activa como condiciones de visibilidad. El carro pausado conserva
metadata, canonical, contenido y ratings reales de su agencia; su Offer lleva
`availability: https://schema.org/OutOfStock`. La UI muestra indisponibilidad
temporal en lugar del formulario de reserva. No se afirma disponibilidad para
un carro activo sin consultar fechas.

Se retiraron los dos `loading.tsx` heredados por el detalle para que la respuesta
espere la validación antes de enviar encabezados. La regresión detectó que,
con esos límites, un borrador mostraba not-found con HTTP 200. Ahora devuelve
HTTP 404. El perfil de agencia también espera su respuesta antes de mostrar
contenido, sin ese skeleton intermedio. Es el comportamiento documentado de
[not-found y streaming en Next.js](https://nextjs.org/docs/app/api-reference/file-conventions/not-found).

El sitemap sigue enumerando inventario activo obtenido del listado público;
conservar una URL pausada con 200 no exige inventar un catálogo de pausados.
Este criterio reemplaza la sección de pausas de SEO-TASK2.md.

## Reservas con campos ausentes

`Booking.depositCents` e `inspections`, y `BookingDetail.deposit`, `claim` y
`settlement` son opcionales. `cancellationQuote` ya era opcional.
Los consumidores de admin, host y cliente toleran campos omitidos. Admin usa
refs vacíos cuando no vienen inspecciones; el editor de inspecciones y el
formulario de reclamaciones comprueban tanto null como undefined. Importes
desconocidos no se convierten en cero ni se presentan como depósitos confirmados.
No se conectaron nuevas tarjetas ni se cambiaron endpoints.

## Validación

- Build de producción: salida 0, 51/51 páginas; bandera Stripe solo en proceso.
- TypeScript: 0 errores. ESLint: 0 errores y 0 warnings.
- Supresiones: 216 archivos, ninguna supresión.
- `node scripts/seo-smoke.mjs`: 36 comprobaciones sobre servidor de producción
  aislado, incluyendo paused HTTP 200 + OutOfStock, draft HTTP 404 sin Offer,
  hidratación, ratings de agencia y sitemap parcial ante 429.
- `node scripts/booking-guards-smoke.mjs`: 9 casos de render de componentes con
  props sintéticas; inspecciones omitidas/vacías y depósitos omitidos/null/held/
  pending_hold. Dependencias de red y formularios aisladas con stubs.

Estas pruebas usan fixtures explícitos; no son evidencia de inventario real ni
de una sesión autenticada contra el backend. La verificación real pendiente de
Tarea 2 continúa separada.
