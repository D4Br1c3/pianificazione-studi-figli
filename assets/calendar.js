(function (app) {
  'use strict';

  const DAY = 86400000;
  const YEAR = 365.2425;
  const date = (year, month = 1, day = 1) => Date.UTC(year, month - 1, day) / DAY;
  const parseDay = iso => Date.parse(iso + 'T00:00:00Z') / DAY;
  const isoDay = day => new Date(day * DAY).toISOString().slice(0, 10);
  const yearOf = day => new Date(day * DAY).getUTCFullYear();
  const monthOf = day => new Date(day * DAY).getUTCMonth() + 1;
  const dayOf = day => new Date(day * DAY).getUTCDate();
  const yearsBetween = (start, end) => (end - start) / YEAR;
  const academicYear = day => yearOf(day) - Number(monthOf(day) < 9);
  const academicLabel = year => String(year) + '/' + String(year + 1).slice(-2);
  const monthEnd = (year, month) => date(year, month + 1, 1) - 1;
  const schoolDue = (year, month) => date(year + Number(month < 9), month);

  function plusMonths(day, count) {
    const index = yearOf(day) * 12 + monthOf(day) - 1 + count;
    const year = Math.floor(index / 12);
    const month = index % 12 + 1;
    return Math.min(date(year, month, dayOf(day)), monthEnd(year, month));
  }

  function ageAt(birth, at) {
    if (at < birth) return null;
    const years = yearOf(at) - yearOf(birth);
    return years - Number(at < plusMonths(birth, years * 12));
  }

  function childSchedule(child, start) {
    const birth = parseDay(child.birth);
    const year = yearOf(birth);
    const academic = academicYear(start);
    const eligible = app.schoolDateEligible(child.birth);
    const standardPrimary = year + 6;
    const primary = standardPrimary - Number(eligible && child.primaryEarly);
    const infant = year + 3 + child.infantDelay - Number(eligible && child.infantEarly);
    const firstUniversity = primary + 13 + child.universityDelay;
    return {
      birth, year, academic, eligible, standardPrimary, primary, infant, firstUniversity,
      nurseryPast: academic > year + 2,
      infantPast: academic >= primary,
      canPlanPrimaryEarly: academic < standardPrimary - 1,
      canPlanInfantEarly: academic <= year + 2 && academic < primary,
      springYear: year + 2,
      end: firstUniversity + child.bachelorYears + child.masterYears - 1
    };
  }

  function stageAt(child, schedule, year) {
    const s = schedule;
    if (year < s.year || year > s.end) return null;
    if (year < s.primary) {
      if (year >= s.infant && child.stages.infant.enabled) return 'infant';
      if (year === s.springYear && child.stages.spring.enabled) return 'spring';
      if (year >= s.year + child.nurseryStart && year <= s.year + 2) return 'nursery';
      return null;
    }
    if (year < s.primary + 5) return 'primary';
    if (year < s.primary + 8) return 'middle';
    if (year < s.primary + 13) return 'high';
    if (year < s.firstUniversity) return null;
    if (year < s.firstUniversity + child.bachelorYears) return 'bachelor';
    return 'master';
  }

  function projectChild(child, schedule, year, start, plan, shockInflation) {
    const stage = stageAt(child, schedule, year);
    const setting = stage && child.stages[stage];
    if (!setting?.enabled) return null;
    let originalDue = schoolDue(year, plan.payMonth);
    if (stage === 'nursery' || stage === 'spring') {
      const allowed = plusMonths(schedule.birth, stage === 'nursery' ? 3 : 24);
      originalDue = Math.max(originalDue, allowed);
      if (originalDue >= date(year + 1, 9)) return null;
    }
    const due = Math.max(originalDue, start);
    const t = yearsBetween(start, due);
    const remainder = originalDue < start ? plan.currentRemaining / 100 : 1;
    const university = Boolean(app.STAGE_BY_ID[stage].university);
    const inflation = (plan.inflation + (university ? plan.uniPremium + shockInflation : 0)) / 100;
    const index = Math.pow(1 + inflation, t);
    const fullToday = setting.cost + (university ? child.away + child.privateFee : 0);
    const fullNominal = fullToday * index;
    const gross = fullNominal * remainder;
    const aid = Math.min(gross, setting.aid * index * remainder);
    return {
      stage, due, originalDue, university, remainder, fullToday, fullNominal,
      today: fullToday * remainder, gross, aid, net: gross - aid,
      age: ageAt(schedule.birth, due), incomePaid: 0, outside: 0, target: 0
    };
  }

  function parentYear(parent, open, start, end, reference, inflation) {
    const born = parseDay(parent.birth);
    const retirement = plusMonths(born, parent.retirementAge * 12);
    const adjusted = retirement > start && retirement <= reference;
    const time = yearsBetween(start, reference);
    const replacement = adjusted ? parent.replacement / 100 : 1;
    const income = parent.income * Math.pow(1 + (parent.realGrowth + inflation) / 100, time) * replacement;
    return {
      age: ageAt(born, reference), income, adjusted,
      pensionWindow: open < plusMonths(born, 71 * 12) && end > plusMonths(born, 67 * 12)
    };
  }

  function buildCalendar(state, scenario = 'base') {
    const { plan, parents, children } = state;
    const start = parseDay(state.startDate);
    const firstYear = academicYear(start);
    const schedules = children.map(child => childSchedule(child, start));
    const lastPossible = Math.max(firstYear, ...schedules.map(schedule => schedule.end));
    const extraInflation = scenario === 'shock' ? plan.stressInflation : 0;
    const rows = [];
    let lastIncluded = 0;
    let firstUniversityDue = null;
    let cumTarget = 0;
    let cumTargetReal = 0;

    for (let year = firstYear; year <= lastPossible; year++) {
      const reference = Math.max(schoolDue(year, plan.payMonth), start);
      const open = Math.max(date(year, 9), start);
      const close = date(year + 1, 9);
      const profiles = parents.map(parent => parentYear(parent, open, start, close, reference, plan.inflation));
      const income = profiles.reduce((total, profile) => total + profile.income, 0);
      const people = children.map((child, index) => projectChild(child, schedules[index], year, start, plan, extraInflation));
      const chronological = people.filter(Boolean).sort((a, b) => a.due - b.due);
      const flows = [];
      let remainingIncome = income * plan.incomeShare / 100;
      let today = 0, gross = 0, aid = 0, net = 0, university = 0, incomePaid = 0, outside = 0, target = 0, targetReal = 0;

      for (const person of chronological) {
        today += person.today;
        gross += person.gross;
        aid += person.aid;
        net += person.net;
        if (person.university) {
          university += person.net;
          if (person.net > 0 && firstUniversityDue === null) firstUniversityDue = person.due;
        }
        if (plan.scope === 'all' || person.university) {
          person.incomePaid = Math.min(remainingIncome, person.net);
          remainingIncome -= person.incomePaid;
          person.target = person.net - person.incomePaid;
        } else {
          person.outside = person.net;
        }
        incomePaid += person.incomePaid;
        outside += person.outside;
        target += person.target;
        targetReal += person.target / Math.pow(1 + plan.inflation / 100, yearsBetween(start, person.due));
        if (person.target > 0) {
          const latest = flows.at(-1);
          if (latest?.day === person.due) latest.amount += person.target;
          else flows.push({ day: person.due, amount: person.target });
        }
      }

      if (chronological.length) lastIncluded = rows.length;
      const report = Math.max(reference, ...chronological.map(person => person.due));
      const burden = income > 0 ? net / income : null;
      const inWindow = net > 0 && profiles.some(profile => profile.pensionWindow);
      const warning = inWindow ? (university > 0 || burden === null || burden >= 0.25 ? 'red' : 'amber') : null;
      cumTarget += target;
      cumTargetReal += targetReal;
      rows.push({
        year, label: academicLabel(year), report, reference, profiles, income, people, flows, warning,
        today, gross, aid, net, university, incomePaid, outside, target, targetReal, cumTarget, cumTargetReal, burden
      });
    }
    rows.length = lastIncluded + 1;
    const totals = {};
    for (const key of ['today', 'gross', 'aid', 'net', 'university', 'incomePaid', 'outside', 'target', 'targetReal']) {
      totals[key] = rows.reduce((sum, row) => sum + row[key], 0);
    }
    return { start, rows, totals, firstUniversityDue, end: rows.at(-1).report };
  }

  function contributionDates(state, start, end) {
    const { plan } = state;
    const amount = app.monthlyAmount(plan) * 12 / plan.frequency;
    const deposits = new Map();
    if (amount === 0) return deposits;
    for (let year = yearOf(start); year <= yearOf(end); year++) {
      for (let month = 1; month <= 12; month++) {
        const early = plan.timing === 'start';
        if (plan.frequency === 4 && (early ? (month - 1) % 3 : month % 3)) continue;
        const last = early ? date(year, month) : monthEnd(year, month);
        const dates = plan.frequency === 24 ? [last, date(year, month, early ? 16 : 15)] : [last];
        for (const day of dates) {
          if (day >= start && day <= end) deposits.set(day, amount);
        }
      }
    }
    return deposits;
  }

  Object.assign(app, {
    date, parseDay, isoDay, yearOf, monthOf, yearsBetween, academicYear, academicLabel, ageAt,
    childSchedule, buildCalendar, contributionDates
  });
})(globalThis.StudyPlan);
