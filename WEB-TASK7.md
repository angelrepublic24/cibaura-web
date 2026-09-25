# Tarea 7 — contrato de reservas y release Stripe

## Fuente y tipos

Backend `booking-payload.service.ts:62-85` y `booking.serializer.ts` emiten
depositCents e inspections en cada booking (0 y [] si no hay datos).
`booking-payload.service.ts:97-108` emite deposit, claim y settlement como valor o
null en el detalle. `:158-178` emite cancellationQuote únicamente al customer dueño
en requested/accepted; sigue opcional. Payment y deposit.clientSecret conservan
sus reglas de viewer, no se muestran ni copian al host/admin.

`src/shared/types/domain.ts` refleja esas garantías. Se conservan las guardas de
renderizado para payloads antiguos/parciales aunque el contrato actual sea requerido.
ClaimDto incorpora currency, emitida por `claim.serializer.ts:14-33`.
CancellationQuoteDto requiere tier/freeUntil. No declara policy: el backend no la
emite; la explicación de cancelación utiliza el GET /legal/current ya existente,
y los importes siempre vienen de la cotización. No se calcula dinero en el cliente.
depositCents se describe como efectivo del backend, no como snapshot inmutable:
la implementación actual llama effectiveDepositCentsByBooking.

## Superficies comprobadas

| Viewer/ruta | Datos y acciones |
|---|---|
| Customer `/account/bookings/[id]`, booking-detail.tsx | DepositBanner, ClaimResponseCard, InspectionsSection y SettlementCard ya estaban montadas. Ahora la reclamación está justo después del aviso de pago, por encima de timeline/inspecciones largas, incluso en reservas cerradas. |
| Agencia `/agency/requests/[bookingId]`, agency-booking-detail.tsx | InspectionPanel, DepositStatusCard, ClaimCard y AgencySettlementCard ya leen el detalle real. Acciones condicionadas por bookings:handle; no se monta el formulario de respuesta del customer. |
| Admin `/admin/orders/[id]` | DepositCard, ClaimCard, InspectionsCard y SettlementCard ya reciben booking.deposit/claim/inspections/settlement. Enlace al detalle administrativo de la reclamación para decidir; no se monta el formulario del customer. |

La conexión a estos bloques ya existía: no se duplican tarjetas ni endpoints.
La lectura del customer ahora se refresca cada 30 segundos en accepted/active/
returned o con claim open, solo con la pestaña en primer plano. Así aparecen
cambios de depósito, inspecciones o una reclamación nueva sin recargar manualmente.

## Responder una reclamación

`claim-response-card.tsx` muestra aceptación/rechazo y nota, junto a respondBy
del servidor. No se fija “48 horas” en el código: se usa el plazo real. Fuera de
plazo deshabilita los controles; under_review muestra el estado de revisión.
La mutación existente usa BookingsApi.respondClaim y POST
/bookings/:bookingId/claims/:claimId/respond con accept boolean y note opcional,
igual a `claims-customer.controller.ts:29-48`. Invalida detalle, inspecciones y lista
tras éxito; refresca también ante CLAIM_NOT_OPEN/CLAIM_RESPONSE_WINDOW_CLOSED.

## Verificación y dependencias

`booking-lifecycle-smoke.mjs` renderiza componentes reales con fixtures de forma
del serializer: datos de depósito/reclamación/liquidación de los tres viewers,
inspección del customer, formulario abierto/caducado/en revisión, aceptar/rechazar
pasando por la mutación y método API reales (transporte simulado), y polling.
`booking-guards-smoke.mjs` conserva casos de payloads omitidos. No son reservas
reales ni prueba de cobros. No se ha escrito una reserva en un backend.

No falta un endpoint para estas tarjetas/acción. La única propiedad esperada que
no se emite era cancellationQuote.policy: se retira del tipo y se usa legal/current.
Las credenciales y un entorno con reservas reales siguen siendo necesarias para
validar pagos/evidencia firmada de extremo a extremo; no se presentan fixtures
como inventario real. El detalle de separación staging/release está en WEB-DEPLOY.md.

Gates de esta entrega: build CI 51/51 páginas; TypeScript 0 errores; ESLint
0 errores/0 warnings; 224 archivos sin supresiones. Suites específicas: lifecycle
19 casos y release Stripe 11; el guard general suma 115, incluido staging pk_test_
con flag true. El CLI de release ejecutado con esa misma combinación devuelve
exit 1 antes de construir/publicar, sin imprimir la clave.
