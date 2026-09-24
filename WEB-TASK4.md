# Tarea 4 — Contrato de configuración de plataforma

## Inventario antes del cambio

Referencias del frontend en main `2b97f54` (PR #9 mergeado); se conservan estos
números históricos porque el formulario se corrige en este PR.

El formulario esperaba **13 claves**, no ocho. `PlatformConfigDto` las declaraba
obligatorias en `src/shared/types/domain.ts:850-863`. Tanto GET como PATCH se
tipaban con ese DTO plano, sin validar la respuesta: `src/features/admin/api.ts:338-348`.

En la tabla, F significa `src/features/admin/components/platform-config-form.tsx`.
Todos los campos se esperaban presentes en GET y en la respuesta PATCH. El PATCH
enviaba solamente claves cuyo valor difiriera del objeto cargado (`F:164-175`),
como números/booleanos JSON, no strings. Ausente en PATCH significaba conservar.

| Campo JSON esperado | Tipo y límites del formulario anterior | Edición / conversión | Referencias F (validación; envío; lectura) | API actual |
|---|---|---|---|---|
| commissionPct | number 0–100, hasta 2 decimales | string → Number | 59; 142; 123 | GET raíz; PATCH /commission |
| freeCancellationHours | int 0–720 | horas, string → Number | 69; 143; 124 | GET cancellationPolicy; PATCH /cancellation-policy |
| lateCancellationRetentionPct | int 0–100 | porcentaje, string → Number | 73; 144; 125 | igual |
| earlyReturnPenaltyDays | int 0–7 | días, string → Number | 77; 145; 126 | igual; backend acepta hasta **30** |
| disputeWindowHours | int 0–168 | horas, string → Number | 81; 146; 127 | no expuesto por GET/PATCH admin |
| claimResponseHours | int 12–168 | horas, string → Number | 85; 147; 128 | no expuesto |
| defaultDepositCents | int 0–500000 | UI `defaultDeposit`, USD 0–5000 hasta 2 decimales → centavos con Math.round(units * 100); lectura /100 con 2 decimales | 90; 148; 129 | no expuesto |
| checkinAdvancePct | int 0–80 | porcentaje, string → Number | 100; 149; 130 | no expuesto |
| depositReauthLeadHours | int 6–72 | horas, string → Number | 104; 150; 131 | no expuesto |
| inspectionsRequired | boolean | checkbox, sin conversión | 108; 151; 132 | no expuesto |
| inspectionMinPhotos | int 0–30 | fotos, string → Number | 109; 152; 133 | no expuesto |
| inspectionMediaRetentionMonths | int 3–60 | meses, string → Number | 113; 153; 134 | no expuesto; tampoco localizado en PlatformConfigValues |
| stripePayoutsEnabled | boolean | checkbox, sin conversión | 117; 154; 135 | no expuesto |

Los límites numéricos originales están centralizados en `F:34-46`; conversiones
monetarias en `src/shared/utils/money.ts:52-62`. `F:195-200` sustituía caché,
reiniciaba campos y anunciaba éxito ante cualquier respuesta resuelta, sin comprobar
que contuviera las claves enviadas ni los valores solicitados.

**Fallo real:** la ruta raíz inexistente responde error; el código original no
anunciaba éxito ante ese 404. El GET anidado producía strings `"undefined"`, un
depósito `"NaN"` y checkboxes indefinidos; la validación podía impedir incluso
enviar la comisión. El riesgo de falso éxito era aceptar un 2xx con valores
incompletos/ignorados, no que el 404 se tratara como éxito.

## Contrato backend comprobado (repo hermano, solo lectura)

- `backend/src/modules/admin/admin.controller.ts:17-21`: GET /admin/config,
  `{commissionPct: number, cancellationPolicy: {freeCancellationHours: number,
  lateCancellationRetentionPct: number, earlyReturnPenaltyDays: number}}`.
- Controller `:23-33`: PATCH /admin/config/commission, body `{commissionPct}`,
  respuesta `{commissionPct}`. `dto/update-commission.dto.ts:3-9`: number 0–100;
  backend no impone el máximo de dos decimales de la UI.
- Controller `:36-42`: PATCH /admin/config/cancellation-policy, tres campos
  opcionales; devuelve la política completa, **sin envoltorio**.
  `dto/update-cancellation-policy.dto.ts:10-30`: enteros 0–720, 0–100 y 0–30.
- `platform-config.service.ts:196-201`: GET devuelve únicamente comisión y política.
  Sus defaults de política son 48/20/1 (`:28-32`); comisión usa DB o env/default 15
  (`:108-112`). Son valores del servidor, nunca defaults inventados en el cliente.
- `platform-config.service.ts:44-61`: existen ocho claves internas en snake_case
  para payouts, adelanto, inspecciones, fotos, disputas, respuesta, depósito y
  reautorización; esto **no equivale a un contrato HTTP editable**. No aparece
  retención de medios en ese mapa.

## Implementación compatible

Se guardan comisión y política de forma independiente por las dos rutas existentes.
Una sección no anuncia que la otra se guardó. Las nueve opciones restantes se
enumeran como no disponibles, sin valores aparentes ni controles que prometan guardar.
La penalidad permite los 30 días soportados por el backend actual.

`platform-config-contract.ts` valida y normaliza el GET anidado actual; también
acepta las cuatro claves en raíz para la transición al DTO plano anunciado. No
habilita edición adicional por inferir capacidades a partir de ese formato.
`platform-config-api.ts` valida las respuestas de PATCH y compara los valores
enviados antes de permitir el mensaje de éxito. Si la respuesta es incompleta o
distinta, advierte que el resultado no está confirmado y que debe recargarse antes
de reintentar. Errores HTTP se conservan; no hay fallback a rutas inventadas.

Referencias nuevas: normalización `src/features/admin/platform-config-contract.ts:15`,
lectura y guardados `src/features/admin/platform-config-api.ts:11`, `:22`, `:34`;
opciones no disponibles `src/features/admin/components/platform-config-form.tsx:68`,
formularios independientes `:89` y `:168`; mensaje de resultado `:253`.

El formulario actualiza la caché de cada sección sin pisar la otra y revalida
configuración; al guardar política también revalida las consultas legales.
Los campos se bloquean durante su guardado para no perder ediciones en vuelo.

## Dependencias para ampliar a las 13 claves

El backend debe confirmar GET plano completo y PATCH raíz parcial (respuesta
completa), límites, persistencia y aplicación efectiva de cada opción, incluida
retención de medios. Debe conservar las rutas existentes durante el despliegue.
La discrepancia 7/30 días se resuelve aquí con el contrato actual de 30, no cambiando
backend. No se consume PATCH raíz hasta que exista y se haya verificado.

Nota SEO de Tarea 3: retirar loading.tsx priorizó el 404 correcto sobre el skeleton;
el tiempo percibido hasta la primera respuesta de esas rutas puede empeorar.
Validar antes de iniciar streaming queda como refinamiento futuro, sin medir ni
implementar en esta tarea.

## Validación local

- `npm run build`: salida 0, 51/51 páginas; Stripe test key permitida solo con
  bandera del proceso, sin cambiar .env ni el guard de producción.
- `npx tsc --noEmit`: salida 0, 0 errores.
- `npm run lint`: salida 0, 0 errores y 0 warnings.
- `npm run lint:suppressions`: salida 0, 218 archivos sin supresiones.
- `node scripts/platform-config-smoke.mjs`: 11 comprobaciones de contrato pasan,
  con transporte sintético: GET anidado/plano, validación, rutas existentes,
  cambios parciales, valores ignorados, respuestas vacías y error HTTP.
- `git diff --check`: salida 0.

No se modificó configuración real ni se verificó una sesión admin autenticada.
Las pruebas del adaptador no acreditan persistencia en una base de datos real.
