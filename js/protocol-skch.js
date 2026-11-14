/* Печатная форма протокола измерения концентрации аэрозольных частиц. */
(function (K) {
  'use strict';
  var calc = K.calc, ref = K.ref, P = {};

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  P.esc = esc;

  /* Номер протокола: три знака номера в реестре (с 5-го) и порядковый номер */
  P.number = function (state, room) {
    var list = state.rooms.filter(calc.isClassified), i = list.indexOf(room);
    var first = calc.num(state.skch.firstNo);
    if (i < 0 || first === null) return '';
    var prefix = String(state.obj.registry || '').substr(4, 3);
    return (prefix ? prefix + ' - ' : '') + (first + i);
  };

  function typeName(key) {
    var t = ref.instrumentTypes.filter(function (x) { return x[0] === key; })[0];
    return t ? t[1] : key;
  }

  function row(label, value) {
    return '<tr><th>' + esc(label) + '</th><td>' + esc(value) + '</td></tr>';
  }

  function limitText(v) { return v === null || v === undefined ? null : calc.fmt(v); }

  function table(title, key, data, res, judgeKey, meanKey) {
    var h = '<h3>' + title + '</h3><table class="grid"><thead>' +
      '<tr><th rowspan="3">Номер контрольной точки</th>' +
      '<th colspan="3">Измеренное значение концентрации частиц в каждой пробе, частиц/м³</th>' +
      '<th rowspan="3">Средняя концентрация частиц в контрольной точке, част/м³</th>' +
      '<th rowspan="3">Соответствует / не соответствует (да / нет)</th></tr>' +
      '<tr><th colspan="3">порядковый номер пробы</th></tr><tr><th>1</th><th>2</th><th>3</th></tr></thead><tbody>';
    data.points.forEach(function (p, i) {
      var r = res.points[i], j = r[judgeKey];
      h += '<tr><td>' + (i + 1) + '</td>';
      for (var s = 0; s < ref.samplesPerPoint; s++) h += '<td>' + esc(calc.fmt(calc.num(p[key][s]))) + '</td>';
      h += '<td>' + esc(calc.fmt(r[meanKey])) + '</td><td>' +
        (j === 'ok' ? 'Да' : j === 'fail' ? 'Нет' : j === 'na' ? '—' : '') + '</td></tr>';
    });
    return h + '</tbody></table>';
  }

  P.build = function (state, room) {
    var o = state.obj, lab = state.lab, t = state.skch;
    var data = K.store.skchData(room), res = calc.skchRoom(room, data, o.special);
    var smp = calc.sample(room.cls, o.special, t.flow);
    var no = P.number(state, room), oper = calc.isOper(o.special);
    var la = limitText(res.limits.a), lb = limitText(res.limits.b);
    var stateTxt = oper ? ' в эксплуатируемом состоянии' : '';
    var h = '<section class="sheet">';

    h += '<header class="lab"><div class="lab-name">' + esc(lab.name) + '</div>' +
      (lab.short ? '<div>(' + esc(lab.short) + ')</div>' : '') +
      '<div>' + esc(lab.unit) + '</div><div>' + esc(lab.address) + '</div>' +
      '<div class="pre">' + esc(lab.contacts) + '</div></header>';

    h += '<div class="approve"><div>УТВЕРЖДАЮ</div><div class="line">' + esc(o.approverPost) + '</div>' +
      '<small>должность</small><div class="line sign"><span></span><span>' + esc(o.approver) + '</span></div>' +
      '<small class="sign"><span>подпись</span><span>фамилия и инициалы</span></small></div>';

    h += '<h1>ПРОТОКОЛ № ' + esc(no) + ' от ' + esc(calc.fmtDate(o.protoDate)) + '</h1>' +
      '<h2>измерения концентрации аэрозольных частиц в воздухе чистого помещения (зоны)</h2>';

    h += '<table class="info">' +
      row('Объект:', o.object) + row('Местонахождение:', o.location) +
      row('Заказчик:', o.customer) + row('ИНН Заказчика:', o.inn) +
      row('Номер и наименование помещения (зоны):', (room.no ? '№' + room.no + ' - ' : '') + room.name) +
      row('Класс чистоты по проекту:', room.cls) +
      row('Площадь помещения (зоны), м²:', calc.fmt(calc.num(room.area))) +
      row('Количество контрольных точек:', data.points.length) +
      row('Объём отбираемой пробы, л:', smp ? calc.fmt(smp.litres) : '') +
      row('Время пробоотбора:', smp ? calc.fmt(smp.min) + ' мин.' : '') +
      '</table>';

    h += '<table class="grid tools"><thead><tr><th>Средство измерения</th><th>зав. №</th><th>поверен до</th></tr></thead><tbody>';
    ref.skchInstruments.forEach(function (key) {
      var ins = state.instruments.filter(function (x) { return x.type === key; })[0];
      if (!ins || !ins.model) return;
      h += '<tr><td>' + esc(typeName(key) + ' ' + ins.model) + '</td><td>' + esc(ins.serial) +
        '</td><td>' + esc(calc.fmtDate(ins.validTo)) + '</td></tr>';
    });
    h += '</tbody></table>';

    h += '<table class="info">' +
      row('Дата измерений:', calc.fmtDate(t.date)) +
      row('Режим работы систем вентиляции:', o.ventMode) +
      row('Нормативная документация на проведение измерений:', 'ГОСТ Р ИСО 14644-1-2017') +
      row('Особые условия проведения измерений:', o.special) +
      '</table>';

    h += '<p><b>КРИТЕРИЙ ПРИЕМЛЕМОСТИ:</b><br>1. Концентрация аэрозольных частиц размером ≥0,5 мкм для помещений класса чистоты ' +
      esc(room.cls) + stateTxt + (la === null ? ' не нормируется.' : ' не превышает ' + la + ' частиц/м³.') +
      '<br>2. Концентрация аэрозольных частиц размером ≥5,0 мкм для помещений класса чистоты ' +
      esc(room.cls) + stateTxt + (lb === null ? ' не нормируется.' : ' не превышает ' + lb + ' частиц/м³.') + '</p>';

    h += '<h3 class="center">Условия окружающей среды</h3><table class="grid"><thead><tr>' +
      '<th>Температура воздуха, °С</th><th>Относительная влажность воздуха, %</th><th>Абсолютное давление, гПа</th>' +
      '<th>Напряжение сети питания, В</th><th>Частота сети питания, Гц</th></tr></thead><tbody><tr>' +
      ['t', 'rh', 'p', 'u', 'f'].map(function (k) { return '<td>' + esc(data.env[k]) + '&nbsp;</td>'; }).join('') +
      '</tr></tbody></table>' +
      '<p>Проведение испытаний при данных внешних условиях ДОПУСКАЕТСЯ</p>';

    h += table('1. Таблица измерений по частицам ≥ 0,5 мкм', 'a', data, res, 'judgeA', 'meanA');
    h += table('2. Таблица измерений по частицам ≥ 5,0 мкм', 'b', data, res, 'judgeB', 'meanB');

    h += '<h3>3. Дополнения, отклонения, исключения из метода</h3><p>' + esc(data.note || 'нет') + '</p>';
    h += '<p>Высота плоскости измерения от уровня пола 1 м.</p>';
    h += '<h3>Правило принятия решения</h3><p>При принятии решения применяется правило простой приемки согласно ' +
      'ILAC-G8:09/2019 Приложение В вариант а, при котором характеристика объекта принимается как соответствующая, ' +
      'если измеренное значение находится в пределах допуска в проверенных точках и несоответствующая в противном случае.</p>' +
      '<p>Результаты, приведенные в протоколе, применимы только к данному объекту испытаний.</p>';

    var verdict = res.verdict === 'ok' ? 'Результаты измерений соответствуют критерию приемлемости.'
      : res.verdict === 'fail' ? 'Результаты измерений не соответствуют критерию приемлемости.'
      : 'не сформирован: измерения внесены не полностью.';
    h += '<div class="final"><p class="verdict"><b>ВЫВОД:</b> ' + verdict + '</p>' +
      '<div class="author"><div>Составил:</div><div class="line">' + esc(o.performerPost) + '</div><small>должность</small>' +
      '<div class="line sign"><span></span><span>' + esc(o.performer) + '</span></div>' +
      '<small class="sign"><span>подпись</span><span>фамилия и инициалы</span></small></div></div>';

    h += '<p class="center">Окончание документа</p><footer>Протокол не должен быть воспроизведен не в полном объеме без разрешения ' +
      esc(lab.short || lab.name) + '<span>' + esc(o.index) + ' · Протокол № ' + esc(no) + '</span></footer>';
    return h + '</section>';
  };

  K.protocolSkch = P;
})(window.KCHP = window.KCHP || {});
