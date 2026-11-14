/* ==========================================================================
   measurements.js — динамические таблицы карты замеров (шаг 3)
   • добавление / удаление диффузоров и точек отбора проб;
   • ввод значений без перерисовки строк (фокус не теряется);
   • вывод итогов и статусов из CRQ.calc.summary().
   ========================================================================== */
(function (root) {
  'use strict';
  var CRQ = root.CRQ = root.CRQ || {};
  var calc = CRQ.calc;

  var TABLES = {
    airflow: {
      bodyId: 'airflow-body',
      emptyText: 'Точки замера не добавлены.',
      colspan: 4,
      prefix: 'Д-',
      labelName: 'Обозначение диффузора',
      fields: [{ key: 'flow', name: 'Расход, м³/ч' }],
      hasStatus: false,
      create: function (id, label) { return { id: id, label: label, flow: null }; }
    },
    particles: {
      bodyId: 'particles-body',
      emptyText: 'Точки отбора проб не добавлены.',
      colspan: 6,
      prefix: 'Т-',
      labelName: 'Обозначение точки отбора',
      fields: [{ key: 'p05', name: 'Частицы ≥ 0,5 мкм, шт./м³' }, { key: 'p50', name: 'Частицы ≥ 5,0 мкм, шт./м³' }],
      hasStatus: true,
      create: function (id, label) { return { id: id, label: label, p05: null, p50: null }; }
    }
  };

  function byId(id) { return document.getElementById(id); }

  function setText(id, text) {
    var el = byId(id);
    if (el) { el.textContent = text; }
  }

  function setStatus(el, status) {
    if (!el) { return; }
    var cls = (status === 'ok' || status === 'fail') ? status : (status === 'none' ? 'none' : 'na');
    el.className = 'status status--' + cls + (el.classList.contains('status--large') ? ' status--large' : '');
    el.textContent = calc.STATUS_LABELS[status] || calc.STATUS_LABELS.none;
  }

  function points(kind) {
    return CRQ.state[kind].points;
  }

  function nextId(list) {
    return list.reduce(function (max, p) { return Math.max(max, p.id); }, 0) + 1;
  }

  /* ---------- построение строк ---------- */

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) { node.className = className; }
    if (text !== undefined) { node.textContent = text; }
    return node;
  }

  function buildRow(kind, point, index) {
    var cfg = TABLES[kind];
    var n = index + 1;
    var tr = el('tr');
    tr.setAttribute('data-id', String(point.id));

    tr.appendChild(el('td', 'col-n num', String(n)));

    var tdLabel = el('td');
    var label = el('input');
    label.type = 'text';
    label.value = point.label || '';
    label.autocomplete = 'off';
    label.setAttribute('data-field', 'label');
    label.setAttribute('aria-label', cfg.labelName + ', строка ' + n);
    tdLabel.appendChild(label);
    tr.appendChild(tdLabel);

    cfg.fields.forEach(function (field) {
      var td = el('td', 'num');
      var input = el('input', 'input-num');
      input.type = 'text';
      input.inputMode = 'decimal';
      input.autocomplete = 'off';
      input.value = calc.toInput(point[field.key]);
      input.setAttribute('data-field', field.key);
      input.setAttribute('aria-label', field.name + ', строка ' + n);
      td.appendChild(input);
      tr.appendChild(td);
    });

    if (cfg.hasStatus) {
      var tdStatus = el('td');
      tdStatus.appendChild(el('span', 'status status--none', calc.STATUS_LABELS.none));
      tr.appendChild(tdStatus);
    }

    var tdAct = el('td', 'col-act no-print');
    var remove = el('button', 'btn btn--icon', '×');
    remove.type = 'button';
    remove.setAttribute('data-action', 'remove');
    remove.setAttribute('aria-label', 'Удалить строку ' + n);
    remove.title = 'Удалить строку';
    tdAct.appendChild(remove);
    tr.appendChild(tdAct);

    return tr;
  }

  function renderTable(kind) {
    var cfg = TABLES[kind];
    var body = byId(cfg.bodyId);
    var list = points(kind);
    body.textContent = '';
    if (!list.length) {
      var tr = el('tr', 'empty-row');
      var td = el('td', '', cfg.emptyText);
      td.colSpan = cfg.colspan;
      tr.appendChild(td);
      body.appendChild(tr);
      return;
    }
    list.forEach(function (point, index) {
      body.appendChild(buildRow(kind, point, index));
    });
  }

  function renderTables() {
    renderTable('airflow');
    renderTable('particles');
  }

  /* ---------- действия ---------- */

  function commit() {
    CRQ.store.save();
    CRQ.app.render();
  }

  function addPoint(kind) {
    var cfg = TABLES[kind];
    var list = points(kind);
    var id = nextId(list);
    list.push(cfg.create(id, cfg.prefix + (list.length + 1)));
    renderTable(kind);
    commit();
    var input = byId(cfg.bodyId).querySelector('tr[data-id="' + id + '"] [data-field="' + cfg.fields[0].key + '"]');
    if (input) { input.focus(); }
  }

  function removePoint(kind, id) {
    var cfg = TABLES[kind];
    var list = points(kind);
    var index = -1;
    list.forEach(function (p, i) { if (p.id === id) { index = i; } });
    if (index === -1) { return; }

    var point = list[index];
    var hasData = cfg.fields.some(function (f) { return calc.isNum(point[f.key]); });
    if (hasData && !root.confirm('Удалить строку «' + (point.label || index + 1) + '» вместе с введёнными значениями?')) {
      return;
    }
    list.splice(index, 1);
    renderTable(kind);
    commit();
    var addButton = byId(kind === 'airflow' ? 'btn-add-diffuser' : 'btn-add-point');
    if (addButton) { addButton.focus(); }
  }

  function findPoint(kind, row) {
    var id = Number(row.getAttribute('data-id'));
    var list = points(kind);
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) { return list[i]; }
    }
    return null;
  }

  function onInput(kind, event) {
    var input = event.target;
    var field = input.getAttribute && input.getAttribute('data-field');
    var row = input.closest ? input.closest('tr[data-id]') : null;
    if (!field || !row) { return; }
    var point = findPoint(kind, row);
    if (!point) { return; }

    if (field === 'label') {
      point.label = input.value;
    } else {
      var value = calc.parseNumber(input.value);
      var invalid = (input.value.trim() !== '' && value === null) || (value !== null && value < 0);
      if (invalid) {
        input.setAttribute('aria-invalid', 'true');
        value = null;
      } else {
        input.removeAttribute('aria-invalid');
      }
      point[field] = value;
    }
    commit();
  }

  function onClick(kind, event) {
    var button = event.target.closest ? event.target.closest('[data-action="remove"]') : null;
    if (!button) { return; }
    var row = button.closest('tr[data-id]');
    if (row) { removePoint(kind, Number(row.getAttribute('data-id'))); }
  }

  /* ---------- вывод результатов ---------- */

  function showNote(id, text) {
    var node = byId(id);
    if (!node) { return; }
    node.textContent = text || '';
    node.hidden = !text;
  }

  function renderAirflow(sum) {
    var air = sum.airflow;
    setText('out-flow-total', air.total === null ? '—' : calc.formatNumber(air.total, 1));
    setText('out-ach', air.ach === null ? '—' : calc.formatNumber(air.ach, calc.ACH_DIGITS));
    setStatus(byId('st-ach'), air.status);

    var note = '';
    if (air.count > 0 && !air.complete) {
      note = 'Расход введён не для всех точек (' + air.filled + ' из ' + air.count +
        ') — кратность не рассчитывается, сумма показана по заполненным строкам.';
    } else if (air.complete && sum.volume === null) {
      note = 'Для расчёта кратности укажите площадь и высоту помещения.';
    }
    showNote('airflow-warning', note);
  }

  function renderEnv(sum) {
    setStatus(byId('st-dp'), sum.env.dp.status);
    setStatus(byId('st-temp'), sum.env.temp.status);
    setStatus(byId('st-rh'), sum.env.rh.status);
  }

  function renderParticles(sum) {
    var part = sum.particles;
    ['p05', 'p50'].forEach(function (key) {
      var ch = part[key];
      setText('out-' + key + '-avg', ch.avg === null ? '—' : calc.formatNumber(ch.avg, 0));
      setText('out-' + key + '-max', ch.max === null ? '—' : calc.formatNumber(ch.max, 0));
      setText('out-' + key + '-lim', ch.limit === null ? 'не нормируется' : '≤ ' + calc.formatNumber(ch.limit));
      setStatus(byId('st-' + key), ch.status);
    });

    var body = byId('particles-body');
    part.rows.forEach(function (row) {
      var tr = body.querySelector('tr[data-id="' + row.id + '"]');
      if (!tr) { return; }
      setStatus(tr.querySelector('.status'), row.status);
      ['p05', 'p50'].forEach(function (key) {
        var input = tr.querySelector('[data-field="' + key + '"]');
        if (input) { input.classList.toggle('is-over', row[key] === 'fail'); }
      });
    });

    showNote('particles-warning', sum.remarks.join(' '));
  }

  function listLabels(items, status) {
    return items.filter(function (i) { return i.status === status; })
      .map(function (i) { return i.label; }).join('; ');
  }

  function renderOverall(sum) {
    setStatus(byId('st-overall'), sum.overall);
    var text;
    var grade = CRQ.state.room.grade;
    var stateName = CRQ.gmp.STATES[CRQ.state.room.state].short;
    if (sum.overall === 'fail') {
      text = 'Не соответствуют: ' + listLabels(sum.items, 'fail') + '.';
      var missing = listLabels(sum.items, 'none');
      if (missing) { text += ' Не введены: ' + missing + '.'; }
    } else if (sum.overall === 'none') {
      text = 'Не введены: ' + listLabels(sum.items, 'none') + '.';
    } else {
      text = 'Все оцениваемые показатели соответствуют требованиям к классу ' + grade +
        ' (' + stateName + ' состояние).';
    }
    var skipped = sum.items.filter(function (i) { return i.status === 'na' || i.status === 'nocrit'; })
      .map(function (i) { return i.label; }).join('; ');
    if (skipped) { text += ' Не оцениваются: ' + skipped + '.'; }
    if (sum.remarks.length) { text += ' Замечание: ' + sum.remarks.join(' '); }
    setText('out-overall-text', text);
  }

  function renderResults() {
    var sum = calc.summary(CRQ.state);
    renderAirflow(sum);
    renderEnv(sum);
    renderParticles(sum);
    renderOverall(sum);
    return sum;
  }

  /* ---------- запуск ---------- */

  function init() {
    ['airflow', 'particles'].forEach(function (kind) {
      var body = byId(TABLES[kind].bodyId);
      body.addEventListener('input', function (e) { onInput(kind, e); });
      body.addEventListener('click', function (e) { onClick(kind, e); });
    });
    byId('btn-add-diffuser').addEventListener('click', function () { addPoint('airflow'); });
    byId('btn-add-point').addEventListener('click', function () { addPoint('particles'); });
  }

  CRQ.measurements = {
    init: init,
    renderTables: renderTables,
    renderResults: renderResults,
    setStatus: setStatus
  };
})(typeof window !== 'undefined' ? window : globalThis);
