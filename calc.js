/* ==========================================================================
   calc.js — расчёты и форматирование чисел
   Шаг 2: разбор/формат чисел, объём помещения.
   Шаг 3: суммарный расход, кратность воздухообмена, средние по частицам,
          оценка соответствия.
   ========================================================================== */
(function (root) {
  'use strict';
  var CRQ = root.CRQ = root.CRQ || {};

  function isNum(v) {
    return typeof v === 'number' && isFinite(v);
  }

  /** «12,5» / «12.5» / «1 250» → число; пустая или некорректная строка → null */
  function parseNumber(text) {
    if (text === null || text === undefined) { return null; }
    var s = String(text).replace(/[\s\u00A0\u202F]/g, '').replace(',', '.');
    if (s === '' || !/^-?\d+(\.\d+)?$/.test(s)) { return null; }
    var n = Number(s);
    return isFinite(n) ? n : null;
  }

  /** Число → строка с десятичной запятой и разделителями разрядов; null → «—» */
  function formatNumber(value, digits) {
    if (!isNum(value)) { return '—'; }
    var d = (typeof digits === 'number') ? digits : 0;
    return value.toLocaleString('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  /** Число → строка для поля ввода (без разделителей разрядов) */
  function toInput(value) {
    return isNum(value) ? String(value).replace('.', ',') : '';
  }

  /** Объём помещения, м³ = площадь × высота; null, если данных нет */
  function volume(area, height) {
    if (!isNum(area) || !isNum(height) || area <= 0 || height <= 0) { return null; }
    return area * height;
  }

  CRQ.calc = {
    isNum: isNum,
    parseNumber: parseNumber,
    formatNumber: formatNumber,
    toInput: toInput,
    volume: volume
  };
})(typeof window !== 'undefined' ? window : globalThis);
