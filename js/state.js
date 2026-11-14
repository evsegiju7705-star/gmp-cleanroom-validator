/* ==========================================================================
   state.js — модель данных, localStorage, экспорт/импорт JSON (шаг 2)
   ========================================================================== */
(function (root) {
  'use strict';
  var CRQ = root.CRQ = root.CRQ || {};

  var STORAGE_KEY = 'crq.cleanroom.v1';
  var SCHEMA = 'crq-cleanroom';
  var VERSION = 1;

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function isPlainObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  }

  function defaultState() {
    return {
      schema: SCHEMA,
      version: VERSION,
      meta: {
        standard: 'mpt916',   // ключ CRQ.gmp.STANDARDS
        date: '',             // дата испытаний, ГГГГ-ММ-ДД
        performer: ''         // исполнитель
      },
      room: {
        name: '',
        code: '',
        area: null,           // м²
        height: null,         // м
        grade: 'C',           // A | B | C | D
        state: 'atRest'       // atRest | inOperation
      },
      airflow: {
        points: []            // { id, label, flow } — расход, м³/ч
      },
      env: {
        dp: null,             // Па
        temp: null,           // °C
        rh: null              // %
      },
      particles: {
        points: []            // { id, label, p05, p50 } — шт./м³
      },
      criteria: clone(CRQ.gmp.DEFAULT_CRITERIA)
    };
  }

  /* Берём структуру из defaults, значения — из data (если есть). Лишние ключи отбрасываются. */
  function merge(defaults, data) {
    var out = {};
    Object.keys(defaults).forEach(function (key) {
      var d = defaults[key];
      var v = isPlainObject(data) ? data[key] : undefined;
      if (isPlainObject(d)) {
        out[key] = merge(d, v);
      } else if (Array.isArray(d)) {
        out[key] = Array.isArray(v) ? clone(v) : clone(d);
      } else {
        out[key] = (v === undefined) ? d : v;
      }
    });
    return out;
  }

  function numOrNull(v) {
    return (typeof v === 'number' && isFinite(v) && v >= 0) ? v : null;
  }

  /* Приводит массив точек к виду { id, label, <числовые поля> } с уникальными id */
  function cleanPoints(list, fields) {
    var out = [];
    (Array.isArray(list) ? list : []).forEach(function (p) {
      if (!isPlainObject(p)) { return; }
      var point = { id: out.length + 1, label: (typeof p.label === 'string') ? p.label : '' };
      fields.forEach(function (f) { point[f] = numOrNull(p[f]); });
      out.push(point);
    });
    return out;
  }

  function normalize(data) {
    var s = merge(defaultState(), data);
    s.airflow.points = cleanPoints(s.airflow.points, ['flow']);
    s.particles.points = cleanPoints(s.particles.points, ['p05', 'p50']);
    s.schema = SCHEMA;
    s.version = VERSION;
    if (CRQ.gmp.GRADES.indexOf(s.room.grade) === -1) { s.room.grade = 'C'; }
    if (!CRQ.gmp.STATES[s.room.state]) { s.room.state = 'atRest'; }
    if (!CRQ.gmp.STANDARDS[s.meta.standard]) { s.meta.standard = 'mpt916'; }
    return s;
  }

  var store = {
    available: true,
    lastSaved: null,

    load: function () {
      try {
        var raw = root.localStorage.getItem(STORAGE_KEY);
        CRQ.state = raw ? normalize(JSON.parse(raw)) : defaultState();
      } catch (e) {
        store.available = false;
        CRQ.state = defaultState();
      }
      return CRQ.state;
    },

    save: function () {
      try {
        root.localStorage.setItem(STORAGE_KEY, JSON.stringify(CRQ.state));
        store.available = true;
        store.lastSaved = new Date();
      } catch (e) {
        store.available = false;
      }
      return store.available;
    },

    reset: function () {
      CRQ.state = defaultState();
      store.save();
      return CRQ.state;
    },

    /** Скачивание текущего состояния файлом JSON */
    exportJSON: function () {
      var payload = clone(CRQ.state);
      payload.exportedAt = new Date().toISOString();
      var code = (CRQ.state.room.code || CRQ.state.room.name || 'room')
        .replace(/[^0-9A-Za-zА-Яа-яЁё_-]+/g, '_').slice(0, 40);
      var date = CRQ.state.meta.date || new Date().toISOString().slice(0, 10);
      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'cleanroom_' + code + '_' + date + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    },

    /** Загрузка состояния из текста JSON. Бросает Error с понятным сообщением. */
    importJSON: function (text) {
      var data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error('Файл не является корректным JSON.');
      }
      if (!isPlainObject(data) || data.schema !== SCHEMA) {
        throw new Error('Файл не похож на экспорт этого приложения (нет признака «' + SCHEMA + '»).');
      }
      if (typeof data.version === 'number' && data.version > VERSION) {
        throw new Error('Файл создан более новой версией приложения (версия данных ' + data.version + ').');
      }
      CRQ.state = normalize(data);
      store.save();
      return CRQ.state;
    }
  };

  CRQ.defaultState = defaultState;
  CRQ.store = store;
  CRQ.state = null;
})(typeof window !== 'undefined' ? window : globalThis);
