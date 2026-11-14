/* ==========================================================================
   app.js — инициализация, привязка форм к состоянию, справочник (шаг 2)
   Поля связываются с моделью через атрибут data-bind="путь.в.состоянии".
   Токен $grade в пути заменяется выбранным классом чистоты.
   ========================================================================== */
(function (root) {
  'use strict';
  var CRQ = root.CRQ;
  var gmp = CRQ.gmp;
  var calc = CRQ.calc;
  var store = CRQ.store;

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) { el.textContent = text; }
  }

  /* ---------- доступ к состоянию по пути ---------- */

  function resolvePath(path) {
    return path.replace('$grade', CRQ.state.room.grade).split('.');
  }

  function getPath(path) {
    var keys = resolvePath(path);
    var obj = CRQ.state;
    for (var i = 0; i < keys.length; i++) {
      if (obj === null || obj === undefined) { return undefined; }
      obj = obj[keys[i]];
    }
    return obj;
  }

  function setPath(path, value) {
    var keys = resolvePath(path);
    var obj = CRQ.state;
    for (var i = 0; i < keys.length - 1; i++) { obj = obj[keys[i]]; }
    obj[keys[keys.length - 1]] = value;
  }

  /* ---------- состояние → форма ---------- */

  function fillField(el) {
    var value = getPath(el.getAttribute('data-bind'));
    if (el.type === 'radio') {
      el.checked = (el.value === value);
    } else if (el.getAttribute('data-type') === 'number') {
      el.value = calc.toInput(value);
      el.removeAttribute('aria-invalid');
    } else {
      el.value = (value === null || value === undefined) ? '' : value;
    }
  }

  function fillForm() {
    $$('[data-bind]').forEach(fillField);
  }

  /* ---------- форма → состояние ---------- */

  function onFieldChange(event) {
    var el = event.target;
    if (!el.getAttribute || !el.getAttribute('data-bind')) { return; }
    if (el.type === 'radio' && !el.checked) { return; }

    var path = el.getAttribute('data-bind');
    var value;

    if (el.getAttribute('data-type') === 'number') {
      value = calc.parseNumber(el.value);
      var invalid = (el.value.trim() !== '' && value === null) ||
                    (value !== null && el.hasAttribute('data-positive') && value <= 0);
      if (invalid) {
        el.setAttribute('aria-invalid', 'true');
        value = null;
      } else {
        el.removeAttribute('aria-invalid');
      }
    } else {
      value = el.value;
    }

    setPath(path, value);
    store.save();

    /* При смене класса поля с $grade в пути показывают значение для нового класса */
    if (path === 'room.grade') {
      $$('[data-bind*="$grade"]').forEach(fillField);
    }
    render();
  }

  /* ---------- производные значения ---------- */

  function renderRoomDerived() {
    var s = CRQ.state;
    var vol = calc.volume(s.room.area, s.room.height);
    setText('out-volume', vol === null ? '—' : calc.formatNumber(vol, 2));

    var iso = gmp.getIsoEquivalent(s.meta.standard, s.room.grade, s.room.state);
    setText('out-iso', iso || 'не установлен');

    var nl = gmp.minSamplingLocations(s.room.area);
    setText('out-nl', nl === null ? '—' : String(nl));
  }

  function limitText(value) {
    return value === null ? 'не нормируется' : '≤ ' + calc.formatNumber(value);
  }

  function renderActiveLimits() {
    var s = CRQ.state;
    var std = gmp.getStandard(s.meta.standard);
    var lim = gmp.getParticleLimits(s.meta.standard, s.room.grade, s.room.state);

    setText('lim-p05', limitText(lim.p05));
    setText('lim-p50', limitText(lim.p50));
    setText('lim-source', 'Класс ' + s.room.grade + ', ' + gmp.STATES[s.room.state].short +
      ' состояние — ' + std.shortLabel);

    var achInput = $('#crit-ach');
    var achNote = $('#crit-ach-note');
    if (achInput && achNote) {
      achNote.hidden = (s.room.grade !== 'A');
    }
    setText('crit-ach-grade', s.room.grade);
  }

  /* ---------- справочник ---------- */

  function cell(tag, text, className) {
    var el = document.createElement(tag);
    el.textContent = text;
    if (className) { el.className = className; }
    return el;
  }

  function renderReference() {
    var s = CRQ.state;
    var std = gmp.getStandard(s.meta.standard);
    var body = $('#ref-particles-body');
    body.textContent = '';

    gmp.GRADES.forEach(function (grade) {
      var tr = document.createElement('tr');
      var isRow = (grade === s.room.grade);
      if (isRow) { tr.className = 'is-active-row'; }
      tr.appendChild(cell('th', grade, 'ref-grade'));

      ['atRest', 'inOperation'].forEach(function (state) {
        var lim = std.particles[grade][state];
        var active = (isRow && state === s.room.state) ? ' is-active' : '';
        ['p05', 'p50'].forEach(function (key) {
          var v = lim[key];
          tr.appendChild(cell('td', v === null ? 'не норм.' : calc.formatNumber(v),
            'num' + (v === null ? ' is-na' : '') + active));
        });
      });

      var isoRest = std.iso[grade].atRest || '—';
      var isoOper = std.iso[grade].inOperation || '—';
      tr.appendChild(cell('td', isoRest + ' / ' + isoOper, 'ref-iso'));
      body.appendChild(tr);
    });

    setText('ref-source', std.reference);

    var notes = $('#ref-notes');
    notes.textContent = '';
    std.notes.forEach(function (text) {
      notes.appendChild(cell('li', text));
    });
  }

  function renderIsoLocations() {
    var body = $('#ref-iso-body');
    if (body.childElementCount) { return; }
    var rows = gmp.ISO_LOCATIONS;
    var half = Math.ceil(rows.length / 2);
    for (var i = 0; i < half; i++) {
      var tr = document.createElement('tr');
      [rows[i], rows[i + half]].forEach(function (pair) {
        tr.appendChild(cell('td', pair ? calc.formatNumber(pair[0]) : '', 'num'));
        tr.appendChild(cell('td', pair ? String(pair[1]) : '', 'num'));
      });
      body.appendChild(tr);
    }
  }

  /* ---------- индикатор сохранения ---------- */

  function renderSaveStatus() {
    var el = $('#save-status');
    if (!store.available) {
      el.textContent = 'Хранилище браузера недоступно — сохраняйте через «Экспорт JSON»';
      el.className = 'save-status is-warn';
    } else if (store.lastSaved) {
      el.textContent = 'Сохранено в браузере в ' +
        store.lastSaved.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      el.className = 'save-status';
    } else {
      el.textContent = 'Данные хранятся только в этом браузере';
      el.className = 'save-status';
    }
  }

  function render() {
    renderRoomDerived();
    renderActiveLimits();
    renderReference();
    renderSaveStatus();
  }

  /* ---------- панель действий ---------- */

  function bindToolbar() {
    $('#btn-export').addEventListener('click', function () {
      store.exportJSON();
    });

    var fileInput = $('#file-import');
    $('#btn-import').addEventListener('click', function () {
      fileInput.value = '';
      fileInput.click();
    });
    fileInput.addEventListener('change', function () {
      var file = fileInput.files && fileInput.files[0];
      if (!file) { return; }
      var reader = new FileReader();
      reader.onload = function () {
        try {
          store.importJSON(String(reader.result));
          fillForm();
          render();
        } catch (e) {
          root.alert('Импорт не выполнен. ' + e.message);
        }
      };
      reader.onerror = function () {
        root.alert('Импорт не выполнен. Не удалось прочитать файл.');
      };
      reader.readAsText(file, 'utf-8');
    });

    $('#btn-reset').addEventListener('click', function () {
      if (root.confirm('Очистить все введённые данные? Действие нельзя отменить — при необходимости сначала выполните экспорт JSON.')) {
        store.reset();
        fillForm();
        render();
      }
    });
  }

  /* ---------- запуск ---------- */

  function init() {
    store.load();
    fillForm();
    renderIsoLocations();
    render();
    document.addEventListener('input', onFieldChange);
    document.addEventListener('change', onFieldChange);
    bindToolbar();
    CRQ.measurements.init();   // шаг 3
    CRQ.protocol.init();       // шаг 4
  }

  CRQ.app = { init: init, render: render, fillForm: fillForm };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
