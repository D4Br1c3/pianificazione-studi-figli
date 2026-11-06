(function (app) {
  'use strict';

  const VERSION = 1;
  const MAX_CHILDREN = 20;
  const LIMITS = {
    cash: [0, 100000000], annualCost: [0, 1000000], growth: [-20, 30],
    inflation: [-5, 15], equityReturn: [-60, 60], volatility: [0, 80],
    rate: [-5, 30], pct: [0, 100], bollo: [0, 2], ter: [0, 10],
    degree: [0, 12], delay: [0, 2], window: [1, 10], jumpFrequency: [0, 2],
    jumpMean: [-95, 50], returnStress: [0, 40], volatilityStress: [0, 40],
    stressInflation: [0, 12], crash: [0, 95], retirementAge: [50, 80],
    paths: [1000, 25000], seed: [0, 4294967295]
  };
  const STAGES = [
    { id: 'nursery', label: 'Nido', cost: 6600 },
    { id: 'spring', label: 'Sezione primavera', cost: 1000 },
    { id: 'infant', label: 'Scuola dell’infanzia', cost: 1000 },
    { id: 'primary', label: 'Primaria', cost: 1000 },
    { id: 'middle', label: 'Secondaria di I grado', cost: 1000 },
    { id: 'high', label: 'Secondaria di II grado', cost: 1000 },
    { id: 'bachelor', label: 'Università · primo ciclo', cost: 5000, university: true },
    { id: 'master', label: 'Università · secondo ciclo', cost: 5000, university: true }
  ];
  const STAGE_BY_ID = Object.fromEntries(STAGES.map(stage => [stage.id, stage]));
  const STRATEGIES = [
    { id: 'equity', label: 'PAC azionario', short: 'PAC azionario', text: 'Il PAC e il capitale iniziale disponibile restano esposti all’azionario. Le spese richiedono vendite alle scadenze.' },
    { id: 'motors', label: 'Due Motori', short: 'Due Motori', text: 'Una riserva di breve periodo viene alimentata con vendite azionarie fino al budget delle prossime scadenze. La riserva può ridurre le vendite durante un calo e limita la partecipazione ai rialzi.' },
    { id: 'ladder', label: 'Ladder integrale', short: 'Ladder', text: 'Il capitale iniziale viene dedicato a scadenze sintetiche, a partire dalla prima. Il PAC finanzia la parte che resta scoperta dal piano a pronti.' },
    { id: 'hybrid', label: 'Ladder ibrida', short: 'Ibrida', text: 'La ladder punta a coprire una quota di ogni pagamento. Il PAC e l’eventuale avanzo iniziale finanziano la parte residua, esposta al mercato.' }
  ];
  const SCENARIOS = [
    { id: 'base', label: 'Base', description: 'Rendimento, rischio e costi impostati.' },
    { id: 'bear', label: 'Bear', description: 'Rendimento atteso più basso e volatilità più alta per tutto il piano.' },
    { id: 'bull', label: 'Bull', description: 'Rendimento atteso più alto e volatilità più bassa per tutto il piano.' },
    { id: 'shock', label: 'Stress università', description: 'Ribasso alla prima retta universitaria del piano e crescita più rapida dei costi universitari.' }
  ];
  const BANDS = [
    { label: '0–1 anni', max: 1, ytm: 2.50, reference: 'Liquidità di riferimento' },
    { label: '1–3 anni', max: 3, ytm: 3.50, reference: '3 anni 3,628%' },
    { label: '3–5 anni', max: 5, ytm: 3.75, reference: '3 anni 3,628% · 5 anni 3,942%' },
    { label: '5–7 anni', max: 7, ytm: 4.00, reference: '5 anni 3,942% · 7 anni 4,150%' },
    { label: '7–10 anni', max: 10, ytm: 4.25, reference: '7 anni 4,150% · 10 anni 4,424%' },
    { label: '10–20 anni', max: 20, ytm: 4.50, reference: '10 anni 4,424% · 15 anni 4,728% · 20 anni 4,83%' },
    { label: '20 anni e oltre', max: Infinity, ytm: 4.75, reference: '30 anni 4,996%' }
  ];
  const TAX = Object.freeze({ equity: 0.26, bond: 0.125 });
  const DISCLAIMER = 'Simulazioni didattiche e di pianificazione. Il servizio non presta consulenza in materia di investimenti ai sensi MiFID II, non valuta l’adeguatezza e non raccomanda operazioni o strumenti finanziari. Gli esiti dipendono dalle ipotesi, non sono previsioni o garanzie e possono includere perdite anche rilevanti. I rendimenti passati non garantiscono quelli futuri. Fiscalità e prezzi sono semplificati.';
  const MONTHS = [
    [9, 'Settembre'], [10, 'Ottobre'], [11, 'Novembre'], [12, 'Dicembre'], [1, 'Gennaio'],
    [2, 'Febbraio'], [3, 'Marzo'], [4, 'Aprile'], [5, 'Maggio'], [6, 'Giugno'], [7, 'Luglio'], [8, 'Agosto']
  ];

  function todayRome(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(now);
    const date = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return [date.year, date.month, date.day].join('-');
  }

  function newParent(number, birth) {
    return { name: 'Genitore ' + number, birth, income: 10000, realGrowth: 1, retirementAge: 67, replacement: 100 };
  }

  function newChild(number, birth) {
    return {
      name: 'Figlio ' + number, birth, nurseryStart: 0, infantDelay: 0, infantEarly: false, primaryEarly: false,
      bachelorYears: 3, masterYears: 2, universityDelay: 0, away: 0, privateFee: 0,
      stages: Object.fromEntries(STAGES.map(stage => [stage.id, {
        enabled: stage.id !== 'spring', cost: stage.cost, aid: 0
      }]))
    };
  }

  function defaultState(startDate = todayRome()) {
    const year = Number(startDate.slice(0, 4));
    return {
      version: VERSION,
      startDate,
      parents: [newParent(1, (year - 52) + '-03-18'), newParent(2, (year - 49) + '-10-20')],
      children: [newChild(1, (year - 8) + '-04-18'), newChild(2, (year - 5) + '-11-14')],
      plan: {
        inflation: 2, uniPremium: 0, payMonth: 9, currentRemaining: 0, scope: 'all', incomeShare: 0,
        pac: 250, pacAlternative: 500, profile: 'standard', frequency: 12, timing: 'end', lump: 0,
        equityReturn: 6, volatility: 15, rf: 2.5, ter: 0.2, bollo: 0.2, orderFee: 0,
        jumps: true, jumpFrequency: 0.2, jumpMean: -18,
        curve: 'btp', flat: 3.5, reserveYears: 5, reservePct: 100, hybridPct: 50,
        bearReturn: 4, bearVol: 5, bullReturn: 3, bullVol: 3, stressInflation: 2, crash: 30,
        paths: 10000, seed: 1729
      },
      view: { strategy: 'motors', scenario: 'base', units: 'nominal', cumulative: true, year: null }
    };
  }

  function schoolDateEligible(iso) {
    return Number(iso.slice(5, 7)) <= 4;
  }

  function checkDate(value, label) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw Error(label + ' · inserisci una data.');
    const parsed = new Date(value + 'T00:00:00Z');
    if (!Number.isFinite(+parsed) || parsed.toISOString().slice(0, 10) !== value) {
      throw Error(label + ' · data non valida.');
    }
    return value;
  }

  function checkNumber(value, bounds, label, integer = false) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < bounds[0] || value > bounds[1] ||
      (integer && !Number.isInteger(value))) {
      throw Error(label + ' · inserisci ' + (integer ? 'un intero' : 'un valore') + ' tra ' + bounds[0] + ' e ' + bounds[1] + '.');
    }
    return value;
  }

  function checkChoice(value, choices, label) {
    if (!choices.includes(value)) throw Error(label + ' · opzione non valida.');
    return value;
  }

  function checkName(value, label) {
    if (typeof value !== 'string' || value.trim().length === 0 || value.length > 60) {
      throw Error(label + ' · inserisci un nome fino a 60 caratteri.');
    }
    return value;
  }

  function checkBoolean(value, label) {
    if (typeof value !== 'boolean') throw Error(label + ' · selezione non valida.');
    return value;
  }

  function validateState(input) {
    if (input?.version !== VERSION) throw Error('Versione delle ipotesi non supportata.');
    const startDate = checkDate(input.startDate, 'Data del piano');
    const startYear = Number(startDate.slice(0, 4));
    checkNumber(startYear, [1900, 2200], 'Anno del piano');
    if (!Array.isArray(input.parents) || input.parents.length < 1 || input.parents.length > 2) {
      throw Error('Inserisci uno o due genitori.');
    }
    if (!Array.isArray(input.children) || input.children.length > MAX_CHILDREN) {
      throw Error('Il piano supporta fino a ' + MAX_CHILDREN + ' figli.');
    }
    const parents = input.parents.map((parent, index) => {
      const label = 'Genitore ' + (index + 1);
      const birth = checkDate(parent?.birth, label);
      if (birth > startDate || Number(birth.slice(0, 4)) < startYear - 120) {
        throw Error(label + ' · data di nascita fuori dall’intervallo del piano.');
      }
      return {
        name: checkName(parent.name, label), birth,
        income: checkNumber(parent.income, LIMITS.cash, label + ' · reddito'),
        realGrowth: checkNumber(parent.realGrowth, LIMITS.growth, label + ' · crescita reale'),
        retirementAge: checkNumber(parent.retirementAge, LIMITS.retirementAge, label + ' · età del cambio reddito', true),
        replacement: checkNumber(parent.replacement, LIMITS.pct, label + ' · reddito sostitutivo')
      };
    });
    const children = input.children.map((child, index) => {
      const label = 'Figlio ' + (index + 1);
      const birth = checkDate(child?.birth, label);
      checkNumber(Number(birth.slice(0, 4)), [startYear - 55, startYear + 15], label + ' · anno di nascita', true);
      const eligible = schoolDateEligible(birth);
      const infantEarly = checkBoolean(child.infantEarly, label + ' · anticipo infanzia');
      const primaryEarly = checkBoolean(child.primaryEarly, label + ' · anticipo primaria');
      const infantDelay = checkNumber(child.infantDelay, LIMITS.delay, label + ' · ritardo infanzia', true);
      if ((infantEarly || primaryEarly) && !eligible) throw Error(label + ' · anticipo ammesso per nascite entro il 30 aprile.');
      if (infantEarly && infantDelay) throw Error(label + ' · scegli anticipo o ingresso differito per l’infanzia.');
      return {
        name: checkName(child.name, label), birth, infantEarly, primaryEarly, infantDelay,
        nurseryStart: checkNumber(child.nurseryStart, LIMITS.delay, label + ' · ingresso al nido', true),
        bachelorYears: checkNumber(child.bachelorYears, LIMITS.degree, label + ' · durata primo ciclo', true),
        masterYears: checkNumber(child.masterYears, LIMITS.degree, label + ' · durata secondo ciclo', true),
        universityDelay: checkNumber(child.universityDelay, [0, 5], label + ' · pausa prima dell’università', true),
        away: checkNumber(child.away, LIMITS.annualCost, label + ' · fuori sede'),
        privateFee: checkNumber(child.privateFee, LIMITS.annualCost, label + ' · extra retta privata'),
        stages: Object.fromEntries(STAGES.map(stage => {
          const values = child.stages?.[stage.id];
          return [stage.id, {
            enabled: checkBoolean(values?.enabled, label + ' · ' + stage.label),
            cost: checkNumber(values?.cost, LIMITS.annualCost, label + ' · costo ' + stage.label),
            aid: checkNumber(values?.aid, LIMITS.annualCost, label + ' · agevolazione ' + stage.label)
          }];
        }))
      };
    });
    const p = input.plan || {};
    const number = (key, bounds, label, integer) => checkNumber(p[key], LIMITS[bounds] || bounds, label, integer);
    const plan = {
      inflation: number('inflation', 'inflation', 'Inflazione'),
      uniPremium: number('uniPremium', 'inflation', 'Extra inflazione universitaria'),
      payMonth: checkChoice(p.payMonth, MONTHS.map(month => month[0]), 'Mese di pagamento'),
      currentRemaining: number('currentRemaining', 'pct', 'Quota già scaduta ancora da pagare'),
      scope: checkChoice(p.scope, ['all', 'university'], 'Perimetro del portafoglio'),
      incomeShare: number('incomeShare', 'pct', 'Quota dal reddito'),
      pac: number('pac', 'cash', 'PAC standard'),
      pacAlternative: number('pacAlternative', 'cash', 'PAC alternativo'),
      profile: checkChoice(p.profile, ['standard', 'alternative'], 'Profilo PAC'),
      frequency: checkChoice(p.frequency, [4, 12, 24], 'Frequenza PAC'),
      timing: checkChoice(p.timing, ['start', 'end'], 'Giorno versamento'),
      lump: number('lump', 'cash', 'Capitale iniziale'),
      equityReturn: number('equityReturn', 'equityReturn', 'Rendimento azionario'),
      volatility: number('volatility', 'volatility', 'Volatilità'),
      rf: number('rf', 'rate', 'Tasso privo di rischio'),
      ter: number('ter', 'ter', 'Costo annuo ETF / Fondo comune'),
      bollo: number('bollo', 'bollo', 'Bollo'),
      orderFee: number('orderFee', 'annualCost', 'Commissione a versamento'),
      jumps: checkBoolean(p.jumps, 'Salti di mercato'),
      jumpFrequency: number('jumpFrequency', 'jumpFrequency', 'Frequenza dei salti'),
      jumpMean: number('jumpMean', 'jumpMean', 'Salto medio'),
      curve: checkChoice(p.curve, ['flat', 'btp'], 'Curva obbligazionaria'),
      flat: number('flat', 'rate', 'Rendimento flat'),
      reserveYears: number('reserveYears', 'window', 'Orizzonte riserva', true),
      reservePct: number('reservePct', 'pct', 'Quota Due Motori'),
      hybridPct: number('hybridPct', 'pct', 'Quota ladder ibrida'),
      bearReturn: number('bearReturn', 'returnStress', 'Bear · calo del rendimento'),
      bearVol: number('bearVol', 'volatilityStress', 'Bear · aumento volatilità'),
      bullReturn: number('bullReturn', 'returnStress', 'Bull · aumento rendimento'),
      bullVol: number('bullVol', 'volatilityStress', 'Bull · calo volatilità'),
      stressInflation: number('stressInflation', 'stressInflation', 'Stress · extra inflazione'),
      crash: number('crash', 'crash', 'Stress · ribasso una tantum'),
      paths: number('paths', 'paths', 'Percorsi', true),
      seed: number('seed', 'seed', 'Seed', true)
    };
    if (plan.equityReturn - plan.bearReturn <= -100) {
      throw Error('Bear · il rendimento atteso deve essere maggiore di −100%.');
    }
    const v = input.view || {};
    const view = {
      strategy: checkChoice(v.strategy, STRATEGIES.map(strategy => strategy.id), 'Vista · strategia'),
      scenario: checkChoice(v.scenario, SCENARIOS.map(scenario => scenario.id), 'Vista · scenario'),
      units: checkChoice(v.units, ['nominal', 'real'], 'Vista · unità'),
      cumulative: checkBoolean(v.cumulative, 'Vista · fabbisogno cumulato'),
      year: v.year === null ? null : checkNumber(v.year, [1899, 2300], 'Vista · anno', true)
    };
    return { version: VERSION, startDate, parents, children, plan, view };
  }

  function monthlyAmount(plan) {
    return plan.profile === 'alternative' ? plan.pacAlternative : plan.pac;
  }

  Object.assign(app, {
    VERSION, MAX_CHILDREN, LIMITS, STAGES, STAGE_BY_ID, STRATEGIES, SCENARIOS, BANDS, TAX, DISCLAIMER, MONTHS,
    todayRome, newParent, newChild, defaultState, schoolDateEligible, validateState, monthlyAmount
  });
})(globalThis.StudyPlan ??= {});
