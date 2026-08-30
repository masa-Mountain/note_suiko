/* 推敲 (suikou) — 計量と可読性 */
(function (global) {
  'use strict';

  var S = global.Suikou;
  var T = S.text;
  var U = S.util;

  var M = (S.metrics = {});

  M.EASE_LEVELS = [
    { min: 88, label: '非常にやさしい', reader: '小学校高学年でも読める', grade: '小5〜小6' },
    { min: 76, label: 'やさしい', reader: '中学生が無理なく読める', grade: '中1〜中3' },
    { min: 62, label: '標準', reader: '高校生以上の一般読者', grade: '高1〜高3' },
    { min: 48, label: 'やや硬い', reader: '読書習慣のある成人', grade: '大学教養' },
    { min: 34, label: '硬い', reader: '関心のある読者・専門読者', grade: '大学専門' },
    { min: -999, label: '非常に硬い', reader: '同分野の読者に限られる', grade: '専門' }
  ];

  M.compute = function (text, title, config) {
    var sentences = T.splitSentences(text);
    var paragraphs = T.splitParagraphs(text);
    var stats = T.charStats(text);
    var body = stats.body;

    var lens = sentences.map(function (s) {
      return s.text.replace(/[\s\u3000]/g, '').length;
    });
    var sum = lens.reduce(function (a, b) { return a + b; }, 0);
    var avgLen = lens.length ? sum / lens.length : 0;
    var maxLen = lens.length ? Math.max.apply(null, lens) : 0;
    var mean = avgLen;
    var sd = lens.length
      ? Math.sqrt(lens.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / lens.length)
      : 0;

    var words = T.contentWords(text);
    var uniqCount = Object.keys(T.frequency(words)).length;
    var ttr = words.length ? (uniqCount / words.length) * 100 : 0;

    var polite = 0, plain = 0, taigen = 0, other = 0;
    for (var i = 0; i < sentences.length; i++) {
      switch (T.endingStyle(sentences[i].text)) {
        case 'polite': polite++; break;
        case 'plain': plain++; break;
        case 'taigen': taigen++; break;
        default: other++; break;
      }
    }

    var kanjiRatio = body ? stats.kanji / body : 0;
    var kanaRatio = body ? stats.hiragana / body : 0;
    var katakanaRatio = body ? stats.katakana / body : 0;

    var abstractCount = 0;
    U.scan(text, /[\u4E00-\u9FFF]{2,}(?:性|化|的|論|主義)/g, function () { abstractCount++; });
    var abstractPer1000 = body ? (abstractCount / body) * 1000 : 0;

    var commas = 0;
    U.scan(text, /[、,]/g, function () { commas++; });

    var cps = (config && config.note && config.note.cps) || 500;
    /* 96 を上限の基準点にしている。満点が簡単に出ると指標として役に立たないため。 */
    var ease = 96
      - Math.max(0, avgLen - 24) * 0.9
      - Math.max(0, kanjiRatio * 100 - 27) * 1.5
      - Math.max(0, katakanaRatio * 100 - 10) * 0.7
      - Math.max(0, maxLen - 80) * 0.06
      - abstractPer1000 * 0.5;
    ease = U.clamp(ease, 0, 100);

    var level = M.EASE_LEVELS[M.EASE_LEVELS.length - 1];
    for (var k = 0; k < M.EASE_LEVELS.length; k++) {
      if (ease >= M.EASE_LEVELS[k].min) { level = M.EASE_LEVELS[k]; break; }
    }

    return {
      title: title || '',
      titleLength: (title || '').length,
      chars: text.length,
      body: body,
      sheets: U.round(body / 400, 2),
      sentences: sentences.length,
      paragraphs: paragraphs.length,
      avgSentence: U.round(avgLen, 1),
      maxSentence: maxLen,
      sdSentence: U.round(sd, 1),
      cvSentence: mean ? U.round(sd / mean, 2) : 0,
      kanjiRatio: U.round(kanjiRatio * 100, 1),
      kanaRatio: U.round(kanaRatio * 100, 1),
      katakanaRatio: U.round(katakanaRatio * 100, 1),
      latinRatio: U.round(body ? (stats.latin / body) * 100 : 0, 1),
      digitRatio: U.round(body ? (stats.digit / body) * 100 : 0, 1),
      ttr: U.round(ttr, 1),
      contentWords: words.length,
      uniqueWords: uniqCount,
      commas: commas,
      commaPerSentence: sentences.length ? U.round(commas / sentences.length, 2) : 0,
      style: { polite: polite, plain: plain, taigen: taigen, other: other },
      abstractPer1000: U.round(abstractPer1000, 1),
      readingMinutes: Math.max(1, Math.round(body / cps)),
      mora: T.countMora(text),
      ease: U.round(ease, 1),
      easeLabel: level.label,
      easeReader: level.reader,
      easeGrade: level.grade,
      paragraphProfile: paragraphs.map(function (p) {
        var pb = p.text.replace(/[\s\u3000]/g, '').length;
        var ps = T.charStats(p.text);
        var pSent = T.splitSentences(p.text);
        var pLens = pSent.map(function (x) { return x.text.replace(/[\s\u3000]/g, '').length; });
        var pAvg = pLens.length ? pLens.reduce(function (a, b) { return a + b; }, 0) / pLens.length : 0;
        var load = U.clamp((pb / 160) * 45 + (pAvg / 60) * 35 + (pb ? (ps.kanji / pb) : 0) * 100 * 0.7, 0, 100);
        return {
          start: p.start,
          end: p.end,
          chars: pb,
          sentences: pSent.length,
          kanjiRatio: pb ? U.round((ps.kanji / pb) * 100, 1) : 0,
          avgSentence: U.round(pAvg, 1),
          load: U.round(load, 0),
          preview: p.text.slice(0, 28)
        };
      })
    };
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
