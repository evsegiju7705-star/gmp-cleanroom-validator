/* Состояние, сохранение в браузере, экспорт и импорт файла. */
(function (K) {
  'use strict';
  var KEY = 'kchp.v1', ref = K.ref, store = {};

  function uid() { return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  store.blank = function () {
    return {
      version: 1,
      lab: { name: '', short: '', unit: '', unitShort: '', legalAddress: '', address: '', contacts: '', accred: '', accredShow: 'да', logo: '' },
      obj: { object: '', customer: '', custLegal: '', custActual: '', inn: '', location: '', docNo: '', index: 'КЧП', registry: '',
             performer: '', performerPost: '', approver: '', approverPost: '',
             special: 'нет', ventMode: 'Рабочий (основной)', protoDate: '', firstNo: '' },
      instruments: ref.instrumentTypes.map(function (t) {
        return { type: t[0], model: '', serial: '', validTo: '' };
      }),
      rooms: [],
      staff: [],
      skch: { date: '', flow: '28.3', firstNo: '', rooms: {} },
      tivl: { date: '', firstNo: '', env: { t: '', rh: '', p: '' }, note: '', rooms: {} },
      t: {},
      schemes: {}
    };
  };

  /* Дополняет загруженные данные недостающими полями */
  store.normalize = function (d) {
    var b = store.blank(), k;
    if (!d || typeof d !== 'object') return b;
    for (k in b.lab) if (d.lab && d.lab[k] != null) b.lab[k] = String(d.lab[k]);
    for (k in b.obj) if (d.obj && d.obj[k] != null) b.obj[k] = String(d.obj[k]);
    if (Array.isArray(d.instruments)) {
      b.instruments.forEach(function (ins) {
        var src = d.instruments.filter(function (x) { return x && x.type === ins.type; })[0];
        if (src) ['model', 'serial', 'validTo'].forEach(function (f) { if (src[f] != null) ins[f] = String(src[f]); });
      });
    }
    if (Array.isArray(d.rooms)) {
      b.rooms = d.rooms.filter(Boolean).map(function (r) {
        return { id: r.id || uid(), no: String(r.no == null ? '' : r.no), name: String(r.name == null ? '' : r.name),
                 area: String(r.area == null ? '' : r.area), volume: String(r.volume == null ? '' : r.volume),
                 cls: String(r.cls == null ? '' : r.cls),
                 design: (r.design && typeof r.design === 'object') ? r.design : {} };
      });
    }
    if (d.skch) {
      ['date', 'flow', 'firstNo'].forEach(function (f) { if (d.skch[f] != null) b.skch[f] = String(d.skch[f]); });
      if (d.skch.rooms && typeof d.skch.rooms === 'object') b.skch.rooms = d.skch.rooms;
    }
    if (Array.isArray(d.staff)) {
      b.staff = d.staff.filter(Boolean).map(function (p) {
        return { name: String(p.name == null ? '' : p.name), post: String(p.post == null ? '' : p.post) };
      });
    }
    if (d.t && typeof d.t === 'object' && !Array.isArray(d.t)) b.t = d.t;
    if (d.schemes && typeof d.schemes === 'object' && !Array.isArray(d.schemes)) b.schemes = d.schemes;
    if (d.tivl) {
      ['date', 'firstNo', 'note'].forEach(function (f) { if (d.tivl[f] != null) b.tivl[f] = String(d.tivl[f]); });
      for (k in b.tivl.env) if (d.tivl.env && d.tivl.env[k] != null) b.tivl.env[k] = String(d.tivl.env[k]);
      if (d.tivl.rooms && typeof d.tivl.rooms === 'object') b.tivl.rooms = d.tivl.rooms;
    }
    return b;
  };

  store.load = function () {
    try { store.state = store.normalize(JSON.parse(localStorage.getItem(KEY))); }
    catch (e) { store.state = store.blank(); }
    return store.state;
  };

  store.save = function () {
    try { localStorage.setItem(KEY, JSON.stringify(store.state)); return true; }
    catch (e) { return false; }
  };

  store.addRoom = function () {
    var r = { id: uid(), no: '', name: '', area: '', volume: '', cls: '', design: {} };
    store.state.rooms.push(r);
    return r;
  };

  /* Данные замеров помещения; число точек не меньше минимального по таблице А.1 */
  store.skchData = function (room) {
    var all = store.state.skch.rooms, d = all[room.id];
    if (!d) d = all[room.id] = { env: { t: '', rh: '', p: '', u: '', f: '' }, points: [], note: '' };
    if (!d.env) d.env = { t: '', rh: '', p: '', u: '', f: '' };
    if (!Array.isArray(d.points)) d.points = [];
    var min = K.calc.minPoints(room.area) || 0;
    while (d.points.length < min) d.points.push({ a: ['', '', ''], b: ['', '', ''] });
    return d;
  };

  /* Замеры температуры и влажности по помещению; по умолчанию четыре точки, как в рабочей книге */
  store.tivlData = function (room) {
    var all = store.state.tivl.rooms, d = all[room.id];
    if (!d || !Array.isArray(d.points)) {
      d = all[room.id] = { points: [] };
      for (var i = 0; i < 4; i++) d.points.push({ t: '', rh: '' });
    }
    return d;
  };

  store.exportText = function () { return JSON.stringify(store.state, null, 2); };
  store.importText = function (text) { store.state = store.normalize(JSON.parse(text)); store.save(); };
  store.reset = function () { store.state = store.blank(); store.save(); };

  K.store = store;
})(window.KCHP = window.KCHP || {});
