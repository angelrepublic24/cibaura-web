# Tarea 10 — importes congelados

## Resultado

- `src/shared/types/domain.ts:452`: `Pricing.taxCents` y `taxRatePct` obligatorios, según `backend/src/common/serializers/wire-contract.ts:473,478`. `SettlementDto.taxCents` en `domain.ts:1114`, según wire:743. `Booking.depositCents` sigue obligatorio (wire:562); el override nullable de `AgencyCar` (wire:1055) no cambia.
- `src/shared/components/price-breakdown.tsx:5`: muestra importes del servidor sin sumarlos. Impuesto y tasa siempre visibles, incluido cero: distingue una tasa válida de un dato omitido y hace visible cualquier cambio futuro sin modificar código. El subtotal incluye delivery; se identifica explícitamente para evitar aparentar un doble cargo. Depósito separado del total.
- `src/features/bookings/components/booking-summary.tsx:92`: customer y agencia comparten el desglose y reciben `booking.depositCents`, nunca el depósito actual del carro. Admin usa el mismo componente en `src/app/admin/orders/[id]/page.tsx:209`.
- Liquidación: netos de host/plataforma, impuesto y reembolso recibidos del servidor. Customer: `src/features/bookings/components/settlement-card.tsx:164`; agencia: `src/features/agency/components/agency-settlement-card.tsx:267`; admin: `src/features/admin/components/order-lifecycle-cards.tsx:337`. Se usa el impuesto de **liquidación**, que puede diferir del impuesto original de la reserva al cancelar. No se recalcula la identidad contable.
- Las tarjetas de retención siguen mostrando `deposit.amountCents` cuando existe una retención real. Antes de existir, usan el snapshot `booking.depositCents`. No corresponde reemplazar el importe de una operación ya realizada por una configuración actual.

## Ficha y checkout antes de crear una reserva: límite del wire

`QuoteDto` solo contiene `pricing` (`backend/src/common/serializers/wire-contract.ts:771`). No emite depósito ni identificador de snapshot. Antes de crear la reserva no existe `booking.depositCents` para mostrar: se conserva el importe actual **resuelto por la API** en `CarDetailDto.depositCents` (wire:119), marcado como estimación. No hay fallback a variable/configuración local.

Referencias: `src/features/cars/components/car-detail.tsx:331,919` y `src/features/cars/components/rental-policy-card.tsx:58`. La UI aclara que el depósito se confirma al crear la reserva. Tras crearla, el desglose usa el snapshot de reserva.

Dependencia para que quote, previsualización y creación garanticen idéntico depósito incluso ante un cambio concurrente de configuración: exponer el depósito resuelto en la cotización y vincular la creación/previsualización a ese snapshot (o rechazar y pedir nueva aceptación cuando cambie). No se inventó este contrato ni un endpoint. Agregar solo un campo al quote no garantiza esa invariancia temporal.

## Contrato

`src/features/bookings/components/rental-agreement-sign-dialog.tsx:144` renderiza `template.html` del servidor; no sustituye importes en el documento firmado. El PDF también lo entrega el backend. `backend/src/modules/contracts/rental-agreement.service.ts:153` exige el depósito congelado al construir el contrato de la reserva; líneas 175–179 usan el impuesto, tasa y depósito congelados. La preview anterior a crear la reserva usa el resultado de la cotización interna (línea 404). No se altera un documento firmado desde el cliente.

## Auditoría de cálculos

No se encontró suma de piezas para recalcular el total de una reserva en `src`. Se mantienen dos sumas **de página** en `src/app/admin/orders/page.tsx:123,124`: agregan `totalCents` y `commissionCents` ya enviados por el servidor para las órdenes visibles, rotuladas como esta página. No son un total de reserva ni un agregado global. La UI asume moneda uniforme en esa página (contrato actual USD); no convierte monedas.

## Verificación

`scripts/booking-lifecycle-smoke.mjs`: 29 casos, diez nuevos. Renderiza componentes reales con fixtures explícitos: impuesto cero/no cero, total deliberadamente distinto de la suma para detectar recomputación, depósito de reserva distinto del carro, estimación antes de reservar y desglose de liquidación para los tres viewers. No representa reservas ni cobros reales.
