(function (app) {
  'use strict';

  const { SCENARIOS, STRATEGIES, STAGE_BY_ID } = app;
  const $ = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const currency = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const percent = new Intl.NumberFormat('it-IT', { style: 'percent', maximumFractionDigits: 2 });
  const decimal = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 });
  const compact = new Intl.NumberFormat('it-IT', { notation: 'compact', maximumFractionDigits: 1 });
  const calendarDate = new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeZone: 'UTC' });
  const euros = value => value == null ? 'N.D.' : currency.format(value === 0 ? 0 : value);
  const pct = value => value == null ? 'N.D.' : percent.format(value);
  const num = value => value == null ? 'N.D.' : decimal.format(value);
  const fmtDate = day => calendarDate.format(new Date(day * 86400000));
  const scenarioName = id => SCENARIOS.find(item => item.id === id).label;
  const strategyName = id => STRATEGIES.find(item => item.id === id).label;
  const empty = text => '<p class="empty">' + escape(text) + '</p>';
  const sum = (items, key) => items.reduce((total, item) => total + item[key], 0);
  const badge = (text, tone = 'neutral') => `<span class="badge ${tone}">${escape(text)}</span>`;
  const strip = (name, value, active = false) => `<div class="strip-item${active ? ' active' : ''}">${escape(name)}<strong>${value}</strong></div>`;

  function pensionText(state, row) {
    if (!row.warning) return '';
    const names = row.profiles.flatMap((profile, index) => profile.pensionWindow ? [state.parents[index].name] : []);
    return 'Fascia 67–70 anni · ' + names.join(', ');
  }

  function retirementText(state, row) {
    return row.profiles.flatMap((profile, index) => profile.retirementInYear === null ? [] : [
      'Pensione ipotizzata di ' + state.parents[index].name + ' dal ' + fmtDate(profile.retirementInYear)
    ]).join(' · ');
  }

  function table(label, headers, rows, tall = false) {
    return `<div class="table-scroll${tall ? ' tall' : ''}" role="region" aria-label="${escape(label)}" tabindex="0">
      <table aria-label="${escape(label)}"><thead><tr>${headers.map(header => '<th scope="col">' + escape(header) + '</th>').join('')}</tr></thead>
      <tbody>${rows.map(({ cells, className = '' }) => `<tr class="${className}">${cells.map((value, index) => (
        index === 0 ? '<th scope="row">' + value + '</th>' : '<td>' + value + '</td>')).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  function context(state, result) {
    const { view, plan } = state;
    const calendar = result.calendars[view.scenario];
    const risk = result.scenarios[view.scenario][view.strategy];
    const finalFactor = view.units === 'real' ? 1 / Math.pow(1 + plan.inflation / 100, app.yearsBetween(calendar.start, calendar.end)) : 1;
    return { calendar, risk, finalFactor };
  }

  function renderMetrics(state, result) {
    const { calendar, risk } = context(state, result);
    const baseCost = sum(result.costs, 'full');
    const last = calendar.rows.at(-1);
    const start = calendar.firstWithdrawal === null ? 'Nessuna spesa affidata al portafoglio' :
      'Prima spesa del portafoglio il ' + fmtDate(calendar.firstWithdrawal);
    $('results-context').textContent = [app.withdrawalLabel(state.plan), start,
      'Ultimo anno ' + last.label, num(state.plan.paths) + ' percorsi per scenario'].join(' · ');
    const values = [
      ['Spese nette ancora da pagare', euros(calendar.totals.net), 'Ai prezzi previsti negli anni scolastici'],
      ['Capitale per la ladder integrale', euros(baseCost), 'Somma teorica necessaria oggi · scenario Base'],
      ['Probabilità di pagare ogni scadenza', pct(risk.success), risk.success === null ? 'Nessuna spesa del portafoglio' :
        strategyName(state.view.strategy) + ' · ' + scenarioName(state.view.scenario)],
      ['Scoperto nel 5% peggiore (ES 95%)', euros(risk.loss95.es), 'Media della coda · euro di oggi']
    ];
    $('metrics').innerHTML = values.map(([name, value, note], index) =>
      `<div class="metric${index === 2 ? ' accent' : ''}"><span class="label">${name}</span><strong>${value}</strong><small>${note}</small></div>`).join('');
  }

  function fanMarkup(state, calendar, risk, print = false) {
    const isReal = state.view.units === 'real';
    const rows = calendar.rows;
    const width = 1000, height = 298, left = 68, right = 20, top = 17, bottom = 40;
    const plot = width - left - right;
    const step = plot / Math.max(1, rows.length - 1);
    const data = rows.map((row, index) => {
      const factor = isReal ? 1 / (1 + state.plan.inflation / 100) ** app.yearsBetween(calendar.start, row.report) : 1;
      return { fan: risk.rows[index].fan.map(value => value * factor), target: isReal ? row.cumTargetReal : row.cumTarget, row };
    });
    const maxValue = Math.max(1, ...data.map(point => Math.max(point.fan[4], state.view.cumulative ? point.target : 0)));
    const power = 10 ** Math.floor(Math.log10(maxValue / 4));
    const axisStep = [1, 2, 2.5, 5, 10].find(size => size * power >= maxValue / 4) * power;
    const axisMax = Math.ceil(maxValue / axisStep) * axisStep;
    const x = index => rows.length === 1 ? left + plot / 2 : left + index * step;
    const y = value => height - bottom - value * (height - bottom - top) / axisMax;
    const point = (index, value) => x(index).toFixed(1) + ',' + y(value).toFixed(1);
    const line = getter => data.map((item, index) => point(index, getter(item))).join(' ');
    const band = (low, high) => line(item => item.fan[high]) + ' ' + data.map((_, index) => {
      const reverse = data.length - 1 - index;
      return point(reverse, data[reverse].fan[low]);
    }).join(' ');
    const grid = [];
    for (let value = 0; value <= axisMax + axisStep * 0.01; value += axisStep) {
      const pos = y(value);
      grid.push(`<line class="chart-grid" x1="${left}" x2="${width - right}" y1="${pos}" y2="${pos}"/>
        <text class="chart-axis" x="${left - 9}" y="${pos + 4}" text-anchor="end">${escape(compact.format(value))}</text>`);
    }
    const tickStep = Math.ceil(rows.length / 8);
    const ticks = rows.map((row, index) => {
      if (index !== rows.length - 1 && (index % tickStep !== 0 || rows.length - index < tickStep)) return '';
      return `<text class="chart-axis${row.warning ? ' year-hot' : ''}" x="${x(index)}" y="${height - 14}" text-anchor="middle">${row.label}</text>`;
    }).join('');
    const pensionBands = rows.map((row, index) => {
      if (!row.warning) return '';
      const from = Math.max(left, x(index) - step / 2);
      const to = Math.min(width - right, x(index) + step / 2);
      return `<rect x="${from}" y="${top}" width="${to - from}" height="${height - bottom - top}" fill="${row.warning === 'red' ? '#fae2da' : '#fff0d1'}">
        <title>${escape(row.label + ' · ' + pensionText(state, row))}</title></rect>`;
    }).join('');
    const selected = Math.max(0, rows.findIndex(row => row.year === state.view.year));
    const label = 'Cono di Ibbotson, ' + strategyName(state.view.strategy) + ', ' + scenarioName(state.view.scenario);
    const svg = `<svg class="svg-fan" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escape(label)}">
      <title>${escape(label)}</title><desc>Saldo netto a ciascuna data. Percentili dal 5 al 95. La tabella annuale riporta i valori numerici.</desc>
      ${pensionBands}${grid.join('')}
      <polygon class="fan-outer" points="${band(0, 4)}"/><polygon class="fan-inner" points="${band(1, 3)}"/>
      <polyline class="fan-edge" points="${line(item => item.fan[0])}"/><polyline class="fan-edge" points="${line(item => item.fan[4])}"/>
      <polyline class="fan-med" points="${line(item => item.fan[2])}"/>
      ${rows.length === 1 ? `<circle cx="${x(0)}" cy="${y(data[0].fan[2])}" r="4" fill="#087064"/>` : ''}
      ${state.view.cumulative ? `<polyline class="fan-cost" points="${line(item => item.target)}"/>
        ${rows.length === 1 ? `<circle cx="${x(0)}" cy="${y(data[0].target)}" r="4" fill="#a76b22"/>` : ''}` : ''}
      ${print ? '' : `<line data-marker class="fan-marker" x1="${x(selected)}" x2="${x(selected)}" y1="${top}" y2="${height - bottom}"/>`}
      ${ticks}</svg>`;
    const legend = `<div class="legend"><span><i class="key outer"></i>P5–P95</span><span><i class="key inner"></i>P25–P75</span>
      <span><i class="key median"></i>P50 (mediana)</span>${state.view.cumulative ? '<span><i class="key cost"></i>Spese cumulate del portafoglio</span>' : ''}
      <span><i class="key red"></i><i class="key amber"></i>Fascia 67–70 anni</span><span>${isReal ? 'Euro di oggi' : 'Euro alle date future'}</span></div>`;
    return { svg, legend, data, x, left, step, width, selected };
  }

  function renderFan(state, calendar, risk) {
    const chart = fanMarkup(state, calendar, risk);
    $('fan').innerHTML = `<div class="chart-shell" tabindex="0" role="region" aria-label="Cono di Ibbotson, scorribile">${chart.svg}</div>
      <div class="chart-meta">${chart.legend}</div><p id="chart-readout" class="chart-readout"></p>
      <p class="legend-note">A ogni data, il 90% dei saldi simulati ricade tra P5 e P95. Il saldo include il capitale già destinato alle scadenze della ladder. La linea tratteggiata somma le spese affidate al portafoglio fino a quell’anno.</p>`;
    const svg = $('fan').querySelector('svg');
    const marker = svg.querySelector('[data-marker]');
    let last = -1;
    function show(index) {
      if (index === last) return;
      last = index;
      const { row, fan, target } = chart.data[index];
      marker.setAttribute('x1', chart.x(index));
      marker.setAttribute('x2', chart.x(index));
      const pension = pensionText(state, row);
      $('chart-readout').textContent = row.label + ' · P5 ' + euros(fan[0]) + ' · P25 ' + euros(fan[1]) +
        ' · P50 ' + euros(fan[2]) + ' · P75 ' + euros(fan[3]) + ' · P95 ' + euros(fan[4]) +
        (state.view.cumulative ? ' · Spese cumulate ' + euros(target) : '') + (pension ? ' · ' + pension : '');
    }
    show(chart.selected);
    svg.addEventListener('pointermove', event => {
      const bounds = svg.getBoundingClientRect();
      const position = (event.clientX - bounds.left) * chart.width / bounds.width;
      const index = Math.min(chart.data.length - 1, Math.max(0, Math.round((position - chart.left) / chart.step)));
      show(index);
    });
    svg.addEventListener('pointerleave', () => show(chart.selected));
  }

  function renderComparison(state, result) {
    const { view, plan } = state;
    const { calendar, risk, finalFactor } = context(state, result);
    const market = app.marketSettings(plan, view.scenario);
    const sharpe = app.sharpeMetrics(plan, view.scenario);
    const active = plan.jumps ? sharpe.jumps : sharpe.plain;
    const metrics = [
      strip('Sharpe delle ipotesi', num(sharpe.input)),
      strip('Sharpe senza salti', num(sharpe.plain.sharpe), !plan.jumps),
      strip('Sharpe con salti', num(sharpe.jumps.sharpe), plan.jumps),
      strip('Rischio annuo del modello', pct(active.risk))
    ];
    const scenario = SCENARIOS.find(item => item.id === view.scenario);
    let shockDescription = scenario.description;
    if (view.scenario === 'shock') {
      shockDescription = calendar.firstUniversityDue === null || plan.crash === 0 ? 'Nessun ribasso puntuale previsto.' :
        'Ribasso del ' + pct(plan.crash / 100) + ' il ' + fmtDate(calendar.firstUniversityDue) + '.';
    }
    const scenarioInfo = 'Scenario ' + scenario.label + ' · rendimento lordo ' + pct(market.mean) +
      ' · volatilità di base ' + pct(market.sigma) + ' · ' + shockDescription;
    const detail = STRATEGIES.map((strategy, index) => {
      const value = result.scenarios[view.scenario][strategy.id];
      return {
        className: strategy.id === view.strategy ? 'is-current' : '',
        cells: [`<button class="table-link" type="button" data-strategy="${strategy.id}">${strategy.label}</button>`,
          pct(value.success), euros(value.loss95.var), euros(value.loss95.es), euros(value.loss99.var), euros(value.loss99.es),
          euros(value.final[0] * finalFactor), euros(value.final[2] * finalFactor), euros(result.plans[index].invested)]
      };
    });
    const matrix = STRATEGIES.map(strategy => ({
      cells: [strategy.label, ...SCENARIOS.map(item => pct(result.scenarios[item.id][strategy.id].success))]
    }));

    $('comparison').innerHTML = `<div class="panel-head"><div><h4>Risultati per lo scenario ${scenario.label}</h4>
      <p>${escape(scenarioInfo)}</p></div></div>
      <div class="sharpe-strip">${metrics.join('')}</div>
      <p class="hint">Lo Sharpe misura il rendimento atteso oltre il tasso privo di rischio per unità di rischio azionario. I due valori del modello includono il costo annuo dell’ETF / Fondo comune. Il ribasso dello stress universitario si aggiunge alla dinamica ordinaria.</p>
      <div class="spaced">${table('Misure per strategia nello scenario ' + scenario.label, [
        'Strategia', 'Prob. di copertura', 'VaR 95%', 'ES 95%', 'VaR 99%', 'ES 99%',
        'Saldo finale P5', 'Saldo finale P50', 'Capitale iniziale nella ladder'
      ], detail)}</div>
      <p class="hint">Il VaR 95% indica la soglia che separa il 5% dei percorsi con scoperti maggiori. L’ES 95% è lo scoperto medio in quel 5%. Al 99% si considera l’1% peggiore. VaR ed ES sono in euro di oggi. Il saldo finale è ${view.units === 'real' ? 'in euro di oggi' : 'espresso ai prezzi futuri'}.</p>
      <div class="spaced"><h4>Probabilità di copertura per scenario</h4>
      ${table('Probabilità di copertura per scenario', ['Strategia', ...SCENARIOS.map(item => item.label)], matrix)}</div>`;

    const equity = result.scenarios[view.scenario].equity;
    const zeroLump = plan.lump === 0 && result.costs.length > 0;
    const info = risk.interval === null ? '' :
      'Intervallo Monte Carlo al 95% per ' + strategyName(view.strategy) + ' · ' + pct(risk.interval[0]) + ' – ' +
      pct(risk.interval[1]) + '. Con ' + decimal.format(plan.paths) + ' percorsi, l’ES 99 usa circa ' +
      num(plan.paths * 0.01) + ' esiti di coda. L’intervallo misura il rumore del campione.';
    $('strategy-notes').innerHTML = `<div class="panel-head"><div><h4>Copertura e primo scoperto</h4>
      ${zeroLump ? '<p>Con capitale iniziale zero, le due ladder hanno lo stesso esito del PAC azionario.</p>' : ''}</div></div>
      <div class="strategy-cards">${STRATEGIES.map(strategy => {
        const item = result.scenarios[view.scenario][strategy.id];
        const first = item.first;
        const difference = item.success !== null && equity.success !== null && strategy.id !== 'equity' ?
          (item.success - equity.success) * 100 : 0;
        const change = Math.abs(difference) >= 0.005 ? ' · ' + (difference > 0 ? '+' : '') + num(difference) + ' punti vs PAC azionario' : '';
        const outcome = first ? 'Primo scoperto più frequente nel ' + app.academicLabel(first.year) + ' (' +
          pct(first.probability) + ' dei percorsi).' : 'Il campione copre tutte le scadenze.';
        return `<article class="strategy-card"><h4>${strategy.label}</h4>${item.success === null ?
          '<p>Nessuna spesa affidata al portafoglio.</p>' : `<p><strong>${pct(item.success)}</strong> di copertura${change}
          · ES 95% <strong>${euros(item.loss95.es)}</strong>.</p><p>${outcome}</p>`}</article>`;
      }).join('')}</div>${info ? `<p class="hint spaced">${escape(info)}</p>` : ''}`;
  }

  function renderLadder(state, prepared) {
    const expanded = $('ladder').querySelector('details')?.open;
    const costs = prepared.costs;
    const full = sum(costs, 'full');
    const hybrid = full * state.plan.hybridPct / 100;
    const [, , ladder, mixed] = prepared.plans;
    const summary = [
      strip('Ladder integrale · obiettivo oggi', euros(full), true),
      strip('Ladder integrale · impiegato', euros(ladder.invested)),
      strip('Ladder ibrida · obiettivo oggi', euros(hybrid)),
      strip('Ladder ibrida · impiegato', euros(mixed.invested)),
      strip('Obiettivo con tassi più bassi di 1 punto', euros(sum(costs, 'down'))),
      strip('Obiettivo con tassi più alti di 1 punto', euros(sum(costs, 'up')))
    ].join('');
    const rows = costs.map((cost, index) => ({ cells: [
      fmtDate(cost.day), num(cost.years), pct(cost.ytm), euros(cost.amount), euros(cost.full),
      euros(ladder.rungs[index].budget), euros(ladder.rungs[index].maturity),
      euros(mixed.rungs[index].budget), euros(mixed.rungs[index].maturity)
    ] }));
    $('ladder').innerHTML = `<div class="panel-head"><div><h3>Quanto accantonare oggi</h3><p>
      Il capitale iniziale finanzia incassi alle date delle spese affidate al portafoglio nello scenario Base. Le scadenze più vicine hanno la precedenza.
      </p></div>${badge(state.plan.curve === 'steps' ? 'Curva a gradini' : 'Tasso costante')}</div>
      <div class="summary-strip">${summary}</div>
      <p class="hint">Capitale aggiuntivo per completare l’obiettivo integrale ${euros(Math.max(0, full - ladder.invested))}.
      Imposta del 12,5% sui guadagni positivi e bollo modellato. La sensibilità applica uno spostamento parallelo prima dell’acquisto.</p>
      <details class="inside-details spaced"${expanded ? ' open' : ''}><summary>Apri le scadenze e gli importi</summary><div class="spaced">
      ${rows.length ? table('Scadenze della ladder', ['Pagamento', 'Anni alla scadenza', 'Tasso lordo', 'Spesa del portafoglio', 'Capitale teorico oggi',
        'Capitale impiegato · integrale', 'Incasso · integrale', 'Capitale impiegato · ibrida', 'Incasso · ibrida'], rows, true) : empty('Nessun importo da accantonare per le scadenze selezionate.')}
      </div></details>`;
  }

  function renderCash(state, calendar, risk, yearIndex) {
    const max = Math.max(1, ...calendar.rows.map(row => row.net));
    const summaries = [
      strip('Netto anno in corso', euros(calendar.rows[0].net)),
      strip('Dal prossimo anno scolastico', euros(calendar.totals.net - calendar.rows[0].net)),
      strip('Spese assegnate alla famiglia', euros(calendar.totals.incomePaid + calendar.totals.outside)),
      strip('Spese affidate al portafoglio', euros(calendar.totals.target), true)
    ];
    const years = calendar.rows.map((row, index) => {
      const gap = risk.rows[index].gap50;
      const color = row.warning ? ' has-' + row.warning : '';
      const selected = index === yearIndex;
      const pension = pensionText(state, row);
      const label = [row.label, 'Spesa netta ' + euros(row.net), pension].filter(Boolean).join(' · ');
      const items = [
        ['gap', gap], ['portfolio', Math.max(0, row.target - gap)], ['outside', row.outside], ['income', row.incomePaid]
      ];
      return `<button class="bar-col${color}${selected ? ' is-current' : ''}" type="button" data-year="${row.year}"
        aria-pressed="${selected}" aria-label="${escape(label)}" title="${escape(label)}">
        <span class="stack">${items.map(([name, value]) => `<i class="bar ${name}" style="height:${(value / max * 108).toFixed(2)}px"></i>`).join('')}</span>
        <small>${String(row.year).slice(-2)}</small></button>`;
    });
    const retirements = calendar.rows.flatMap(row => {
      const transition = retirementText(state, row);
      return transition ? [`<li><button class="table-link" type="button" data-year="${row.year}">${row.label}</button>
        <span>${escape(transition)}</span></li>`] : [];
    });
    const tableRows = calendar.rows.map((row, index) => {
      const metrics = risk.rows[index];
      const ages = row.profiles.map((profile, position) => escape(state.parents[position].name) + ' ' + num(profile.age));
      const burden = row.income > 0 ? metrics.gap95 / row.income : null;
      const alert = row.warning ? badge(pensionText(state, row), row.warning) : '·';
      return {
        className: row.warning ? 'has-' + row.warning : index === yearIndex ? 'is-current' : '',
        cells: [`<button class="table-link" type="button" data-year="${row.year}">${row.label}</button>`,
          fmtDate(row.reference), ages.join(' / '), euros(row.today), euros(row.gross), euros(row.aid), euros(row.net),
          ...row.people.map(person => person ? euros(person.net) : '·'),
          euros(row.income), pct(row.burden), euros(row.incomePaid), euros(row.outside), euros(row.target), euros(row.cumTarget),
          euros(metrics.gap95), pct(burden), pct(metrics.gapProbability), alert]
      };
    });

    $('cashflows').innerHTML = `<div class="panel-head"><div><h3>Calendario finanziario</h3><p>${scenarioName(state.view.scenario)} ·
      importi residui dalla data del piano. Seleziona un anno per vedere i singoli figli e il bilancio del portafoglio.</p></div></div>
      <div class="summary-strip">${summaries.join('')}</div>
      <div class="chart-bars" role="group" aria-label="Composizione annuale dei costi">${years.join('')}</div>
      <div class="legend"><span><i class="key income"></i>Da reddito</span><span><i class="key outside"></i>Spese escluse dai prelievi</span>
        <span><i class="key portfolio"></i>Pagato dal portafoglio · P50</span>
        <span><i class="key gap"></i>Scoperto · P50</span></div>
      ${retirements.length ? `<ul class="pension-events">${retirements.join('')}</ul>` : ''}
      <div class="spaced">${table('Flussi per anno scolastico', ['Anno scolastico', 'Data di riferimento', 'Età genitori',
        'Costo residuo ai prezzi di oggi', 'Costo lordo previsto', 'Agevolazioni', 'Spesa netta prevista', ...state.children.map(child => 'Spesa netta · ' + child.name),
        'Reddito annuo', 'Spesa netta / reddito', 'Pagato direttamente dal reddito', 'Spese escluse dai prelievi', 'Da finanziare con il portafoglio', 'Spese cumulate del portafoglio',
        'Scoperto P95', 'Scoperto P95 / reddito', 'Prob. di scoperto', 'Genitori in fascia 67–70'], tableRows, true)}</div>
      <p class="hint spaced">L’alert indica che l’anno scolastico comprende un periodo nella fascia 67–70. È rosso con spese universitarie, reddito zero o spesa netta pari almeno al 25% del reddito. Le età sono riferite alla data indicata nella riga.</p>`;
  }

  function renderYear(state, calendar, risk, index) {
    const row = calendar.rows[index];
    const outcome = risk.rows[index];
    const gapBurden = row.income > 0 ? (row.incomePaid + row.outside + outcome.deposit + outcome.gap95) / row.income : null;
    const transition = retirementText(state, row);
    const pension = pensionText(state, row);
    const parents = row.profiles.map((profile, position) => ({ cells: [
      escape(state.parents[position].name), num(profile.age), euros(profile.income),
      profile.pensionWindow ? badge('67–70', row.warning || 'amber') : '·',
      profile.retirementInYear !== null ? fmtDate(profile.retirementInYear) : '·',
      profile.adjusted ? pct(state.parents[position].replacement / 100) : '·'
    ] }));
    const children = row.people.map((child, position) => {
      const student = row.students[position];
      return { cells: [
        escape(state.children[position].name), student.age === null ? 'Nascita futura' : num(student.age),
        STAGE_BY_ID[student.stage]?.label ?? '·', child ? fmtDate(child.due) : '·',
        child ? euros(child.fullToday) : '·', child ? euros(child.fullNominal) : '·',
        child ? euros(child.gross) : '·', child ? euros(child.aid) : '·', child ? euros(child.net) : '·',
        child ? euros(child.incomePaid + child.outside) : '·', child ? euros(child.target) : '·'
      ] };
    });
    const financial = [
      strip('Versamenti PAC nel periodo', euros(outcome.deposit)),
      strip('Pagato dal portafoglio · media', euros(outcome.paid)),
      strip('Risultato di gestione · media', euros(outcome.gain)),
      strip('Imposte, bollo e costi liquidi · media', euros(outcome.tax + outcome.bollo + outcome.fee)),
      strip('Scoperto P50 / P95', euros(outcome.gap50) + ' / ' + euros(outcome.gap95)),
      strip('Probabilità del primo scoperto', pct(outcome.firstGap)),
      strip('Saldo netto P50', euros(outcome.fan[2])),
      strip('Capitale liquidabile P50', euros(outcome.liquid)),
      strip('Quota del reddito impegnata con scoperto P95', pct(gapBurden), gapBurden > 0.5)
    ].join('');
    $('year-detail').innerHTML = `<div class="panel-head"><div><h3 id="year-heading" tabindex="-1">Dettaglio ${row.label}</h3>
      <p>Età e reddito al ${fmtDate(row.reference)} · Saldo al ${fmtDate(row.report)}</p></div>
      <label class="field">Anno scolastico<select data-view="year">${calendar.rows.map(candidate =>
        `<option value="${candidate.year}"${candidate.year === row.year ? ' selected' : ''}>${candidate.label}</option>`).join('')}</select></label></div>
      ${pension ? `<p>${badge(pension, row.warning)}</p>` : ''}
      ${transition ? `<p class="setting-note">${escape(transition)}.</p>` : ''}
      <div class="subtables"><div><h4>Genitori</h4>${table('Età, redditi e pensione per genitore', [
        'Nome', 'Età', 'Reddito netto annuo', 'Fascia nell’anno', 'Data di pensione ipotizzata', 'Quota sostitutiva già applicata'
      ], parents)}</div>
      <div><h4>Figli</h4>${children.length ? table('Età e spese per figlio', ['Nome', 'Età', 'Ciclo previsto', 'Data di pagamento',
        'Costo annuo ai prezzi di oggi', 'Costo annuo previsto', 'Lordo residuo', 'Agevolazioni', 'Netto residuo', 'Da pagare in famiglia', 'Da finanziare con il portafoglio'], children) :
        empty('Aggiungi un figlio per costruire il calendario delle spese.')}</div></div>`;
    $('year-detail').insertAdjacentHTML('beforeend', `<h4 class="spaced">Portafoglio · ${strategyName(state.view.strategy)} · ${scenarioName(state.view.scenario)}</h4>
      <div class="summary-strip">${financial}</div>
      <p class="hint">Per stimare l’impegno sul reddito si sommano le spese da pagare in famiglia, le rate PAC e lo scoperto P95. Il risultato si divide per il reddito netto annuo. Il capitale iniziale è riportato a parte.</p>`);
  }

  function renderDashboard(state, result) {
    const { calendar, risk } = context(state, result);
    const selected = calendar.rows.findIndex(row => row.year === state.view.year);
    const index = selected < 0 ? 0 : selected;
    renderMetrics(state, result);
    renderFan(state, calendar, risk);
    renderComparison(state, result);
    renderLadder(state, result);
    renderCash(state, calendar, risk, index);
    renderYear(state, calendar, risk, index);
  }

  function report(state, result) {
    const { calendar, risk, finalFactor } = context(state, result);
    const { plan, view } = state;
    const chart = fanMarkup(state, calendar, risk, true);
    const highest = [...calendar.rows.keys()].filter(index => calendar.rows[index].net > 0)
      .sort((a, b) => calendar.rows[b].net - calendar.rows[a].net).slice(0, 3);
    const priority = highest.map(index => {
      const row = calendar.rows[index];
      return { cells: [row.label, euros(row.net), pct(row.burden), euros(risk.rows[index].gap95),
        escape(pensionText(state, row) || retirementText(state, row) || '·')] };
    });
    const comparison = STRATEGIES.map(strategy => {
      const value = result.scenarios[view.scenario][strategy.id];
      return { cells: [strategy.label, pct(value.success), euros(value.loss95.var), euros(value.loss95.es),
        euros(value.loss99.var), euros(value.loss99.es), euros(value.final[2] * finalFactor)] };
    });
    $('print-report').innerHTML = `<span class="eyebrow">PIANO STUDI · SCHEDA ESECUTIVA</span>
      <h1>Pianificazione studi figli</h1>
      <p>${fmtDate(calendar.start)} · ${strategyName(view.strategy)} · ${scenarioName(view.scenario)} · ${app.withdrawalLabel(plan)}</p>
      <div class="summary-strip">${[
        strip('Spese nette residue', euros(calendar.totals.net)),
        strip('Prima spesa del portafoglio', calendar.firstWithdrawal === null ? 'Nessuna spesa' : fmtDate(calendar.firstWithdrawal)),
        strip('Probabilità di copertura', pct(risk.success)), strip('ES 95% · euro di oggi', euros(risk.loss95.es))
      ].join('')}</div>
      <h2>Capitale dopo i pagamenti</h2>${chart.svg}${chart.legend}
      <h2>Strategie nello scenario ${scenarioName(view.scenario)}</h2>
      ${table('Confronto per la stampa', ['Strategia', 'Successo', 'VaR 95', 'ES 95', 'VaR 99', 'ES 99', 'Saldo finale P50'], comparison)}
      <p>VaR ed ES sullo scoperto cumulato in euro di oggi. Saldo finale ${view.units === 'real' ? 'in euro di oggi' : 'nominale'}.</p>
      ${priority.length ? `<h2>Anni con la spesa maggiore</h2>
      ${table('Anni con la spesa maggiore', ['Anno', 'Spesa netta', 'Spesa / reddito', 'Scoperto P95', 'Fascia pensione'], priority)}` : ''}
      <p>PAC equivalente ${euros(app.monthlyAmount(plan))}/mese · capitale iniziale ${euros(plan.lump)} · inflazione ${pct(plan.inflation / 100)} ·
      rend. azionario atteso Base ${pct(plan.equityReturn / 100)} · volatilità di base ${pct(plan.volatility / 100)} ·
      ${num(plan.paths)} percorsi · seed ${plan.seed}.</p>
      <p class="print-note"><strong>Avvertenze MiFID II.</strong> ${escape(app.DISCLAIMER)}</p>`;
  }

  Object.assign(app, { $, escape, euros, pct, num, fmtDate, renderDashboard, report });
})(globalThis.StudyPlan);
