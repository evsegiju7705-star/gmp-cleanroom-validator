/* Описания испытаний и их расчёты. Экран и печатную форму строит js/engine.js. */
(function (K) {
  'use strict';
  var calc = K.calc, num = calc.num, T = {};

  /* ---------- общие функции ---------- */
  function fx(n, d) {
    if (n === null || n === undefined || !isFinite(n)) return '';
    return n.toFixed(d === undefined ? 1 : d).replace('.', ',');
  }
  function round(n, d) { var k = Math.pow(10, d || 0); return Math.round(n * k) / k; }
  function nums(row, keys) {
    var a = [];
    for (var i = 0; i < keys.length; i++) { var n = num(row[keys[i]]); if (n === null) return null; a.push(n); }
    return a;
  }
  function mean(a) { return a.reduce(function (s, x) { return s + x; }, 0) / a.length; }
  function sd(a) {
    if (a.length < 2) return 0;
    var m = mean(a);
    return Math.sqrt(a.reduce(function (s, x) { return s + (x - m) * (x - m); }, 0) / (a.length - 1));
  }
  function has(room, k) { return String((room.design || {})[k] == null ? '' : room.design[k]).trim() !== ''; }
  function dnum(room, k) { return num((room.design || {})[k]); }
  /* Итог по набору оценок: есть несоответствие -> fail; есть незаполненное -> none; иначе ok */
  function overall(list) {
    if (!list.length) return 'none';
    if (list.indexOf('fail') >= 0) return 'fail';
    if (list.indexOf('none') >= 0) return 'none';
    return 'ok';
  }
  T.fx = fx; T.overall = overall; T.sd = sd; T.mean = mean;

  /* Квантиль Стьюдента, двусторонний, 5 %, по числу степеней свободы */
  var T95 = [12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.160, 2.145, 2.131,
    2.120, 2.110, 2.101, 2.093, 2.086, 2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048, 2.045, 2.042];
  T.t95 = function (df) { return df < 1 ? null : (df <= 30 ? T95[df - 1] : 1.96); };

  var FILTER_CLASSES = ['H13', 'H14', 'U15', 'U16', 'U17'];
  /* Локальный проскок Pl, отн. ед. (ГОСТ Р ЕН 1822-1-2010, таблица 3) */
  var PL = { H13: 0.0025, H14: 0.00025, U15: 0.000025, U16: 0.0000025, U17: 0.000001 };
  /* Интегральный коэффициент проскока, % */
  var PINT = { E11: 5, E12: 0.5, H13: 0.05, H14: 0.005, U15: 0.0005, U16: 0.00005, U17: 0.000005 };
  /* Расход счётчика, см3/с */
  function counterFlow(state) { return num(state.skch.flow) < 10 ? 47.2 : 472; }

  var list = [];

  /* ================= Перепад давления ================= */
  list.push({
    key: 'davl', tab: 'Перепад давления',
    title: 'измерения перепада давления между помещением и окружающей средой',
    nd: 'ГОСТ Р ИСО 14644-3-2020 приложение В, п. В.1', instruments: ['dmano', 'thermo', 'baro'],
    extras: [
      { k: 'ambient', label: 'Окружающая среда', def: 'пространство, окружающее КЧП' },
      { k: 'exceed', label: 'Превышение проектного значения допускается технологией', options: ['нет', 'да'], def: 'нет' }
    ],
    criterion: function () {
      return 'Среднее значение перепада давления в помещениях по отношению к окружающей среде не отличается от значения, ' +
        'указанного в проектной документации, более чем на ±2 Па (возможно превышение проектного значения на большую ' +
        'величину по требованиям технологических процессов).';
    },
    rooms: function (s) { return s.rooms.filter(function (r) { return has(r, 'pressure'); }); },
    groups: [{ k: 'm', title: 'Результат измерения', min: 1, fixed: true, judge: true,
      cols: [{ k: 'm1', label: 'Измерение 1, Па' }, { k: 'm2', label: 'Измерение 2, Па' }, { k: 'm3', label: 'Измерение 3, Па' }],
      outs: [{ k: 'cls', label: 'Класс чистоты' }, { k: 'pz', label: 'Заданный Рз, Па' }, { k: 'avg', label: 'Среднее Рср, Па' }, { k: 'dev', label: 'Рср − Рз, Па' }] }],
    calc: function (room, data, state, x) {
      var pz = dnum(room, 'pressure'), a = nums(data.g.m[0], ['m1', 'm2', 'm3']);
      var o = { cls: room.cls || 'НК', pz: pz === null ? String(room.design.pressure) : fx(pz, 1), avg: '', dev: '', j: 'none' };
      if (a) {
        var avg = round(mean(a), 1);
        o.avg = fx(avg, 1);
        if (pz !== null) {
          var dev = round(avg - pz, 1), over = dev * (pz < 0 ? -1 : 1);
          o.dev = fx(dev, 1);
          o.j = Math.abs(dev) <= 2 || (x.exceed === 'да' && over > 2) ? 'ok' : 'fail';
        }
      }
      return { g: { m: [o] }, sum: [], verdict: o.j };
    }
  });

  /* ================= Скорость и расход воздуха, кратность ================= */
  var IN_KINDS = ['Приток', 'Внутр. очистка', 'Переток'], OUT_KINDS = ['Вытяжка', 'Внутр. очистка', 'Переток'];
  function terminalCols(kinds) {
    return [{ k: 'kind', label: 'Вид', options: kinds, def: kinds[0] }, { k: 'sys', label: 'Система', text: true },
      { k: 'dev', label: 'Устройство (тип)', text: true }, { k: 'name', label: 'Обозначение', text: true }, { k: 'v', label: 'Скорость, м/с' }, { k: 'area', label: 'Проходное сечение, м²' },
      { k: 'qp', label: 'Расход по проекту, м³/ч' }];
  }
  var TERM_OUTS = [{ k: 'verr', label: 'Погрешность скорости, м/с' }, { k: 'q', label: 'Объём воздуха, м³/ч' }];
  function flowGroup(rows, kinds) {
    var res = { rows: [], sum: {}, total: 0, complete: true };
    kinds.forEach(function (k) { res.sum[k] = 0; });
    rows.forEach(function (r) {
      var a = nums(r, ['v', 'area']);
      if (!a) { res.rows.push({ verr: '', q: '', j: 'none' }); res.complete = false; return; }
      var e = round(0.03 + 0.05 * a[0], 2), q = Math.round(a[0] * a[1] * 3600);
      res.rows.push({ verr: '± ' + fx(e, 2), q: q + ' ± ' + Math.round(e * a[1] * 3600), j: 'na' });
      res.sum[r.kind] = (res.sum[r.kind] || 0) + q; res.total += q;
    });
    return res;
  }
  T.flowCalc = function (room, data, tolText) {
    var I = flowGroup(data.g['in'], IN_KINDS), O = flowGroup(data.g.out, OUT_KINDS);
    var V = num(room.volume), d = function (k) { var n = dnum(room, k); return n === null ? 0 : n; };
    var tol = num(tolText), achFact = null, achProj = dnum(room, 'ach'), dev = null;
    if (V) {
      achFact = I.sum['Приток'] > O.sum['Вытяжка']
        ? round((I.sum['Приток'] + I.sum['Внутр. очистка'] + I.sum['Переток']) / V, 1)
        : round((O.sum['Вытяжка'] + O.sum['Внутр. очистка'] + O.sum['Переток']) / V, 1);
      if (achProj === null && (d('supply') || d('exhaust'))) {
        achProj = d('supply') > d('exhaust') ? round((d('supply') + d('recirc') + d('flowIn')) / V, 1)
          : round((d('exhaust') + d('recirc') + d('flowOut')) / V, 1);
      }
      if (achProj) dev = round((achFact - achProj) / achProj * 100, 1);
    }
    var js = [], complete = I.complete && O.complete && (data.g['in'].length + data.g.out.length > 0);
    if (!complete || tol === null) js.push('none');
    else {
      var sp = dnum(room, 'supply');
      if (sp) js.push(Math.abs(I.sum['Приток'] - sp) / sp * 100 <= tol ? 'ok' : 'fail');
      if (dev !== null) js.push(Math.abs(dev) <= tol ? 'ok' : 'fail');
    }
    return { I: I, O: O, achFact: achFact, achProj: achProj, dev: dev, complete: complete, verdict: overall(js) };
  };
  list.push({
    key: 'flow', tab: 'Расход воздуха и кратность', perRoom: true,
    title: 'измерения объёмов поступающего и удаляемого воздуха, кратности воздухообмена',
    nd: 'ФР.1.29.2004.01164', instruments: ['anemo', 'thermo', 'baro'],
    extras: [{ k: 'tol', label: 'Допуск от проектных значений, ± %', def: '8' }],
    criterion: function (s, room, x) {
      return 'Объём поступающего воздуха, кратность воздухообмена соответствуют значениям, указанным в проектной документации с допуском ±' + (x.tol || '…') + '%.';
    },
    rooms: function (s) { return s.rooms.filter(function (r) { return has(r, 'supply') || has(r, 'exhaust') || has(r, 'ach') || has(r, 'recirc'); }); },
    facts: function (room) { return [['Объём помещения*, м3', room.volume || '–'], ['Класс чистоты*', room.cls || 'НК']]; },
    groups: [
      { k: 'in', title: 'Поступающий воздух', min: 1, cols: terminalCols(IN_KINDS), outs: TERM_OUTS },
      { k: 'out', title: 'Удаляемый воздух', min: 0, cols: terminalCols(OUT_KINDS), outs: TERM_OUTS }
    ],
    noSpecial: true, noteNo: '3. ',
    protoBody: function (ctx) {
      var it = ctx.rooms[0], esc = ctx.esc, room = it.room, r = T.flowCalc(room, it.data, ctx.x.tol);
      var dash = '–', n = function (v) { return v ? String(v) : dash; };
      var d = function (k) { return has(room, k) ? String(room.design[k]).replace('.', ',') : dash; };
      function tbl(title, dev, flowTitle, sysTitle, rows, res, kinds) {
        var h = '<h3 class="tbl plain">' + title + '</h3><table class="grid flow"><thead><tr>' +
          '<th rowspan="2" style="width:5%">Сис-тема</th><th rowspan="2" style="width:15%">' + dev + '</th><th rowspan="2" style="width:13%">Обозначение</th>' +
          '<th rowspan="2" style="width:15%">Среднее значение скорости воздуха, м/сек**</th><th rowspan="2" style="width:9%">Проход-ное сечение, м2</th>' +
          '<th rowspan="2" style="width:10%">Объём воздуха, проходящего через ' + (kinds === IN_KINDS ? 'ВР' : 'УВ') + ', м3/час</th>' +
          '<th colspan="4">' + flowTitle + '</th></tr><tr><th>' + sysTitle + '</th><th>Внутр. Очистка</th><th>Переток</th><th>Всего</th></tr></thead><tbody>';
        var cnt = Math.max(rows.length, 1);
        for (var i = 0; i < cnt; i++) {
          var w = rows[i] || {}, o = res.rows[i] || {};
          h += '<tr><td>' + esc(w.sys) + '</td><td>' + esc(w.dev) + '</td><td>' + esc(w.name) + '</td>' +
            '<td>' + esc(String(w.v == null ? '' : w.v).trim().replace('.', ',')) + (o.verr ? ' ' + esc(o.verr) : '') + '</td>' +
            '<td>' + esc(String(w.area == null ? '' : w.area).trim().replace('.', ',')) + '</td><td>' + esc(o.q || '') + '</td>';
          if (i === 0) h += kinds.map(function (k) { return '<td class="tot" rowspan="' + cnt + '">' + (rows.length ? n(res.sum[k]) : dash) + '</td>'; }).join('') +
            '<td class="tot" rowspan="' + cnt + '">' + (rows.length ? n(res.total) : dash) + '</td>';
          h += '</tr>';
        }
        return h + '</tbody></table>';
      }
      var h = tbl('1. Поступающий воздух', 'Воздухораспреде-литель (ВР)', 'Поступающий в помещение воздух, м3/час', 'Приточная система', it.data.g['in'], r.I, IN_KINDS) +
        tbl('2. Удаляемый воздух', 'Устройство воздухоудаления (УВ)', 'Удаляемый из помещения воздух, м3/час', 'Вытяжная система', it.data.g.out, r.O, OUT_KINDS);
      var after = '<p class="foot-note">** Измеренная скорость потока воздуха определяется как среднее арифметическое измерений в нескольких точках. ' +
        'Измерительный прибор автоматически определяет среднее значение по серии измерений.<br>' +
        '*** Величина определена с помощью измерительной воронкой.</p>' +
        '<table class="grid sum"><thead><tr><th colspan="6">Объём поступающего воздуха, м3/час</th><th colspan="6">Объём удаляемого воздуха, м3/час</th></tr>' +
        '<tr><th colspan="2">Приток</th><th colspan="2">Внутр. Очистка</th><th colspan="2">Переток</th><th colspan="2">Вытяжка</th><th colspan="2">Внутр. Очистка</th><th colspan="2">Переток</th></tr>' +
        '<tr>' + new Array(7).join('<th>проект</th><th>факт</th>') + '</tr></thead><tbody><tr>' +
        [[d('supply'), r.I.sum['Приток']], [d('recirc'), r.I.sum['Внутр. очистка']], [d('flowIn'), r.I.sum['Переток']],
         [d('exhaust'), r.O.sum['Вытяжка']], [d('recirc'), r.O.sum['Внутр. очистка']], [d('flowOut'), r.O.sum['Переток']]]
          .map(function (p) { return '<td class="v">' + esc(p[0]) + '</td><td class="v">' + n(p[1]) + '</td>'; }).join('') + '</tr></tbody></table>';
      var side = '<table class="grid ach"><thead><tr><th colspan="3">Кратность воздухообмена, ч-1</th></tr>' +
        '<tr><th>проект</th><th>факт</th><th>отклонение, %</th></tr></thead><tbody><tr><td class="v">' + (r.achProj === null ? dash : fx(r.achProj, 1)) +
        '</td><td class="v">' + (r.achFact === null ? dash : fx(r.achFact, 1)) + '</td><td class="v">' + (r.dev === null ? dash : fx(r.dev, 1)) + '</td></tr></tbody></table>';
      return { before: h, after: after, side: side };
    },
    calc: function (room, data, state, x) {
      var r = T.flowCalc(room, data, x.tol), d = function (k) { return has(room, k) ? String(room.design[k]) : '–'; };
      var f = function (n) { return n ? String(n) : '–'; };
      return { g: { 'in': r.I.rows, out: r.O.rows }, verdict: r.verdict, sum: [
        ['Приток, м³/ч: проект / факт', d('supply') + ' / ' + f(r.I.sum['Приток'])],
        ['Внутренняя очистка (поступающий), м³/ч: проект / факт', d('recirc') + ' / ' + f(r.I.sum['Внутр. очистка'])],
        ['Переток (поступающий), м³/ч: проект / факт', d('flowIn') + ' / ' + f(r.I.sum['Переток'])],
        ['Вытяжка, м³/ч: проект / факт', d('exhaust') + ' / ' + f(r.O.sum['Вытяжка'])],
        ['Внутренняя очистка (удаляемый), м³/ч: проект / факт', d('recirc') + ' / ' + f(r.O.sum['Внутр. очистка'])],
        ['Переток (удаляемый), м³/ч: проект / факт', d('flowOut') + ' / ' + f(r.O.sum['Переток'])],
        ['Кратность воздухообмена, ч⁻¹: проект / факт', (r.achProj === null ? '–' : fx(r.achProj, 1)) + ' / ' + (r.achFact === null ? '–' : fx(r.achFact, 1))],
        ['Отклонение кратности, %', r.dev === null ? '–' : fx(r.dev, 1)]
      ] };
    }
  });
  /* Фактическая кратность по испытанию расхода воздуха (для времени восстановления) */
  T.flowAch = function (state, room) {
    var t = state.t && state.t.flow, d = t && t.rooms[room.id];
    if (!d || !d.g || !d.g['in'] || !d.g.out) return null;
    var r = T.flowCalc(room, d, '0');
    return r.complete ? r.achFact : null;
  };

  /* ================= Однородность скорости потока ================= */
  list.push({
    key: 'unif', tab: 'Однородность потока', perRoom: true,
    title: 'измерения однородности скорости воздушного потока',
    nd: 'ГОСТ Р ИСО 14644-3-2020 приложение В, п. В.2', instruments: ['anemo', 'thermo', 'baro'],
    extras: [{ k: 'vmin', label: 'Средняя скорость, не менее, м/с', def: '0,36' }, { k: 'vmax', label: 'Средняя скорость, не более, м/с', def: '0,54' }],
    criterion: function (s, room, x) {
      return '1. Средняя измеренная скорость воздуха соответствует значению (' + x.vmin + ' – ' + x.vmax + ') м/с. ' +
        '2. Относительное отклонение скоростей воздушных потоков в каждой измеряемой точке от среднего значения не превышает ±20 %.';
    },
    rooms: function (s) { return s.rooms.filter(function (r) { return has(r, 'uniform'); }); },
    facts: function (room) { return [['Класс чистоты', room.cls || 'НК']]; },
    groups: [{ k: 'p', title: 'Результаты измерений (плоскость на расстоянии 15 см от поверхности фильтра)', min: 4, judge: true,
      cols: [{ k: 'zone', label: 'Обозначение зоны (секция)', text: true, def: function (room) { return 'Ф ' + room.no + '/1'; } },
        { k: 'v', label: 'Скорость потока воздуха, м/с' }],
      outs: [{ k: 'dev', label: 'Отклонение от среднего, %' }] }],
    calc: function (room, data, state, x) {
      var zones = {}, order = [], rows = data.g.p, out = [], js = [], sum = [];
      var vmin = num(x.vmin), vmax = num(x.vmax);
      rows.forEach(function (r) {
        var z = String(r.zone || '').trim(), v = num(r.v);
        if (!zones[z]) { zones[z] = []; order.push(z); }
        if (v !== null) zones[z].push(v);
      });
      rows.forEach(function (r) {
        var z = String(r.zone || '').trim(), v = num(r.v), m = zones[z].length ? mean(zones[z]) : null;
        if (v === null || !m) { out.push({ dev: '', j: 'none' }); js.push('none'); return; }
        var dv = (v - m) / m * 100, j = Math.abs(dv) <= 20 ? 'ok' : 'fail';
        out.push({ dev: fx(dv, 1), j: j }); js.push(j);
      });
      order.forEach(function (z) {
        var a = zones[z];
        if (!a.length) return;
        var m = mean(a), s = sd(a), dmax = Math.max.apply(null, a.map(function (v) { return Math.abs(v - m) / m * 100; }));
        js.push(vmin === null || vmax === null ? 'none' : (m >= vmin && m <= vmax ? 'ok' : 'fail'));
        sum.push(['Зона ' + (z || 'без обозначения'), 'среднее ' + fx(m, 2) + ' м/с; σ = ' + fx(s, 3) + '; однородность Uv = ' +
          fx(Math.abs(1 - s / m) * 100, 1) + ' %; макс. отклонение Dmax = ' + fx(dmax, 1) + ' %']);
      });
      return { g: { p: out }, sum: sum, verdict: overall(js) };
    }
  });

  /* ================= Целостность фильтров ================= */
  T.integrity = function (cc, cls, flow, tr) {
    var pl = PL[cls];
    if (cc === null || !pl) return null;
    var np = Math.floor(cc * pl * flow * 1 / 5), npr = cc * pl * flow * tr;
    return { np: np, na: Math.floor(np - 2 * Math.sqrt(np)), ca: Math.floor(npr - 2 * Math.sqrt(npr)) };
  };
  var filterName = { k: 'name', label: 'Обозначение фильтра', text: true, def: function (room) { return 'Ф ' + room.no + '/1'; } };
  list.push({
    key: 'integ', tab: 'Целостность фильтров', env5: true,
    title: 'контроля воздушных фильтров на целостность',
    nd: 'ГОСТ Р ИСО 14644-3-2020 п. В.7.3', instruments: ['counter', 'thermo', 'baro', 'multi', 'aerosol', 'dil'],
    extras: [{ k: 'aerosol', label: 'Аэрозоль', def: 'DEHS' }],
    criterion: function () {
      return '1. Количество частиц размером ≥0,3 мкм, регистрируемых в процессе сканирования поверхности фильтра со скоростью Sr = 5 см/с, ' +
        'не превышает расчётного значения для измеренной концентрации частиц перед фильтром. ' +
        '2. В местах обнаруженных потенциальных утечек количество регистрируемых частиц не превышает значения Са за время отбора пробы Тr.';
    },
    rooms: function (s) { return s.rooms.filter(function (r) { return has(r, 'filterClass'); }); },
    groups: [
      { k: 'f', title: '1. Обнаружение мест потенциальной утечки', min: 1,
        cols: [filterName, { k: 'cls', label: 'Класс по ГОСТ Р ЕН 1822-1-2010', options: FILTER_CLASSES,
          def: function (room) { var c = String(room.design.filterClass).trim().toUpperCase(); return FILTER_CLASSES.indexOf(c) >= 0 ? c : 'H14'; } },
          { k: 'cc', label: 'Концентрация частиц перед фильтром Сс, част/см³' }, { k: 'leaks', label: 'Количество обнаруженных потенциальных утечек', def: '0' }],
        outs: [{ k: 'np', label: 'Ожидаемое число частиц Np' }, { k: 'na', label: 'Приемлемое число частиц Nа (пороговое значение)' }] },
      { k: 'l', title: '2. Исследование мест потенциальной утечки', min: 0, judge: true,
        cols: [{ k: 'name', label: 'Обозначение фильтра', text: true }, { k: 'tr', label: 'Время отбора пробы Тr, с', def: '10' },
          { k: 'm1', label: 'Измерение 1' }, { k: 'm2', label: 'Измерение 2' }, { k: 'm3', label: 'Измерение 3' }],
        outs: [{ k: 'ca', label: 'Допустимое число частиц Са (пороговое значение)' }] }
    ],
    calc: function (room, data, state) {
      var flow = counterFlow(state), byName = {}, js = [], F = [], L = [], found = {};
      data.g.l.forEach(function (r) { var n = String(r.name || '').trim(); found[n] = (found[n] || 0) + 1; });
      data.g.f.forEach(function (r) {
        var name = String(r.name || '').trim(), cc = num(r.cc), lk = num(r.leaks), q = T.integrity(cc, r.cls, flow, 10);
        byName[name] = { cc: cc, cls: r.cls };
        if (!q || lk === null || !name) { F.push({ np: '', na: '', j: 'none' }); js.push('none'); return; }
        F.push({ np: String(q.np), na: String(q.na), j: 'na' });
        js.push((found[name] || 0) >= lk ? 'ok' : 'none');
      });
      data.g.l.forEach(function (r) {
        var f = byName[String(r.name || '').trim()], tr = num(r.tr), a = nums(r, ['m1', 'm2', 'm3']);
        var q = f && tr !== null ? T.integrity(f.cc, f.cls, flow, tr) : null;
        if (!q || !a) { L.push({ ca: q ? String(q.ca) : '', j: 'none' }); js.push('none'); return; }
        var j = Math.max.apply(null, a) <= q.ca ? 'ok' : 'fail';
        L.push({ ca: String(q.ca), j: j }); js.push(j);
      });
      return { g: { f: F, l: L }, sum: [], verdict: overall(js) };
    }
  });

  /* ================= Эффективность фильтров (интегральный проскок) ================= */
  var EFF_CLASSES = ['E11', 'E12', 'H13', 'H14', 'U15', 'U16', 'U17'];
  T.efficiency = function (cc, tc, n, flowCm3s) {
    var after = n / (flowCm3s * tc);
    return { after: after, p: after / cc * 100 };
  };
  list.push({
    key: 'eff', tab: 'Эффективность фильтров', env5: true,
    title: 'испытания фильтров на интегральный проскок',
    nd: 'СП 1.3.3118-13, Приложение 9', instruments: ['counter', 'thermo', 'baro', 'multi', 'aerosol', 'dil'],
    extras: [{ k: 'aerosol', label: 'Аэрозоль', def: 'DEHS' }],
    criterion: function () {
      return 'Измеренный интегральный коэффициент проскока по частицам ≥0,3 мкм не превышает значения, приведённого в ГОСТ Р ЕН 1822-1-2010 для данного класса фильтра, более чем в 5 раз.';
    },
    rooms: function (s) { return s.rooms.filter(function (r) { return has(r, 'effClass'); }); },
    groups: [{ k: 'f', title: 'Результаты контроля интегрального проскока', min: 1, judge: true,
      cols: [filterName, { k: 'cls', label: 'Класс фильтра', options: EFF_CLASSES,
        def: function (room) { var c = String(room.design.effClass).trim().toUpperCase(); return EFF_CLASSES.indexOf(c) >= 0 ? c : 'H14'; } },
        { k: 'cc', label: 'Концентрация частиц перед фильтром Сс, част/см³' }, { k: 'tc', label: 'Время сканирования, с' },
        { k: 'n', label: 'Количество обнаруженных частиц после фильтра' }],
      outs: [{ k: 'after', label: 'Концентрация частиц после фильтра, част/см³' }, { k: 'p', label: 'Коэффициент проскока фактический, %' },
        { k: 'lim', label: 'Коэффициент проскока по ГОСТ Р ЕН 1822-1-2010, %' }] }],
    calc: function (room, data, state) {
      /* расход счётчика в см3/с: 28,3 л/мин = 471,7 */
      var flow = num(state.skch.flow) * 1000 / 60, out = [], js = [];
      data.g.f.forEach(function (r) {
        var a = nums(r, ['cc', 'tc', 'n']), lim = PINT[r.cls];
        if (!a || !a[0] || !a[1] || !lim) { out.push({ after: '', p: '', lim: lim ? String(lim).replace('.', ',') : '', j: 'none' }); js.push('none'); return; }
        var q = T.efficiency(a[0], a[1], a[2], flow), j = q.p <= 5 * lim ? 'ok' : 'fail';
        out.push({ after: q.after.toPrecision(3).replace('.', ','), p: q.p.toPrecision(3).replace('.', ','), lim: String(lim).replace('.', ','), j: j });
        js.push(j);
      });
      return { g: { f: out }, sum: [], verdict: overall(js) };
    }
  });

  /* ================= Освещённость ================= */
  T.luxRoom = function (rows, voltage, errPct) {
    var k = voltage !== null && (voltage > 242 || voltage < 218) ? 230 / voltage : 1;
    var means = [], us = [], complete = rows.length > 0;
    rows.forEach(function (r) {
      var a = nums(r, ['r1', 'r2', 'r3']);
      if (!a) { complete = false; means.push(null); return; }
      var s = sd(a.map(function (v) { return v * k; })) || 0.001;
      means.push(mean(a)); us.push(s / Math.sqrt(3));
    });
    if (!complete) return { means: means, complete: false };
    var n = means.length, avg = mean(means), t = T.t95(n - 1), err = null;
    if (t !== null) {
      var geo = Math.exp(mean(us.map(Math.log)));
      err = t * Math.sqrt(Math.pow(avg * errPct / 100, 2) + Math.pow(geo / Math.sqrt(n - 1), 2));
    }
    return { means: means, complete: true, avg: Math.round(avg), err: err };
  };
  list.push({
    key: 'lux', tab: 'Освещённость',
    title: 'измерения уровня средней искусственной освещённости в помещениях',
    nd: 'ФР.1.37.2018.31306', instruments: ['lux', 'thermo', 'baro', 'tape', 'multi'],
    extras: [{ k: 'time', label: 'Время измерений', def: '' }, { k: 'u1', label: 'Напряжение сети в начале измерений, В', def: '' },
      { k: 'u2', label: 'Напряжение сети в конце измерений, В', def: '' },
      { k: 'lamps', label: 'Состояние осветительных установок', def: 'исправные' },
      { k: 'err', label: 'Погрешность люксметра, %', def: '8' }],
    criterion: function () { return 'Фактическое значение средней искусственной освещённости не ниже проектных значений.'; },
    rooms: function (s) { return s.rooms.filter(function (r) { return has(r, 'lux'); }); },
    groups: [{ k: 'p', title: 'Показания по точкам', min: 4,
      cols: [{ k: 'r1', label: 'Отсчёт 1, лк' }, { k: 'r2', label: 'Отсчёт 2, лк' }, { k: 'r3', label: 'Отсчёт 3, лк' }],
      outs: [{ k: 'avg', label: 'Среднее в точке, лк' }] }],
    calc: function (room, data, state, x) {
      var e = num(x.err), q = T.luxRoom(data.g.p, num(x.u1), e === null ? 8 : e), des = dnum(room, 'lux');
      var j = !q.complete || des === null ? 'none' : (q.avg >= des ? 'ok' : 'fail');
      return { g: { p: q.means.map(function (m) { return { avg: m === null ? '' : String(Math.round(m)), j: 'na' }; }) }, verdict: j,
        lux: q, sum: [['Освещённость проектная, лк', has(room, 'lux') ? String(room.design.lux) : '–'],
          ['Освещённость фактическая средняя, лк', q.complete ? String(q.avg) : ''],
          ['Погрешность, лк', q.complete && q.err !== null ? '± ' + Math.round(q.err) : '']] };
    },
    /* В протоколе — одна строка на помещение, как в рабочей книге */
    protoBody: function (ctx) {
      var h = '<h3>1. Результаты измерений</h3><table class="grid"><thead><tr><th colspan="2">Помещение</th><th rowspan="2">Индекс</th>' +
        '<th colspan="2">Освещённость, лк</th><th rowspan="2">Погрешность, лк</th></tr><tr><th>номер</th><th>наименование</th>' +
        '<th>проектная</th><th>фактическая средняя</th></tr></thead><tbody>';
      ctx.rooms.forEach(function (it) {
        var q = it.res.lux, d = it.room.design;
        h += '<tr><td>' + ctx.esc(it.room.no) + '</td><td class="left">' + ctx.esc(it.room.name) + '</td><td>' + ctx.esc(d.lightIndex || '') +
          '</td><td>' + ctx.esc(d.lux) + '</td><td>' + (q.complete ? q.avg : '') + '</td><td>' +
          (q.complete && q.err !== null ? '± ' + Math.round(q.err) : '') + '</td></tr>';
      });
      return h + '</tbody></table>';
    }
  });

  /* ================= Уровень звука ================= */
  T.noisePoint = function (a) {
    var lp = round(10 * Math.log(mean(a.map(function (l) { return Math.pow(10, 0.1 * l); }))) / Math.LN10, 1);
    return { lp: lp, est: round(lp + 1.7, 1) };
  };
  list.push({
    key: 'noise', tab: 'Уровень звука',
    title: 'измерения уровня звука в помещениях',
    nd: 'ГОСТ ISO 9612-2016', instruments: ['noise', 'calib', 'thermo', 'baro', 'tape'],
    extras: [
      { k: 'goal', label: 'Цель проведения измерений', def: 'оценка шума в районе рабочих мест от систем вентиляции' },
      { k: 'strategy', label: 'Стратегия проведения измерений', def: 'на основе рабочей операции' },
      { k: 'cal1', label: 'Калибровка до, дБА', def: '' }, { k: 'cal2', label: 'Калибровка после, дБА', def: '' },
      { k: 'source', label: 'Описание источника шума', def: 'система приточно-вытяжной вентиляции, шум равномерно распределённый' },
      { k: 'char', label: 'Характер шума', def: 'постоянный' },
      { k: 'odd', label: 'Нетипичные источники шума и влияющие события', def: 'нет' },
      { k: 'axis', label: 'Направление измерительной оси микрофона', def: 'вертикальное' },
      { k: 'dur', label: 'Длительность одного измерения, мин', def: '5' },
      { k: 'staff', label: 'Наличие работников во время измерений', def: 'отсутствуют' }
    ],
    criterion: function () {
      return 'Эквивалентный уровень звука не должен превышать допустимый в соответствии с СН 2.2.4/2.1.8.562-96 для данного вида трудовой деятельности.';
    },
    rooms: function (s) { return s.rooms.filter(function (r) { return has(r, 'noise'); }); },
    groups: [{ k: 'p', title: 'Результаты измерений', min: 1, judge: true,
      cols: [{ k: 'l1', label: 'Lp,A,eqT,1, дБА' }, { k: 'l2', label: 'Lp,A,eqT,2, дБА' }, { k: 'l3', label: 'Lp,A,eqT,3, дБА' }],
      outs: [{ k: 'lp', label: 'Уровень звука в точке, дБА' }, { k: 'est', label: 'Оценка эквивалентного уровня звука, дБА' },
        { k: 'max', label: 'Максимально допустимый уровень звука, дБА' }] }],
    footnote: 'Уровень звука в точке — энергетическое среднее трёх измерений. Оценка эквивалентного уровня звука равна уровню в точке плюс 1,7 дБА: ' +
      '0,7 дБА — отклонение, обусловленное средством измерений 1-го класса точности, 1 дБА — отклонение, связанное с местом установки микрофона.',
    calc: function (room, data) {
      var max = dnum(room, 'noise'), out = [], js = [];
      data.g.p.forEach(function (r) {
        var a = nums(r, ['l1', 'l2', 'l3']), o = { lp: '', est: '', max: has(room, 'noise') ? String(room.design.noise) : '', j: 'none' };
        if (a) {
          var q = T.noisePoint(a);
          o.lp = fx(q.lp, 1); o.est = fx(q.est, 1);
          if (max !== null) o.j = q.est <= max ? 'ok' : 'fail';
        }
        out.push(o); js.push(o.j);
      });
      return { g: { p: out }, sum: [], verdict: overall(js) };
    }
  });

  /* ================= Время восстановления ================= */
  T.recovery = function (values, interval) {
    /* values — ряд концентраций с шагом interval, первая — исходная */
    var c0 = values.length ? values[0] : null;
    for (var i = 1; i < values.length; i++) if (values[i] > 0 ? c0 / values[i] > 100 : c0 > 0) return { c0: c0, time: i * interval };
    return { c0: c0, time: null };
  };
  list.push({
    key: 'recov', tab: 'Время восстановления', perRoom: true, env5: true,
    title: 'измерения времени восстановления чистого помещения',
    nd: 'ГОСТ Р ИСО 14644-3-2020 п. В.4', instruments: ['counter', 'thermo', 'baro', 'multi', 'tape', 'aerosol'],
    extras: [{ k: 'step', label: 'Интервал между отсчётами, мин', def: '1' }, { k: 'aerosol', label: 'Аэрозоль', def: 'DEHS' }],
    criterion: function () {
      return 'Время снижения счётной концентрации аэрозольных частиц в чистом помещении в 100 раз от исходного уровня не превышает расчётного значения более чем на 20 %.';
    },
    rooms: function (s) { return s.rooms.filter(function (r) { return has(r, 'recovery'); }); },
    roomFields: [{ k: 'ach', label: 'Фактическая кратность воздухообмена, ч⁻¹', hint: 'Если пусто, берётся из испытания расхода воздуха' }],
    facts: function (room) { return [['Объём помещения, м³', room.volume || '–'], ['Класс чистоты', room.cls || 'НК'], ['Размер регистрируемых частиц, мкм', '≥ 0,5']]; },
    groups: [{ k: 'c', title: 'Результаты измерений', min: 10,
      cols: [{ k: 'c', label: 'Измеренная концентрация частиц ≥0,5 мкм, в м³' }],
      outs: [{ k: 't', label: 't, мин' }] }],
    calc: function (room, data, state, x) {
      var step = num(x.step), vals = [], rows = data.g.c, i;
      for (i = 0; i < rows.length; i++) { var v = num(rows[i].c); if (v === null) break; vals.push(v); }
      var ach = num(data.f.ach);
      if (ach === null) ach = T.flowAch(state, room);
      var tCalc = ach ? Math.ceil(400 / ach) : null, q = step ? T.recovery(vals, step) : { c0: null, time: null }, j = 'none';
      if (tCalc !== null && step) {
        if (q.time !== null) j = q.time <= 1.2 * tCalc ? 'ok' : 'fail';
        else if (vals.length === rows.length && vals.length > 1 && (vals.length - 1) * step > 1.2 * tCalc) j = 'fail';
      }
      return { g: { c: rows.map(function (r, n) { return { t: step ? fx(n * step, step % 1 ? 1 : 0) : '', j: 'na' }; }) }, verdict: j, sum: [
        ['Кратность воздухообмена, ч⁻¹', ach ? fx(ach, 1) : '–'],
        ['Расчётное время, мин', tCalc === null ? '–' : String(tCalc)],
        ['Исходный уровень чистоты, частиц/м³', q.c0 === null ? '' : calc.fmt(q.c0)],
        ['Целевой уровень чистоты, частиц/м³', q.c0 === null ? '' : calc.fmt(q.c0 / 100)],
        ['Время восстановления, мин', q.time === null ? (vals.length > 1 ? 'не достигнуто за время измерений' : '') : fx(q.time, step % 1 ? 1 : 0)]
      ] };
    }
  });

  T.list = list;
  T.byKey = {};
  list.forEach(function (d) { T.byKey[d.key] = d; });
  K.tests = T;
})(window.KCHP = window.KCHP || {});
