/* 推敲 (suikou) — 読者層の推定
 *
 * 「誰に向いた文章になっているか」を、文体の計量から逆算する。
 * 当てにいくのではなく、書き手が自分の文章を外から眺めるための鏡として使う。 */
(function (global) {
  'use strict';

  var S = global.Suikou;
  var T = S.text;
  var D = S.dict;
  var U = S.util;

  var A = (S.audience = {});

  /**
   * 語リストの出現数。複合語の一部（「不機嫌」の「嫌」、「彼女」の「彼」）は数えない。
   * @param {string} text 本文
   * @param {string[]} words 数える語
   * @returns {number} 独立した出現数
   */
  function countAny(text, words) {
    var n = 0;
    U.wordScan(text, words, {
      compoundGuard: true,
      guardTail: true,
      exclude: D.partialExclusions
    }, function () { n++; });
    return n;
  }

  function per1000(count, body) {
    return body ? (count / body) * 1000 : 0;
  }

  A.analyze = function (text, metrics, hashtags) {
    var body = metrics.body;
    if (body < 80) return null;

    /* ---- 軸の計算（0〜100） ---- */
    var styleTotal = metrics.style.polite + metrics.style.plain || 1;
    var politeRatio = metrics.style.polite / styleTotal;

    var casualCount = countAny(text, ['だよね', 'かな', 'じゃん', 'けど', 'なんか', 'めっちゃ', 'ヤバ', 'w',
      'てる', 'とか', 'ぽい', 'っぽ', '笑）', '（笑', '！！']);
    var casual = U.clamp(per1000(casualCount, body) * 7, 0, 100);

    var formality = U.clamp(
      (metrics.style.plain / styleTotal) * 45 + (metrics.kanjiRatio - 24) * 2.2 + metrics.abstractPer1000 * 1.6 - casual * 0.35 + 30,
      0, 100);

    var intimacy = U.clamp(politeRatio * 40 + per1000(countAny(text, D.addressive), body) * 9 + casual * 0.4, 0, 100);
    var introspection = U.clamp(per1000(countAny(text, D.introspective), body) * 2.6, 0, 100);
    var abstraction = U.clamp(metrics.abstractPer1000 * 4.5 + (metrics.kanjiRatio - 22) * 1.8, 0, 100);

    var concreteCount = 0;
    U.scan(text, /[0-9０-９]+|「[^」]{1,30}」|[ァ-ヶ]{3,}/g, function () { concreteCount++; });
    var specificity = U.clamp(per1000(concreteCount, body) * 5.5, 0, 100);

    var pos = countAny(text, D.polarity.positive);
    var neg = countAny(text, D.polarity.negative);
    var emotionTotal = pos + neg;
    var emotion = U.clamp(per1000(emotionTotal, body) * 6, 0, 100);
    // 感情語が数語しかないときの極性は当てにならないので中立として扱う
    var polarity = emotionTotal >= 4 ? U.round(((pos - neg) / emotionTotal) * 100, 0) : 0;

    var questions = 0;
    U.scan(text, /[？?]/g, function () { questions++; });
    var dialogic = U.clamp(per1000(questions, body) * 22 + per1000(countAny(text, D.addressive), body) * 8, 0, 100);

    var difficulty = U.round(100 - metrics.ease, 1);

    /* ---- ジャンル推定 ---- */
    var genres = D.genreProfiles.map(function (g) {
      var hit = 0;
      var matched = [];
      for (var i = 0; i < g.words.length; i++) {
        var c = 0;
        U.wordScan(text, [g.words[i]], {
          compoundGuard: true,
          guardTail: true,
          exclude: D.partialExclusions
        }, function () { c++; });
        if (c > 0) { hit += Math.min(c, 5); matched.push(g.words[i]); }
      }
      return { id: g.id, label: g.label, score: per1000(hit, body), matched: matched.slice(0, 6) };
    });
    genres.sort(function (a, b) { return b.score - a.score; });
    var maxScore = genres[0] ? genres[0].score : 0;
    genres.forEach(function (g) {
      g.percent = maxScore ? U.round((g.score / maxScore) * 100, 0) : 0;
    });

    /* ---- 年齢帯・読者像 ---- */
    var ageBands = [];
    if (metrics.ease >= 80 && casual > 25) ageBands.push('10代後半〜20代');
    if (metrics.ease >= 62 && metrics.ease < 88) ageBands.push('20代〜30代');
    if (metrics.ease < 62 && metrics.ease >= 44) ageBands.push('30代〜40代');
    if (metrics.ease < 44) ageBands.push('40代以上／読書量の多い層');
    if (!ageBands.length) ageBands.push('20代〜40代');

    var traits = [];
    if (introspection > 45) traits.push('自分の内側を言葉にすることに関心がある');
    if (abstraction > 55) traits.push('抽象的な議論を追える');
    if (specificity > 45) traits.push('具体的な描写や事実を好む');
    if (intimacy > 55) traits.push('語り手との距離が近いほうが心地よい');
    if (formality > 65) traits.push('硬質な文章を読み慣れている');
    if (emotion > 50) traits.push('感情の起伏に反応する');
    if (dialogic > 45) traits.push('問いかけられると考え込む');
    if (!traits.length) traits.push('特定の傾向に寄らない一般の読者');

    var scene;
    if (metrics.readingMinutes <= 3) scene = '移動中や休憩の合間にスマホで一気に読む';
    else if (metrics.readingMinutes <= 8) scene = '夜、腰を落ち着けてスマホで読む';
    else scene = '時間を確保して、あるいは何度かに分けて読む';

    /* ---- タグ候補 ---- */
    var kw = T.keywords(text, 10);
    var baseTag = {
      essay: 'エッセイ', diary: '日記', opinion: 'コラム', howto: '仕事', review: '感想',
      fiction: '小説', tech: 'プログラミング', business: 'キャリア', poem: '詩'
    }[genres[0] ? genres[0].id : 'essay'] || 'エッセイ';
    var tagSuggestions = ['#' + baseTag].concat(kw.slice(0, 5).map(function (k) { return '#' + k.word; }));
    tagSuggestions = U.uniq(tagSuggestions).filter(function (t) {
      return hashtags.indexOf(t.slice(1)) < 0 && hashtags.indexOf(t) < 0;
    });

    /* ---- ミスマッチ ---- */
    var mismatches = [];
    if (abstraction > 60 && specificity < 30) {
      mismatches.push('抽象度が高いのに具体物が少ないです。読者は「言っていることは分かるが像が浮かばない」状態になりやすいです。');
    }
    if (formality > 65 && casual > 35) {
      mismatches.push('硬い語彙と口語が混ざっています。どちらかに寄せると読者の像がはっきりします。');
    }
    if (difficulty > 60 && metrics.readingMinutes > 10) {
      mismatches.push('難度と長さが同時に高いです。読者に要求している集中力が大きいので、見出しで区切ってください。');
    }
    if (intimacy > 60 && introspection < 25) {
      mismatches.push('読者に近い口調ですが、書き手の内面がほとんど書かれていません。距離の近さが空回りする可能性があります。');
    }
    if (emotion > 60 && specificity < 30) {
      mismatches.push('感情語が多い一方で場面が少ないです。感情は説明より描写で伝わります。');
    }
    if (metrics.style.polite > 0 && metrics.style.plain > 0 &&
        Math.min(metrics.style.polite, metrics.style.plain) / styleTotal > 0.2) {
      mismatches.push('敬体と常体が両方使われています。読者が想定する語り手の人物像が揺れます。');
    }

    return {
      axes: [
        { key: 'formality', label: '硬さ', value: U.round(formality, 0), low: '口語・軽い', high: '硬質・書き言葉' },
        { key: 'intimacy', label: '距離の近さ', value: U.round(intimacy, 0), low: '突き放す', high: '寄り添う' },
        { key: 'introspection', label: '内省', value: U.round(introspection, 0), low: '外を見る', high: '内を見る' },
        { key: 'abstraction', label: '抽象度', value: U.round(abstraction, 0), low: '具体', high: '抽象' },
        { key: 'specificity', label: '具体物の密度', value: U.round(specificity, 0), low: '希薄', high: '濃い' },
        { key: 'emotion', label: '感情の量', value: U.round(emotion, 0), low: '静か', high: '激しい' },
        { key: 'dialogic', label: '対話性', value: U.round(dialogic, 0), low: '独白', high: '呼びかけ' },
        { key: 'difficulty', label: '読解の負荷', value: difficulty, low: 'やさしい', high: '難しい' }
      ],
      polarity: polarity,
      polarityLabel: polarity > 25 ? '肯定的' : polarity < -25 ? '否定的・陰りがある' : '中立・両価的',
      genres: genres,
      ageBands: ageBands,
      traits: traits,
      scene: scene,
      readingMinutes: metrics.readingMinutes,
      easeLabel: metrics.easeLabel,
      easeReader: metrics.easeReader,
      easeGrade: metrics.easeGrade,
      keywords: kw,
      tagSuggestions: tagSuggestions.slice(0, 6),
      mismatches: mismatches,
      summary: A.buildSummary({
        genres: genres, ageBands: ageBands, traits: traits, scene: scene,
        metrics: metrics, polarity: polarity, formality: formality, intimacy: intimacy
      })
    };
  };

  A.buildSummary = function (d) {
    var genre = d.genres[0] ? d.genres[0].label : 'エッセイ';
    var tone = d.formality > 60 ? '硬質な語り' : d.formality < 35 ? '話し言葉に近い語り' : '落ち着いた語り';
    var dist = d.intimacy > 55 ? '読者に近い距離' : d.intimacy < 30 ? '読者と距離を取った書き方' : '中間の距離';
    return genre + 'として、' + tone + '・' + dist + 'で書かれています。' +
      '読解の負荷は' + d.metrics.easeLabel + '（' + d.metrics.easeReader + '）、' +
      '想定読者は' + d.ageBands.join('・') + '。' +
      d.scene + '長さです（約' + d.metrics.readingMinutes + '分）。';
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
