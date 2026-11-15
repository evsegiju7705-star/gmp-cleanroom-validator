/* Общий экран ввода и печатная форма для испытаний, описанных в js/tests.js. */
(function (K) {
  'use strict';
  var calc = K.calc, store = K.store, B = K.protocolSkch, esc = B.esc, E = { cur: {} };

  var JUDGE = { ok: ['ok', 'Да'], fail: ['bad', 'Нет'], na: ['', '—'], none: ['', ''] };
  var VERDICT = { ok: ['ok', 'СООТВЕТСТВУЕТ'], fail: ['bad', 'НЕ СООТВЕТСТВУЕТ'], none: ['warn', 'ИЗМЕРЕНИЯ НЕ ЗАВЕРШЕНЫ'] };
  var ENV = [['t', 'Температура воздуха, °С'], ['rh', 'Относительная влажность воздуха, %'], ['p', 'Абсолютное давление, гПа'],
    ['u', 'Напряжение сети питания, В'], ['f', 'Частота сети питания, Гц']];

  function S() { return store.state; }
  function envKeys(def) { return ENV.slice(0, def.env5 ? 5 : 3); }
  function label(r) { return (r.no ? '№' + r.no + ' — ' : '') + (r.name || 'без названия'); }

  /* ---------- данные ---------- */
  E.data = function (def) {
    var all = S().t, t = all[def.key];
    if (!t || typeof t !== 'object') t = all[def.key] = {};
    ['date', 'firstNo', 'note'].forEach(function (k) { if (typeof t[k] !== 'string') t[k] = ''; });
    if (!t.env || typeof t.env !== 'object') t.env = {};
    ENV.forEach(function (e) { if (typeof t.env[e[0]] !== 'string') t.env[e[0]] = ''; });
    if (!t.x || typeof t.x !== 'object') t.x = {};
    (def.extras || []).forEach(function (x) { if (typeof t.x[x.k] !== 'string') t.x[x.k] = x.def || ''; });
    if (!t.rooms || typeof t.rooms !== 'object') t.rooms = {};
    return t;
  };
  function newRow(group, room) {
    var r = {};
    group.cols.forEach(function (c) { r[c.k] = typeof c.def === 'function' ? c.def(room) : (c.def || ''); });
    return r;
  }
  E.roomData = function (def, room) {
    var t = E.data(def), d = t.rooms[room.id];
    if (!d || typeof d !== 'object') d = t.rooms[room.id] = {};
    if (!d.f || typeof d.f !== 'object') d.f = {};
    (def.roomFields || []).forEach(function (f) { if (typeof d.f[f.k] !== 'string') d.f[f.k] = ''; });
    if (!d.g || typeof d.g !== 'object') d.g = {};
    def.groups.forEach(function (g) {
      if (!Array.isArray(d.g[g.k])) d.g[g.k] = [];
      while (d.g[g.k].length < g.min) d.g[g.k].push(newRow(g, room));
    });
    return d;
  };
  E.calcRoom = function (def, room) {
    return def.calc(room, E.roomData(def, room), S(), E.data(def).x);
  };
  E.verdict = function (def) {
    return K.tests.overall(def.rooms(S()).map(function (r) { return E.calcRoom(def, r).verdict; }));
  };
  E.number = function (def, room) {
    var first = K.numbering.start(S(), def.key);
    if (first === null) return '';
    var i = def.perRoom ? def.rooms(S()).indexOf(room) : 0;
    return K.numbering.format(S(), first + Math.max(i, 0));
  };
  function currentRoom(def) {
    var list = def.rooms(S()), id = E.cur[def.key];
    var r = list.filter(function (x) { return x.id === id; })[0] || list[0] || null;
    E.cur[def.key] = r ? r.id : null;
    return r;
  }

  /* ---------- экран ---------- */
  function groupTable(def, room, g, rows) {
    var base = 't.' + def.key + '.rooms.' + room.id + '.g.' + g.k + '.';
    var h = '<h4>' + esc(g.title) + '</h4>';
    if (!rows.length) h += '<p class="empty">Строк нет.</p>';
    else {
      h += '<div class="scroll"><table class="data"><thead><tr><th>№</th>' +
        g.cols.map(function (c) { return '<th>' + esc(c.label) + '</th>'; }).join('') +
        g.outs.map(function (c) { return '<th>' + esc(c.label) + '</th>'; }).join('') +
        (g.judge ? '<th>Соответствует</th>' : '') + '</tr></thead><tbody>';
      rows.forEach(function (r, i) {
        h += '<tr><th scope="row">' + (i + 1) + '</th>';
        g.cols.forEach(function (c) {
          var a = ' aria-label="' + esc(c.label + ', строка ' + (i + 1) + ', ' + label(room)) + '" data-bind="' + base + i + '.' + c.k + '"';
          if (c.options) {
            h += '<td><select' + a + '>' + c.options.map(function (o) { return '<option' + (o === r[c.k] ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select></td>';
          } else {
            h += '<td><input' + a + (c.text ? '' : ' class="short" inputmode="decimal"') + ' data-grid="1" value="' + esc(r[c.k]) + '"></td>';
          }
        });
        g.outs.forEach(function (c) { h += '<td class="num" data-out="o-' + room.id + '-' + g.k + '-' + i + '-' + c.k + '"></td>'; });
        if (g.judge) h += '<td><span class="tag" data-out="j-' + room.id + '-' + g.k + '-' + i + '"></span></td>';
        h += '</tr>';
      });
      h += '</tbody></table></div>';
    }
    if (!g.fixed) {
      h += '<div class="row-actions"><button type="button" class="small" data-act="e-add" data-room="' + room.id + '" data-g="' + g.k + '">Добавить строку</button>' +
        '<button type="button" class="small" data-act="e-del" data-room="' + room.id + '" data-g="' + g.k + '"' + (rows.length <= g.min ? ' disabled' : '') + '>Убрать последнюю строку</button></div>';
    }
    return h;
  }
  function roomBlock(def, room) {
    var d = E.roomData(def, room), h = '';
    if (def.roomFields) {
      h += '<div class="form">' + def.roomFields.map(function (f) {
        return K.ui.field(f.label, 't.' + def.key + '.rooms.' + room.id + '.f.' + f.k, { mode: 'decimal', hint: f.hint });
      }).join('') + '</div>';
    }
    def.groups.forEach(function (g) { h += groupTable(def, room, g, d.g[g.k]); });
    return h + '<dl class="sums" data-sum="' + room.id + '"></dl>';
  }

  E.view = function (def) {
    var t = E.data(def), base = 't.' + def.key + '.', rooms = def.rooms(S());
    var h = '<section class="card"><h2>Параметры испытания</h2><div class="form">' +
      K.ui.field('Дата измерений', base + 'date', { type: 'date', hint: K.ui.oldDateHint(t.date) }) +
      K.ui.field(def.perRoom ? 'Номер первого протокола' : 'Номер протокола', base + 'firstNo', { mode: 'numeric', hint: 'Пусто — по сквозной нумерации: ' + (E.number(def, def.rooms(S())[0]) || 'не задана') }) +
      (def.extras || []).map(function (x) { return K.ui.field(x.label, base + 'x.' + x.k, x.options ? { options: x.options } : {}); }).join('') +
      '</div><h3>Условия окружающей среды</h3><div class="form five">' +
      envKeys(def).map(function (e) { return K.ui.field(e[1], base + 'env.' + e[0], { mode: 'decimal' }); }).join('') + '</div></section>';
    if (!rooms.length) {
      return h + '<section class="card"><p class="empty">Нет помещений, для которых задано это испытание. ' +
        'Заполните проектные данные на вкладке «Помещения».</p></section>';
    }
    h += '<section class="card"><h2>Замеры</h2><p class="note">Числа можно вставлять из таблицы сразу несколькими ячейками: ' +
      'поставьте курсор в первую ячейку и вставьте скопированное.</p>';
    if (def.perRoom) {
      var room = currentRoom(def);
      h += '<div class="form"><div class="field wide"><label for="e-room">Помещение</label><select id="e-room">' +
        rooms.map(function (r) {
          var v = E.calcRoom(def, r).verdict;
          return '<option value="' + r.id + '"' + (r === room ? ' selected' : '') + '>' + esc(label(r)) + ' · ' +
            (v === 'ok' ? 'соответствует' : v === 'fail' ? 'не соответствует' : 'не завершено') + '</option>';
        }).join('') + '</select></div></div>' +
        '<dl class="facts"><div><dt>Протокол №</dt><dd>' + esc(E.number(def, room)) + '</dd></div>' +
        (def.facts ? def.facts(room).map(function (f) { return '<div><dt>' + esc(f[0]) + '</dt><dd>' + esc(f[1]) + '</dd></div>'; }).join('') : '') + '</dl>' +
        '<p class="verdict-line">Вывод по помещению: <span class="tag big" data-out="v-' + room.id + '"></span></p>' + roomBlock(def, room);
    } else {
      h += '<p class="verdict-line">Вывод по протоколу: <span class="tag big" data-out="v-all"></span></p>';
      rooms.forEach(function (r) {
        h += '<div class="room-block"><h3>' + esc(label(r)) + ' <span class="tag" data-out="v-' + r.id + '"></span></h3>' + roomBlock(def, r) + '</div>';
      });
    }
    h += '<div class="form">' + K.ui.field('Дополнения, отклонения, исключения из метода', base + 'note', { wide: true, area: true, hint: 'Если пусто, в протоколе будет «нет»' }) + '</div>' +
      '<div class="row-actions">' + (def.perRoom
        ? '<button type="button" class="primary" data-act="e-print-one">Протокол по этому помещению</button><button type="button" data-act="e-print">Протоколы по всем помещениям</button>'
        : '<button type="button" class="primary" data-act="e-print">Протокол</button>') + '</div></section>';
    return h;
  };

  function setOut(root, key, text, cls) {
    var el = root.querySelector('[data-out="' + key + '"]');
    if (!el) return;
    el.textContent = text;
    if (cls !== undefined) el.className = el.className.replace(/ ?\b(ok|bad|warn)\b/g, '') + (cls ? ' ' + cls : '');
  }
  E.refresh = function (def, root) {
    var rooms = def.perRoom ? [currentRoom(def)].filter(Boolean) : def.rooms(S()), vs = [];
    rooms.forEach(function (room) {
      var res = E.calcRoom(def, room);
      vs.push(res.verdict);
      def.groups.forEach(function (g) {
        (res.g[g.k] || []).forEach(function (o, i) {
          g.outs.forEach(function (c) { setOut(root, 'o-' + room.id + '-' + g.k + '-' + i + '-' + c.k, o[c.k] == null ? '' : o[c.k]); });
          if (g.judge) setOut(root, 'j-' + room.id + '-' + g.k + '-' + i, JUDGE[o.j][1], JUDGE[o.j][0]);
        });
      });
      var sum = root.querySelector('[data-sum="' + room.id + '"]');
      if (sum) sum.innerHTML = (res.sum || []).map(function (s) { return '<div><dt>' + esc(s[0]) + '</dt><dd>' + esc(s[1]) + '</dd></div>'; }).join('');
      setOut(root, 'v-' + room.id, VERDICT[res.verdict][1], VERDICT[res.verdict][0]);
    });
    if (!def.perRoom) { var v = K.tests.overall(vs); setOut(root, 'v-all', VERDICT[v][1], VERDICT[v][0]); }
  };

  /* ---------- действия ---------- */
  function roomById(id) { return S().rooms.filter(function (r) { return r.id === id; })[0]; }
  /* Возвращает true, если данные изменились и экран нужно перерисовать */
  E.click = function (def, btn) {
    var act = btn.dataset.act;
    if (act === 'e-print') { K.ui.showPreview(E.buildAll(def) + K.extras.appendix(def.key) + K.extras.schemeSheets(def.key)); return false; }
    if (act === 'e-print-one') { K.ui.showPreview(E.build(def, [currentRoom(def)])); return false; }
    var room = roomById(btn.dataset.room), g = def.groups.filter(function (x) { return x.k === btn.dataset.g; })[0];
    if (!room || !g) return false;
    var rows = E.roomData(def, room).g[g.k];
    if (act === 'e-add') { rows.push(newRow(g, room)); return true; }
    if (act === 'e-del') {
      if (rows.length <= g.min) return false;
      var last = rows[rows.length - 1], blank = newRow(g, room);
      var filled = g.cols.some(function (c) { return !c.options && String(last[c.k]) !== String(blank[c.k]); });
      if (filled && !confirm('В последней строке есть данные. Убрать её?')) return false;
      rows.pop(); return true;
    }
    return false;
  };
  E.selectRoom = function (def, id) { E.cur[def.key] = id; };

  /* Вставка нескольких ячеек из таблицы. Возвращает true, если вставка обработана. */
  E.paste = function (def, input, text) {
    if (!/[\t\n]/.test(text.replace(/[\r\n]+$/, ''))) return false;
    var m = /^t\.[^.]+\.rooms\.([^.]+)\.g\.([^.]+)\.(\d+)\.([^.]+)$/.exec(input.dataset.bind || '');
    if (!m) return false;
    var room = roomById(m[1]), g = def.groups.filter(function (x) { return x.k === m[2]; })[0];
    if (!room || !g) return false;
    var cols = g.cols.filter(function (c) { return !c.options; }).map(function (c) { return c.k; });
    var c0 = cols.indexOf(m[4]), rows = E.roomData(def, room).g[g.k], r0 = +m[3];
    var lines = text.replace(/[\r\n]+$/, '').split(/\r?\n/);
    if (g.fixed && r0 + lines.length > rows.length) lines = lines.slice(0, rows.length - r0);
    lines.forEach(function (line, i) {
      while (rows.length <= r0 + i) rows.push(newRow(g, room));
      line.split('\t').forEach(function (cell, j) {
        if (c0 + j < cols.length) rows[r0 + i][cols[c0 + j]] = cell.trim();
      });
    });
    return true;
  };

  /* ---------- печатная форма ---------- */
  function resultTables(def, items) {
    var h = '';
    def.groups.forEach(function (g, gi) {
      var any = items.some(function (it) { return it.data.g[g.k].length; });
      if (!any) return;
      h += '<h3>' + (def.groups.length > 1 || /^\d/.test(g.title) ? '' : '1. ') + esc(g.title) + '</h3><table class="grid"><thead><tr>' +
        (def.perRoom ? '' : '<th>Номер помещения</th><th>Наименование</th>') + '<th>№</th>' +
        g.cols.map(function (c) { return '<th>' + esc(c.label) + '</th>'; }).join('') +
        g.outs.map(function (c) { return '<th>' + esc(c.label) + '</th>'; }).join('') +
        (g.judge ? '<th>Соответствует (да / нет)</th>' : '') + '</tr></thead>';
      items.forEach(function (it) {
        var rows = it.data.g[g.k];
        if (!rows.length) return;
        h += '<tbody class="keep">';
        rows.forEach(function (r, i) {
          var o = (it.res.g[g.k] || [])[i] || {};
          h += '<tr>';
          if (!def.perRoom && i === 0) h += '<td rowspan="' + rows.length + '">' + esc(it.room.no) + '</td><td class="left" rowspan="' + rows.length + '">' + esc(it.room.name) + '</td>';
          h += '<td>' + (i + 1) + '</td>' +
            g.cols.map(function (c) { var n = c.text || c.options ? null : calc.num(r[c.k]); return '<td>' + esc(n === null ? r[c.k] : String(r[c.k]).trim().replace('.', ',')) + '</td>'; }).join('') +
            g.outs.map(function (c) { return '<td>' + esc(o[c.k] == null ? '' : o[c.k]) + '</td>'; }).join('') +
            (g.judge ? '<td>' + (o.j === 'ok' ? 'Да' : o.j === 'fail' ? 'Нет' : o.j === 'na' ? '—' : '') + '</td>' : '') + '</tr>';
        });
        h += '</tbody>';
      });
      h += '</table>';
    });
    return h;
  }
  function sumTable(items, perRoom) {
    var h = '';
    items.forEach(function (it) {
      if (!it.res.sum || !it.res.sum.length) return;
      h += '<table class="info">' + (perRoom ? '' : '<tr><th colspan="2"><b>' + esc(label(it.room)) + '</b></th></tr>') +
        it.res.sum.map(function (s) { return B.row(s[0] + ':', s[1]); }).join('') + '</table>';
    });
    return h;
  }
  /* Один лист протокола по списку помещений */
  E.build = function (def, rooms) {
    var s = S(), o = s.obj, t = E.data(def), x = t.x, room = def.perRoom ? rooms[0] : null;
    var items = rooms.map(function (r) { return { room: r, data: E.roomData(def, r), res: E.calcRoom(def, r) }; });
    var no = E.number(def, room), verdict = K.tests.overall(items.map(function (it) { return it.res.verdict; }));
    var ln = B.ln, body;
    var h = '<section class="sheet">' + B.head(s) + B.title(s, no, esc(def.title)) + B.customer(s);
    if (room) {
      h += ln('Номер и наименование помещения*', (room.no ? '№' + room.no + ' - ' : '') + room.name);
      var facts = def.facts ? def.facts(room) : [], args = [];
      facts.forEach(function (f) { args.push(f[0], { v: f[1], w: 24, c: 1 }); });
      if (args.length) h += ln.apply(null, args).replace('class="ln"', 'class="ln left"');
    }
    h += B.tools(s, def.instruments) +
      ln('Дата измерений', { v: calc.fmtDate(t.date), w: 34, c: 1 }, 'Режим работы систем вентиляции', { v: o.ventMode, c: 1 }) +
      ln('Нормативная документация на проведение измерений', { v: def.nd, c: 1 });
    if (!def.noSpecial) h += ln('Особые условия проведения измерений:', { v: o.special, c: 1 }) +
      '<div class="sub-note">(наличие технологического оборудования, его состояние и т.д.)</div>';
    (def.extras || []).forEach(function (e) { if (e.k !== 'exceed' && e.k !== 'tol') h += ln(e.label + ':', { v: x[e.k], c: 1 }); });
    h += B.disclaimer(s);
    h += '<div class="crit"><div class="crit-h">КРИТЕРИЙ<br>ПРИЕМЛЕМОСТИ:</div><div class="crit-t big">' + esc(def.criterion(s, room, x)) + '</div></div>';
    h += B.env(t.env, envKeys(def).map(function (e) { return e[0]; }));
    body = def.protoBody ? def.protoBody({ rooms: items, esc: esc, x: x, state: s }) : resultTables(def, items) + sumTable(items, def.perRoom);
    if (typeof body === 'string') body = { before: body, after: '' };
    h += body.before;
    if (def.footnote) h += '<p class="small-note">' + esc(def.footnote) + '</p>';
    h += '<h3 class="tbl plain it">' + (def.noteNo || '') + 'Дополнения, отклонения, исключения из метода</h3><div class="ln"><span class="vl">' + esc(t.note || 'нет') + '</span></div>';
    h += body.after || '';
    return h + B.tail(s, no, verdict, body.side) + '</section>';
  };
  E.buildAll = function (def) {
    var rooms = def.rooms(S());
    return def.perRoom ? rooms.map(function (r) { return E.build(def, [r]); }).join('') : E.build(def, rooms);
  };

  K.engine = E;
})(window.KCHP = window.KCHP || {});
