/* Печатная форма протокола измерения температуры и относительной влажности (один на комплекс). */
(function (K) {
  'use strict';
  var calc = K.calc, B = K.protocolSkch, esc = B.esc, P = {};

  P.instruments = ['thermo', 'baro', 'tape'];

  P.rooms = function (state) { return state.rooms.filter(calc.hasClimate); };

  P.number = function (state) {
    var n = String(state.tivl.firstNo || '').trim();
    if (!n) return '';
    var prefix = String(state.obj.registry || '').substr(4, 3);
    return (prefix ? prefix + ' - ' : '') + n;
  };

  P.verdict = function (state) {
    return calc.tivlAll(P.rooms(state), K.store.tivlData);
  };

  function val(v) { var n = calc.num(v); return n === null ? esc(v) : esc(String(n).replace('.', ',')); }

  P.build = function (state) {
    var o = state.obj, t = state.tivl, no = P.number(state), rooms = P.rooms(state);
    var h = '<section class="sheet">' + B.head(state);
    h += '<h1>ПРОТОКОЛ № ' + esc(no) + ' от ' + esc(calc.fmtDate(o.protoDate)) + '</h1>' +
      '<h2>измерения температуры и относительной влажности</h2>';
    h += '<table class="info">' + B.row('Объект:', o.object) + B.row('Местонахождение:', o.location) +
      B.row('Заказчик:', o.customer) + B.row('ИНН Заказчика:', o.inn) + '</table>';
    h += B.tools(state, P.instruments);
    h += '<table class="info">' + B.row('Дата измерений:', t.date) +
      B.row('Режим работы систем вентиляции:', o.ventMode) +
      B.row('Нормативная документация на проведение измерений:', 'ГОСТ Р ИСО 14644-3-2020 п. В.5, В.6') + '</table>';
    h += '<p><b>КРИТЕРИЙ ПРИЕМЛЕМОСТИ:</b> Средние измеренные значения температуры и относительной влажности ' +
      'в помещениях соответствуют нормам, указанным в проектной документации.</p>';
    h += '<h3 class="center">Условия окружающей среды</h3><table class="grid"><thead><tr>' +
      '<th>Температура воздуха, °С</th><th>Относительная влажность воздуха, %</th><th>Абсолютное давление, гПа</th>' +
      '</tr></thead><tbody><tr><td>' + esc(t.env.t) + '&nbsp;</td><td>' + esc(t.env.rh) + '&nbsp;</td><td>' + esc(t.env.p) +
      '&nbsp;</td></tr></tbody></table><p>Проведение испытаний при данных внешних условиях ДОПУСКАЕТСЯ</p>';

    h += '<h3>1. РЕЗУЛЬТАТЫ ИЗМЕРЕНИЙ</h3><table class="grid"><thead>' +
      '<tr><th colspan="2">Помещение</th><th rowspan="2">Номер точки</th><th colspan="2">Температура, °С</th>' +
      '<th colspan="2">Относительная влажность, %</th></tr>' +
      '<tr><th>номер</th><th>наименование</th><th>проектная</th><th>измеренная средняя</th>' +
      '<th>проектная</th><th>измеренная средняя</th></tr></thead>';
    rooms.forEach(function (r) {
      var pts = K.store.tivlData(r).points, d = r.design || {}, n = pts.length || 1;
      h += '<tbody class="keep">';
      for (var i = 0; i < n; i++) {
        var p = pts[i] || { t: '', rh: '' };
        h += '<tr>';
        if (i === 0) h += '<td rowspan="' + n + '">' + esc(r.no) + '</td><td rowspan="' + n + '" class="left">' + esc(r.name) + '</td>';
        h += '<td>' + (i + 1) + '</td>';
        if (i === 0) h += '<td rowspan="' + n + '">' + esc(d.temp || '–') + '</td>';
        h += '<td>' + val(p.t) + '</td>';
        if (i === 0) h += '<td rowspan="' + n + '">' + esc(d.rh || '–') + '</td>';
        h += '<td>' + val(p.rh) + '</td></tr>';
      }
      h += '</tbody>';
    });
    h += '</table>';

    h += '<h3>2. Дополнения, отклонения, исключения из метода</h3><p>' + esc(t.note || 'нет') + '</p>' +
      '<p>Расположение точек измерения смотри в приложении.</p>';
    var v = P.verdict(state);
    h += B.tail(state, no, v === 'manual' ? 'none' : v);
    return h + '</section>';
  };

  K.protocolTivl = P;
})(window.KCHP = window.KCHP || {});
