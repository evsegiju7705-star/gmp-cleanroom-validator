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

  /* Помещения испытания; для помещения с рабочей зоной добавляется отдельная запись зоны */
  P.rooms = function (state) {
    var out = [];
    state.rooms.filter(calc.isClassified).forEach(function (r) {
      out.push(r);
      var za = (r.design || {}).zoneArea;
      if (calc.minPoints(za) !== null) {
        out.push({ id: r.id + '_z', no: r.no, name: (r.name || '') + ' — рабочая зона', area: String(za), volume: '', cls: r.cls, design: {}, zone: true });
      }
    });
    return out;
  };

  /* Номер протокола: три знака номера в реестре (с 5-го) и порядковый номер */
  P.number = function (state, room) {
    var list = P.rooms(state).map(function (r) { return r.id; }), i = list.indexOf(room.id);
    var first = K.numbering.start(state, 'skch');
    if (i < 0 || first === null) return '';
    return K.numbering.format(state, first + i);
  };

  function typeName(key) {
    var t = ref.instrumentTypes.filter(function (x) { return x[0] === key; })[0];
    return t ? t[1] : key;
  }

  function row(label, value) {
    return '<tr><th>' + esc(label) + '</th><td>' + esc(value) + '</td></tr>';
  }

  function limitText(v) { return v === null || v === undefined ? null : calc.fmt(v); }

  /* Строка формы: подпись и подчёркнутое значение; пары можно ставить в одну строку */
  function ln() {
    var h = '<div class="ln">';
    for (var i = 0; i < arguments.length; i += 2) {
      var v = arguments[i + 1], o = (v && typeof v === 'object') ? v : { v: v };
      h += '<span class="lb">' + esc(arguments[i]) + '</span><span class="vl' + (o.w ? ' fix" style="width:' + o.w + 'mm' : '') +
        (o.c ? ' c' : '') + '">' + esc(o.v) + '</span>';
    }
    return h + '</div>';
  }
  P.ln = ln;

  function table(title, key, data, res, judgeKey, meanKey) {
    var h = '<h3 class="tbl">' + title + '</h3><table class="grid"><thead>' +
      '<tr><th rowspan="3" style="width:24%">Номер контрольной точки</th>' +
      '<th colspan="3">Измеренное значение концентрации частиц в каждой пробе, частиц/м3</th>' +
      '<th rowspan="3" style="width:24%">Средняя концентрация частиц в контрольной точке, част/м3</th>' +
      '<th rowspan="3" style="width:17%">Соответствует / не соответствует (да / нет)</th></tr>' +
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

  /* Шапка лаборатории, логотип, место печати и гриф утверждения */
  P.head = function (state) {
    var lab = state.lab, o = state.obj, h = '';
    var logo = /^data:image\//.test(lab.logo || '') ? lab.logo : '';
    function l(label, value) {
      return '<div class="ln"><span class="lb">' + label + '</span><span class="vl">' + esc(value) + '</span></div>';
    }
    /* Строка шапки, которая обязана уместиться в одну: длинный текст печатается мельче */
    function one(text) {
      text = String(text).replace(/\s+/g, ' ').trim();
      var size = Math.max(7, Math.min(9, Math.floor(9 * 105 / Math.max(text.length, 1) * 10) / 10));
      return '<div class="ln full"><span class="vl one" style="font-size:' + size + 'pt">' + esc(text) + '</span></div>';
    }
    h += '<header class="lab">' +
      l('Наименование организации:', lab.name + (lab.short ? ' (' + lab.short + ')' : '')) +
      l('Юридический адрес организации:', lab.legalAddress) +
      l('Наименование лаборатории:', lab.unit) +
      l('Фактический адрес места осуществления<br>деятельности (адрес лаборатории)', lab.address) +
      '<div class="ln tel"><span class="lb">Номер телефона, адрес электронной почты, сайт</span>' +
        '<span class="vl one" style="font-size:9pt">' + esc(String(lab.contacts).replace(/\s+/g, ' ').trim()) + '</span></div>' +
      (lab.accredShow !== 'нет' ? one('Уникальный номер записи об аккредитации в реестре аккредитованных лиц ' + lab.accred) : '') +
      '</header>';

    h += '<div class="approve"><div class="logo-box">' + (logo ? '<img class="logo" alt="" src="' + logo + '">' : '') + '</div>' +
      '<div class="mp">М.П.</div>' +
      '<div class="appr"><div>УТВЕРЖДАЮ</div><div class="line">' + esc(o.approverPost) + '</div>' +
      '<small>должность</small><div class="sign"><span class="line"></span><span class="line wide">' + esc(o.approver) + '</span></div>' +
      '<div class="sign"><small>подпись</small><small class="wide">фамилия и инициалы</small></div><div class="line"></div></div></div>';
    return h;
  };

  /* Заголовок протокола: номер, дата, название */
  P.title = function (state, no, name) {
    return '<h1>ПРОТОКОЛ № <span class="no">' + esc(no) + '</span> от <span class="no date">' + esc(calc.fmtDate(state.obj.protoDate)) + '</span></h1>' +
      '<h2>' + name + '</h2>';
  };

  /* Сведения об объекте и заказчике */
  P.customer = function (state) {
    var o = state.obj;
    return ln('Объект:*', o.object) + ln('Местонахождение:*', o.location) + ln('Заказчик:', o.customer) +
      ln('Юридический адрес:', o.custLegal) + ln('Фактический адрес:', o.custActual) +
      ln('ИНН Заказчика, данные заявки, договора:', o.inn);
  };

  /* Средства измерений по списку видов приборов */
  P.tools = function (state, keys) {
    var h = '<div class="tools">', first = true;
    keys.forEach(function (key) {
      var ins = state.instruments.filter(function (x) { return x.type === key; })[0];
      if (!ins || !ins.model) return;
      h += '<div class="ln"><span class="lb head">' + (first ? 'Средство измерения' : '') + '</span>' +
        '<span class="vl ser">' + esc(typeName(key) + ' ' + ins.model) + '</span>' +
        '<span class="lb ser">зав. №</span><span class="vl ser fix c" style="width:23mm">' + esc(ins.serial) + '</span>' +
        '<span class="lb ser">поверен до</span><span class="vl ser fix c" style="width:19mm">' + esc(calc.fmtDate(ins.validTo)) + '</span></div>';
      first = false;
    });
    if (first) h += ln('Средство измерения', '');
    return h + '</div>';
  };

  /* Оговорка об ответственности за данные заказчика */
  P.disclaimer = function (state) {
    var lab = state.lab, who = [lab.unit, lab.short].filter(Boolean).join(' ');
    return '<p class="disc">Результаты, приведённые в протоколе относятся только к данному объекту испытаний. Образец предоставлен заказчиком. ' +
      esc(who) + ' не несет ответственности за предоставленные заказчиком данные о месте нахождения образца испытаний ' +
      '(наименование помещения) и наименование организации, эксплуатирующей образец испытаний. Проверка осуществляется в месте ' +
      'нахождения объекта испытаний в состоянии и на условиях, предоставленных заказчиком / эксплуатирующей организацией<br>' +
      '*-информация предоставлена заказчиком.</p>';
  };

  /* Таблица условий окружающей среды */
  P.env = function (env, keys) {
    var names = { t: 'Температура воздуха, °С', rh: 'Относительная влаж-ность воздуха, %', p: 'Абсолютное давление, гПа',
                  u: 'Напряжение сети пита-ния, В', f: 'Частота сети питания, Гц' };
    if (keys.length <= 3) {
      return '<div class="env-side"><div class="env-cap">Условия окружающей среды:</div><table class="grid env"><thead><tr>' +
        keys.map(function (k) { return '<th>' + names[k] + '</th>'; }).join('') + '</tr></thead><tbody><tr>' +
        keys.map(function (k) { return '<td>' + esc(env[k]) + '&nbsp;</td>'; }).join('') + '</tr></tbody></table></div>' +
        '<p>Проведение испытаний при данных внешних условиях <i>ДОПУСКАЕТСЯ</i></p>';
    }
    return '<p class="center cap">Условия окружающей среды</p><table class="grid env"><thead><tr>' +
      keys.map(function (k) { return '<th>' + names[k] + '</th>'; }).join('') + '</tr></thead><tbody><tr>' +
      keys.map(function (k) { return '<td>' + esc(env[k]) + '&nbsp;</td>'; }).join('') + '</tr></tbody></table>' +
      '<p>Проведение испытаний при данных внешних условиях ДОПУСКАЕТСЯ</p>';
  };

  /* Правило принятия решения, вывод, подпись, нижняя строка */
  P.tail = function (state, no, verdictKey, side) {
    var lab = state.lab, o = state.obj, h = '';
    if (side) h += '<div class="keep rule-side"><div class="rule"><h3 class="tbl">Правило принятия решения</h3><p>При принятии решения применяется правило простой приемки согласно ' +
      'ILAC-G8:09/2019 Приложение В вариант а, при котором характеристика объекта принимается как соответствующая, ' +
      'если измеренное значение находится в пределах допуска в проверенных точках и несоответствующая в противном случае.</p></div>' +
      '<div class="side">' + side + '</div></div><p class="center serif">Результаты, приведенные в протоколе применимы только к данному объекту испытаний.</p>';
    else h += '<div class="keep"><h3 class="tbl">Правило принятия решения</h3><p>При принятии решения применяется правило простой приемки согласно ' +
      'ILAC-G8:09/2019 Приложение В вариант а, при котором характеристика объекта принимается как соответствующая, ' +
      'если измеренное значение находится в пределах допуска в проверенных точках и несоответствующая в противном случае.</p>' +
      '<p class="center serif">Результаты, приведенные в протоколе применимы только к данному объекту испытаний.</p></div>';

    var verdict = verdictKey === 'ok' ? 'Результаты измерений соответствуют критерию приемлемости.'
      : verdictKey === 'fail' ? 'Результаты измерений не соответствуют критерию приемлемости.'
      : 'не сформирован: измерения внесены не полностью.';
    h += '<div class="final"><p class="verdict"><b>ВЫВОД:</b> ' + verdict + '</p>' +
      '<div class="author"><div class="sign"><span class="who">Составил:</span><span class="line wide">' + esc(o.performerPost) + '</span></div>' +
      '<div class="sign"><small></small><small class="wide">должность</small></div>' +
      '<div class="sign"><span class="line"></span><span class="line wide">' + esc(o.performer) + '</span></div>' +
      '<div class="sign"><small>подпись</small><small class="wide">фамилия и инициалы</small></div></div></div>';

    var code = [o.index, o.docNo].filter(Boolean).join(' ');
    var warn = 'Протокол не должен быть воспроизведен не в полном объеме без разрешения ' +
      ([lab.unitShort, lab.short].filter(Boolean).join(' ') || lab.name);
    var foot = (code ? code + '   ' : '') + 'Протокол № ' + String(no).replace(/\s+/g, '');
    h += '<p class="center serif end">Окончание документа</p><footer data-warn="' + esc(warn) + '" data-foot="' + esc(foot) + '">' +
      '<span>' + esc(warn) + '</span><span class="code">' + esc(foot) + '</span></footer>';
    return h;
  };
  P.row = row;

  P.build = function (state, room) {
    var o = state.obj, t = state.skch;
    var data = K.store.skchData(room), res = calc.skchRoom(room, data, o.special);
    var smp = calc.sample(room.cls, o.special, t.flow);
    var no = P.number(state, room), oper = calc.isOper(o.special);
    var la = limitText(res.limits.a), lb = limitText(res.limits.b);
    var stateTxt = oper ? ' в эксплуатируемом состоянии' : '';
    var plan = (state.schemes || {})['skch:' + room.id], img = plan && plan[0] && /^data:image\//.test(plan[0].data) ? plan[0].data : '';
    var h = '<section class="sheet">';

    h += P.head(state);
    h += P.title(state, no, 'измерения концентрации аэрозольных частиц в воздухе чистого помещения (зоны)');
    h += P.customer(state);
    h += ln('Номер и наименование помещения(зоны)*', (room.no ? '№' + room.no + ' - ' : '') + room.name) +
      ln('Класс чистоты по проекту*', { v: room.cls, w: 22, c: 1 }, 'Площадь помещения (зоны), м2*', { v: calc.fmt(calc.num(room.area)), w: 22, c: 1 }) +
      ln('Количество контрольных точек', { v: data.points.length, w: 12, c: 1 },
         'Объём отбираемой пробы, л', { v: smp ? calc.fmt(smp.litres) : '', w: 16, c: 1 },
         'Время пробоотбора', { v: smp ? calc.fmt(smp.min) + ' мин.' : '', c: 1 });
    h += P.tools(state, ref.skchInstruments);
    h += ln('Дата измерений:', { v: calc.fmtDate(t.date), w: 34, c: 1 }, 'Режим работы систем вентиляции:', { v: o.ventMode, c: 1 }) +
      ln('Нормативная документация на проведение измерений', { v: 'ГОСТ ИСО 14644–1-2017', c: 1 }) +
      ln('Особые условия проведения измерений:', { v: o.special, c: 1 }) +
      '<div class="sub-note">(наличие технологического оборудования, его состояние и т.д.)</div>';
    h += P.disclaimer(state);

    h += '<div class="crit"><div class="crit-h">КРИТЕРИЙ ПРИЕМЛЕМОСТИ:</div><div class="crit-t">' +
      '1. Концентрация аэрозольных частиц Сп, размером ≥0,5 мкм для помещений класса чистоты ' +
      esc(room.cls) + stateTxt + (la === null ? ' не нормируется.' : ' не превышает ' + la + ' частиц /м3.') +
      '<br>2. Концентрация аэрозольных частиц Сп, размером ≥5,0 мкм для помещений класса чистоты ' +
      esc(room.cls) + stateTxt + (lb === null ? ' не нормируется.' : ' не превышает ' + lb + ' частиц /м3.') + '</div></div>';

    h += P.env(data.env, ['t', 'rh', 'p', 'u', 'f']);

    h += table('1. Таблица измерений по частицам ≥ 0,5&nbsp; мкм', 'a', data, res, 'judgeA', 'meanA');
    h += table('2. Таблица измерений по частицам ≥ 5,0 мкм', 'b', data, res, 'judgeB', 'meanB');

    h += '<h3 class="tbl">3. Дополнения, отклонения, исключения из метода</h3>' + '<div class="ln"><span class="vl">' + esc(data.note || 'нет') + '</span></div>';
    h += '<div class="plan"><p class="center cap">Расположение контрольных точек на плане помещения</p>' +
      (img ? '<img class="plan-img" alt="План помещения с контрольными точками" src="' + img + '">' : '<div class="plan-blank"></div>') +
      '<p class="plan-note">В скобках сквозная нумерация. Высота плоскости измерения от уровня пола 1 м.</p></div>';
    h += P.tail(state, no, res.verdict);
    return h + '</section>';
  };

  K.protocolSkch = P;
})(window.KCHP = window.KCHP || {});
