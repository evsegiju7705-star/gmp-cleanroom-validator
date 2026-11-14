/* Сквозная нумерация протоколов, схемы точек, справочные приложения, паспорт систем вентиляции. */
(function (K) {
  'use strict';
  var calc = K.calc, store = K.store, B = K.protocolSkch, esc = B.esc;
  function S() { return store.state; }

  /* ---------- сквозная нумерация ---------- */
  /* Порядок испытаний тот же, что в рабочей книге */
  var ORDER = ['flow', 'unif', 'davl', 'integ', 'eff', 'skch', 'tivl', 'lux', 'noise', 'recov'];
  function ownFirst(state, key) {
    var t = key === 'skch' ? state.skch : key === 'tivl' ? state.tivl : (state.t[key] || {});
    return calc.num(t.firstNo);
  }
  function count(state, key) {
    if (key === 'skch') return B.rooms(state).length;
    if (key === 'tivl') return K.protocolTivl.rooms(state).length ? 1 : 0;
    var def = K.tests.byKey[key], n = def.rooms(state).length;
    return def.perRoom ? n : (n ? 1 : 0);
  }
  var N = {};
  /* Номер первого протокола испытания: свой, если задан, иначе по цепочке от общего первого номера */
  N.start = function (state, key) {
    var next = calc.num(state.obj.firstNo);
    for (var i = 0; i < ORDER.length; i++) {
      var own = ownFirst(state, ORDER[i]);
      if (own !== null) next = own;
      if (ORDER[i] === key) return next;
      if (next !== null) next += count(state, ORDER[i]);
    }
    return null;
  };
  N.format = function (state, n) {
    if (n === null || n === undefined) return '';
    var prefix = String(state.obj.registry || '').substr(4, 3);
    return (prefix ? prefix + ' - ' : '') + n;
  };
  /* «587 - 3» или «587 - 3 – 587 - 12» для приложений */
  N.range = function (state, key) {
    var a = N.start(state, key), c = count(state, key);
    if (a === null || !c) return '';
    return N.format(state, a) + (c > 1 ? ' – ' + N.format(state, a + c - 1) : '');
  };
  K.numbering = N;

  /* ---------- схемы расположения точек ---------- */
  var X = {};
  X.schemes = function (key) {
    var all = S().schemes;
    if (!Array.isArray(all[key])) all[key] = [];
    return all[key];
  };
  X.schemesCard = function (key) {
    var list = X.schemes(key);
    var h = '<section class="card"><h2>Схемы расположения точек</h2><p class="note">Планы помещений с нанесёнными точками. ' +
      'Печатаются приложением к протоколу. Картинки уменьшаются при загрузке и хранятся вместе с данными.</p>';
    if (list.length) {
      h += '<ul class="schemes">' + list.map(function (s, i) {
        return '<li><img src="' + s.data + '" alt="Схема: ' + esc(s.name) + '"><span>' + esc(s.name) + '</span>' +
          '<button type="button" class="danger small" data-act="scheme-del" data-i="' + i + '">Удалить</button></li>';
      }).join('') + '</ul>';
    }
    return h + '<label class="file-btn" for="scheme-file">Добавить схему (картинка)</label>' +
      '<input type="file" id="scheme-file" accept="image/*" multiple class="visually-hidden"><p id="scheme-msg" class="note" role="status"></p></section>';
  };
  /* Уменьшает картинку до 1500 точек по большей стороне и отдаёт JPEG */
  X.shrink = function (file, done) {
    var rd = new FileReader();
    rd.onerror = function () { done(null); };
    rd.onload = function () {
      var img = new Image();
      img.onerror = function () { done(null); };
      img.onload = function () {
        var k = Math.min(1, 1500 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        done(c.toDataURL('image/jpeg', 0.75));
      };
      img.src = rd.result;
    };
    rd.readAsDataURL(file);
  };
  var SCHEME_TITLE = {
    skch: 'измерения концентрации аэрозольных частиц', tivl: 'измерения температуры и влажности воздуха', davl: 'измерения перепада давления',
    flow: 'измерения скорости воздуха', unif: 'измерения однородности скорости потока', integ: 'контроля целостности фильтров',
    eff: 'контроля эффективности фильтров', lux: 'измерения освещённости', noise: 'измерения уровня звука', recov: 'измерения времени восстановления'
  };
  function appendixHead(state, key, title) {
    var range = N.range(state, key);
    return '<section class="sheet"><p class="app-head">' + title + '<br>к протоколу(ам) № ' + esc(range) + '</p>';
  }
  function appendixFoot(state, key, title) {
    return '<footer>' + esc(state.obj.index) + ' · ' + title + ' к протоколу(ам) № ' + esc(N.range(state, key)) + '</footer></section>';
  }
  X.schemeSheets = function (key) {
    var state = S();
    return X.schemes(key).map(function (s) {
      return appendixHead(state, key, 'Приложение') +
        '<h2>Расположение контрольных точек ' + SCHEME_TITLE[key] + ' на плане помещений</h2>' +
        '<img class="scheme" src="' + s.data + '" alt="' + esc(s.name) + '">' + appendixFoot(state, key, 'Приложение');
    }).join('');
  };

  /* ---------- справочные приложения ---------- */
  X.appendix = function (key) {
    var state = S(), h;
    if (key === 'skch') {
      h = appendixHead(state, key, 'Приложение №1') + '<h2>Обработка данных по концентрации частиц</h2>' +
        '<h3>1. Определение точек отбора проб</h3><p>Число точек отбора проб N<sub>L</sub> для заданной площади классифицируемого чистого ' +
        'помещения или чистой зоны следует определять по таблице А.1 ГОСТ Р ИСО 14644-1-2017.</p>' +
        '<table class="grid a1"><thead><tr><th>Площадь, меньшая или равная, м²</th><th>N<sub>L</sub></th><th>Площадь, меньшая или равная, м²</th><th>N<sub>L</sub></th>' +
        '<th>Площадь, меньшая или равная, м²</th><th>N<sub>L</sub></th></tr></thead><tbody>';
      for (var i = 0; i < 9; i++) {
        h += '<tr>' + [0, 9, 18].map(function (o) { var r = K.ref.A1[i + o]; return '<td>' + r[0] + '</td><td>' + r[1] + '</td>'; }).join('') + '</tr>';
      }
      h += '</tbody></table><p>Примечание. Если площадь помещения попадает между двумя значениями в таблице, выбирается большее из двух значений. ' +
        'При площади более 1000 м² число точек определяется как 27 · (A / 1000).</p>' +
        '<h3>2. Вычисление средней концентрации частиц в точке отбора проб</h3><p>В каждой i-й точке отбора проб берутся две или более проб. ' +
        'Средняя концентрация частиц в точке i для p проб определяется по уравнению:</p>' +
        '<p class="center"><i>x̄<sub>i</sub> = (x<sub>i,1</sub> + x<sub>i,2</sub> + … + x<sub>i,p</sub>) / p</i></p>' +
        '<h3>3. Оценка результатов</h3><p>Чистое помещение или чистая зона соответствуют заданному классу чистоты воздуха, если средняя ' +
        'концентрация частиц в каждой точке отбора проб не превышает предельно допустимое значение для данного класса.</p>';
      return h + appendixFoot(state, key, 'Приложение №1');
    }
    if (key === 'integ') {
      h = appendixHead(state, key, 'Приложение №1 (справочное)') + '<h2>Порядок расчёта значений для критерия приемлемости</h2>' +
        '<h3>1. Ожидаемое число частиц N<sub>p</sub>, подтверждающих факт наличия потенциальной утечки</h3>' +
        '<p class="center"><i>N<sub>p</sub> = C<sub>c</sub> · P<sub>l</sub> · q · D<sub>p</sub> / S<sub>r</sub></i></p>' +
        '<p>где C<sub>c</sub> — среднее значение счётной концентрации аэрозольных частиц перед фильтром, част/см³; ' +
        'P<sub>l</sub> — максимально допустимый локальный проскок в точке MPPS для данного фильтра по ГОСТ Р ЕН 1822-1-2010; ' +
        'q — скорость отбора пробы счётчиком, см³/с (472 см³/с при расходе 28,3 л/мин); D<sub>p</sub> = 1 см — размер пробоотборника ' +
        'в направлении сканирования; S<sub>r</sub> = 5 см/с — скорость сканирования.</p>' +
        '<p>Приемлемое число частиц при сканировании: <i>N<sub>a</sub> = N<sub>p</sub> − 2 · √N<sub>p</sub></i>.</p>' +
        '<h3>2. Допустимый счёт при стационарном измерении</h3>' +
        '<p class="center"><i>N<sub>pr</sub> = C<sub>c</sub> · P<sub>l</sub> · q · T<sub>r</sub>;&nbsp;&nbsp; C<sub>a</sub> = N<sub>pr</sub> − 2 · √N<sub>pr</sub></i></p>' +
        '<p>где T<sub>r</sub> — время исследования места потенциальной утечки (отбора пробы), с.</p>' +
        '<h3>3. Локальные значения по таблице 3 ГОСТ Р ЕН 1822-1-2010</h3><table class="grid a1"><thead><tr><th>Класс фильтра</th>' +
        '<th>Эффективность, %</th><th>Коэффициент проскока, % (отн. ед.)</th></tr></thead><tbody>' +
        '<tr><td>H13</td><td>99,75</td><td>0,25 (0,0025)</td></tr><tr><td>H14</td><td>99,975</td><td>0,025 (0,00025)</td></tr>' +
        '<tr><td>U15</td><td>99,9975</td><td>0,0025 (0,000025)</td></tr><tr><td>U16</td><td>99,99975</td><td>0,00025 (0,0000025)</td></tr>' +
        '<tr><td>U17</td><td>99,9999</td><td>0,0001 (0,000001)</td></tr></tbody></table>';
      return h + appendixFoot(state, key, 'Приложение №1');
    }
    return '';
  };
  K.extras = X;

  /* ---------- паспорт систем вентиляции ---------- */
  var Pp = {};
  /* Собирает воздухораспределители из испытания расхода воздуха по системам */
  Pp.collect = function (state) {
    var def = K.tests.byKey.flow, sides = { 'in': {}, out: {} };
    def.rooms(state).forEach(function (room) {
      var d = K.engine.roomData(def, room);
      ['in', 'out'].forEach(function (side) {
        d.g[side].forEach(function (r) {
          var v = calc.num(r.v), a = calc.num(r.area);
          if (v === null || a === null) return;
          var sys = String(r.sys || '').trim() || 'без обозначения', q = Math.round(v * a * 3600), qp = calc.num(r.qp);
          (sides[side][sys] = sides[side][sys] || []).push({ name: r.name, room: (room.no ? '№' + room.no + ' ' : '') + room.name, area: a, v: v, q: q, qp: qp,
            dev: qp ? (q - qp) / qp * 100 : null });
        });
      });
    });
    return sides;
  };
  function passTables(state, printable) {
    var sides = Pp.collect(state), h = '', any = false;
    [['in', 'Поступающий воздух'], ['out', 'Удаляемый воздух']].forEach(function (sd) {
      Object.keys(sides[sd[0]]).sort().forEach(function (sys) {
        var rows = sides[sd[0]][sys], total = 0, totalP = 0, hepa = 0;
        any = true;
        h += '<h3>' + sd[1] + ', система ' + esc(sys) + '</h3><div class="scroll"><table class="' + (printable ? 'grid' : 'data') + '"><thead><tr>' +
          '<th>Номер мерного сечения (воздухораспределителя)</th><th>Помещение</th><th>Площадь сечения, м²</th><th>Скорость воздуха, м/с</th>' +
          '<th>Расход фактический, м³/ч</th><th>Расход по проекту, м³/ч</th><th>Отклонение, %</th></tr></thead><tbody>';
        rows.forEach(function (r) {
          total += r.q; if (r.qp) totalP += r.qp;
          if (/^Ф/i.test(String(r.name || '').trim())) hepa++;
          h += '<tr><td>' + esc(r.name) + '</td><td class="left">' + esc(r.room) + '</td><td>' + K.tests.fx(r.area, 2) + '</td><td>' + K.tests.fx(r.v, 2) +
            '</td><td>' + r.q + '</td><td>' + (r.qp === null ? '' : r.qp) + '</td><td>' + (r.dev === null ? '' : K.tests.fx(r.dev, 0)) + '</td></tr>';
        });
        h += '</tbody></table></div><p>Суммарный расход воздуха: фактически ' + total + ' м³/ч' + (totalP ? ', по проекту ' + totalP + ' м³/ч' : '') +
          '. Воздухораспределителей: ' + rows.length + (sd[0] === 'in' ? ', из них с фильтром HEPA (обозначение на «Ф»): ' + hepa : '') + '.</p>';
      });
    });
    return any ? h : '';
  }
  Pp.view = function () {
    var body = passTables(S(), false);
    return '<section class="card"><h2>Паспорт систем вентиляции</h2><p class="note">Сводка по системам собирается из вкладки «Расход воздуха и кратность»: ' +
      'учитываются строки, где указаны скорость и сечение. Проектный расход вводится там же, в столбце «Расход по проекту».</p>' +
      (body ? body + '<div class="row-actions"><button type="button" class="primary" data-act="pass-print">Печать сводки</button></div>'
        : '<p class="empty">Пока нет заполненных воздухораспределителей.</p>') + '</section>';
  };
  Pp.build = function () {
    var s = S();
    return '<section class="sheet">' + B.head(s).replace(/<div class="approve">[\s\S]*$/, '') +
      '<h1>Расходы воздуха по помещениям (по сети)</h1><table class="info">' + B.row('Объект:', s.obj.object) +
      B.row('Местонахождение:', s.obj.location) + B.row('Дата измерений:', (s.t.flow || {}).date || '') + '</table>' +
      passTables(s, true) + '</section>';
  };
  K.passport = Pp;
})(window.KCHP = window.KCHP || {});
