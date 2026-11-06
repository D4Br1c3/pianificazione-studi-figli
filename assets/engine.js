(function (app) {
  'use strict';

  const { TAX, BANDS, STRATEGIES, SCENARIOS, yearsBetween } = app;
  const CENT_TOLERANCE = 0.005;
  const JUMP_SIGMA = 0.05;
  const PERCENTILES = [0.05, 0.25, 0.50, 0.75, 0.95];

  function bondYield(plan, maturity) {
    return (plan.curve === 'flat' ? plan.flat : BANDS.find(band => maturity < band.max).ytm) / 100;
  }

  function zeroFactor(years, yieldRate, bollo) {
    const gain = Math.expm1(Math.log1p(yieldRate) * years);
    return (1 + gain - TAX.bond * Math.max(0, gain)) * Math.exp(-bollo * years);
  }

  function ladderCost(calendar, plan) {
    return calendar.rows.flatMap(row => row.flows.map(flow => {
      const years = yearsBetween(calendar.start, flow.day);
      const ytm = bondYield(plan, years);
      const bollo = plan.bollo / 100;
      return {
        ...flow, year: row.year, years, ytm,
        full: flow.amount / zeroFactor(years, ytm, bollo),
        down: flow.amount / zeroFactor(years, ytm - 0.01, bollo),
        up: flow.amount / zeroFactor(years, ytm + 0.01, bollo)
      };
    }));
  }

  function fundLadder(costs, initial, share) {
    let equity = initial;
    const rungs = costs.map(cost => {
      const budget = Math.min(equity, cost.full * share);
      equity -= budget;
      return { ...cost, budget, maturity: cost.amount * (budget / cost.full) };
    });
    return { rungs, equity, invested: initial - equity };
  }

  function marketSettings(plan, scenario) {
    let mean = plan.equityReturn;
    let sigma = plan.volatility;
    if (scenario === 'bear') {
      mean -= plan.bearReturn;
      sigma += plan.bearVol;
    } else if (scenario === 'bull') {
      mean += plan.bullReturn;
      sigma = Math.max(0, sigma - plan.bullVol);
    }
    return { mean: mean / 100, sigma: sigma / 100 };
  }

  function marketMoments(plan, market, jumps) {
    const { mean, sigma } = market;
    const jump = plan.jumpMean / 100;
    const lambda = jumps ? plan.jumpFrequency : 0;
    const expected = (1 + mean) * Math.exp(-plan.ter / 100);
    const jumpSecond = (1 + jump) ** 2 * Math.exp(JUMP_SIGMA ** 2) - 2 * (1 + jump) + 1;
    const variance = sigma ** 2 + lambda * jumpSecond;
    const risk = expected * Math.sqrt(Math.expm1(variance));
    return { mean: expected - 1, risk, sharpe: risk > 0 ? (expected - 1 - plan.rf / 100) / risk : null };
  }

  function sharpeMetrics(plan, scenario = 'base') {
    const market = marketSettings(plan, scenario);
    const input = market.sigma > 0 ? (market.mean - plan.rf / 100) / market.sigma : null;
    return { input, plain: marketMoments(plan, market, false), jumps: marketMoments(plan, market, true) };
  }

  function generator(seed) {
    let current = seed >>> 0;
    let spare;
    function uniform() {
      current = (current + 0x6D2B79F5) >>> 0;
      let x = Math.imul(current ^ (current >>> 15), current | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    }
    function normal() {
      if (spare !== undefined) {
        const value = spare;
        spare = undefined;
        return value;
      }
      const radius = Math.sqrt(-2 * Math.log(1 - uniform()));
      const angle = 2 * Math.PI * uniform();
      spare = radius * Math.sin(angle);
      return radius * Math.cos(angle);
    }
    function poisson(threshold) {
      let count = 0;
      let product = uniform();
      while (product > threshold) {
        count++;
        product *= uniform();
      }
      return count;
    }
    return { normal, poisson };
  }

  function buildRun(state, calendar, base, scenario, plans) {
    const { plan } = state;
    const events = new Map();
    function event(day) {
      if (!events.has(day)) events.set(day, { day, deposit: 0, target: 0, review: false, report: -1, maturities: [0, 0, 0, 0] });
      return events.get(day);
    }
    event(calendar.start).review = true;
    for (const [day, amount] of app.contributionDates(state, calendar.start, calendar.end)) {
      event(day).deposit = amount;
    }
    for (let year = app.yearOf(calendar.start); year <= app.yearOf(calendar.end); year++) {
      for (const month of [1, 4, 7, 10]) {
        const day = app.date(year, month);
        if (day >= calendar.start && day <= calendar.end) event(day).review = true;
      }
    }
    calendar.rows.forEach((row, index) => {
      event(row.report).report = index;
      row.people.forEach(person => { if (person) event(person.due); });
      row.flows.forEach(flow => { event(flow.day).target = flow.amount; });
    });
    plans.forEach((fund, strategy) => {
      for (const rung of fund.rungs) {
        if (rung.maturity > 0) event(rung.day).maturities[strategy] = rung.maturity;
      }
    });
    if (scenario === 'shock' && calendar.firstUniversityDue !== null) {
      event(calendar.firstUniversityDue).shock = 1 - plan.crash / 100;
    }

    const ordered = [...events.values()].sort((a, b) => a.day - b.day);
    const market = marketSettings(plan, scenario);
    const lambda = plan.jumps ? plan.jumpFrequency : 0;
    const jump = plan.jumpMean / 100;
    const eta = Math.log1p(jump) - JUMP_SIGMA ** 2 / 2;
    const drift = Math.log1p(market.mean) - lambda * jump - market.sigma ** 2 / 2 - plan.ter / 100;
    const cashYtm = bondYield(plan, 0.5);
    const cashLog = Math.log1p(cashYtm);
    const cashNetLog = Math.log1p(cashYtm - TAX.bond * Math.max(0, cashYtm)) - plan.bollo / 100;
    const baseFlows = base.rows.flatMap(row => row.flows);
    const marks = plans.map(fund => calendar.rows.map(row => {
      let amount = 0;
      for (const rung of fund.rungs) {
        if (rung.budget > 0 && rung.day > row.report) {
          const progress = yearsBetween(calendar.start, row.report) / rung.years;
          amount += rung.budget * (rung.maturity / rung.budget) ** progress;
        }
      }
      return amount;
    }));

    let previous = calendar.start;
    const maturedSinceReport = [0, 0, 0, 0];
    const previousMark = plans.map(fund => fund.invested);
    let depositsSinceReport = 0;
    const deposits = [];
    for (const item of ordered) {
      const dt = yearsBetween(previous, item.day);
      item.dt = dt;
      item.drift = drift * dt;
      item.noise = market.sigma * Math.sqrt(dt);
      item.poisson = Math.exp(-lambda * dt);
      item.cashGain = Math.expm1(cashLog * dt);
      item.bollo = Math.exp(-plan.bollo / 100 * dt);
      item.real = 1 / Math.pow(1 + plan.inflation / 100, yearsBetween(calendar.start, item.day));
      item.crash = item.shock ?? 1;
      item.reserve = 0;
      if (item.review && plan.reservePct > 0) {
        for (const flow of baseFlows) {
          const distance = yearsBetween(item.day, flow.day);
          if (distance >= 0 && distance <= plan.reserveYears) item.reserve += flow.amount * Math.exp(-cashNetLog * distance);
        }
        item.reserve *= plan.reservePct / 100;
      }
      previous = item.day;
      depositsSinceReport += item.deposit;
      for (let strategy = 0; strategy < plans.length; strategy++) maturedSinceReport[strategy] += item.maturities[strategy];
      if (item.report >= 0) {
        deposits[item.report] = depositsSinceReport;
        depositsSinceReport = 0;
        item.ladderAccrual = marks.map((series, strategy) => {
          const mark = series[item.report];
          const accrual = mark - previousMark[strategy] + maturedSinceReport[strategy];
          previousMark[strategy] = mark;
          maturedSinceReport[strategy] = 0;
          return accrual;
        });
      }
    }
    return { ordered, eta, marks, deposits };
  }

  function sell(account, wanted) {
    if (wanted <= 0 || account.equity <= 0) return 0;
    const netFactor = 1 - TAX.equity * Math.max(0, 1 - account.basis / account.equity);
    const gross = Math.min(account.equity, wanted / netFactor);
    const net = gross * netFactor;
    account.basis *= 1 - gross / account.equity;
    account.equity -= gross;
    account.tax += gross - net;
    return net;
  }

  function buy(account, amount, orderFee) {
    const fee = Math.min(amount, orderFee);
    const net = amount - fee;
    account.equity += net;
    account.basis += net;
    account.fee += fee;
  }

  function newAccount(equity, fee) {
    const account = {
      equity: 0, basis: 0, cash: 0, fee: 0, tax: 0, bollo: 0, gains: 0,
      paid: 0, gap: 0, loss: 0, firstGap: -1
    };
    buy(account, equity, fee);
    return account;
  }

  function step(account, item, marketFactor, index, orderFee) {
    const oldEquity = account.equity;
    const equity = oldEquity * marketFactor;
    const interest = account.cash * item.cashGain;
    const tax = TAX.bond * Math.max(0, interest);
    const cash = account.cash + interest - tax;
    account.gains += equity - oldEquity + interest;
    account.tax += tax;
    account.equity = equity * item.bollo;
    account.cash = cash * item.bollo;
    account.bollo += equity - account.equity + cash - account.cash;

    if (item.deposit > 0) buy(account, item.deposit, orderFee);
    account.cash += item.maturities[index];
    if (index === 1 && item.reserve > account.cash) {
      account.cash += sell(account, item.reserve - account.cash);
    }
    if (item.target > 0) {
      const fromCash = Math.min(item.target, account.cash);
      account.cash -= fromCash;
      const paid = fromCash + sell(account, item.target - fromCash);
      account.paid += Math.min(item.target, paid);
      const gap = item.target - paid;
      if (gap > CENT_TOLERANCE) {
        account.gap += gap;
        account.loss += gap * item.real;
      }
    }
  }

  function stats(length, paths) {
    return {
      years: Array.from({ length }, () => ({
        balances: new Float32Array(paths), gaps: new Float32Array(paths), liquid: new Float32Array(paths),
        gains: 0, paid: 0, tax: 0, bollo: 0, fee: 0, misses: 0, first: 0
      })),
      losses: new Float64Array(paths), successes: 0
    };
  }

  function samplePath(run, buffers, plans, plan, rng, path) {
    const accounts = plans.map(fund => newAccount(fund.equity, plan.orderFee));
    for (const item of run.ordered) {
      let factor = item.crash;
      if (item.dt > 0) {
        let logReturn = item.drift + item.noise * rng.normal();
        if (item.poisson < 1) {
          const count = rng.poisson(item.poisson);
          if (count > 0) logReturn += count * run.eta + Math.sqrt(count) * JUMP_SIGMA * rng.normal();
        }
        factor *= Math.exp(logReturn);
      }
      for (let index = 0; index < accounts.length; index++) {
        const account = accounts[index];
        step(account, item, factor, index, plan.orderFee);
        if (item.report < 0) continue;

        const buffer = buffers[index].years[item.report];
        const liquid = account.cash + account.equity - TAX.equity * Math.max(0, account.equity - account.basis);
        buffer.balances[path] = liquid + run.marks[index][item.report];
        buffer.liquid[path] = liquid;
        buffer.gaps[path] = account.gap;
        buffer.gains += account.gains + item.ladderAccrual[index];
        buffer.paid += account.paid;
        buffer.tax += account.tax;
        buffer.bollo += account.bollo;
        buffer.fee += account.fee;
        if (account.gap > CENT_TOLERANCE) {
          buffer.misses++;
          if (account.firstGap < 0) {
            account.firstGap = item.report;
            buffer.first++;
          }
        }
        account.gap = account.gains = account.paid = account.tax = account.bollo = account.fee = 0;
      }
    }
    accounts.forEach((account, index) => {
      const buffer = buffers[index];
      buffer.losses[path] = account.loss;
      if (account.firstGap < 0) buffer.successes++;
    });
  }

  function percentile(sorted, probability) {
    const index = (sorted.length - 1) * probability;
    const low = Math.floor(index);
    const high = Math.ceil(index);
    return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
  }

  function tail(sorted, confidence) {
    const length = sorted.length;
    const count = (1 - confidence) * length;
    const whole = Math.floor(count);
    let sum = 0;
    for (let index = length - whole; index < length; index++) sum += sorted[index];
    if (whole < length) sum += (count - whole) * sorted[length - whole - 1];
    return { var: sorted[Math.max(0, Math.ceil(confidence * length) - 1)], es: sum / count };
  }

  function wilson(successes, n) {
    const p = successes / n;
    const z = 1.959963984540054;
    const center = (p + z ** 2 / (2 * n)) / (1 + z ** 2 / n);
    const half = z * Math.sqrt(p * (1 - p) / n + z ** 2 / (4 * n ** 2)) / (1 + z ** 2 / n);
    return [Math.max(0, center - half), Math.min(1, center + half)];
  }

  function summarize(buffer, calendar, run, strategy, n) {
    const rows = buffer.years.map((data, index) => {
      data.balances.sort();
      data.gaps.sort();
      data.liquid.sort();
      return {
        fan: PERCENTILES.map(probability => percentile(data.balances, probability)),
        liquid: percentile(data.liquid, 0.5),
        locked: run.marks[strategy][index],
        gain: data.gains / n, paid: data.paid / n, tax: data.tax / n, bollo: data.bollo / n, fee: data.fee / n,
        gap50: percentile(data.gaps, 0.5), gap95: percentile(data.gaps, 0.95),
        gapMean: data.gaps.reduce((sum, value) => sum + value, 0) / n,
        gapProbability: data.misses / n, firstGap: data.first / n,
        deposit: run.deposits[index]
      };
    });
    buffer.losses.sort();
    const first = rows.map((row, index) => ({ year: calendar.rows[index].year, probability: row.firstGap }))
      .filter(row => row.probability > 0).sort((a, b) => b.probability - a.probability)[0] ?? null;
    return {
      rows, success: buffer.successes / n, interval: wilson(buffer.successes, n),
      loss95: tail(buffer.losses, 0.95), loss99: tail(buffer.losses, 0.99),
      lossMean: buffer.losses.reduce((sum, value) => sum + value, 0) / n,
      final: rows.at(-1).fan, first
    };
  }

  function prepare(state) {
    const base = app.buildCalendar(state);
    const costs = ladderCost(base, state.plan);
    const { lump, hybridPct } = state.plan;
    const plans = [fundLadder([], lump, 0), fundLadder([], lump, 0),
      fundLadder(costs, lump, 1), fundLadder(costs, lump, hybridPct / 100)];
    const calendars = Object.fromEntries(SCENARIOS.map(({ id }) => [id, id === 'shock' ? app.buildCalendar(state, id) : base]));
    return { base, costs, plans, calendars };
  }

  async function simulate(state, { onProgress = () => {}, signal, yieldToBrowser = () => Promise.resolve() } = {}) {
    const validated = app.validateState(state);
    const { plan } = validated;
    const prepared = prepare(validated);
    const scenarios = {};
    for (const [index, scenario] of SCENARIOS.entries()) {
      const calendar = prepared.calendars[scenario.id];
      const run = buildRun(validated, calendar, prepared.base, scenario.id, prepared.plans);
      const rng = generator(plan.seed);
      const buffers = STRATEGIES.map(() => stats(calendar.rows.length, plan.paths));
      for (let path = 0; path < plan.paths; path++) {
        if (path % 256 === 0) {
          if (signal?.aborted) throw new DOMException('Simulazione interrotta', 'AbortError');
          onProgress((index + path / plan.paths) / SCENARIOS.length);
          await yieldToBrowser();
        }
        samplePath(run, buffers, prepared.plans, plan, rng, path);
      }
      scenarios[scenario.id] = Object.fromEntries(STRATEGIES.map((strategy, strategyIndex) => [
        strategy.id, summarize(buffers[strategyIndex], calendar, run, strategyIndex, plan.paths)
      ]));
    }
    onProgress(1);
    return { ...prepared, scenarios };
  }

  Object.assign(app, { bondYield, zeroFactor, ladderCost, fundLadder, marketSettings, sharpeMetrics, tail, prepare, simulate });
})(globalThis.StudyPlan);
