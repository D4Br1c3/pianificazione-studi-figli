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
  const warning = row => row.warning ? badge('Fascia 67–70', row.warning) : '·';
  const strip = (name, value, active = false) => `<div class="strip-item${active ? ' active' : ''}">${escape(name)}<strong>${value}</strong></div>`;
  const scopeText = plan => plan.scope === 'all' ? 'Tutti i cicli inclusi' : 'Solo università';

  function table(label, headers, rows, tall = false) {
    return `<div class="table-scroll${tall ? ' tall' : ''}" role="region" aria-label="${escape(label)}" tabindex="0">
      <table aria-label="${escape(label)}"><thead><tr>${headers.map(header => '<th scope="col">' + escape(header) + '</th>').join('')}</tr></thead>
      <tbody>${rows.map(({ cells, className = '' }) => `<tr class="${className}">${cells.map((value, index) => (
        index === 0 ? '<th scope="row">' + value + '</th>' : '<td>' + value + '</td>')).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  function context(state, prepared, result) {
    const { view, plan } = state;
    const calendar = prepared.calendars[view.scenario];
    const risk = result?.scenarios[view.scenario][view.strategy];
    const finalFactor = view.units === 'real' ? 1 / Math.pow(1 + plan.inflation / 100, app.yearsBetween(calendar.start, calendar.end)) : 1;
    return { calendar, risk, finalFactor };
  }

  function renderMetrics(state, prepared, result) {
    const { calendar, risk } = context(state, prepared, result);
    const baseCost = sum(prepared.costs, 'full');
    const last = calendar.rows.at(-1);
    $('hero-date').innerHTML = `<span>Data del piano <strong>${fmtDate(calendar.start)}</strong></span><span>Ultima riga <strong>${last.label}</strong></span>`;
    const values = [
      ['Costo netto residuo', euros(calendar.totals.net), 'Nominale · ' + calendar.rows.length + ' anni scolastici'],
      ['Ladder integrale oggi', euros(baseCost), 'Capitale teorico a pronti · scenario Base'],
      ['Copertura a ogni scadenza', risk ? pct(risk.success) : '—', strategyName(state.view.strategy) + ' · ' + scenarioName(state.view.scenario)],
      ['Scoperto ES 95%', risk ? euros(risk.loss95.es) : '—', 'Media del 5% peggiore · euro di oggi']
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
      return `<rect x="${from}" y="${top}" width="${to - from}" height="${height - bottom - top}" fill="${row.warning === 'red' ? '#fae2da' : '#fff0d1'}" />`;
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
      <span><i class="key median"></i>P50</span>${state.view.cumulative ? '<span><i class="key cost"></i>Target cumulato</span>' : ''}
      <span><i class="key red"></i><i class="key amber"></i>Fascia 67–70</span><span>${isReal ? 'Euro di oggi' : 'Euro nominali'}</span></div>`;
    return { svg, legend, data, x, left, step, width, selected };
  }

  function renderFan(state, calendar, risk, busy) {
    if (!risk) {
      $('fan').innerHTML = empty(busy ? 'Elaborazione dei percorsi in corso.' : 'Esegui la simulazione per aggiornare il cono e le misure di rischio.');
      return;
    }
    const chart = fanMarkup(state, calendar, risk);
    $('fan').innerHTML = `<div class="chart-shell" tabindex="0" role="region" aria-label="Cono di Ibbotson, scorribile">${chart.svg}</div>
      <div class="chart-meta">${chart.legend}</div><p id="chart-readout" class="chart-readout"></p>
      <p class="legend-note">La fascia mostra gli esiti a ciascuna data. Il saldo include il valore contabile delle scadenze vincolate. Il target cumulato somma i pagamenti affidati al portafoglio fino a quell’anno, anche se già eseguiti.</p>`;
    const svg = $('fan').querySelector('svg');
    const marker = svg.querySelector('[data-marker]');
    let last = -1;
    function show(index) {
      if (index === last) return;
      last = index;
      const { row, fan, target } = chart.data[index];
      marker.setAttribute('x1', chart.x(index));
      marker.setAttribute('x2', chart.x(index));
      $('chart-readout').textContent = row.label + ' · P5 ' + euros(fan[0]) + ' · P25 ' + euros(fan[1]) +
        ' · P50 ' + euros(fan[2]) + ' · P75 ' + euros(fan[3]) + ' · P95 ' + euros(fan[4]) +
        (state.view.cumulative ? ' · Target cumulato ' + euros(target) : '');
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

  function renderComparison(state, prepared, result) {
    const { view, plan } = state;
    const { calendar, finalFactor } = context(state, prepared, result);
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
    const shockDescription = view.scenario === 'shock' && calendar.firstUniversityDue === null ?
      'Il calendario residuo non contiene rette universitarie. Il ribasso puntuale resta inattivo.' : scenario.description;
    const scenarioInfo = 'Scenario ' + scenario.label + ' · rendimento lordo ' + pct(market.mean) +
      ' · volatilità di base ' + pct(market.sigma) + ' · ' + shockDescription;
    let comparison = empty('Esegui la simulazione per confrontare strategie, scenari e rischi di coda.');
    if (result) {
      const detail = STRATEGIES.map((strategy, index) => {
        const risk = result.scenarios[view.scenario][strategy.id];
        return {
          className: strategy.id === view.strategy ? 'is-current' : '',
          cells: [`<button class="table-link" type="button" data-strategy="${strategy.id}">${strategy.label}</button>`,
            pct(risk.success), euros(risk.loss95.var), euros(risk.loss95.es), euros(risk.loss99.var), euros(risk.loss99.es),
            euros(risk.final[0] * finalFactor), euros(risk.final[2] * finalFactor), euros(prepared.plans[index].invested)]
        };
      });
      const matrix = STRATEGIES.map(strategy => ({
        cells: [strategy.label, ...SCENARIOS.map(item => pct(result.scenarios[item.id][strategy.id].success))]
      }));
      comparison = table('Misure per strategia nello scenario ' + scenario.label, [
        'Strategia', 'Successo', 'VaR 95', 'ES 95', 'VaR 99', 'ES 99',
        'Saldo finale P5', 'Saldo finale P50', 'Ladder iniziale'
      ], detail) +
      `<p class="hint">VaR ed ES si riferiscono agli scoperti lungo il piano e sono sempre in euro di oggi. Saldo finale ${view.units === 'real' ? 'in euro di oggi' : 'nominale'}. La ladder iniziale è l’importo effettivamente impiegato.</p>
      <div class="spaced"><h4>Probabilità di coprire tutte le scadenze</h4>${table('Probabilità di successo per scenario', ['Strategia', ...SCENARIOS.map(item => item.label)], matrix)}</div>`;
    }

    $('comparison').innerHTML = `<div class="panel-head"><div><h3>Confronto delle strategie</h3>
      <p>${escape(scenarioInfo)}</p></div><span class="badge green">${escape(scopeText(plan))}</span></div>
      <div class="sharpe-strip">${metrics.join('')}</div><p class="hint">Sharpe dell’asset. I due valori del modello includono il costo ETF / Fondo comune. Nello stress, il ribasso puntuale alla retta si aggiunge ai rendimenti ordinari.</p>
      <div class="spaced">${comparison}</div>`;

    const risk = result?.scenarios[view.scenario][view.strategy];
    const equity = result?.scenarios[view.scenario].equity;
    const zeroLump = plan.lump === 0 && prepared.costs.length > 0;
    const info = !risk ? '' :
      'Intervallo Monte Carlo al 95% per ' + strategyName(view.strategy) + ' · ' + pct(risk.interval[0]) + ' – ' +
      pct(risk.interval[1]) + '. Con ' + decimal.format(plan.paths) + ' percorsi, l’ES 99 usa circa ' +
      num(plan.paths * 0.01) + ' esiti di coda. L’intervallo misura il rumore del campione.';
    $('strategy-notes').innerHTML = `<div class="panel-head"><div><h3>Come leggere il confronto</h3>
      <p>${zeroLump ? 'Capitale iniziale zero. Le due ladder hanno lo stesso esito del PAC azionario.' : 'Tutti i piani usano lo stesso capitale iniziale e gli stessi versamenti.'}</p></div></div>
      <div class="strategy-cards">${STRATEGIES.map(strategy => {
        const item = result?.scenarios[view.scenario][strategy.id];
        const first = item?.first;
        const difference = item && strategy.id !== 'equity' ? (item.success - equity.success) * 100 : 0;
        const change = Math.abs(difference) >= 0.005 ? ' · ' + (difference > 0 ? '+' : '') + num(difference) + ' punti vs PAC azionario' : '';
        return `<article class="strategy-card"><h4>${strategy.label}</h4><p>${strategy.text}</p>${item ? `<p><strong>${pct(item.success)}</strong> di successo${change} · ES 95 <strong>${euros(item.loss95.es)}</strong>.</p>
          <p>${first ? 'Primo scoperto più frequente nel ' + app.academicLabel(first.year) + ' (' + pct(first.probability) + ' dei percorsi).' : 'Il campione copre tutte le scadenze.'}</p>` : ''}</article>`;
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
      strip('Obiettivo con curva −100 pb', euros(sum(costs, 'down'))),
      strip('Obiettivo con curva +100 pb', euros(sum(costs, 'up')))
    ].join('');
    const rows = costs.map((cost, index) => ({ cells: [
      fmtDate(cost.day), num(cost.years), pct(cost.ytm), euros(cost.amount), euros(cost.full),
      euros(ladder.rungs[index].budget), euros(ladder.rungs[index].maturity),
      euros(mixed.rungs[index].budget), euros(mixed.rungs[index].maturity)
    ] }));
    $('ladder').innerHTML = `<div class="panel-head"><div><h3>Quanto accantonare oggi</h3><p>
      Scadenze zero-coupon sintetiche sul fabbisogno Base affidato al portafoglio. Le due ladder acquistano in ordine di scadenza entro il capitale iniziale.
      </p></div>${badge(state.plan.curve === 'btp' ? 'Curva BTP a gradini' : 'Curva flat')}</div>
      <div class="summary-strip">${summary}</div>
      <p class="hint">Capitale aggiuntivo per completare l’obiettivo integrale ${euros(Math.max(0, full - ladder.invested))}.
      Imposta del 12,5% sui guadagni positivi e bollo modellato. La sensibilità applica uno spostamento parallelo prima dell’acquisto.</p>
      <details class="inside-details spaced"${expanded ? ' open' : ''}><summary>Apri le scadenze e gli importi</summary><div class="spaced">
      ${rows.length ? table('Scadenze della ladder', ['Pagamento', 'Anni', 'YTM lordo', 'Target Base', 'Capitale teorico oggi',
        'Spesa integrale oggi', 'Incasso integrale', 'Spesa ibrida oggi', 'Incasso ibrida'], rows, true) : empty('Nessun importo da accantonare per il perimetro selezionato.')}
      </div></details>`;
  }

  function renderCash(state, calendar, risk, yearIndex) {
    const max = Math.max(1, ...calendar.rows.map(row => row.net));
    const summaries = [
      strip('Netto anno in corso', euros(calendar.rows[0].net)),
      strip('Dal prossimo anno scolastico', euros(calendar.totals.net - calendar.rows[0].net)),
      strip('Da reddito + fuori mandato', euros(calendar.totals.incomePaid + calendar.totals.outside)),
      strip('Target complessivo portafoglio', euros(calendar.totals.target), true)
    ];
    const years = calendar.rows.map((row, index) => {
      const gap = risk?.rows[index].gap50 ?? 0;
      const color = row.warning ? ' has-' + row.warning : '';
      const items = [
        ['gap', gap], ['portfolio', Math.max(0, row.target - gap)], ['outside', row.outside], ['income', row.incomePaid]
      ];
      return `<button class="bar-col${color}${index === yearIndex ? ' is-current' : ''}" type="button" data-year="${row.year}"
        aria-label="${row.label}, costo netto ${euros(row.net)}${row.warning ? ', fascia pensionistica' : ''}" title="${row.label} · ${euros(row.net)}">
        <span class="stack">${items.map(([name, value]) => `<i class="bar ${name}" style="height:${(value / max * 108).toFixed(2)}px"></i>`).join('')}</span>
        <small>${String(row.year).slice(-2)}</small></button>`;
    });
    const tableRows = calendar.rows.map((row, index) => {
      const metrics = risk?.rows[index];
      const ages = row.profiles.map(profile => profile.age ?? '·').join(' / ');
      const burden = metrics && row.income > 0 ? metrics.gap95 / row.income : null;
      return {
        className: row.warning ? 'has-' + row.warning : index === yearIndex ? 'is-current' : '',
        cells: [`<button class="table-link" type="button" data-year="${row.year}">${row.label}</button>`,
          fmtDate(row.reference), ages, euros(row.today), euros(row.gross), euros(row.aid), euros(row.net),
          ...row.people.map(person => person ? euros(person.net) : '·'),
          euros(row.income), pct(row.burden), euros(row.incomePaid), euros(row.outside), euros(row.target), euros(row.cumTarget),
          metrics ? euros(metrics.gap95) : '·', pct(burden), metrics ? pct(metrics.gapProbability) : '·', warning(row)]
      };
    });

    $('cashflows').innerHTML = `<div class="panel-head"><div><h3>Calendario finanziario</h3><p>${scenarioName(state.view.scenario)} ·
      importi residui dalla data del piano. Seleziona un anno per vedere i singoli figli e il bilancio del portafoglio.</p></div></div>
      <div class="summary-strip">${summaries.join('')}</div>
      <div class="chart-bars" role="group" aria-label="Composizione annuale dei costi">${years.join('')}</div>
      <div class="legend"><span><i class="key income"></i>Da reddito</span><span><i class="key outside"></i>Fuori mandato</span>
        <span><i class="key portfolio"></i>${risk ? 'Pagato dal portafoglio · P50' : 'Target portafoglio'}</span>
        ${risk ? '<span><i class="key gap"></i>Scoperto · P50</span>' : ''}</div>
      <div class="spaced">${table('Flussi per anno scolastico', ['Anno scolastico', 'Data di riferimento', 'Età genitori',
        'Costo base residuo', 'Lordo nominale', 'Agevolazioni', 'Netto nominale', ...state.children.map(child => child.name),
        'Reddito annuo', 'Netto / reddito', 'Da reddito', 'Fuori mandato', 'Target portafoglio', 'Target cumulato',
        'Scoperto P95', 'P95 / reddito', 'Prob. scoperto', 'Pensione'], tableRows, true)}</div>
      <p class="hint spaced">La fascia 67–70 evidenzia spese in anni scolastici che toccano la finestra anagrafica di un genitore. Rosso con università, reddito zero o costo netto pari almeno al 25% del reddito. N.D. indica un rapporto con denominatore pari a zero o una misura ancora da simulare.</p>`;
  }

  function renderYear(state, calendar, risk, index) {
    const row = calendar.rows[index];
    const outcome = risk?.rows[index];
    const gapBurden = outcome && row.income > 0 ? (row.incomePaid + row.outside + outcome.deposit + outcome.gap95) / row.income : null;
    const parents = row.profiles.map((profile, position) => ({ cells: [
      escape(state.parents[position].name), num(profile.age), euros(profile.income),
      profile.pensionWindow ? badge('67–70', row.warning || 'amber') : '·',
      profile.adjusted ? badge('Attivo') : '·'
    ] }));
    const children = row.people.map((child, position) => ({ cells: [
      escape(state.children[position].name), child ? STAGE_BY_ID[child.stage].label : '·',
      child ? num(child.age) : '·', child ? fmtDate(child.due) : '·',
      child ? euros(child.fullToday) : '·', child ? euros(child.fullNominal) : '·',
      child ? euros(child.gross) : '·', child ? euros(child.aid) : '·', child ? euros(child.net) : '·',
      child ? euros(child.incomePaid + child.outside) : '·', child ? euros(child.target) : '·'
    ] }));
    const financial = outcome ? [
      strip('PAC lordo nel periodo', euros(outcome.deposit)),
      strip('Pagato dal portafoglio · media', euros(outcome.paid)),
      strip('Risultato di gestione · media', euros(outcome.gain)),
      strip('Imposte, bollo e costi liquidi · media', euros(outcome.tax + outcome.bollo + outcome.fee)),
      strip('Scoperto P50 / P95', euros(outcome.gap50) + ' / ' + euros(outcome.gap95)),
      strip('Probabilità del primo scoperto', pct(outcome.firstGap)),
      strip('Saldo netto P50', euros(outcome.fan[2])),
      strip('Liquidabile P50', euros(outcome.liquid)),
      strip('Impegno famiglia con scoperto P95', pct(gapBurden), gapBurden > 0.5)
    ].join('') : '';
    $('year-detail').innerHTML = `<div class="panel-head"><div><h3 id="year-heading" tabindex="-1">Dettaglio ${row.label}</h3>
      <p>Situazione al ${fmtDate(row.report)} · ${strategyName(state.view.strategy)} · ${scenarioName(state.view.scenario)}</p></div>
      <label class="field">Anno scolastico<select data-view="year">${calendar.rows.map(candidate =>
        `<option value="${candidate.year}"${candidate.year === row.year ? ' selected' : ''}>${candidate.label}</option>`).join('')}</select></label></div>
      ${financial ? `<div class="summary-strip">${financial}</div>
        <p class="hint">Impegno famiglia = quota da reddito + costi fuori mandato + rate PAC + scoperto P95, divisi per il reddito annuo netto.
        Il capitale iniziale è separato. Il risultato di gestione include l’accrescimento netto della ladder.</p>` : ''}
      <div class="subtables"><div><h4>Genitori</h4>${table('Redditi e fasce per genitore', ['Nome', 'Età alla data di riferimento', 'Reddito annuo', 'Fascia', 'Cambio reddito'], parents)}</div>
      <div><h4>Figli</h4>${children.length ? table('Spese per figlio', ['Nome', 'Ciclo', 'Età', 'Pagamento',
        'Costo annuo base', 'Costo annuo nominale', 'Lordo residuo', 'Aiuti', 'Netto residuo', 'Da famiglia', 'Target portafoglio'], children) :
        empty('Aggiungi un figlio per costruire il calendario delle spese.')}</div></div>`;
  }

  function renderDashboard(state, prepared, result, busy = false) {
    const { calendar, risk } = context(state, prepared, result);
    const selected = calendar.rows.findIndex(row => row.year === state.view.year);
    const index = selected < 0 ? 0 : selected;
    renderMetrics(state, prepared, result);
    renderFan(state, calendar, risk, busy);
    renderComparison(state, prepared, result);
    renderLadder(state, prepared);
    renderCash(state, calendar, risk, index);
    renderYear(state, calendar, risk, index);
  }

  function report(state, result) {
    const { calendar, risk, finalFactor } = context(state, result, result);
    const { plan, view } = state;
    const chart = fanMarkup(state, calendar, risk, true);
    const highest = [...calendar.rows.keys()].filter(index => calendar.rows[index].net > 0)
      .sort((a, b) => calendar.rows[b].net - calendar.rows[a].net).slice(0, 3);
    const priority = highest.map(index => {
      const row = calendar.rows[index];
      return { cells: [row.label, euros(row.net), pct(row.burden), euros(risk.rows[index].gap95), row.warning ? '67–70' : '·'] };
    });
    const comparison = STRATEGIES.map(strategy => {
      const value = result.scenarios[view.scenario][strategy.id];
      return { cells: [strategy.label, pct(value.success), euros(value.loss95.var), euros(value.loss95.es),
        euros(value.loss99.var), euros(value.loss99.es), euros(value.final[2] * finalFactor)] };
    });
    $('print-report').innerHTML = `<span class="eyebrow">PIANO STUDI · SCHEDA ESECUTIVA</span>
      <h1>Pianificazione studi figli</h1>
      <p>${fmtDate(calendar.start)} · ${strategyName(view.strategy)} · ${scenarioName(view.scenario)} · ${scopeText(plan)}</p>
      <div class="summary-strip">${[
        strip('Spese nette residue', euros(calendar.totals.net)), strip('Ladder Base oggi', euros(sum(result.costs, 'full'))),
        strip('Successo', pct(risk.success)), strip('ES 95% · euro di oggi', euros(risk.loss95.es))
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
