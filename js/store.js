/* Состояние, сохранение в браузере, экспорт и импорт файла. */
(function (K) {
  'use strict';
  var KEY = 'kchp.v1', ref = K.ref, store = {};

  function uid() { return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  store.blank = function () {
    return {
      version: 1,
      lab: { name: '', short: '', unit: '', address: '', contacts: '' },
      obj: { object: '', customer: '', inn: '', location: '', index: 'КЧП', registry: '',
             performer: '', performerPost: '', approver: '', approverPost: '',
             special: 'нет', ventMode: 'Рабочий (основной)', protoDate: '' },
      instruments: ref.instrumentTypes.map(function (t) {
        return { type: t[0], model: '', serial: '', validTo: '' };
      }),
      rooms: [],
      skch: { date: '', flow: '28.3', firstNo: '1', rooms: {} }
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
                 cls: String(r.cls == null ? '' : r.cls), design: r.design || {} };
      });
    }
    if (d.skch) {
      ['date', 'flow', 'firstNo'].forEach(function (f) { if (d.skch[f] != null) b.skch[f] = String(d.skch[f]); });
      if (d.skch.rooms && typeof d.skch.rooms === 'object') b.skch.rooms = d.skch.rooms;
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

  store.exportText = function () { return JSON.stringify(store.state, null, 2); };
  store.importText = function (text) { store.state = store.normalize(JSON.parse(text)); store.save(); };
  store.reset = function () { store.state = store.blank(); store.save(); };

  K.store = store;
})(window.KCHP = window.KCHP || {});
