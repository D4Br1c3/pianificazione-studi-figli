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

  function fieldMarkup(label, path, control, { help, full = false } = {}) {
    const id = 'setting-' + path;
    return `<div class="field${full ? ' full' : ''}">
      ${label ? `<label for="${id}">${label}</label>` : ''}${control}
      ${help ? `<small id="${id}-help">${help}</small>` : ''}</div>`;
  }

  function fieldAttrs(path, { help, disabled = false } = {}) {
    const id = 'setting-' + path;
    return `id="${id}" data-path="${path}"${help ? ` aria-describedby="${id}-help"` : ''}${disabled ? ' disabled' : ''}`;
  }

  function field(label, path, type = 'text', options = {}) {
    const { bounds, integer, disabled, name } = options;
    const value = get(state, path);
    const size = type === 'text' ? ' maxlength="60"' : '';
    const limits = bounds ? ` min="${bounds[0]}" max="${bounds[1]}"` : '';
    const step = type === 'number' ? ' step="' + (integer ? '1' : 'any') + '"' : '';
    const control = `<input type="${type}" ${fieldAttrs(path, options)} value="${escape(value)}"
      ${name ? `aria-label="${escape(name)}"` : ''}${size}${limits}${step}${disabled ? '' : ' required'}>`;
    return fieldMarkup(label, path, control, options);
  }

  function number(label, path, bounds, options = {}) {
    return field(label, path, 'number', { bounds: LIMITS[bounds] || bounds, ...options });
  }

  function dropdown(label, path, choices, options = {}) {
    const control = `<select ${fieldAttrs(path, options)}>${selectOptions(choices, get(state, path))}</select>`;
    return fieldMarkup(label, path, control, options);
  }

  function check(label, path, options = {}) {
    const id = 'setting-' + path;
    return `<div class="check-field${options.full ? ' full' : ''}"><label class="check">
      <input type="checkbox" ${fieldAttrs(path, options)}${get(state, path) ? ' checked' : ''}
        ${options.name ? ` aria-label="${escape(options.name)}"` : ''}><span>${label}</span></label>
      ${options.help ? `<small id="${id}-help">${options.help}</small>` : ''}</div>`;
  }

  function panel(id, title, content, opens, initiallyOpen = false) {
    const open = opens.has(id) ? opens.get(id) : initiallyOpen;
    return `<details class="panel" data-open="${id}"${open ? ' open' : ''}><summary>${title}</summary>${content}</details>`;
  }

  function renderPlan(opens) {
    const plan = state.plan;
    const pac = app.monthlyAmount(plan);
    const rate = euros(pac * 12 / plan.frequency);
    const budget = panel('budget', 'Calendario e costo degli studi', `<div class="field-grid">
      ${field('Data di inizio del piano', 'startDate', 'date', {
        bounds: ['1900-01-01', '2200-12-31'], help: 'Data da cui partono i calcoli. I costi e il reddito iniziali si riferiscono a questo momento.'
      })}
      ${dropdown('Mese di pagamento delle spese', 'plan.payMonth', MONTHS, {
        help: 'Il modello concentra la spesa di ogni anno scolastico al primo giorno di questo mese.'
      })}
      ${number('Quota residua delle spese già scadute (%)', 'plan.currentRemaining', 'pct', {
        full: true, help: 'Riguarda l’anno scolastico in corso. Con il 40% su 1.000 € già scaduti, restano 400 € da pagare alla data di inizio. Usa 0% se hai già saldato quelle spese. Le scadenze future entrano per intero.'
      })}
      ${number('Inflazione generale annua (%)', 'plan.inflation', 'inflation', {
        help: 'Tasso di crescita dei prezzi. Serve a proiettare le spese e a esprimere i risultati in euro di oggi.'
      })}
      ${number('Inflazione aggiuntiva per l’università (punti percentuali)', 'plan.uniPremium', 'inflation', {
        help: 'Si somma all’inflazione generale. Con 2% generale e 1 punto aggiuntivo, le spese universitarie crescono del 3% all’anno.'
      })}
      </div>`, opens, true);

    const calendar = preview.base;
    const currentYear = calendar.rows[0].year;
    const lastYear = calendar.rows.at(-1).year;
    const schoolYears = Array.from({ length: lastYear - currentYear + 1 }, (_, index) => currentYear + index);
    if (!schoolYears.includes(plan.withdrawalYear)) schoolYears.push(plan.withdrawalYear);
    schoolYears.sort((a, b) => a - b);
    const withdrawal = panel('withdrawal', 'Quando il portafoglio inizia a pagare', `<div class="field-grid">
      ${dropdown('Inizio dei prelievi per gli studi', 'plan.withdrawalMode', app.WITHDRAWAL_MODES, {
        full: true, help: 'Dalla prima spesa residua, da un anno comune a tutti i figli oppure da un ciclo che ciascun figlio inizia nel proprio anno.'
      })}
      ${plan.withdrawalMode === 'year' ? dropdown('Primo anno scolastico a carico del portafoglio', 'plan.withdrawalYear',
        schoolYears.map(year => [year, app.academicLabel(year)]), {
          full: true, help: 'Per tutti i figli, il portafoglio può contribuire alle spese da questo anno scolastico in poi.'
        }) : ''}
      ${plan.withdrawalMode === 'stage' ? dropdown('Ciclo da cui iniziare a finanziare gli studi', 'plan.withdrawalStage',
        app.WITHDRAWAL_STAGES, {
          full: true, help: 'Se due figli iniziano il ciclo in anni diversi, il portafoglio paga ciascuno a partire dal suo anno. Per un figlio senza il ciclo scelto, le spese restano a carico della famiglia.'
        }) : ''}
      ${number('Quota di reddito per pagare le spese direttamente (%)', 'plan.incomeShare', 'pct', {
        full: true, help: 'Con il 10% di 30.000 € netti, puoi pagare direttamente fino a 3.000 € all’anno delle spese previste dalla data scelta. Il portafoglio copre la parte rimanente.'
      })}
      </div><p class="hint">Prima dell’avvio dei prelievi, le spese restano nel bilancio familiare. Il piano di accumulo (PAC) può partire subito, con la frequenza che scegli.</p>`, opens, true);

    const savings = panel('savings', 'Capitale e versamenti', `<div class="field-grid">
      ${dropdown('Profilo dei versamenti da usare', 'plan.profile', [
        ['standard', 'Standard'], ['alternative', 'Alternativo']
      ], { help: 'Scegli quale importo usare per tutte le strategie in questa simulazione.' })}
      ${dropdown('Frequenza dei versamenti', 'plan.frequency', [[12, 'Una volta al mese'], [4, 'Ogni tre mesi'], [24, 'Due volte al mese']], {
        help: 'La frequenza ripartisce lo stesso budget annuo tra le rate.'
      })}
      ${number('Importo mensile standard (€)', 'plan.pac', 'cash', {
        help: 'Budget mensile del profilo standard. Con 250 €, prevedi 3.000 € in un anno completo.'
      })}
      ${number('Importo mensile alternativo (€)', 'plan.pacAlternative', 'cash', {
        help: 'Secondo budget mensile da richiamare cambiando profilo.'
      })}
      ${dropdown('Quando versare la rata', 'plan.timing', [['end', 'A fine periodo'], ['start', 'A inizio periodo']], {
        help: 'Indica se la rata entra all’inizio o alla fine di ciascun periodo della frequenza scelta.'
      })}
      ${number('Capitale disponibile all’inizio (€)', 'plan.lump', 'cash', {
        help: 'Somma già disponibile alla data di inizio, oltre ai versamenti futuri.'
      })}
      ${number('Commissione per acquisto azionario (€)', 'plan.orderFee', 'annualCost', {
        full: true, help: 'Costo fisso trattenuto da ogni acquisto, compreso l’eventuale investimento azionario iniziale.'
      })}
      </div><p class="hint">Ogni rata ammonta a <strong>${rate}</strong>. Il budget per un anno completo è ${euros(pac * 12)}.</p>`, opens, true);

    const market = panel('market', 'Rendimenti, rischio e costi', `<div class="field-grid">
      ${number('Rendimento annuo atteso dell’azionario, lordo (%)', 'plan.equityReturn', 'equityReturn', {
        help: 'Ipotesi di rendimento medio annuo, prima dei costi e delle imposte.'
      })}
      ${number('Volatilità annua di base dell’azionario (%)', 'plan.volatility', 'volatility', {
        help: 'Misura l’ampiezza delle oscillazioni dei rendimenti. Una volatilità più alta allarga la gamma degli esiti.'
      })}
      ${number('Tasso privo di rischio per lo Sharpe (%)', 'plan.rf', 'rate', {
        help: 'Tasso di confronto per calcolare il rendimento in eccesso per unità di rischio.'
      })}
      ${number('Costo annuo dell’ETF / Fondo comune (%)', 'plan.ter', 'ter', {
        help: 'Percentuale annua di costo del prodotto, applicata al valore dell’azionario.'
      })}
      ${number('Imposta di bollo annua modellata (%)', 'plan.bollo', 'bollo', {
        help: 'Prelievo annuo sul valore degli investimenti, approssimato lungo il piano.'
      })}
      ${dropdown('Modello dei tassi obbligazionari', 'plan.curve', [['steps', 'Curva a gradini'], ['flat', 'Tasso costante']], {
        help: 'I tassi servono a stimare il capitale per gli incassi a scadenza e il rendimento della riserva.'
      })}
      ${number('Tasso annuo lordo costante (%)', 'plan.flat', 'rate', {
        disabled: plan.curve !== 'flat', help: 'Se scegli Tasso costante, lo stesso tasso vale per tutte le durate.'
      })}
      ${check('Includi salti di mercato', 'plan.jumps', {
        help: 'Aggiunge movimenti improvvisi e casuali all’azionario, mantenendo il rendimento medio atteso.'
      })}
      ${number('Numero medio di salti all’anno', 'plan.jumpFrequency', 'jumpFrequency', {
        help: 'Con 0,2, il modello genera in media un salto ogni cinque anni.'
      })}
      ${number('Variazione media quando avviene un salto (%)', 'plan.jumpMean', 'jumpMean', {
        help: 'Con −18%, il valore azionario scende in media del 18% quando si verifica un salto.'
      })}
      </div><p class="hint">Aliquote del modello. Azionario 26% e comparto obbligazionario agevolato 12,5%.</p>
      <details class="inside-details spaced" data-open="bands"${opens.get('bands') ? ' open' : ''}><summary>Tassi per durata</summary>
        <div class="table-scroll spaced" tabindex="0"><table aria-label="Curva a gradini">
        <thead><tr><th scope="col">Durata</th><th scope="col">Tasso annuo lordo</th></tr></thead><tbody>
        ${BANDS.map(band => `<tr><th scope="row">${band.label}</th><td>${pct(band.ytm / 100)}</td></tr>`).join('')}
        </tbody></table></div>
      </details>`, opens);
    $('plan-settings').innerHTML = budget + withdrawal + savings + market;
  }

  function renderAdvanced(opens) {
    const simulation = panel('risk', 'Scenari di mercato e simulazione', `<div class="field-grid">
      ${number('Bear · riduzione del rendimento atteso (punti percentuali)', 'plan.bearReturn', 'returnStress', {
        help: 'Con rendimento Base del 6% e riduzione di 4 punti, il rendimento atteso in Bear è del 2% annuo.'
      })}
      ${number('Bear · aumento della volatilità (punti percentuali)', 'plan.bearVol', 'volatilityStress', {
        help: 'Con volatilità Base del 15% e aumento di 5 punti, in Bear sale al 20%.'
      })}
      ${number('Bull · aumento del rendimento atteso (punti percentuali)', 'plan.bullReturn', 'returnStress', {
        help: 'Con rendimento Base del 6% e aumento di 3 punti, il rendimento atteso in Bull è del 9% annuo.'
      })}
      ${number('Bull · riduzione della volatilità (punti percentuali)', 'plan.bullVol', 'volatilityStress', {
        help: 'Con volatilità Base del 15% e riduzione di 3 punti, in Bull scende al 12%. Il minimo è zero.'
      })}
      ${number('Stress università · ribasso azionario alla prima retta (%)', 'plan.crash', 'crash', {
        help: 'Con 30%, il valore azionario già investito cala del 30% subito prima della prima retta universitaria residua.'
      })}
      ${number('Stress università · inflazione in più (punti percentuali)', 'plan.stressInflation', 'stressInflation', {
        help: 'Si somma alla crescita già prevista per le spese universitarie. Con un 3% nel Base e 2 punti di stress, sale al 5% annuo.'
      })}
      ${number('Numero di percorsi per scenario', 'plan.paths', 'paths', {
        integer: true, help: 'Ogni percorso simula una sequenza di rendimenti. Più percorsi rendono più stabili le stime. Con 10.000 percorsi, il peggior 1% ne contiene circa 100.'
      })}
      ${number('Codice per ripetere il campione (seed)', 'plan.seed', 'seed', {
        integer: true, help: 'Con le stesse ipotesi e lo stesso codice, ottieni le stesse simulazioni.'
      })}
      </div><p class="hint">Bear e Bull modificano rendimento e volatilità per tutto il piano. Lo stress universitario combina un singolo ribasso con costi universitari più alti.</p>
      <button type="button" class="button secondary small spaced" data-action="seed">Genera un nuovo codice</button>`, opens);

    const funding = panel('funding', 'Riserva dei Due Motori e ladder ibrida', `<div class="field-grid">
      ${number('Due Motori · quanti anni di spese coprire con la riserva', 'plan.reserveYears', 'window', {
        integer: true, help: 'Con 5 anni, ogni trimestre la strategia verifica quanta riserva serve per le spese dei cinque anni successivi.'
      })}
      ${number('Due Motori · quota delle spese da coprire con la riserva (%)', 'plan.reservePct', 'pct', {
        help: 'Con il 100%, la riserva punta a coprire tutte le spese assegnate al portafoglio nel periodo scelto.'
      })}
      ${number('Ladder ibrida · quota di ogni spesa da coprire in anticipo (%)', 'plan.hybridPct', 'pct', {
        full: true, help: 'Con il 50% su una spesa di 5.000 € a carico del portafoglio, l’obiettivo è predisporre un incasso di 2.500 € alla scadenza.'
      })}
      </div>`, opens, true);

    $('advanced-settings').innerHTML = funding + simulation;
  }

  function renderParents() {
    $('parents').innerHTML = state.parents.map((parent, index) => {
      const path = 'parents.' + index + '.';
      const nominal = pct((parent.realGrowth + state.plan.inflation) / 100);
      return `<article class="family-card"><div class="panel-head"><h4>${escape(parent.name)}</h4>
        <button class="button text" type="button" data-action="remove-parent" data-index="${index}" ${state.parents.length === 1 ? 'disabled' : ''}>Rimuovi</button></div>
        <div class="field-grid">
        ${field('Nome del genitore', path + 'name')}
        ${field('Data di nascita', path + 'birth', 'date', { bounds: [String(Number(state.startDate.slice(0, 4)) - 120) + '-01-01', state.startDate] })}
        ${number('Reddito netto annuo di oggi (€)', path + 'income', 'cash', { help: 'Reddito disponibile dopo imposte e contributi. Inserisci 0 se assente.' })}
        ${number('Crescita del reddito oltre l’inflazione (% annuo)', path + 'realGrowth', 'growth', {
          help: 'Si somma all’inflazione generale. Con i valori attuali, il reddito nominale cresce del ' + nominal + ' all’anno.'
        })}
        ${number('Età ipotizzata per la pensione (anni)', path + 'retirementAge', 'retirementAge', {
          integer: true, help: 'Al compleanno futuro indicato si applica la quota di reddito dopo la pensione.'
        })}
        ${number('Quota di reddito dopo la pensione (%)', path + 'replacement', 'pct', {
          help: 'Con il 70% su un reddito annuo previsto di 30.000 €, il modello assume 21.000 € dopo il pensionamento. Se sei già in pensione, inserisci il reddito netto corrente.'
        })}</div></article>`;
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
        controls.push(dropdown('Anno di ingresso al nido', path + 'nurseryStart',
          [0, 1, 2].map(offset => [offset, app.academicLabel(sc.year + offset)])));
      }
      if (!sc.infantPast) {
        controls.push(dropdown('Anno di ingresso ordinario alla scuola dell’infanzia', path + 'infantDelay',
          [0, 1, 2].map(offset => [offset, app.academicLabel(sc.year + 3 + offset)])));
        controls.push(check('Anticipa l’ingresso alla scuola dell’infanzia', path + 'infantEarly', {
          disabled: !sc.eligible || !sc.canPlanInfantEarly || child.infantDelay > 0
        }));
      }
      if (sc.canPlanPrimaryEarly) {
        controls.push(check('Anticipa l’ingresso alla scuola primaria', path + 'primaryEarly', { disabled: !sc.eligible }));
      } else if (sc.eligible) {
        controls.push(dropdown('Anno effettivo di ingresso alla primaria', path + 'primaryEarly', [
          [false, app.academicLabel(sc.standardPrimary) + ' · ordinario'], [true, app.academicLabel(sc.standardPrimary - 1) + ' · anticipato']
        ]));
      }
      const age = app.ageAt(sc.birth, start);
      const time = sc.eligible ? 'Per le nascite entro il 30 aprile, gli anticipi di infanzia e primaria si possono scegliere separatamente.' :
        'Per le nascite da maggio in poi vale l’ingresso ordinario a infanzia e primaria.';
      const rows = STAGES.map(stage => {
        const config = path + 'stages.' + stage.id + '.';
        const disabled = ((stage.id === 'nursery' || stage.id === 'spring') && sc.nurseryPast) ||
          (stage.id === 'infant' && sc.infantPast);
        return `<div class="cycle-row">
          ${check(stage.label, config + 'enabled', { disabled, name: 'Includi spesa · ' + stage.label + ' · ' + child.name })}
          ${number('', config + 'cost', 'annualCost', { disabled, name: 'Costo annuo · ' + stage.label + ' · ' + child.name })}
          ${number('', config + 'aid', 'annualCost', { disabled, name: 'Agevolazione annua · ' + stage.label + ' · ' + child.name })}</div>`;
      }).join('');
      const dateYear = Number(state.startDate.slice(0, 4));
      const university = child.bachelorYears + child.masterYears > 0 ?
        ' · Università dal ' + app.academicLabel(sc.firstUniversity) : '';
      return `<article class="family-card"><div class="panel-head"><h4>${escape(child.name)}</h4>
        <button class="button text" type="button" data-action="remove-child" data-index="${index}">Rimuovi</button></div>
        <div class="field-grid">${field('Nome del figlio', path + 'name')}
        ${field('Data di nascita', path + 'birth', 'date', { bounds: [(dateYear - 55) + '-01-01', (dateYear + 15) + '-12-31'] })}</div>
        <p class="hint">${age === null ? 'Nascita futura' : age + ' anni alla data di inizio'} · Primaria dal ${app.academicLabel(sc.primary)}${university}.</p>
        ${controls.length ? `<div class="field-grid spaced">${controls.join('')}</div><p class="hint">${time}</p>` : ''}
        <details data-open="${id}"${opens.get(id) ? ' open' : ''}><summary>Costi, agevolazioni e durata degli studi</summary>
          <p class="hint">La spunta include la spesa nel piano. Le agevolazioni riducono l’importo a carico della famiglia e del portafoglio. Inserisci i valori annui ai prezzi di oggi.</p>
          <div class="cycle-header"><span>Spesa inclusa</span><span>Costo annuo €</span><span>Agevolazioni annue €</span></div>
          ${rows}
          <div class="field-grid spaced">
            ${number('Durata del primo corso universitario (anni)', path + 'bachelorYears', 'degree', {
              integer: true, help: 'Per un corso a ciclo unico di sei anni, imposta 6 qui e 0 per la magistrale.'
            })}
            ${number('Durata della laurea magistrale (anni)', path + 'masterYears', 'degree', {
              integer: true, help: 'Durata del percorso successivo al primo corso. Imposta 0 se il piano termina con il primo corso.'
            })}
            ${number('Anni di pausa prima dell’università', path + 'universityDelay', [0, 5], {
              integer: true, help: 'Posticipa l’ingresso all’università dopo la fine delle superiori.'
            })}
            ${number('Spesa aggiuntiva annua per fuori sede (€)', path + 'away', 'annualCost', {
              help: 'Aggiunta al costo universitario di ogni anno per alloggio, trasporti e altre spese fuori sede.'
            })}
            ${number('Retta privata in più ogni anno (€)', path + 'privateFee', 'annualCost', {
              help: 'Importo annuo aggiuntivo rispetto al costo universitario indicato sopra.'
            })}
          </div>
          <p class="hint">La sezione primavera è per i 24–36 mesi, secondo l’accesso previsto dal servizio locale. L’infanzia anticipata ha priorità nello stesso anno. Escludere un costo delle scuole dell’obbligo conserva la durata del ciclo.</p>
        </details></article>`;
    }).join('') || '<p class="empty">Aggiungi un figlio per proiettare le spese di studio.</p>';
    document.querySelector('[data-action="add-child"]').disabled = state.children.length >= app.MAX_CHILDREN;
  }

  function renderSettings() {
    const opens = new Map([...settings.querySelectorAll('details[data-open]')].map(item => [item.dataset.open, item.open]));
    const focusedPath = settings.contains(document.activeElement) && document.activeElement.dataset.path;
    renderPlan(opens);
    renderParents();
    renderChildren(opens);
    renderAdvanced(opens);
    if (focusedPath) $('setting-' + focusedPath)?.focus({ preventScroll: true });
  }

  function renderStrategyGuide() {
    $('strategy-guide').innerHTML = STRATEGIES.map(strategy => `<article class="strategy-card">
      <h4>${strategy.label}</h4><p>${strategy.text}</p><p>${strategy.tradeoff}</p></article>`).join('');
  }

  function renderPlanSummary() {
    const calendar = preview.base;
    const stress = preview.calendars.shock;
    const plan = state.plan;
    const amount = app.monthlyAmount(plan) * 12 / plan.frequency;
    const family = calendar.totals.outside + calendar.totals.incomePaid;
    const formatDue = day => day === null ? 'Nessuna spesa prevista' : app.fmtDate(day);
    const metrics = [
      ['Importo di ogni versamento', euros(amount)], ['Spese già assegnate alla famiglia', euros(family)],
      ['Spese da finanziare con il portafoglio', euros(calendar.totals.target)],
      ['Prima scadenza da finanziare', formatDue(calendar.firstWithdrawal)],
      ['Ribasso nello stress universitario', plan.crash === 0 || stress.firstUniversityDue === null ?
        'Nessun ribasso previsto' : app.fmtDate(stress.firstUniversityDue)]
    ];
    const children = calendar.withdrawals.map((start, index) => {
      let detail = start.fromYear === null ? 'Ciclo assente nel piano' : formatDue(start.firstDue);
      if (start.fromYear !== null && plan.withdrawalMode === 'stage') {
        detail = app.academicLabel(start.fromYear) + ' come anno di avvio · ' + detail;
      }
      return `<li><strong>${escape(state.children[index].name)}</strong> · ${detail}</li>`;
    });
    $('plan-summary').innerHTML = `<h3 id="plan-summary-title">Riepilogo prima della simulazione</h3>
      <p class="hint">${app.withdrawalLabel(plan)}. Le spese stimate qui sono quelle dello scenario Base, ai prezzi previsti alle scadenze.</p>
      <div class="summary-strip">${metrics.map(([name, value]) => `<div class="strip-item">${name}<strong>${value}</strong></div>`).join('')}</div>
      ${children.length ? `<details class="inside-details"><summary>Prima spesa da finanziare per ciascun figlio</summary>
        <ul class="first-expenses">${children.join('')}</ul></details>` : ''}`;
  }

  function renderSelectors() {
    const { view } = state;
    $('selectors').innerHTML = `<label class="field">Strategia<select data-view="strategy">${selectOptions(STRATEGIES.map(s => [s.id, s.label]), view.strategy)}</select></label>
      <label class="field">Scenario<select data-view="scenario">${selectOptions(SCENARIOS.map(s => [s.id, s.label]), view.scenario)}</select></label>
      <label class="field">Importi del grafico<select data-view="units">${selectOptions([['nominal', 'Euro alle date future'], ['real', 'Euro di oggi']], view.units)}</select></label>
      <label class="check"><input type="checkbox" data-view="cumulative"${view.cumulative ? ' checked' : ''}>Mostra le spese cumulate</label>`;
  }

  function render() {
    const ready = Boolean(result) && validForm;
    $('risultati').hidden = !ready;
    $('results-nav').hidden = !ready;
    if (ready) app.renderDashboard(state, result);
    document.querySelectorAll('[data-action="results"],[data-action="print"]').forEach(button => {
      button.disabled = !ready;
    });
  }

  function status(message, error = false) {
    const element = $('form-status');
    element.textContent = message;
    element.classList.toggle('error', error);
  }

  function busy(active) {
    settings.querySelector('[data-action="run"]').disabled = active;
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
    if (!readForm(true)) return;
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
      status('Simulazione completata.');
      $('results-title').focus({ preventScroll: true });
      $('risultati').scrollIntoView({ block: 'start' });
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
      active.worker = new Worker(new URL('assets/worker.js?v=2', location.href));
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

  function applyState(candidate) {
    const validated = app.validateState(candidate);
    const prepared = app.prepare(validated);
    stopJob();
    state = validated;
    preview = prepared;
    result = null;
    validForm = true;
    renderSettings();
    renderPlanSummary();
    renderSelectors();
    render();
    status('Ipotesi aggiornate. Controlla il riepilogo e avvia la simulazione.');
  }

  function readForm(revealError = false) {
    const candidate = structuredClone(state);
    for (const input of settings.querySelectorAll('[data-path]:not(:disabled)')) {
      const segments = input.dataset.path.split('.');
      const key = segments.pop();
      const parent = segments.reduce((object, part) => object[part], candidate);
      const current = parent[key];
      if (!input.validity.valid) {
        validForm = false;
        stopJob();
        render();
        const name = input.getAttribute('aria-label') || input.labels?.[0]?.textContent.trim() || 'Valore';
        status(name + ' · ' + (input.validity.valueMissing ? 'inserisci un valore.' : 'controlla il formato o l’intervallo.'), true);
        if (revealError) {
          for (let panel = input.closest('details'); panel; panel = panel.parentElement.closest('details')) panel.open = true;
          input.focus();
        }
        return false;
      }
      if (input.type === 'checkbox') parent[key] = input.checked;
      else if (input.type === 'number') parent[key] = input.valueAsNumber;
      else if (typeof current === 'number') parent[key] = Number(input.value);
      else if (typeof current === 'boolean') parent[key] = input.value === 'true';
      else parent[key] = input.value;
    }
    if (candidate.plan.withdrawalMode !== 'year' && candidate.startDate !== state.startDate) {
      candidate.plan.withdrawalYear = app.academicYear(app.parseDay(candidate.startDate));
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
      stopJob();
      render();
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
      fileStatus('Ipotesi importate.');
      status('Ipotesi importate. Controlla il riepilogo e avvia la simulazione.');
      $('inputs-title').focus();
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

  settings.addEventListener('submit', event => event.preventDefault());
  settings.addEventListener('change', () => readForm());

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
        if (result) {
          app.report(state, result);
          window.print();
        }
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
  renderStrategyGuide();
  renderPlanSummary();
  renderSelectors();
  render();
})(globalThis.StudyPlan);
