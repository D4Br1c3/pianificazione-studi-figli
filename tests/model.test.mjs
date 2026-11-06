import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../assets/state.js';
import '../assets/calendar.js';
import '../assets/engine.js';
import '../assets/files.js';

const app = globalThis.StudyPlan;
const approx = (actual, expected, tolerance = 1e-6) => assert.ok(
  Math.abs(actual - expected) <= tolerance, String(actual) + ' ≠ ' + expected
);

function oneChild(start, birth, stages) {
  const state = app.defaultState(start);
  state.children = [app.newChild(1, birth)];
  const child = state.children[0];
  for (const id of Object.keys(child.stages)) child.stages[id].enabled = stages.includes(id);
  Object.assign(state.plan, {
    inflation: 0, equityReturn: 0, volatility: 0, jumps: false, pac: 0,
    ter: 0, bollo: 0, curve: 'flat', flat: 0, paths: 1000
  });
  return state;
}

test('coorti italiane, anticipo al 30 aprile e scelte indipendenti', () => {
  const state = oneChild('2026-09-01', '2024-04-30', ['nursery', 'infant', 'primary']);
  const child = state.children[0];
  child.infantEarly = true;
  let calendar = app.buildCalendar(app.validateState(state));
  assert.equal(calendar.rows[0].people[0].stage, 'infant');
  assert.equal(calendar.rows.find(row => row.people[0]?.stage === 'primary').year, 2030);
  child.primaryEarly = true;
  assert.equal(app.buildCalendar(state).rows.find(row => row.people[0]?.stage === 'primary').year, 2029);
  child.birth = '2024-05-01';
  assert.throws(() => app.validateState(state), /30 aprile/);
  child.birth = '2024-11-21';
  child.infantEarly = child.primaryEarly = false;
  calendar = app.buildCalendar(app.validateState(state));
  const primary = calendar.rows.find(row => row.people[0]?.stage === 'primary');
  assert.equal(primary.year, 2030);
  assert.equal(primary.people[0].age, 5);
});

test('sezione primavera e nido rispettano la prima età utile', () => {
  const spring = oneChild('2026-09-01', '2024-11-30', ['nursery', 'spring', 'infant']);
  const calendar = app.buildCalendar(spring);
  assert.equal(calendar.rows[0].people[0].stage, 'spring');
  assert.equal(app.isoDay(calendar.rows[0].people[0].due), '2026-11-30');
  const nursery = oneChild('2026-09-01', '2026-11-30', ['nursery']);
  assert.equal(app.isoDay(app.buildCalendar(nursery).rows[0].people[0].due), '2027-02-28');
});

test('spesa residua, aiuti e reddito zero si riconciliano', () => {
  const state = oneChild('2026-11-06', '2019-11-06', ['primary']);
  state.plan.currentRemaining = 40;
  state.plan.incomeShare = 50;
  state.parents.forEach(parent => { parent.income = 0; });
  state.children[0].stages.primary.aid = 100;
  const [current, next] = app.buildCalendar(state).rows;
  assert.equal(current.gross, 400);
  assert.equal(current.aid, 40);
  assert.equal(current.net, 360);
  assert.equal(current.target, 360);
  assert.equal(current.burden, null);
  assert.equal(current.incomePaid, 0);
  assert.equal(next.net, 900);
});

test('alert per intersezione d’anno e reddito sostitutivo alla data di riferimento', () => {
  const state = oneChild('2026-09-01', '2020-06-01', ['primary']);
  state.parents = [app.newParent(1, '1959-11-01')];
  Object.assign(state.parents[0], { realGrowth: 0, retirementAge: 67, replacement: 50 });
  const [current, next] = app.buildCalendar(state).rows;
  assert.equal(current.profiles[0].age, 66);
  assert.equal(current.warning, 'amber');
  assert.equal(current.income, 10000);
  assert.equal(next.income, 5000);
  assert.equal(next.profiles[0].age, 67);
  state.parents[0].birth = '1950-11-01';
  assert.equal(app.buildCalendar(state).rows[0].income, 10000);
});

test('la frequenza modifica importi e date preservando il budget annuale', () => {
  const state = app.defaultState('2026-01-01');
  for (const frequency of [4, 12, 24]) {
    state.plan.frequency = frequency;
    const deposits = app.contributionDates(state, app.date(2026), app.date(2026, 12, 31));
    assert.equal(deposits.size, frequency);
    assert.equal([...deposits.values()].reduce((total, item) => total + item, 0), 3000);
    assert.equal(deposits.get(app.date(2026, 12, 31)), 3000 / frequency);
  }
  state.plan.timing = 'start';
  state.plan.frequency = 24;
  assert.equal(app.contributionDates(state, app.date(2026), app.date(2026, 1, 16)).size, 2);
});

test('sette tassi a gradini e fattore netto applicato al capitale della singola scadenza', () => {
  const { plan } = app.defaultState('2026-01-01');
  const maturities = [0, 1, 3, 5, 7, 10, 20];
  assert.deepEqual(maturities.map(t => app.bondYield(plan, t)), [0.025, 0.035, 0.0375, 0.04, 0.0425, 0.045, 0.0475]);
  const gross = 1.035 ** 10;
  approx(app.zeroFactor(10, 0.035, 0.002), (gross - 0.125 * (gross - 1)) * Math.exp(-0.02));
  approx(app.zeroFactor(2, -0.01, 0), 0.99 ** 2);
  assert.equal(app.zeroFactor(0, 0.035, 0.002), 1);
});

