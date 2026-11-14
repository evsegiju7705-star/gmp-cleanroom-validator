/* ==========================================================================
   protocol.js — печатная форма протокола квалификации (шаг 4)
   Кнопка «Сформировать протокол» строит документ в контейнере #protocol
   и переключает страницу в режим просмотра (класс is-protocol на <body>).
   Печать / сохранение в PDF — штатным диалогом браузера (window.print).
   Все значения берутся из CRQ.calc.summary(), т. е. совпадают с экраном.
   ========================================================================== */
(function (root) {
  'use strict';
  var CRQ = root.CRQ = root.CRQ || {};
  var calc = CRQ.calc;
  var gmp = CRQ.gmp;

  var savedTitle = '';
  var savedScroll = 0;

  /* ---------- вспомогательные функции ---------- */

  function esc(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /** Текст или прочерк, если пусто */
  function text(value) {
    var s = (value === null || value === undefined) ? '' : String(value).trim();
    return s === '' ? '—' : esc(s);
  }

  /** Измеренное значение: до 2 знаков после запятой, без лишних нулей */
  function val(value) {
    if (!calc.isNum(value)) { return '—'; }
    return value.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
  }

  function fixed(value, digits) {
    return calc.formatNumber(value, digits);
  }

  function formatDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? m[3] + '.' + m[2] + '.' + m[1] : '';
  }

  function status(code) {
    var cls = (code === 'ok' || code === 'fail') ? code : 'other';
    return '<span class="p-status p-status--' + cls + '">' + esc(calc.STATUS_LABELS[code] || calc.STATUS_LABELS.none) + '</span>';
  }

  function critMin(min, unit) {
    return calc.isNum(min) ? 'не менее ' + val(min) + (unit ? ' ' + unit : '') : 'не задан';
  }

  function critRange(min, max, unit) {
    var u = unit ? ' ' + unit : '';
    if (calc.isNum(min) && calc.isNum(max)) { return 'от ' + val(min) + ' до ' + val(max) + u; }
    if (calc.isNum(min)) { return 'не менее ' + val(min) + u; }
    if (calc.isNum(max)) { return 'не более ' + val(max) + u; }
    return 'не задан';
  }

  function critMax(limit, unit) {
    return calc.isNum(limit) ? 'не более ' + fixed(limit, 0) + (unit ? ' ' + unit : '') : 'не нормируется';
  }

  function row(cells) {
    return '<tr>' + cells.join('') + '</tr>';
  }
  function th(content, attrs) { return '<th' + (attrs ? ' ' + attrs : '') + '>' + content + '</th>'; }
  function td(content, attrs) { return '<td' + (attrs ? ' ' + attrs : '') + '>' + content + '</td>'; }
  function num(content, attrs) { return '<td class="p-num"' + (attrs ? ' ' + attrs : '') + '>' + content + '</td>'; }

  /* ---------- разделы протокола ---------- */

  function sectionHeader(s) {
    var date = formatDate(s.meta.date);
    return '' +
      '<header class="p-head">' +
        '<p class="p-org">Организация: <span class="p-line p-line--long"></span></p>' +
        '<h1>ПРОТОКОЛ № <span class="p-line p-line--short"></span></h1>' +
        '<p class="p-subtitle">квалификации чистого помещения</p>' +
        '<p class="p-date">Дата проведения испытаний: ' +
          (date ? '<strong>' + esc(date) + '</strong>' : '<span class="p-line"></span>') + '</p>' +
      '</header>';
  }

  function sectionGeneral(s, sum) {
    var std = gmp.getStandard(s.meta.standard);
    var iso = gmp.getIsoEquivalent(s.meta.standard, s.room.grade, s.room.state);
    return '' +
      '<section class="p-section">' +
        '<h2>1. Общие сведения</h2>' +
        '<table class="p-table p-table--kv"><tbody>' +
          row([th('Наименование помещения', 'scope="row"'), td(text(s.room.name))]) +
          row([th('Код (номер) помещения', 'scope="row"'), td(text(s.room.code))]) +
          row([th('Нормативная база', 'scope="row"'), td(esc(std.label) + '; ГОСТ Р ИСО 14644-1-2017')]) +
          row([th('Класс чистоты', 'scope="row"'), td('<strong>' + esc(s.room.grade) + '</strong>')]) +
          row([th('Состояние помещения', 'scope="row"'), td(esc(gmp.STATES[s.room.state].label))]) +
          row([th('Эквивалентный класс по ИСО 14644-1', 'scope="row"'), td(iso ? esc(iso) : 'не установлен')]) +
          row([th('Площадь, м²', 'scope="row"'), td(val(s.room.area))]) +
          row([th('Высота, м', 'scope="row"'), td(val(s.room.height))]) +
          row([th('Объём, м³', 'scope="row"'), td(sum.volume === null ? '—' : fixed(sum.volume, 2))]) +
          row([th('Исполнитель', 'scope="row"'), td(text(s.meta.performer))]) +
        '</tbody></table>' +
      '</section>';
  }

  function sectionInstruments() {
    var names = ['Балометр / анемометр', 'Дифференциальный манометр', 'Термогигрометр', 'Счётчик аэрозольных частиц'];
    return '' +
      '<section class="p-section">' +
        '<h2>2. Средства измерений</h2>' +
        '<table class="p-table p-table--blank">' +
          '<thead>' + row([th('Наименование', 'scope="col"'), th('Тип, модель', 'scope="col"'),
            th('Заводской №', 'scope="col"'), th('Свидетельство о поверке (калибровке), действительно до', 'scope="col"')]) + '</thead>' +
          '<tbody>' + names.map(function (n) { return row([td(esc(n)), td(''), td(''), td('')]); }).join('') + '</tbody>' +
        '</table>' +
      '</section>';
  }

  function sectionAirflow(s, sum) {
    var air = sum.airflow;
    var rows = s.airflow.points.map(function (p, i) {
      return row([num(String(i + 1)), td(text(p.label)), num(val(p.flow))]);
    }).join('');
    if (!rows) { rows = row([td('Точки замера не введены.', 'colspan="3" class="p-empty"')]); }

    var formula;
    if (air.ach !== null) {
      formula = 'Кратность воздухообмена: N = L<sub>сум</sub> ÷ V = ' + fixed(air.total, 1) + ' ÷ ' +
        fixed(sum.volume, 2) + ' = <strong>' + fixed(air.ach, calc.ACH_DIGITS) + ' ч⁻¹</strong>.';
    } else if (air.count > 0 && !air.complete) {
      formula = 'Кратность воздухообмена не рассчитана: расход введён не для всех точек (' + air.filled + ' из ' + air.count + ').';
    } else if (air.complete && sum.volume === null) {
      formula = 'Кратность воздухообмена не рассчитана: не указаны площадь и высота помещения.';
    } else {
      formula = 'Кратность воздухообмена не рассчитана: нет данных.';
    }

    return '' +
      '<section class="p-section">' +
        '<h2>3. Результаты измерений</h2>' +
        '<h3>3.1. Расход приточного воздуха и кратность воздухообмена</h3>' +
        '<table class="p-table">' +
          '<thead>' + row([th('№', 'scope="col" class="p-col-n"'), th('Точка замера (диффузор)', 'scope="col"'),
            th('Расход, м³/ч', 'scope="col" class="p-num"')]) + '</thead>' +
          '<tbody>' + rows + '</tbody>' +
          '<tfoot>' + row([th('Суммарный расход L<sub>сум</sub>, м³/ч', 'scope="row" colspan="2"'),
            num(air.total === null ? '—' : fixed(air.total, 1))]) + '</tfoot>' +
        '</table>' +
        '<p class="p-formula">' + formula + '</p>' +
      '</section>';
  }

  function sectionEnv(s, sum) {
    var env = sum.env;
    return '' +
      '<section class="p-section">' +
        '<h3>3.2. Перепад давления и микроклимат</h3>' +
        '<table class="p-table">' +
          '<thead>' + row([th('Показатель', 'scope="col"'), th('Измерено', 'scope="col" class="p-num"'),
            th('Критерий приемлемости', 'scope="col"'), th('Заключение', 'scope="col"')]) + '</thead>' +
          '<tbody>' +
            row([th('Перепад давления ΔP, Па', 'scope="row"'), num(val(env.dp.value)), td(critMin(env.dp.min)), td(status(env.dp.status))]) +
            row([th('Температура, °C', 'scope="row"'), num(val(env.temp.value)), td(critRange(env.temp.min, env.temp.max)), td(status(env.temp.status))]) +
            row([th('Относительная влажность, %', 'scope="row"'), num(val(env.rh.value)), td(critRange(env.rh.min, env.rh.max)), td(status(env.rh.status))]) +
          '</tbody>' +
        '</table>' +
      '</section>';
  }

  function sectionParticles(s, sum) {
    var part = sum.particles;
    var rows = s.particles.points.map(function (p, i) {
      return row([num(String(i + 1)), td(text(p.label)), num(calc.isNum(p.p05) ? fixed(p.p05, 0) : '—'),
        num(calc.isNum(p.p50) ? fixed(p.p50, 0) : '—'), td(status(part.rows[i].status))]);
    }).join('');
    if (!rows) { rows = row([td('Точки отбора проб не введены.', 'colspan="5" class="p-empty"')]); }

    function foot(label, a, b, last) {
      return row([th(label, 'scope="row" colspan="2"'), num(a), num(b), td(last || '')]);
    }
    function stat(ch, key) { return ch[key] === null ? '—' : fixed(ch[key], 0); }

    var locations = 'Число точек отбора проб: ' + part.count + '; минимально необходимое по ГОСТ Р ИСО 14644-1-2017 (таблица A.1) — ' +
      (part.minLocations === null ? 'не определено (не указана площадь)' : part.minLocations) + '.';

    return '' +
      '<section class="p-section">' +
        '<h3>3.3. Счётная концентрация аэрозольных частиц, шт./м³</h3>' +
        '<table class="p-table">' +
          '<thead>' + row([th('№', 'scope="col" class="p-col-n"'), th('Точка отбора проб', 'scope="col"'),
            th('≥ 0,5 мкм', 'scope="col" class="p-num"'), th('≥ 5,0 мкм', 'scope="col" class="p-num"'),
            th('Заключение по точке', 'scope="col"')]) + '</thead>' +
          '<tbody>' + rows + '</tbody>' +
          '<tfoot>' +
            foot('Среднее по помещению (справочно)', stat(part.p05, 'avg'), stat(part.p50, 'avg')) +
            foot('Максимум по точкам', stat(part.p05, 'max'), stat(part.p50, 'max')) +
            foot('Предел для класса ' + esc(s.room.grade) + ', ' + esc(gmp.STATES[s.room.state].short) + ' состояние',
              part.p05.limit === null ? 'не норм.' : fixed(part.p05.limit, 0),
              part.p50.limit === null ? 'не норм.' : fixed(part.p50.limit, 0)) +
          '</tfoot>' +
        '</table>' +
        '<p class="p-formula">' + locations + ' Соответствие оценивается по каждой точке отбора проб.</p>' +
      '</section>';
  }

  function sectionSummary(s, sum) {
    var air = sum.airflow, env = sum.env, part = sum.particles;
    function partFact(ch) { return ch.max === null ? '—' : 'макс. ' + fixed(ch.max, 0); }
    var lines = [
      ['Кратность воздухообмена, ч⁻¹', air.ach === null ? '—' : fixed(air.ach, calc.ACH_DIGITS), critMin(air.achMin), air.status],
      ['Перепад давления, Па', val(env.dp.value), critMin(env.dp.min), env.dp.status],
      ['Температура, °C', val(env.temp.value), critRange(env.temp.min, env.temp.max), env.temp.status],
      ['Относительная влажность, %', val(env.rh.value), critRange(env.rh.min, env.rh.max), env.rh.status],
      ['Частицы ≥ 0,5 мкм, шт./м³', partFact(part.p05), critMax(part.p05.limit) + (part.p05.limit === null ? '' : ' в каждой точке'), part.p05.status],
      ['Частицы ≥ 5,0 мкм, шт./м³', partFact(part.p50), critMax(part.p50.limit) + (part.p50.limit === null ? '' : ' в каждой точке'), part.p50.status]
    ];
    return '' +
      '<section class="p-section">' +
        '<h2>4. Сводная оценка соответствия</h2>' +
        '<table class="p-table">' +
          '<thead>' + row([th('Показатель', 'scope="col"'), th('Фактически', 'scope="col" class="p-num"'),
            th('Критерий приемлемости', 'scope="col"'), th('Заключение', 'scope="col"')]) + '</thead>' +
          '<tbody>' + lines.map(function (l) {
            return row([th(l[0], 'scope="row"'), num(l[1]), td(l[2]), td(status(l[3]))]);
          }).join('') + '</tbody>' +
        '</table>' +
        '<p class="p-formula">Критерии кратности воздухообмена, температуры и влажности приняты по проектной документации / требованиям пользователя.</p>' +
      '</section>';
  }

  function labels(items, codes) {
    return items.filter(function (i) { return codes.indexOf(i.status) !== -1; })
      .map(function (i) { return i.label; }).join('; ');
  }

  function sectionConclusion(s, sum) {
    var std = gmp.getStandard(s.meta.standard);
    var room = 'Помещение ' + (s.room.name.trim() ? '«' + esc(s.room.name.trim()) + '»' : '') +
      (s.room.code.trim() ? ' (код ' + esc(s.room.code.trim()) + ')' : '');
    var target = 'требованиям к классу чистоты ' + esc(s.room.grade) + ' в состоянии «' +
      esc(gmp.STATES[s.room.state].short) + '» (' + esc(std.shortLabel) + ')';
    var verdict;
    if (sum.overall === 'ok') {
      verdict = room + ' по проверенным показателям <strong>СООТВЕТСТВУЕТ</strong> ' + target + '.';
    } else if (sum.overall === 'fail') {
      verdict = room + ' <strong>НЕ СООТВЕТСТВУЕТ</strong> ' + target + '. Несоответствия: ' + esc(labels(sum.items, ['fail'])) + '.';
    } else {
      verdict = 'Заключение о соответствии помещения ' + target + ' <strong>не может быть сделано</strong>: введены не все данные.';
    }

    var extra = [];
    var missing = labels(sum.items, ['none']);
    var skipped = labels(sum.items, ['na', 'nocrit']);
    if (missing) { extra.push('Не представлены данные: ' + esc(missing) + '.'); }
    if (skipped) { extra.push('Не оценивались (не нормируется или критерий не задан): ' + esc(skipped) + '.'); }
    sum.remarks.forEach(function (r) { extra.push('Замечание: ' + esc(r)); });

    return '' +
      '<section class="p-section p-conclusion">' +
        '<h2>5. Заключение</h2>' +
        '<p class="p-verdict">' + verdict + '</p>' +
        extra.map(function (e) { return '<p>' + e + '</p>'; }).join('') +
      '</section>';
  }

  function sectionSignatures(s) {
    function sign(role, name) {
      return '<tr><th scope="row">' + role + '</th>' +
        '<td><span class="p-sign"></span><small>должность</small></td>' +
        '<td><span class="p-sign"></span><small>подпись</small></td>' +
        '<td><span class="p-sign">' + (name ? esc(name) : '') + '</span><small>Ф. И. О.</small></td>' +
        '<td><span class="p-sign"></span><small>дата</small></td></tr>';
    }
    return '' +
      '<section class="p-section p-signatures">' +
        '<table class="p-sign-table"><tbody>' +
          sign('Испытания провёл', s.meta.performer.trim()) +
          sign('Проверил', '') +
          sign('Утвердил', '') +
        '</tbody></table>' +
      '</section>';
  }

  /** HTML протокола по текущему состоянию */
  function build() {
    var s = CRQ.state;
    var sum = calc.summary(s);
    var warning = '';
    if (sum.overall === 'none') {
      warning = '<p class="p-warning no-print" role="status">Введены не все данные — в протоколе останутся отметки «НЕТ ДАННЫХ».</p>';
    }
    return warning +
      '<article class="p-sheet">' +
        sectionHeader(s) +
        sectionGeneral(s, sum) +
        sectionInstruments() +
        sectionAirflow(s, sum) +
        sectionEnv(s, sum) +
        sectionParticles(s, sum) +
        sectionSummary(s, sum) +
        sectionConclusion(s, sum) +
        sectionSignatures(s) +
      '</article>';
  }

  /* ---------- переключение режимов ---------- */

  function fileTitle() {
    var s = CRQ.state;
    var code = (s.room.code || s.room.name || '').trim().replace(/[^0-9A-Za-zА-Яа-яЁё_-]+/g, '_');
    return 'Протокол' + (code ? '_' + code : '') + (s.meta.date ? '_' + s.meta.date : '');
  }

  function open() {
    var box = document.getElementById('protocol');
    box.innerHTML =
      '<div class="p-toolbar no-print">' +
        '<button type="button" class="btn" id="btn-protocol-back">← Вернуться к вводу данных</button>' +
        '<button type="button" class="btn btn--primary" id="btn-protocol-print">Печать / сохранить в PDF</button>' +
      '</div>' + build();

    savedTitle = document.title;
    savedScroll = root.pageYOffset || 0;
    document.title = fileTitle();          // браузер предложит это имя для PDF
    document.body.classList.add('is-protocol');
    box.hidden = false;
    root.scrollTo(0, 0);

    document.getElementById('btn-protocol-back').addEventListener('click', close);
    var printButton = document.getElementById('btn-protocol-print');
    printButton.addEventListener('click', function () { root.print(); });
    printButton.focus();
  }

  function close() {
    var box = document.getElementById('protocol');
    if (box.hidden) { return; }
    box.hidden = true;
    box.textContent = '';
    document.body.classList.remove('is-protocol');
    document.title = savedTitle;
    root.scrollTo(0, savedScroll);
    var button = document.getElementById('btn-protocol');
    if (button) { button.focus(); }
  }

  function init() {
    document.getElementById('btn-protocol').addEventListener('click', open);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { close(); }
    });
  }

  CRQ.protocol = { init: init, open: open, close: close, build: build };
})(typeof window !== 'undefined' ? window : globalThis);
