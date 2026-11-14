/* Расчёты. Чистые функции, без обращения к странице. */
(function (K) {
  'use strict';
  var ref = K.ref, calc = {};

  calc.num = function (v) {
    if (v === null || v === undefined) return null;
    var s = String(v).replace(/\s/g, '').replace(',', '.');
    if (s === '') return null;
    var n = Number(s);
    return isFinite(n) ? n : null;
  };

  /* Минимальное число точек отбора проб по таблице А.1 */
  calc.minPoints = function (area) {
    var a = calc.num(area);
    if (a === null || a <= 0) return null;
    for (var i = 0; i < ref.A1.length; i++) if (a <= ref.A1[i][0]) return ref.A1[i][1];
    return Math.ceil(27 * a / 1000);
  };

  calc.isOper = function (special) { return special === ref.OPER; };

  /* Пределы для класса: {a: >=0,5; b: >=5,0}; null = не нормируется; undefined = класс неизвестен */
  calc.limits = function (cls, special) {
    var l = (calc.isOper(special) && ref.limitsOper[cls]) || ref.limits[cls];
    return l ? { a: l[0], b: l[1] } : undefined;
  };

  /* Время отбора пробы, мин, и объём пробы, л */
  calc.sample = function (cls, special, flow) {
    var t = (calc.isOper(special) && ref.sampleMinOper[cls]) || ref.sampleMin[cls];
    var f = calc.num(flow);
    if (!t || f === null) return null;
    var min = f < 10 ? t[0] : t[1];
    return { min: min, litres: Math.round(min * f * 100) / 100 };
  };

  /* Среднее по точке: считается только когда заполнены все пробы */
  calc.pointMean = function (samples) {
    var s = 0;
    for (var i = 0; i < ref.samplesPerPoint; i++) {
      var n = calc.num(samples && samples[i]);
      if (n === null) return null;
      s += n;
    }
    return s / ref.samplesPerPoint;
  };

  /* 'ok' | 'fail' | 'none' (нет данных) | 'na' (не нормируется) */
  calc.judge = function (mean, limit) {
    if (limit === null) return 'na';
    if (mean === null || limit === undefined) return 'none';
    return mean <= limit ? 'ok' : 'fail';
  };

  /* Помещение участвует в испытании, если заданы площадь и класс чистоты */
  calc.isClassified = function (room) {
    return !!ref.limits[room.cls] && calc.minPoints(room.area) !== null;
  };

  /* Полный расчёт по одному помещению */
  calc.skchRoom = function (room, data, special) {
    var lim = calc.limits(room.cls, special) || {};
    var pts = (data && data.points) || [];
    var res = { limits: lim, minPoints: calc.minPoints(room.area), points: [], verdict: 'ok' };
    var anyFail = false, anyNone = false;
    pts.forEach(function (p) {
      var ma = calc.pointMean(p.a), mb = calc.pointMean(p.b);
      var ja = calc.judge(ma, lim.a), jb = calc.judge(mb, lim.b);
      res.points.push({ meanA: ma, meanB: mb, judgeA: ja, judgeB: jb });
      if (ja === 'fail' || jb === 'fail') anyFail = true;
      if (ja === 'none' || jb === 'none') anyNone = true;
    });
    if (res.minPoints === null || pts.length < res.minPoints) anyNone = true;
    res.verdict = anyFail ? 'fail' : (anyNone ? 'none' : 'ok');
    return res;
  };

  /* Проектное значение текстом: «20-24», «50±10», «не более 60», «≥18» -> {min, max}; иначе null */
  calc.parseRange = function (text) {
    var s = String(text == null ? '' : text).replace(/\s/g, '').replace(/,/g, '.').toLowerCase(), m;
    var N = '(\\d+(?:\\.\\d+)?)';
    if ((m = new RegExp('^' + N + '(?:±|\\+-|\\+/-)' + N + '$').exec(s))) return { min: +m[1] - +m[2], max: +m[1] + +m[2] };
    if ((m = new RegExp('^(?:от)?' + N + '(?:-|–|—|\\.\\.\\.|…|до)' + N + '$').exec(s)) && +m[1] <= +m[2]) return { min: +m[1], max: +m[2] };
    if ((m = new RegExp('^(?:≤|<=|неболее|до)' + N + '$').exec(s))) return { min: -Infinity, max: +m[1] };
    if ((m = new RegExp('^(?:≥|>=|неменее|от)' + N + '$').exec(s))) return { min: +m[1], max: Infinity };
    return null;
  };

  /* Значение в точке против проектного диапазона: 'ok' | 'fail' | 'none' | 'na' (норма не задана) | 'manual' (норма не распознана) */
  calc.judgeRange = function (value, designText) {
    if (!String(designText == null ? '' : designText).trim()) return 'na';
    var r = calc.parseRange(designText), v = calc.num(value);
    if (!r) return 'manual';
    if (v === null) return 'none';
    return v >= r.min && v <= r.max ? 'ok' : 'fail';
  };

  /* Помещение участвует в измерении температуры и влажности, если задана хотя бы одна проектная норма */
  calc.hasClimate = function (room) {
    var d = room.design || {};
    return !!(String(d.temp || '').trim() || String(d.rh || '').trim());
  };

  calc.tivlRoom = function (room, data) {
    var d = room.design || {}, res = { points: [], verdict: 'ok' }, fail = false, none = false, manual = false;
    ((data && data.points) || []).forEach(function (p) {
      var jt = calc.judgeRange(p.t, d.temp), jr = calc.judgeRange(p.rh, d.rh);
      res.points.push({ t: jt, rh: jr });
      [jt, jr].forEach(function (j) { if (j === 'fail') fail = true; if (j === 'none') none = true; if (j === 'manual') manual = true; });
    });
    if (!res.points.length) none = true;
    res.verdict = fail ? 'fail' : (manual ? 'manual' : (none ? 'none' : 'ok'));
    return res;
  };

  calc.tivlAll = function (rooms, getData) {
    var v = { fail: 0, manual: 0, none: 0, ok: 0 };
    rooms.forEach(function (r) { v[calc.tivlRoom(r, getData(r)).verdict]++; });
    return !rooms.length ? 'none' : v.fail ? 'fail' : v.manual ? 'manual' : v.none ? 'none' : 'ok';
  };

  /* Число, округлённое для вывода */
  calc.fmt = function (n) {
    if (n === null || n === undefined) return '';
    var r = Math.round(n * 10) / 10;
    return String(r).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
  };

  calc.fmtDate = function (iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? m[3] + '.' + m[2] + '.' + m[1] : (iso || '');
  };

  K.calc = calc;
})(window.KCHP = window.KCHP || {});