test('copertura esatta e saldo finale zero sono un successo', async () => {
  const state = oneChild('2026-09-01', '2008-05-01', ['high']);
  state.plan.lump = 1000;
  const result = await app.simulate(state);
  for (const strategy of app.STRATEGIES) {
    const value = result.scenarios.base[strategy.id];
    assert.equal(value.success, 1);
    assert.equal(value.final[2], 0);
    assert.equal(value.loss99.es, 0);
  }
});

test('i versamenti futuri non possono colmare retroattivamente uno scoperto', async () => {
  const state = oneChild('2026-09-01', '2020-05-01', ['primary']);
  state.plan.pac = 500;
  const { scenarios } = await app.simulate(state);
  const value = scenarios.base.equity;
  assert.equal(value.success, 0);
  assert.equal(value.rows[0].gap50, 1000);
  assert.equal(value.rows[0].firstGap, 1);
  assert.ok(value.final[2] > 0);
  approx(value.loss95.es, 1000);
  assert.deepEqual(scenarios.base.equity, scenarios.base.ladder);
  assert.deepEqual(scenarios.base.equity, scenarios.base.hybrid);
});

test('una ladder acquistata su Base non compra più copertura durante lo stress', async () => {
  const state = oneChild('2026-09-01', '2008-05-01', ['bachelor', 'master']);
  state.plan.stressInflation = 10;
  state.plan.lump = app.buildCalendar(state).totals.target;
  const result = await app.simulate(state);
  assert.equal(result.scenarios.base.ladder.success, 1);
  assert.equal(result.scenarios.shock.ladder.success, 0);
  assert.ok(result.scenarios.shock.ladder.loss99.es > 0);
});

test('prelievo azionario realizza la quota proporzionale del guadagno', async () => {
  const state = oneChild('2026-09-01', '2008-05-01', ['high']);
  Object.assign(state.plan, { equityReturn: 25, lump: 2000, payMonth: 2 });
  const result = await app.simulate(state);
  const base = result.scenarios.base.equity.rows[0];
  const t = app.yearsBetween(app.date(2026, 9), app.date(2027, 2));
  const value = 2000 * 1.25 ** t;
  const taxFraction = 0.26 * (1 - 2000 / value);
  approx(base.tax, 1000 / (1 - taxFraction) * taxFraction, 1e-8);
  approx(base.fan[2], value - 0.26 * (value - 2000) - 1000, 0.001);
});

test('seed riproducibile, anni e strategia condividono la stessa storia di mercato', async () => {
  const state = oneChild('2026-09-01', '2020-05-01', ['primary']);
  Object.assign(state.plan, { pac: 350, equityReturn: 6, volatility: 15, jumps: true, bearReturn: 0, bearVol: 0 });
  const first = await app.simulate(state);
  const second = await app.simulate(state);
  assert.deepEqual(first.scenarios, second.scenarios);
  assert.deepEqual(first.scenarios.base, first.scenarios.bear);
  assert.notDeepEqual(first.scenarios.base.equity.final[0], first.scenarios.base.equity.final[4]);
});

test('VaR con massa a zero e ES con coda positiva', () => {
  const losses = new Float64Array(100);
  losses[98] = 50;
  losses[99] = 100;
  const at95 = app.tail(losses, 0.95);
  assert.equal(at95.var, 0);
  approx(at95.es, 30);
  approx(app.tail(losses, 0.99).es, 100);
});

test('round trip JSON e CSV, apostrofi e protezione da formule', () => {
  const state = app.defaultState('2026-11-06');
  state.children[0].name = '=HYPERLINK("https://example.com";"test")';
  state.parents[0].name = "'nome";
  state.children[1].name = 'Due\nrighe';
  state.plan.pac = 340.125;
  state.view.year = 2034;
  state.view.scenario = 'shock';
  const text = app.assumptionsCsv(state);
  assert.match(text, /'=HYPERLINK/);
  assert.match(text, /340,125/);
  assert.match(text, /MiFID II/);
  assert.deepEqual(app.readSession(app.sessionJson(state)), state);
  assert.deepEqual(app.readAssumptions(text), state);
  assert.throws(() => app.readAssumptions(text + 'piano;__proto__;123\n'), /sconosciuto/);
  assert.throws(() => app.readAssumptions(text + 'piano;pac;1\n'), /duplicato/);
});

test('senza figli e senza reddito resta una riga con misure definite', async () => {
  const state = app.defaultState('2026-11-06');
  state.children = [];
  state.parents[0].income = state.parents[1].income = 0;
  state.plan.paths = 1000;
  const result = await app.simulate(state);
  assert.equal(result.base.rows.length, 1);
  assert.equal(result.base.rows[0].burden, null);
  assert.equal(result.scenarios.base.equity.success, 1);
  const exported = app.resultCsv(state, result);
  assert.match(exported, /MiFID II/);
  assert.equal(exported.trim().split('\n').length, 17);
});
