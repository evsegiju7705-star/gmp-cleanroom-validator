/* ==========================================================================
   gmp-limits.js — справочник норм (шаг 2)
   Источники:
   • Приказ Минпромторга России от 14.06.2013 № 916, Приложение № 1 к Правилам
     (таблица классификации соответствует EU GMP Annex 1 редакции 2008 г.);
   • EU GMP Annex 1 «Manufacture of Sterile Medicinal Products», редакция 2022 г.,
     таблица 1 (классификация при квалификации);
   • ГОСТ Р ИСО 14644-1-2017 (ISO 14644-1:2015), таблица A.1.
   Значения null означают «не нормируется документом».
   ========================================================================== */
(function (root) {
  'use strict';
  var CRQ = root.CRQ = root.CRQ || {};

  var GRADES = ['A', 'B', 'C', 'D'];

  var STATES = {
    atRest:      { label: 'Оснащённое',      short: 'оснащённое' },
    inOperation: { label: 'Эксплуатируемое', short: 'эксплуатируемое' }
  };

  /* Предельная концентрация частиц, шт./м³: p05 — ≥ 0,5 мкм, p50 — ≥ 5,0 мкм */
  var STANDARDS = {
    mpt916: {
      id: 'mpt916',
      label: 'Приказ Минпромторга № 916, Приложение № 1',
      shortLabel: 'Приказ № 916',
      reference: 'Приложение № 1 к Правилам надлежащей производственной практики, таблица классификации чистых помещений',
      particles: {
        A: { atRest: { p05: 3520,    p50: 20    }, inOperation: { p05: 3520,    p50: 20    } },
        B: { atRest: { p05: 3520,    p50: 29    }, inOperation: { p05: 352000,  p50: 2900  } },
        C: { atRest: { p05: 352000,  p50: 2900  }, inOperation: { p05: 3520000, p50: 29000 } },
        D: { atRest: { p05: 3520000, p50: 29000 }, inOperation: { p05: null,    p50: null  } }
      },
      iso: {
        A: { atRest: 'ИСО 5 (ИСО 4.8 по частицам ≥ 5,0 мкм)', inOperation: 'ИСО 5 (ИСО 4.8 по частицам ≥ 5,0 мкм)' },
        B: { atRest: 'ИСО 5', inOperation: 'ИСО 7' },
        C: { atRest: 'ИСО 7', inOperation: 'ИСО 8' },
        D: { atRest: 'ИСО 8', inOperation: null }
      },
      notes: [
        'Для класса D в эксплуатируемом состоянии пределы документом не установлены — их задаёт производитель.',
        'Для класса A объём пробы в каждой точке — не менее 1 м³.',
        'Ориентир по перепаду давления между соседними помещениями разных классов — 10–15 Па.',
        'Ориентир по времени восстановления до оснащённого состояния — 15–20 мин после завершения операций.'
      ]
    },
    eu2022: {
      id: 'eu2022',
      label: 'EU GMP Annex 1 (редакция 2022 г.), таблица 1',
      shortLabel: 'EU GMP Annex 1 (2022)',
      reference: 'EU GMP Annex 1, 2022, Table 1 — Maximum permitted total particle concentration for classification',
      particles: {
        A: { atRest: { p05: 3520,    p50: null  }, inOperation: { p05: 3520,    p50: null  } },
        B: { atRest: { p05: 3520,    p50: null  }, inOperation: { p05: 352000,  p50: 2930  } },
        C: { atRest: { p05: 352000,  p50: 2930  }, inOperation: { p05: 3520000, p50: 29300 } },
        D: { atRest: { p05: 3520000, p50: 29300 }, inOperation: { p05: null,    p50: null  } }
      },
      iso: {
        A: { atRest: 'ИСО 5', inOperation: 'ИСО 5' },
        B: { atRest: 'ИСО 5', inOperation: 'ИСО 7' },
        C: { atRest: 'ИСО 7', inOperation: 'ИСО 8' },
        D: { atRest: 'ИСО 8', inOperation: null }
      },
      notes: [
        'При классификации частицы ≥ 5,0 мкм для класса A и для класса B в оснащённом состоянии не нормируются (таблица 1). Предел 29 шт./м³ относится к текущему мониторингу (таблица 5), а не к квалификации.',
        'Для класса D в эксплуатируемом состоянии пределы устанавливает производитель на основе оценки рисков.',
        'Ориентир по перепаду давления между соседними помещениями разных классов — не менее 10 Па.',
        'Ориентир по времени восстановления — 15–20 мин.'
      ]
    }
  };

  /* Ориентировочные проектные критерии. Документами GMP НЕ нормируются,
     пользователь обязан привести их к значениям из проекта / URS. */
  var DEFAULT_CRITERIA = {
    achMin:  { A: null, B: 40, C: 20, D: 10 },   // кратность, 1/ч; для A — однонаправленный поток, кратность не применяется
    dpMin:   10,                                  // Па
    tempMin: 18, tempMax: 25,                     // °C
    rhMin:   30, rhMax:   65                      // %
  };

  /* ГОСТ Р ИСО 14644-1-2017, таблица A.1: [площадь, м², не более; минимум точек отбора N_L] */
  var ISO_LOCATIONS = [
    [2, 1], [4, 2], [6, 3], [8, 4], [10, 5], [24, 6], [28, 7], [32, 8], [36, 9],
    [52, 10], [56, 11], [64, 12], [68, 13], [72, 14], [76, 15], [104, 16], [108, 17],
    [116, 18], [148, 19], [156, 20], [192, 21], [232, 22], [276, 23], [352, 24],
    [436, 25], [636, 26], [1000, 27]
  ];

  function getStandard(id) {
    return STANDARDS[id] || STANDARDS.mpt916;
  }

  /** Пределы по частицам: { p05: number|null, p50: number|null } */
  function getParticleLimits(standardId, grade, state) {
    var g = getStandard(standardId).particles[grade];
    if (!g || !g[state]) { return { p05: null, p50: null }; }
    return { p05: g[state].p05, p50: g[state].p50 };
  }

  /** Эквивалентный класс ИСО или null */
  function getIsoEquivalent(standardId, grade, state) {
    var g = getStandard(standardId).iso[grade];
    return g && g[state] ? g[state] : null;
  }

  /** Минимальное число точек отбора проб N_L по площади помещения, м² */
  function minSamplingLocations(area) {
    if (typeof area !== 'number' || !isFinite(area) || area <= 0) { return null; }
    for (var i = 0; i < ISO_LOCATIONS.length; i++) {
      if (area <= ISO_LOCATIONS[i][0]) { return ISO_LOCATIONS[i][1]; }
    }
    return Math.ceil(27 * area / 1000);
  }

  /** Минимальный объём одной пробы, л (ИСО 14644-1, A.4.4): V = 20 / C × 1000, но не менее 2 л */
  function minSampleVolumeLitres(limitPerM3) {
    if (typeof limitPerM3 !== 'number' || limitPerM3 <= 0) { return null; }
    return Math.max(2, 20 / limitPerM3 * 1000);
  }

  CRQ.gmp = {
    GRADES: GRADES,
    STATES: STATES,
    STANDARDS: STANDARDS,
    DEFAULT_CRITERIA: DEFAULT_CRITERIA,
    ISO_LOCATIONS: ISO_LOCATIONS,
    getStandard: getStandard,
    getParticleLimits: getParticleLimits,
    getIsoEquivalent: getIsoEquivalent,
    minSamplingLocations: minSamplingLocations,
    minSampleVolumeLitres: minSampleVolumeLitres
  };
})(typeof window !== 'undefined' ? window : globalThis);
