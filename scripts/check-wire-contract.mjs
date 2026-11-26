import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { sourceLoader } from './helpers/source-runtime.mjs';

const backend = process.env.BACKEND_CONTRACT_ROOT || fileURLToPath(new URL('../../backend/', import.meta.url));
const script = `${backend}/scripts/export-wire-fixtures.cjs`;
if (!existsSync(script)) throw new Error('Backend contract fixtures are required. Check out cibaura-server beside this repository.');
const fixtures = JSON.parse(execFileSync(process.execPath, [script], { cwd: backend, encoding: 'utf8' }));
const load = sourceLoader();
const wire = load('src/shared/api/wire.ts');
const cars = load('src/modules/cars/schema/cars.schema.ts');
const agency = load('src/modules/agency/schema/agency.schema.ts');
const bookings = load('src/modules/bookings/schema/bookings.schema.ts');
const auth = load('src/modules/auth/schema/auth.schema.ts');
const cases = [[wire.carWireSchema, fixtures.car], [cars.carDetailWireSchema, fixtures.detail],
  [bookings.quoteWireSchema, fixtures.quote], [auth.customerProfileWireSchema, fixtures.user],
  ...fixtures.agencyCars.map(value => [agency.agencyCarWireSchema, value]),
  ...fixtures.payouts.map(value => [agency.payoutWireSchema, value])];
for (const [schema, value] of cases) {
  assert(schema, 'A contract schema was renamed; update the gate.');
  schema.parse(value);
}
console.log(`Contract runtime: ${cases.length} backend serializer cases accepted, including null plates and every payout rail state.`);
