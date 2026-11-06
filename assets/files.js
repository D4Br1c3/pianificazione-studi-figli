(function (app) {
  'use strict';

  const FORMAT = 'pianificazione-studi-figli';
  const UNSAFE_FORMULA = /^\s*[=+\-@\t\r\n]|^[\t\r\n]/u;

  function textForCell(value) {
    const string = String(value);
    return UNSAFE_FORMULA.test(string) || string.startsWith("'") ? "'" + string : string;
  }

  function csvValue(value) {
    if (value == null) return '';
    if (typeof value === 'number') return String(value).replace('.', ',');
    if (typeof value === 'boolean') return value ? 'vero' : 'falso';
    const string = textForCell(value);
    return /[;"\r\n]/.test(string) ? '"' + string.replaceAll('"', '""') + '"' : string;
  }

  function csv(rows) {
    return '\uFEFF' + rows.map(row => row.map(csvValue).join(';')).join('\r\n') + '\r\n';
  }

  function readCsv(source) {
    const text = source.replace(/^\uFEFF/, '');
    const rows = [];
    let row = [];
    let value = '';
    let quoted = false;
    let closed = false;
    for (let index = 0; index < text.length; index++) {
      const char = text[index];
      if (quoted) {
        if (char !== '"') value += char;
        else if (text[index + 1] === '"') { value += '"'; index++; }
        else { quoted = false; closed = true; }
        continue;
      }
      if (char === ';' || char === '\n' || char === '\r') {
        row.push(value);
        value = '';
        closed = false;
        if (char === ';') continue;
        if (char === '\r' && text[index + 1] === '\n') index++;
        if (row.some(field => field !== '')) rows.push(row);
        row = [];
      } else if (char === '"' && value === '' && !closed) {
        quoted = true;
      } else {
        if (closed || char === '"') throw Error('Virgolette non valide nel CSV.');
        value += char;
      }
    }
    if (quoted) throw Error('Virgolette non chiuse nel CSV.');
    if (value !== '' || row.length) rows.push([...row, value]);
    return rows;
  }

  function flatten(object, prefix = '', rows = []) {
    for (const [key, value] of Object.entries(object)) {
      const field = prefix + key;
      if (value !== null && typeof value === 'object') flatten(value, field + '.', rows);
      else rows.push([field, value]);
    }
    return rows;
  }

  function assumptionsCsv(input) {
    const state = app.validateState(input);
    const records = [
      ['ambito', 'campo', 'valore'],
      ['meta', 'versione', app.VERSION],
      ['meta', 'avvertenze', app.DISCLAIMER],
      ['sessione', 'startDate', state.startDate]
    ];
    function add(section, values) {
      for (const [key, value] of flatten(values)) records.push([section, key, value]);
    }
    add('piano', state.plan);
    add('vista', state.view);
    state.parents.forEach((parent, index) => add('genitore.' + (index + 1), parent));
    state.children.forEach((child, index) => add('figlio.' + (index + 1), child));
    return csv(records);
  }

  function typedValue(value, template, field) {
    if (template === null && value === '') return null;
    if (typeof template === 'number' || template === null) {
      if (!/^-?\d+(?:[.,]\d+)?(?:e[+-]?\d+)?$/i.test(value.trim())) throw Error('Numero non valido · ' + field);
      return Number(value.trim().replace(',', '.'));
    }
    if (typeof template === 'boolean') {
      const normalized = value.trim().toLowerCase();
      if (['vero', 'true', '1'].includes(normalized)) return true;
      if (['falso', 'false', '0'].includes(normalized)) return false;
      throw Error('Valore vero/falso non valido · ' + field);
    }
    if (value.startsWith("'") && (value[1] === "'" || UNSAFE_FORMULA.test(value.slice(1)))) return value.slice(1);
    return value;
  }

  function readAssumptions(source) {
    const [header, ...records] = readCsv(source);
    if (header?.join(';') !== 'ambito;campo;valore') throw Error('Seleziona un CSV di ipotesi con intestazione ambito;campo;valore.');
    const groups = new Map();
    for (const row of records) {
      const [section, key, value] = row;
      if (row.length !== 3 || !section || !key) throw Error('Riga del CSV incompleta.');
      if (!groups.has(section)) groups.set(section, new Map());
      const group = groups.get(section);
      if (group.has(key)) throw Error('Campo duplicato · ' + section + ' / ' + key);
      group.set(key, value);
    }
    if (groups.get('meta')?.get('versione') !== String(app.VERSION)) throw Error('Versione del CSV non supportata.');
    const startDate = groups.get('sessione')?.get('startDate');
    if (!startDate) throw Error('Manca la data del piano nel CSV.');
    const defaults = app.defaultState(startDate);
    function restore(section, template) {
      const fields = groups.get(section);
      if (!fields) throw Error('Sezione mancante · ' + section);
      groups.delete(section);
      for (const [key, type] of flatten(template)) {
        if (!fields.has(key)) throw Error('Campo mancante · ' + section + ' / ' + key);
        const segments = key.split('.');
        const name = segments.pop();
        const parent = segments.reduce((current, part) => current[part], template);
        parent[name] = typedValue(fields.get(key), type, key);
        fields.delete(key);
      }
      if (fields.size) throw Error('Campo sconosciuto · ' + section);
      return template;
    }
    function groupList(prefix, create) {
      const count = [...groups.keys()].filter(section => section.startsWith(prefix + '.')).length;
      if (count > app.MAX_CHILDREN) throw Error('Troppe sezioni · ' + prefix);
      return Array.from({ length: count }, (_, index) => restore(prefix + '.' + (index + 1), create(index + 1, startDate)));
    }
    groups.delete('meta');
    groups.delete('sessione');
    const state = {
      version: app.VERSION, startDate,
      plan: restore('piano', defaults.plan),
      view: restore('vista', defaults.view),
      parents: groupList('genitore', app.newParent),
      children: groupList('figlio', app.newChild)
    };
    if (groups.size) throw Error('Sezione sconosciuta nel CSV.');
    return app.validateState(state);
  }

  function sessionJson(input) {
    return JSON.stringify({
      format: FORMAT, exportedAt: new Date().toISOString(), disclaimer: app.DISCLAIMER, state: app.validateState(input)
    }, null, 2);
  }

  function readSession(source) {
    const parsed = JSON.parse(source.replace(/^\uFEFF/, ''));
    if (parsed?.format !== FORMAT) throw Error('Seleziona un JSON esportato da Pianificazione studi figli.');
    return app.validateState(parsed.state);
  }

  function resultCsv(state, result) {
    const header = [
      'scenario', 'strategia', 'anno_scolastico', 'data_rilevazione', 'valuta',
      'costo_base_residuo', 'lordo_nominale', 'agevolazioni', 'netto_nominale', 'universita_netta',
      'reddito_familiare', 'netto_su_reddito_pct', 'da_reddito_in_mandato', 'fuori_mandato',
      'target_portafoglio', 'target_cumulato_nominale', 'target_cumulato_euro_oggi', 'capitale_iniziale',
      'PAC_lordo_periodo', 'ladder_iniziale_impiegata', 'pagato_portafoglio_medio', 'risultato_gestione_medio',
      'imposte_liquide_medie', 'bollo_liquido_medio', 'commissioni_medie',
      'scoperto_medio', 'scoperto_P50', 'scoperto_P95', 'scoperto_P95_su_reddito_pct',
      'prob_scoperto_pct', 'prob_primo_scoperto_pct', 'saldo_P05', 'saldo_P25', 'saldo_P50', 'saldo_P75', 'saldo_P95',
      'liquidabile_P50', 'ladder_residua_modello', 'prob_successo_pct', 'VaR95_scoperto_euro_oggi',
      'ES95_scoperto_euro_oggi', 'VaR99_scoperto_euro_oggi', 'ES99_scoperto_euro_oggi',
      'alert_pensione', 'seed', 'percorsi', 'avvertenze'
    ];
    for (let index = 0; index < state.parents.length; index++) {
      for (const key of ['nome', 'eta', 'reddito', 'fascia_67_70']) header.push('genitore' + (index + 1) + '_' + key);
    }
    for (let index = 0; index < state.children.length; index++) {
      for (const key of ['nome', 'eta', 'ciclo', 'data_spesa', 'costo_annuo_base', 'costo_annuo_nominale',
        'lordo_residuo', 'agevolazioni', 'netto_residuo', 'da_reddito', 'fuori_mandato', 'target']) {
        header.push('figlio' + (index + 1) + '_' + key);
      }
    }

    const rows = [header];
    for (const { id: scenario } of app.SCENARIOS) {
      const calendar = result.calendars[scenario];
      app.STRATEGIES.forEach(({ id: strategy }, strategyIndex) => {
        const risk = result.scenarios[scenario][strategy];
        calendar.rows.forEach((year, index) => {
          const row = risk.rows[index];
          const fields = [
            scenario, strategy, year.label, app.isoDay(year.report), 'EUR', year.today, year.gross, year.aid,
            year.net, year.university, year.income, year.burden === null ? null : year.burden * 100, year.incomePaid,
            year.outside, year.target, year.cumTarget, year.cumTargetReal, index === 0 ? state.plan.lump : 0,
            row.deposit, index === 0 ? result.plans[strategyIndex].invested : 0, row.paid, row.gain, row.tax, row.bollo,
            row.fee, row.gapMean, row.gap50, row.gap95, year.income > 0 ? row.gap95 / year.income * 100 : null,
            row.gapProbability * 100, row.firstGap * 100, ...row.fan, row.liquid, row.locked, risk.success * 100,
            risk.loss95.var, risk.loss95.es, risk.loss99.var, risk.loss99.es, year.warning,
            state.plan.seed, state.plan.paths, index === 0 ? app.DISCLAIMER : ''
          ];
          year.profiles.forEach((parent, position) => {
            fields.push(state.parents[position].name, parent.age, parent.income, parent.pensionWindow);
          });
          year.people.forEach((child, position) => {
            fields.push(state.children[position].name, child?.age,
              child ? app.STAGE_BY_ID[child.stage].label : null, child ? app.isoDay(child.due) : null,
              child?.fullToday, child?.fullNominal, child?.gross, child?.aid, child?.net,
              child?.incomePaid, child?.outside, child?.target);
          });
          rows.push(fields);
        });
      });
    }
    return csv(rows);
  }

  Object.assign(app, { assumptionsCsv, readAssumptions, sessionJson, readSession, resultCsv });
})(globalThis.StudyPlan);
