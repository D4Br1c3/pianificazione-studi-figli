(function (app) {
  'use strict';

  const { $, escape, euros, pct, LIMITS, MONTHS, BANDS, STAGES, STRATEGIES, SCENARIOS } = app;
  let state = app.defaultState();
  let preview = app.prepare(state);
  let result = null;
  let job = null;
  let importVersion = 0;
  let validForm = true;
  const settings = $('settings');

  const get = (object, path) => path.split('.').reduce((parent, key) => parent[key], object);
  const selectOptions = (choices, value) => choices.map(([key, label]) =>
    `<option value="${escape(key)}"${String(value) === String(key) ? ' selected' : ''}>${escape(label)}</option>`).join('');

  function field(label, path, type = 'text', { bounds, integer = false, disabled = false, name, full = false } = {}) {
    const value = get(state, path);
    const size = type === 'text' ? ' maxlength="60"' : '';
    const limits = bounds ? ` min="${bounds[0]}" max="${bounds[1]}"` : '';
    const step = type === 'number' ? ' step="' + (integer ? '1' : 'any') + '"' : '';
    return `<label class="field${full ? ' full' : ''}">${label}<input type="${type}" data-path="${path}" value="${escape(value)}"
      ${name ? `aria-label="${escape(name)}"` : ''}${size}${limits}${step} ${disabled ? 'disabled' : 'required'}></label>`;
  }

  function number(label, path, bounds, options = {}) {
    return field(label, path, 'number', { bounds: LIMITS[bounds] || bounds, ...options });
  }

  function dropdown(label, path, choices, disabled = false) {
    return `<label class="field">${label}<select data-path="${path}"${disabled ? ' disabled' : ''}>${selectOptions(choices, get(state, path))}</select></label>`;
  }

  function check(label, path, disabled = false) {
    return `<label class="check"><input type="checkbox" data-path="${path}"${get(state, path) ? ' checked' : ''}${disabled ? ' disabled' : ''}>
      <span>${label}</span></label>`;
  }

  function panel(id, title, content, opens, initiallyOpen = false) {
    const open = opens.has(id) ? opens.get(id) : initiallyOpen;
    return `<details class="panel" data-open="${id}"${open ? ' open' : ''}><summary>${title}</summary>${content}</details>`;
  }

  function renderPlan(opens) {
    const plan = state.plan;
    const pac = app.monthlyAmount(plan);
    const rate = euros(pac * 12 / plan.frequency);
    const budget = panel('budget', '1 · Calendario e spese', `<div class="field-grid">
      ${field('Data di inizio', 'startDate', 'date', { bounds: ['1900-01-01', '2200-12-31'] })}
      ${dropdown('Mese di pagamento annuo', 'plan.payMonth', MONTHS)}
      ${number('Spesa già scaduta ancora da pagare (%)', 'plan.currentRemaining', 'pct')}
      ${dropdown('Perimetro del portafoglio', 'plan.scope', [['all', 'Tutti i cicli inclusi'], ['university', 'Solo università']])}
      ${number('Reddito destinato alle rette in mandato (%)', 'plan.incomeShare', 'pct')}
      ${number('Inflazione annua (%)', 'plan.inflation', 'inflation')}
      ${number('Extra inflazione universitaria (punti %)', 'plan.uniPremium', 'inflation', { full: true })}
      </div><p class="hint">Le rate già scadute nell’anno scolastico in corso partono dallo 0% residuo. Imposta la quota da pagare oggi.
      La quota da reddito è separata dal PAC. I costi fuori mandato restano nel bilancio familiare.</p>`, opens, true);

    const savings = panel('savings', '2 · Capitale e versamenti', `<div class="field-grid">
      ${dropdown('Profilo PAC attivo', 'plan.profile', [['standard', 'Standard'], ['alternative', 'Alternativo']])}
      ${dropdown('Frequenza PAC', 'plan.frequency', [[12, 'Mensile'], [4, 'Trimestrale'], [24, 'Due volte al mese']])}
      ${number('Standard · equivalente mensile (€)', 'plan.pac', 'cash')}
      ${number('Alternativo · equivalente mensile (€)', 'plan.pacAlternative', 'cash')}
      ${dropdown('Posizione nel periodo', 'plan.timing', [['end', 'Fine periodo'], ['start', 'Inizio periodo']])}
      ${number('Capitale iniziale / lump sum (€)', 'plan.lump', 'cash')}
      ${number('Commissione per acquisto (€)', 'plan.orderFee', 'annualCost', { full: true })}
      </div><p class="hint">Rata effettiva ${rate} · budget a regime ${euros(pac * 12)} l’anno.
      Capitale iniziale e versamenti sono comuni alle quattro strategie.</p>`, opens, true);

    const market = panel('market', '3 · Mercato, curva e fiscalità', `<div class="field-grid">
      ${number('Rendimento azionario atteso lordo (%)', 'plan.equityReturn', 'equityReturn')}
      ${number('Volatilità azionaria di base (%)', 'plan.volatility', 'volatility')}
      ${number('Tasso privo di rischio per lo Sharpe (%)', 'plan.rf', 'rate')}
      ${number('ETF / Fondo comune · costo annuo (%)', 'plan.ter', 'ter')}
      ${number('Bollo annuo modellato (%)', 'plan.bollo', 'bollo')}
      ${dropdown('Curva obbligazionaria', 'plan.curve', [['btp', 'BTP a gradini · benchmark statico'], ['flat', 'Flat · YTM costante']])}
      ${number('YTM flat lordo (%)', 'plan.flat', 'rate', { disabled: plan.curve !== 'flat' })}
      ${check('Includi salti di mercato', 'plan.jumps')}
      ${number('Salti medi all’anno', 'plan.jumpFrequency', 'jumpFrequency')}
      ${number('Salto medio semplice (%)', 'plan.jumpMean', 'jumpMean')}
      </div><p class="hint">Aliquote fisse. Azionario 26%. Titoli di Stato White List 12,5%.
      Il rendimento lordo è la media annua semplice attesa prima dei costi. I salti aumentano il rischio a parità di media.</p>
      <details class="inside-details spaced" data-open="bands"${opens.get('bands') ? ' open' : ''}><summary>Ipotesi a gradini e riferimenti</summary>
        <div class="table-scroll spaced" tabindex="0"><table aria-label="Curva BTP a gradini">
        <thead><tr><th>Durata</th><th>YTM</th><th>Riferimenti Bloomberg forniti</th></tr></thead><tbody>
        ${BANDS.map(band => `<tr><th scope="row">${band.label}</th><td>${pct(band.ytm / 100)}</td><td>${band.reference}</td></tr>`).join('')}
        </tbody></table></div>
        <p class="hint">Benchmark Last Mid YTM forniti come ipotesi statiche. La curva li usa come proxy dei tassi zero-coupon.</p>
      </details>`, opens);

    const risk = panel('risk', '4 · Strategie, stress e campione', `<div class="field-grid">
      ${number('Due Motori · anni di riserva', 'plan.reserveYears', 'window', { integer: true })}
      ${number('Due Motori · quota delle prossime spese (%)', 'plan.reservePct', 'pct')}
      ${number('Ladder ibrida · quota di ogni pagamento (%)', 'plan.hybridPct', 'pct', { full: true })}
      ${number('Bear · riduzione rendimento (punti %)', 'plan.bearReturn', 'returnStress')}
      ${number('Bear · aumento volatilità (punti %)', 'plan.bearVol', 'volatilityStress')}
      ${number('Bull · aumento rendimento (punti %)', 'plan.bullReturn', 'returnStress')}
      ${number('Bull · riduzione volatilità (punti %)', 'plan.bullVol', 'volatilityStress')}
      ${number('Stress · ribasso alla prima retta universitaria (%)', 'plan.crash', 'crash')}
      ${number('Stress · extra inflazione universitaria (punti %)', 'plan.stressInflation', 'stressInflation')}
      ${number('Percorsi per scenario', 'plan.paths', 'paths', { integer: true })}
      ${number('Seed riproducibile', 'plan.seed', 'seed', { integer: true })}
      </div><p class="hint">La riserva viene rivista trimestralmente. Lo stress aggiunge un ribasso prima del primo pagamento universitario residuo.
      Il seed rende ripetibile il campione.</p>
      <button type="button" class="button secondary small spaced" data-action="seed">Nuovo seed</button>`, opens);
    $('plan-settings').innerHTML = budget + savings + market + risk;
  }

  function renderParents() {
    $('parents').innerHTML = state.parents.map((parent, index) => {
      const path = 'parents.' + index + '.';
      return `<article class="family-card"><div class="panel-head"><h4>${escape(parent.name)}</h4>
        <button class="button text" type="button" data-action="remove-parent" data-index="${index}" ${state.parents.length === 1 ? 'disabled' : ''}>Rimuovi</button></div>
        <div class="field-grid three">
        ${field('Nome', path + 'name')}${field('Data di nascita', path + 'birth', 'date', { bounds: [String(Number(state.startDate.slice(0, 4)) - 120) + '-01-01', state.startDate] })}
        ${number('Reddito netto annuo (€)', path + 'income', 'cash')}
        ${number('Crescita oltre l’inflazione (%)', path + 'realGrowth', 'growth')}
        ${number('Età del cambio reddito', path + 'retirementAge', 'retirementAge', { integer: true })}
        ${number('Reddito sostitutivo (%)', path + 'replacement', 'pct')}</div>
        <p class="hint">Crescita nominale ${pct((parent.realGrowth + state.plan.inflation) / 100)} = crescita oltre l’inflazione + inflazione.
        La quota sostitutiva si applica al compleanno futuro indicato. La fascia di alert resta 67–70 anni.</p></article>`;
    }).join('');
    document.querySelector('[data-action="add-parent"]').disabled = state.parents.length >= 2;
  }

  function renderChildren(opens) {
    const start = app.parseDay(state.startDate);
    $('children').innerHTML = state.children.map((child, index) => {
      const path = 'children.' + index + '.';
      const sc = app.childSchedule(child, start);
      const id = 'cycle-' + index;
      const controls = [];
      if (!sc.nurseryPast) {
        controls.push(dropdown('Primo anno di nido', path + 'nurseryStart',
          [0, 1, 2].map(offset => [offset, app.academicLabel(sc.year + offset)])));
      }
      if (!sc.infantPast) {
        controls.push(dropdown('Ingresso ordinario in infanzia', path + 'infantDelay',
          [0, 1, 2].map(offset => [offset, app.academicLabel(sc.year + 3 + offset)])));
        controls.push(check('Anticipo infanzia', path + 'infantEarly', !sc.eligible || !sc.canPlanInfantEarly || child.infantDelay > 0));
      }
      if (sc.canPlanPrimaryEarly) {
        controls.push(check('Anticipo primaria', path + 'primaryEarly', !sc.eligible));
      } else if (sc.eligible) {
        controls.push(dropdown('Coorte primaria registrata', path + 'primaryEarly', [
          [false, app.academicLabel(sc.standardPrimary) + ' · ordinaria'], [true, app.academicLabel(sc.standardPrimary - 1) + ' · anticipata']
        ]));
      }
      const age = app.ageAt(sc.birth, start);
      const time = sc.eligible ? 'Nascita entro il 30 aprile. Infanzia e primaria hanno scelte indipendenti.' :
        'Nascita dopo il 30 aprile. Anticipo di infanzia e primaria non disponibile.';
      const rows = STAGES.map(stage => {
        const config = path + 'stages.' + stage.id + '.';
        const disabled = ((stage.id === 'nursery' || stage.id === 'spring') && sc.nurseryPast) ||
          (stage.id === 'infant' && sc.infantPast);
        return `<div class="cycle-row">${check(stage.label, config + 'enabled', disabled)}
          ${number('', config + 'cost', 'annualCost', { disabled, name: 'Costo annuo · ' + stage.label + ' · ' + child.name })}
          ${number('', config + 'aid', 'annualCost', { disabled, name: 'Agevolazione annua · ' + stage.label + ' · ' + child.name })}</div>`;
      }).join('');
      const dateYear = Number(state.startDate.slice(0, 4));
      return `<article class="family-card"><div class="panel-head"><h4>${escape(child.name)}</h4>
        <button class="button text" type="button" data-action="remove-child" data-index="${index}">Rimuovi</button></div>
        <div class="field-grid">${field('Nome', path + 'name')}
        ${field('Data di nascita', path + 'birth', 'date', { bounds: [(dateYear - 55) + '-01-01', (dateYear + 15) + '-12-31'] })}</div>
        <p class="hint">${age === null ? 'Nascita futura' : age + ' anni alla data del piano'} · primaria ${app.academicLabel(sc.primary)} ·
          primo anno universitario teorico ${app.academicLabel(sc.firstUniversity)}.</p>
        ${controls.length ? `<div class="field-grid spaced">${controls.join('')}</div>` : ''}
        <p class="hint">${time} L’infanzia anticipata ha priorità sulla sezione primavera nello stesso anno.</p>
        <details data-open="${id}"${opens.get(id) ? ' open' : ''}><summary>Cicli, costi e università</summary>
          <div class="cycle-header"><span>Ciclo incluso</span><span>Costo annuo €</span><span>Agevolazioni €</span></div>
          ${rows}
          <div class="field-grid spaced">
            ${number('Anni primo ciclo universitario', path + 'bachelorYears', 'degree', { integer: true })}
            ${number('Anni secondo ciclo universitario', path + 'masterYears', 'degree', { integer: true })}
            ${number('Anni di pausa dopo le superiori', path + 'universityDelay', [0, 5], { integer: true })}
            ${number('Fuori sede · extra annuo (€)', path + 'away', 'annualCost')}
            ${number('Privata · extra retta annua (€)', path + 'privateFee', 'annualCost')}
          </div>
          <p class="hint">I 5.000 € iniziali sono un budget modificabile. Verifica rette, ISEE e costo della vita.
          Per un ciclo unico di sei anni imposta 6 e 0. La sezione primavera è per i 24–36 mesi, con accesso secondo il servizio locale.
          Escludere un costo delle scuole dell’obbligo conserva la durata del ciclo.</p>
        </details></article>`;
    }).join('') || '<p class="empty">Aggiungi un figlio per proiettare gli studi.</p>';
    document.querySelector('[data-action="add-child"]').disabled = state.children.length >= app.MAX_CHILDREN;
  }

  function renderSettings() {
    const opens = new Map([...settings.querySelectorAll('details[data-open]')].map(item => [item.dataset.open, item.open]));
    renderPlan(opens);
    renderParents();
    renderChildren(opens);
  }

  function renderSelectors() {
    const { view } = state;
    $('selectors').innerHTML = `<label class="field">Strategia<select data-view="strategy">${selectOptions(STRATEGIES.map(s => [s.id, s.label]), view.strategy)}</select></label>
      <label class="field">Scenario<select data-view="scenario">${selectOptions(SCENARIOS.map(s => [s.id, s.label]), view.scenario)}</select></label>
      <label class="field">Valore del saldo<select data-view="units">${selectOptions([['nominal', 'Euro nominali'], ['real', 'Euro di oggi']], view.units)}</select></label>
      <label class="check"><input type="checkbox" data-view="cumulative"${view.cumulative ? ' checked' : ''}>Target cumulato</label>`;
  }

  function render() {
    app.renderDashboard(state, preview, result, Boolean(job));
    document.querySelectorAll('[data-action="results"],[data-action="print"]').forEach(button => {
      button.disabled = !result || !validForm;
    });
  }

  function status(message, error = false) {
    for (const element of [$('run-status'), $('form-status')]) {
      element.textContent = message;
      element.classList.toggle('error', error);
    }
  }

  function busy(active) {
    document.querySelectorAll('[data-action="run"]').forEach(button => { button.disabled = active; });
    document.querySelector('[data-action="cancel"]').hidden = !active;
    $('progress').hidden = !active;
    if (active) $('progress').value = 0;
  }

  function stopJob() {
    if (!job) return;
    job.worker?.terminate();
    job.abort.abort();
    job = null;
    busy(false);
  }

  function run() {
    if (!readForm()) return;
    stopJob();
    const snapshot = state;
    const active = { worker: null, abort: new AbortController() };
    job = active;
    result = null;
    busy(true);
    status('Calcolo di strategie e scenari in corso…');
    render();
    let progress = -1;

    function onProgress(fraction) {
      const value = Math.floor(fraction * 100);
      if (job !== active || value === progress) return;
      progress = value;
      $('progress').value = fraction;
    }
    function complete(simulation) {
      if (job !== active) return;
      stopJob();
      result = simulation;
      render();
      status(app.num(snapshot.plan.paths) + ' percorsi per scenario · seed ' + snapshot.plan.seed);
    }
    function failure(error) {
      if (job !== active) return;
      stopJob();
      render();
      status('Simulazione interrotta. ' + error.message, true);
    }
    function runOnPage() {
      active.worker?.terminate();
      active.worker = null;
      app.simulate(snapshot, {
        onProgress, signal: active.abort.signal,
        yieldToBrowser: () => new Promise(resolve => window.setTimeout(resolve, 0))
      }).then(complete, failure);
    }
    if (location.protocol === 'file:') {
      runOnPage();
      return;
    }
    try {
      active.worker = new Worker(new URL('assets/worker.js', location.href));
      active.worker.addEventListener('message', ({ data }) => {
        if (data.type === 'progress') onProgress(data.fraction);
        if (data.type === 'result') complete(data.result);
        if (data.type === 'error') failure(Error(data.message));
      });
      active.worker.addEventListener('error', event => {
        event.preventDefault();
        if (job === active) runOnPage();
      }, { once: true });
      active.worker.postMessage(snapshot);
    } catch {
      runOnPage();
    }
  }

  function applyState(candidate, redraw = true) {
    const validated = app.validateState(candidate);
    const prepared = app.prepare(validated);
    stopJob();
    state = validated;
    preview = prepared;
    result = null;
    validForm = true;
    if (redraw) renderSettings();
    renderSelectors();
    render();
    status('Ipotesi aggiornate. Simula il piano per aggiornare i risultati.');
  }

  function readForm() {
    const candidate = structuredClone(state);
    for (const input of settings.querySelectorAll('[data-path]:not(:disabled)')) {
      const segments = input.dataset.path.split('.');
      const key = segments.pop();
      const parent = segments.reduce((object, part) => object[part], candidate);
      const current = parent[key];
      if (!input.validity.valid) {
        validForm = false;
        status('Controlla i campi del piano. Una data o un valore è fuori intervallo.', true);
        return false;
      }
      if (input.type === 'checkbox') parent[key] = input.checked;
      else if (input.type === 'number') parent[key] = input.valueAsNumber;
      else if (typeof current === 'number') parent[key] = Number(input.value);
      else if (typeof current === 'boolean') parent[key] = input.value === 'true';
      else parent[key] = input.value;
    }
    for (const child of candidate.children) {
      if (!app.schoolDateEligible(child.birth)) child.infantEarly = child.primaryEarly = false;
      if (child.infantDelay > 0) child.infantEarly = false;
    }
    try {
      if (JSON.stringify(candidate) !== JSON.stringify(state)) applyState(candidate);
      else if (!validForm) {
        validForm = true;
        render();
        status(result ? 'Simulazione aggiornata.' : 'Ipotesi valide. Simula il piano.');
      }
      return true;
    } catch (error) {
      validForm = false;
      status(error.message, true);
      return false;
    }
  }

  function setView(key, value) {
    state.view[key] = value;
    render();
  }

  function fileStatus(message, error = false) {
    $('file-status').textContent = message;
    $('file-status').classList.toggle('error', error);
    if (error) status(message, true);
  }

  async function importFile(file) {
    if (!file) return;
    const version = ++importVersion;
    try {
      if (file.size > 512 * 1024) throw Error('Il file di ipotesi supera 512 KB.');
      const contents = await file.text();
      if (version !== importVersion) return;
      const candidate = contents.trimStart().startsWith('{') ? app.readSession(contents) : app.readAssumptions(contents);
      applyState(candidate);
      fileStatus('Sessione importata.');
      run();
    } catch (error) {
      fileStatus('Importazione non riuscita. ' + error.message, true);
    }
  }

  function download(content, type, name) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
    fileStatus('File pronto · ' + name);
  }

  settings.addEventListener('submit', event => { event.preventDefault(); run(); });
  settings.addEventListener('change', () => {
    if (!readForm()) {
      document.querySelectorAll('[data-action="results"],[data-action="print"]').forEach(button => { button.disabled = true; });
    }
  });

  document.addEventListener('change', event => {
    const input = event.target;
    const key = input.dataset.view;
    if (!key) return;
    const value = key === 'year' ? Number(input.value) : key === 'cumulative' ? input.checked : input.value;
    setView(key, value);
    if (key === 'year') document.querySelector('[data-view="year"]').focus();
  });

  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    const { action, year, strategy, index } = button.dataset;
    if (year !== undefined) {
      setView('year', Number(year));
      $('year-heading').focus();
      return;
    }
    if (strategy) {
      setView('strategy', strategy);
      const control = document.querySelector('[data-view="strategy"]');
      control.value = strategy;
      control.focus();
      return;
    }
    if (!action) return;
    if (action === 'run') { run(); return; }
    if (action === 'cancel') { stopJob(); render(); status('Simulazione interrotta.'); return; }
    if (action === 'import') { $('file-input').click(); return; }
    if (!readForm()) return;

    switch (action) {
      case 'json':
        download(app.sessionJson(state), 'application/json', 'piano-studi-sessione.json');
        return;
      case 'assumptions':
        download(app.assumptionsCsv(state), 'text/csv;charset=utf-8', 'piano-studi-ipotesi.csv');
        return;
      case 'results':
        if (result) download(app.resultCsv(state, result), 'text/csv;charset=utf-8', 'piano-studi-flussi.csv');
        return;
      case 'print':
        if (result) window.print();
        return;
    }

    const candidate = structuredClone(state);
    const yearOfStart = Number(state.startDate.slice(0, 4));
    if (action === 'seed') candidate.plan.seed = crypto.getRandomValues(new Uint32Array(1))[0];
    if (action === 'add-parent') candidate.parents.push(app.newParent(candidate.parents.length + 1, (yearOfStart - 40) + '-06-21'));
    if (action === 'add-child') candidate.children.push(app.newChild(candidate.children.length + 1, state.startDate));
    if (action === 'remove-parent') candidate.parents.splice(Number(index), 1);
    if (action === 'remove-child') candidate.children.splice(Number(index), 1);
    applyState(candidate);
  });

  $('file-input').addEventListener('change', event => {
    importFile(event.target.files[0]);
    event.target.value = '';
  });
  const drop = $('dropzone');
  drop.addEventListener('dragover', event => { event.preventDefault(); drop.classList.add('is-over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
  drop.addEventListener('drop', event => {
    event.preventDefault();
    drop.classList.remove('is-over');
    if (event.dataTransfer.files.length === 1) importFile(event.dataTransfer.files[0]);
    else fileStatus('Trascina un solo file di ipotesi.', true);
  });
  window.addEventListener('beforeprint', () => {
    if (result && validForm) app.report(state, result);
    else $('print-report').innerHTML = '<h1>Pianificazione studi figli</h1><p>Esegui la simulazione per preparare la scheda.</p><p>' +
      escape(app.DISCLAIMER) + '</p>';
  });

  $('disclaimer').textContent = app.DISCLAIMER;
  renderSettings();
  renderSelectors();
  run();
})(globalThis.StudyPlan);
