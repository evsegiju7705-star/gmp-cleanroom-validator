/* ==========================================================================
   calc.js — расчёты, оценка соответствия, форматирование чисел
   Шаг 2: разбор/формат чисел, объём помещения.
   Шаг 3: суммарный расход, кратность воздухообмена, статистика по частицам,
          оценка соответствия и общий итог (summary).
   Коды статусов:
     ok     — соответствует            fail   — не соответствует
     none   — нет данных               na     — документом не нормируется
     nocrit — критерий не задан пользователем
   ========================================================================== */
(function (root) {
  'use strict';
  var CRQ = root.CRQ = root.CRQ || {};

  var STATUS_LABELS = {
    ok:     'СООТВЕТСТВУЕТ',
    fail:   'НЕ СООТВЕТСТВУЕТ',
    none:   'НЕТ ДАННЫХ',
    na:     'НЕ НОРМИРУЕТСЯ',
    nocrit: 'КРИТЕРИЙ НЕ ЗАДАН'
  };

  /* Число знаков после запятой, с которым кратность представляется и сравнивается с критерием */
  var ACH_DIGITS = 1;

  function isNum(v) {
    return typeof v === 'number' && isFinite(v);
  }

  /** «12,5» / «12.5» / «1 250» → число; пустая или некорректная строка → null */
  function parseNumber(text) {
    if (text === null || text === undefined) { return null; }
    var s = String(text).replace(/[\s\u00A0\u202F]/g, '').replace(',', '.');
    if (s === '' || !/^-?\d+(\.\d+)?$/.test(s)) { return null; }
    var n = Number(s);
    return isFinite(n) ? n : null;
  }

  /** Число → строка с десятичной запятой и разделителями разрядов; null → «—» */
  function formatNumber(value, digits) {
    if (!isNum(value)) { return '—'; }
    var d = (typeof digits === 'number') ? digits : 0;
    return value.toLocaleString('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  /** Число → строка для поля ввода (без разделителей разрядов) */
  function toInput(value) {
    return isNum(value) ? String(value).replace('.', ',') : '';
  }

  function round(value, digits) {
    var k = Math.pow(10, digits || 0);
    return Math.round((value + Number.EPSILON) * k) / k;
  }

  function sum(values) {
    return values.reduce(function (acc, v) { return acc + v; }, 0);
  }

  /** Объём помещения, м³ = площадь × высота; null, если данных нет */
  function volume(area, height) {
    if (!isNum(area) || !isNum(height) || area <= 0 || height <= 0) { return null; }
    return area * height;
  }

  /** Кратность воздухообмена, ч⁻¹ = суммарный расход, м³/ч ÷ объём, м³ */
  function airChangeRate(totalFlow, vol) {
    if (!isNum(totalFlow) || !isNum(vol) || vol <= 0) { return null; }
    return totalFlow / vol;
  }

  /* ---------- оценка соответствия ---------- */

  /** значение ≥ min */
  function evalMin(value, min) {
    if (!isNum(min)) { return 'nocrit'; }
    if (!isNum(value)) { return 'none'; }
    return value >= min ? 'ok' : 'fail';
  }

  /** min ≤ значение ≤ max; допускается одна заданная граница */
  function evalRange(value, min, max) {
    if (!isNum(min) && !isNum(max)) { return 'nocrit'; }
    if (!isNum(value)) { return 'none'; }
    if (isNum(min) && value < min) { return 'fail'; }
    if (isNum(max) && value > max) { return 'fail'; }
    return 'ok';
  }

  /** значение ≤ limit; limit === null — не нормируется */
  function evalMax(value, limit) {
    if (!isNum(limit)) { return 'na'; }
    if (!isNum(value)) { return 'none'; }
    return value <= limit ? 'ok' : 'fail';
  }

  /** Сводный статус: есть fail → fail; есть none → none; есть ok → ok; иначе — fallback */
  function combine(statuses, fallback) {
    if (statuses.indexOf('fail') !== -1) { return 'fail'; }
    if (statuses.indexOf('none') !== -1) { return 'none'; }
    if (statuses.indexOf('ok') !== -1) { return 'ok'; }
    return fallback || 'none';
  }

  /* ---------- блоки сводки ---------- */

  function airflowSummary(s, vol) {
    var points = s.airflow.points;
    var filled = points.map(function (p) { return p.flow; }).filter(isNum);
    var complete = points.length > 0 && filled.length === points.length;
    var total = filled.length ? sum(filled) : null;
    /* Кратность считается только по полному набору точек: частичная сумма занижает результат */
    var achRaw = complete ? airChangeRate(total, vol) : null;
    var ach = achRaw === null ? null : round(achRaw, ACH_DIGITS);
    var achMin = s.criteria.achMin[s.room.grade];
    return {
      count: points.length,
      filled: filled.length,
      complete: complete,
      total: total,
      ach: ach,
      achMin: isNum(achMin) ? achMin : null,
      status: evalMin(ach, achMin)
    };
  }

  function envSummary(s) {
    var c = s.criteria;
    return {
      dp:   { value: s.env.dp,   min: c.dpMin,   max: null,      status: evalMin(s.env.dp, c.dpMin) },
      temp: { value: s.env.temp, min: c.tempMin, max: c.tempMax, status: evalRange(s.env.temp, c.tempMin, c.tempMax) },
      rh:   { value: s.env.rh,   min: c.rhMin,   max: c.rhMax,   status: evalRange(s.env.rh, c.rhMin, c.rhMax) }
    };
  }

  function channelSummary(points, key, limit) {
    var filled = points.map(function (p) { return p[key]; }).filter(isNum);
    var max = filled.length ? Math.max.apply(null, filled) : null;
    var status;
    if (!isNum(limit)) {
      status = 'na';
    } else if (max !== null && max > limit) {
      status = 'fail';                       // превышение хотя бы в одной точке
    } else if (points.length === 0 || filled.length < points.length) {
      status = 'none';                       // не все точки заполнены
    } else {
      status = 'ok';
    }
    return {
      limit: isNum(limit) ? limit : null,
      filled: filled.length,
      avg: filled.length ? sum(filled) / filled.length : null,
      max: max,
      status: status
    };
  }

  function particlesSummary(s) {
    var points = s.particles.points;
    var lim = CRQ.gmp.getParticleLimits(s.meta.standard, s.room.grade, s.room.state);
    var rows = points.map(function (p) {
      var st05 = evalMax(p.p05, lim.p05);
      var st50 = evalMax(p.p50, lim.p50);
      return { id: p.id, p05: st05, p50: st50, status: combine([st05, st50], 'na') };
    });
    return {
      count: points.length,
      minLocations: CRQ.gmp.minSamplingLocations(s.room.area),
      p05: channelSummary(points, 'p05', lim.p05),
      p50: channelSummary(points, 'p50', lim.p50),
      rows: rows
    };
  }

  /** Полная сводка расчётов и заключений по текущему состоянию */
  function summary(s) {
    var vol = volume(s.room.area, s.room.height);
    var air = airflowSummary(s, vol);
    var env = envSummary(s);
    var part = particlesSummary(s);

    var items = [
      { key: 'ach',  label: 'кратность воздухообмена',  status: air.status },
      { key: 'dp',   label: 'перепад давления',         status: env.dp.status },
      { key: 'temp', label: 'температура',              status: env.temp.status },
      { key: 'rh',   label: 'относительная влажность',  status: env.rh.status },
      { key: 'p05',  label: 'частицы ≥ 0,5 мкм',        status: part.p05.status },
      { key: 'p50',  label: 'частицы ≥ 5,0 мкм',        status: part.p50.status }
    ];

    var remarks = [];
    if (part.count > 0 && part.minLocations !== null && part.count < part.minLocations) {
      remarks.push('Точек отбора проб меньше минимума по ГОСТ Р ИСО 14644-1 (' +
        part.count + ' из ' + part.minLocations + ').');
    }

    return {
      volume: vol,
      airflow: air,
      env: env,
      particles: part,
      items: items,
      remarks: remarks,
      overall: combine(items.map(function (i) { return i.status; }), 'none')
    };
  }

  CRQ.calc = {
    STATUS_LABELS: STATUS_LABELS,
    ACH_DIGITS: ACH_DIGITS,
    isNum: isNum,
    parseNumber: parseNumber,
    formatNumber: formatNumber,
    toInput: toInput,
    round: round,
    sum: sum,
    volume: volume,
    airChangeRate: airChangeRate,
    evalMin: evalMin,
    evalRange: evalRange,
    evalMax: evalMax,
    combine: combine,
    summary: summary
  };
})(typeof window !== 'undefined' ? window : globalThis);
