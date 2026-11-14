/* Экраны ввода и привязка полей к данным. */
(function (K) {
  'use strict';
  var calc = K.calc, ref = K.ref, store = K.store, esc = K.protocolSkch.esc;
  var view, tab = 'general', currentRoomId = null, pasteOpen = false;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function S() { return store.state; }

  /* ---------- привязка полей: data-bind="obj.customer" ---------- */
  function getPath(path) {
    return path.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, S());
  }
  function setPath(path, value) {
    var keys = path.split('.'), o = S();
    for (var i = 0; i < keys.length - 1; i++) o = o[keys[i]];
    o[keys[keys.length - 1]] = value;
  }
  function field(label, path, opts) {
    opts = opts || {};
    var v = getPath(path), id = 'f-' + path.replace(/\W/g, '-'), ctl;
    if (opts.options) {
      ctl = '<select id="' + id + '" data-bind="' + path + '">' + opts.options.map(function (o) {
        return '<option' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>';
      }).join('') + '</select>';
    } else if (opts.area) {
      ctl = '<textarea id="' + id + '" data-bind="' + path + '" rows="2">' + esc(v) + '</textarea>';
    } else {
      ctl = '<input id="' + id + '" data-bind="' + path + '" type="' + (opts.type || 'text') + '" value="' + esc(v) +
        '"' + (opts.mode ? ' inputmode="' + opts.mode + '"' : '') + '>';
    }
    return '<div class="field' + (opts.wide ? ' wide' : '') + '"><label for="' + id + '">' + esc(label) + '</label>' + ctl +
      (opts.hint ? '<small>' + esc(opts.hint) + '</small>' : '') + '</div>';
  }
  function saved() {
    var ok = store.save(), el = $('#save-state');
    el.textContent = ok ? 'Сохранено в браузере' : 'Не удалось сохранить в браузере — сохраните данные в файл';
    el.className = ok ? '' : 'bad';
  }

  /* ---------- Общие данные ---------- */
  function viewGeneral() {
    return '<section class="card"><h2>Лаборатория</h2><p class="note">Печатается в шапке каждого протокола.</p><div class="form">' +
      field('Полное наименование организации', 'lab.name', { wide: true }) +
      field('Сокращённое наименование', 'lab.short') +
      field('Подразделение', 'lab.unit') +
      field('Адрес', 'lab.address', { wide: true }) +
      field('Контакты и номер записи об аккредитации', 'lab.contacts', { wide: true, area: true }) +
      '</div></section>' +
      '<section class="card"><h2>Объект и заказчик</h2><div class="form">' +
      field('Объект испытаний', 'obj.object', { wide: true }) +
      field('Заказчик (полностью)', 'obj.customer', { wide: true, area: true }) +
      field('ИНН заказчика', 'obj.inn') +
      field('Индекс (КЧП или КМСК)', 'obj.index') +
      field('Местонахождение объекта', 'obj.location', { wide: true }) +
      field('Номер в реестре', 'obj.registry', { hint: 'Знаки с 5-го по 7-й идут в номер протокола' }) +
      field('Дата протокола', 'obj.protoDate', { type: 'date' }) +
      '</div></section>' +
      '<section class="card"><h2>Исполнители и условия</h2><div class="form">' +
      field('Измерения провёл (фамилия и инициалы)', 'obj.performer') +
      field('Должность', 'obj.performerPost') +
      field('Утвердил (фамилия и инициалы)', 'obj.approver') +
      field('Должность', 'obj.approverPost') +
      field('Особые условия проведения измерений', 'obj.special', { options: ref.specials }) +
      field('Режим работы систем вентиляции', 'obj.ventMode') +
      '</div></section>';
  }

  /* ---------- Приборы ---------- */
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function instrumentStatus(ins) {
    if (!ins.model) return ['', ''];
    if (!ins.validTo) return ['warn', 'Срок поверки не указан'];
    if (ins.validTo < today()) return ['bad', 'Поверка просрочена'];
    return ['ok', 'Поверка действует'];
  }
  function viewInstruments() {
    var h = '<section class="card"><h2>Средства измерений</h2>' +
      '<p class="note">Строки без модели в протоколы не попадают.</p>' +
      '<div class="scroll"><table class="data"><thead><tr><th>Вид прибора</th><th>Модель</th><th>Зав. №</th><th>Поверен до</th><th>Состояние</th></tr></thead><tbody>';
    S().instruments.forEach(function (ins, i) {
      var name = ref.instrumentTypes.filter(function (t) { return t[0] === ins.type; })[0][1], st = instrumentStatus(ins);
      h += '<tr><th scope="row">' + esc(name) + '</th>' +
        '<td><input aria-label="Модель: ' + esc(name) + '" data-bind="instruments.' + i + '.model" value="' + esc(ins.model) + '"></td>' +
        '<td><input aria-label="Заводской номер: ' + esc(name) + '" data-bind="instruments.' + i + '.serial" value="' + esc(ins.serial) + '"></td>' +
        '<td><input aria-label="Поверен до: ' + esc(name) + '" type="date" data-bind="instruments.' + i + '.validTo" value="' + esc(ins.validTo) + '"></td>' +
        '<td><span class="tag ' + st[0] + '" data-out="ins-' + i + '">' + st[1] + '</span></td></tr>';
    });
    return h + '</tbody></table></div></section>';
  }

  /* ---------- Помещения ---------- */
  function viewRooms() {
    var h = '<section class="card"><h2>Помещения комплекса</h2>' +
      '<p class="note">Помещение участвует в измерении концентрации частиц, если заданы площадь и класс чистоты. ' +
      'Число точек — минимальное по таблице А.1 ГОСТ Р ИСО 14644-1-2017.</p>';
    if (!S().rooms.length) h += '<p class="empty">Помещений пока нет. Добавьте первое или загрузите данные из файла.</p>';
    else {
      h += '<div class="scroll"><table class="data"><thead><tr><th>№ помещения</th><th>Наименование</th><th>Площадь, м²</th><th>Объём, м³</th><th>Класс чистоты</th><th>Точек отбора</th><th></th></tr></thead><tbody>';
      S().rooms.forEach(function (r, i) {
        var p = 'rooms.' + i + '.';
        h += '<tr><td><input class="short" aria-label="Номер помещения" data-bind="' + p + 'no" value="' + esc(r.no) + '"></td>' +
          '<td><input aria-label="Наименование" data-bind="' + p + 'name" value="' + esc(r.name) + '"></td>' +
          '<td><input class="short" inputmode="decimal" aria-label="Площадь" data-bind="' + p + 'area" value="' + esc(r.area) + '"></td>' +
          '<td><input class="short" inputmode="decimal" aria-label="Объём" data-bind="' + p + 'volume" value="' + esc(r.volume) + '"></td>' +
          '<td><select aria-label="Класс чистоты" data-bind="' + p + 'cls"><option value="">не задан</option>' +
          ref.classes.map(function (c) { return '<option' + (c === r.cls ? ' selected' : '') + '>' + c + '</option>'; }).join('') + '</select></td>' +
          '<td class="num" data-out="np-' + i + '">' + (calc.minPoints(r.area) || '—') + '</td>' +
          '<td><button type="button" class="danger small" data-act="del-room" data-i="' + i + '">Удалить</button></td></tr>';
      });
      h += '</tbody></table></div>';
    }
    return h + '<p><button type="button" class="primary" data-act="add-room">Добавить помещение</button></p></section>';
  }

  /* ---------- Концентрация частиц ---------- */
  var VERDICT = { ok: ['ok', 'СООТВЕТСТВУЕТ'], fail: ['bad', 'НЕ СООТВЕТСТВУЕТ'], none: ['warn', 'ИЗМЕРЕНИЯ НЕ ЗАВЕРШЕНЫ'] };
  var JUDGE = { ok: ['ok', 'Да'], fail: ['bad', 'Нет'], na: ['', '—'], none: ['', ''] };

  function skchRooms() { return S().rooms.filter(calc.isClassified); }
  function currentRoom() {
    var list = skchRooms();
    var r = list.filter(function (x) { return x.id === currentRoomId; })[0] || list[0] || null;
    currentRoomId = r ? r.id : null;
    return r;
  }
  function roomLabel(r) { return (r.no ? '№' + r.no + ' — ' : '') + (r.name || 'без названия'); }

  function sizeTable(room, data, key, title, limit) {
    var base = 'skch.rooms.' + room.id + '.points.';
    var h = '<h3>' + title + '</h3><p class="note">Предел: ' +
      (limit === null ? 'не нормируется' : esc(calc.fmt(limit)) + ' частиц/м³') + '</p>' +
      '<div class="scroll"><table class="data"><thead><tr><th>Точка</th><th>Проба 1</th><th>Проба 2</th><th>Проба 3</th><th>Среднее, частиц/м³</th><th>Соответствует</th></tr></thead><tbody>';
    data.points.forEach(function (p, i) {
      h += '<tr><th scope="row">' + (i + 1) + '</th>';
      for (var s = 0; s < ref.samplesPerPoint; s++) {
        h += '<td><input class="short" inputmode="decimal" aria-label="Точка ' + (i + 1) + ', проба ' + (s + 1) +
          '" data-bind="' + base + i + '.' + key + '.' + s + '" value="' + esc(p[key][s]) + '"></td>';
      }
      h += '<td class="num" data-out="m' + key + i + '"></td><td><span class="tag" data-out="j' + key + i + '"></span></td></tr>';
    });
    return h + '</tbody></table></div>';
  }

  function viewSkch() {
    var h = '<section class="card"><h2>Параметры испытания</h2><div class="form">' +
      field('Дата измерений', 'skch.date', { type: 'date' }) +
      field('Расход счётчика частиц, л/мин', 'skch.flow', { options: ['28.3', '2.83'] }) +
      field('Номер первого протокола', 'skch.firstNo', { mode: 'numeric' }) +
      '</div></section>';
    var list = skchRooms(), room = currentRoom();
    if (!room) {
      return h + '<section class="card"><p class="empty">Нет помещений с заданными площадью и классом чистоты. Заполните вкладку «Помещения».</p></section>';
    }
    var data = store.skchData(room), res = calc.skchRoom(room, data, S().obj.special);
    var smp = calc.sample(room.cls, S().obj.special, S().skch.flow), base = 'skch.rooms.' + room.id + '.';

    h += '<section class="card"><h2>Замеры по помещению</h2><div class="form">' +
      '<div class="field wide"><label for="room-select">Помещение</label><select id="room-select">' +
      list.map(function (r) {
        var v = calc.skchRoom(r, store.skchData(r), S().obj.special).verdict;
        return '<option value="' + r.id + '"' + (r === room ? ' selected' : '') + '>' + esc(roomLabel(r)) +
          ' · ' + (v === 'ok' ? 'соответствует' : v === 'fail' ? 'не соответствует' : 'не завершено') + '</option>';
      }).join('') + '</select></div></div>' +
      '<dl class="facts"><div><dt>Протокол №</dt><dd>' + esc(K.protocolSkch.number(S(), room)) + '</dd></div>' +
      '<div><dt>Класс чистоты</dt><dd>' + esc(room.cls) + '</dd></div>' +
      '<div><dt>Площадь, м²</dt><dd>' + esc(calc.fmt(calc.num(room.area))) + '</dd></div>' +
      '<div><dt>Минимум точек</dt><dd>' + res.minPoints + '</dd></div>' +
      '<div><dt>Объём пробы, л</dt><dd>' + (smp ? calc.fmt(smp.litres) : '—') + '</dd></div>' +
      '<div><dt>Время пробоотбора, мин</dt><dd>' + (smp ? calc.fmt(smp.min) : '—') + '</dd></div></dl>' +
      '<p class="verdict-line">Вывод по помещению: <span class="tag big" data-out="verdict"></span></p>' +

      '<h3>Условия окружающей среды</h3><div class="form five">' +
      field('Температура, °С', base + 'env.t', { mode: 'decimal' }) +
      field('Влажность, %', base + 'env.rh', { mode: 'decimal' }) +
      field('Давление, гПа', base + 'env.p', { mode: 'decimal' }) +
      field('Напряжение сети, В', base + 'env.u', { mode: 'decimal' }) +
      field('Частота сети, Гц', base + 'env.f', { mode: 'decimal' }) + '</div>' +

      '<div class="row-actions"><button type="button" data-act="paste-toggle">Вставить показания счётчика</button>' +
      '<button type="button" data-act="add-point">Добавить точку</button>' +
      '<button type="button" data-act="del-point"' + (data.points.length <= res.minPoints ? ' disabled' : '') + '>Убрать последнюю точку</button></div>';

    if (pasteOpen) {
      h += '<div class="paste"><label for="paste-box">Скопируйте из таблицы два столбца: ≥0,5 мкм и ≥5,0 мкм, частиц/м³. ' +
        'По три строки на точку, точки по порядку.</label><textarea id="paste-box" rows="6"></textarea>' +
        '<div class="row-actions"><button type="button" class="primary" data-act="paste-apply">Разнести по точкам</button>' +
        '<button type="button" data-act="paste-toggle">Отмена</button></div><p id="paste-msg" class="note" role="status"></p></div>';
    }

    h += sizeTable(room, data, 'a', 'Частицы ≥ 0,5 мкм', res.limits.a) +
      sizeTable(room, data, 'b', 'Частицы ≥ 5,0 мкм', res.limits.b) +
      '<div class="form">' + field('Дополнения, отклонения, исключения из метода', base + 'note', { wide: true, area: true, hint: 'Если пусто, в протоколе будет «нет»' }) + '</div>' +
      '<div class="row-actions"><button type="button" class="primary" data-act="print-one">Протокол по этому помещению</button>' +
      '<button type="button" data-act="print-all">Протоколы по всем помещениям</button></div></section>';
    return h;
  }

  function out(key, text, cls) {
    var el = $('[data-out="' + key + '"]', view);
    if (!el) return;
    el.textContent = text;
    if (cls !== undefined) el.className = el.className.replace(/ ?\b(ok|bad|warn)\b/g, '') + (cls ? ' ' + cls : '');
  }

  /* Обновляет расчётные ячейки без перерисовки полей ввода */
  function refresh() {
    if (tab === 'instruments') {
      S().instruments.forEach(function (ins, i) { var st = instrumentStatus(ins); out('ins-' + i, st[1], st[0]); });
    } else if (tab === 'rooms') {
      S().rooms.forEach(function (r, i) { out('np-' + i, calc.minPoints(r.area) || '—'); });
    } else if (tab === 'skch') {
      var room = currentRoom();
      if (!room) return;
      var res = calc.skchRoom(room, store.skchData(room), S().obj.special);
      res.points.forEach(function (p, i) {
        out('ma' + i, calc.fmt(p.meanA)); out('mb' + i, calc.fmt(p.meanB));
        out('ja' + i, JUDGE[p.judgeA][1], JUDGE[p.judgeA][0]);
        out('jb' + i, JUDGE[p.judgeB][1], JUDGE[p.judgeB][0]);
      });
      out('verdict', VERDICT[res.verdict][1], VERDICT[res.verdict][0]);
    }
  }

  function render() {
    var views = { general: viewGeneral, instruments: viewInstruments, rooms: viewRooms, skch: viewSkch };
    view.innerHTML = views[tab]();
    Array.prototype.forEach.call(document.querySelectorAll('#tabs button'), function (b) {
      b.setAttribute('aria-current', b.dataset.tab === tab ? 'page' : 'false');
    });
    refresh();
  }

  /* ---------- вставка показаний ---------- */
  function parsePaste(text) {
    var rows = [];
    text.split(/\r?\n/).forEach(function (line) {
      if (!line.trim()) return;
      var cells = line.indexOf('\t') >= 0 ? line.split('\t') : line.trim().split(/[;\s]+/);
      var nums = cells.map(calc.num).filter(function (n) { return n !== null; });
      if (nums.length >= 2) rows.push([nums[0], nums[1]]);
    });
    return rows;
  }
  function applyPaste() {
    var room = currentRoom(), data = store.skchData(room);
    var rows = parsePaste($('#paste-box').value), n = ref.samplesPerPoint;
    if (!rows.length || rows.length % n !== 0) {
      $('#paste-msg').textContent = 'Распознано строк с двумя числами: ' + rows.length +
        '. Нужно число строк, кратное трём. Данные не изменены.';
      return;
    }
    var pts = rows.length / n;
    while (data.points.length < pts) data.points.push({ a: ['', '', ''], b: ['', '', ''] });
    for (var i = 0; i < rows.length; i++) {
      var p = data.points[Math.floor(i / n)];
      p.a[i % n] = String(rows[i][0]); p.b[i % n] = String(rows[i][1]);
    }
    pasteOpen = false; saved(); render();
  }

  /* ---------- просмотр и печать ---------- */
  function preview(rooms) {
    $('#print').innerHTML = rooms.map(function (r) { return K.protocolSkch.build(S(), r); }).join('');
    $('#preview').hidden = false; $('#app').hidden = true;
    window.scrollTo(0, 0);
  }
  function closePreview() { $('#preview').hidden = true; $('#app').hidden = false; $('#print').innerHTML = ''; }

  /* ---------- события ---------- */
  function onInput(e) {
    var path = e.target.dataset && e.target.dataset.bind;
    if (!path) return;
    setPath(path, e.target.value);
    saved(); refresh();
  }
  function onChange(e) {
    if (e.target.id === 'room-select') { currentRoomId = e.target.value; pasteOpen = false; render(); return; }
    var path = e.target.dataset && e.target.dataset.bind;
    if (!path) return;
    /* поля, от которых зависит состав экрана */
    if (/^skch\.(flow|firstNo)$/.test(path) || path === 'obj.special') render();
  }
  function onClick(e) {
    var b = e.target.closest('[data-act]');
    if (!b) return;
    var act = b.dataset.act, room, data;
    if (act === 'add-room') { store.addRoom(); }
    else if (act === 'del-room') {
      var r = S().rooms[+b.dataset.i];
      if (!confirm('Удалить помещение «' + roomLabel(r) + '» вместе с его замерами?')) return;
      S().rooms.splice(+b.dataset.i, 1); delete S().skch.rooms[r.id];
    }
    else if (act === 'add-point') { store.skchData(currentRoom()).points.push({ a: ['', '', ''], b: ['', '', ''] }); }
    else if (act === 'del-point') {
      room = currentRoom(); data = store.skchData(room);
      var last = data.points[data.points.length - 1];
      var filled = last.a.concat(last.b).some(function (v) { return v !== ''; });
      if (data.points.length <= calc.minPoints(room.area)) return;
      if (filled && !confirm('В последней точке есть показания. Убрать её?')) return;
      data.points.pop();
    }
    else if (act === 'paste-toggle') { pasteOpen = !pasteOpen; render(); if (pasteOpen) $('#paste-box').focus(); return; }
    else if (act === 'paste-apply') { applyPaste(); return; }
    else if (act === 'print-one') { preview([currentRoom()]); return; }
    else if (act === 'print-all') { preview(skchRooms()); return; }
    saved(); render();
  }

  function download(name, text) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  K.init = function () {
    store.load();
    view = $('#view');
    view.addEventListener('input', onInput);
    view.addEventListener('change', onChange);
    view.addEventListener('click', onClick);
    $('#tabs').addEventListener('click', function (e) {
      var b = e.target.closest('[data-tab]');
      if (b) { tab = b.dataset.tab; pasteOpen = false; render(); }
    });
    $('#btn-export').addEventListener('click', function () { download('kchp-' + today() + '.json', store.exportText()); });
    $('#btn-import').addEventListener('click', function () { $('#file-import').click(); });
    $('#file-import').addEventListener('change', function (e) {
      var f = e.target.files[0];
      if (!f) return;
      if (!confirm('Данные из файла заменят всё, что сейчас введено. Продолжить?')) { e.target.value = ''; return; }
      var rd = new FileReader();
      rd.onload = function () {
        try { store.importText(rd.result); currentRoomId = null; render(); saved(); }
        catch (err) { alert('Файл не прочитан: это не файл данных приложения.'); }
        e.target.value = '';
      };
      rd.readAsText(f);
    });
    $('#btn-reset').addEventListener('click', function () {
      if (confirm('Удалить все введённые данные из браузера? Отменить это нельзя.')) { store.reset(); currentRoomId = null; render(); }
    });
    $('#btn-print').addEventListener('click', function () { window.print(); });
    $('#btn-close-preview').addEventListener('click', closePreview);
    render();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', K.init); else K.init();
})(window.KCHP = window.KCHP || {});
