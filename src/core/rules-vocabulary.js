/* 推敲 (suikou) — 語彙の単調さと言い換え提案
 * 候補は「参考」として並べるだけで、選ぶのは書き手。 */
(function (global) {
  'use strict';

  var S = global.Suikou;
  var T = S.text;
  var D = S.dict;
  var U = S.util;

  /* ---------------- 頻出語（内容語） ---------------- */
  S.registerRule({
    id: 'vocab.overused',
    name: '同じ語に頼りすぎている',
    category: 'vocabulary',
    severity: 'info',
    description: '本文全体で頻度の高い内容語を挙げます。キーワードなら問題なし、そうでないなら語彙が細っています。',
    params: [
      { key: 'per1000', label: '1000文字あたりの許容回数', type: 'number', value: 5, min: 1, max: 30, step: 1 },
      { key: 'minCount', label: '最低出現回数', type: 'number', value: 4, min: 2, max: 30, step: 1 }
    ],
    run: function (ctx, add, params) {
      var body = ctx.text.replace(/[\s\u3000]/g, '').length;
      if (body < 300) return;
      var allowed = Math.max(params.minCount, Math.round((body / 1000) * params.per1000));
      var freq = T.frequency(T.contentWords(ctx.text));
      Object.keys(freq).forEach(function (word) {
        var entry = freq[word];
        if (entry.count < allowed) return;
        var pos = entry.positions[entry.positions.length - 1];
        add({
          start: pos.start, end: pos.end,
          message: '「' + word + '」が ' + entry.count + ' 回出てきます（目安 ' + allowed + ' 回）。',
          advice: 'この語が記事の主題なら回数は問題ではありません。そうでない場合、同じ語で説明を回している可能性があります。',
          suggestions: D.synonyms[word] || null
        });
      });
    }
  });

  /* ---------------- 単調語の言い換え ---------------- */
  S.registerRule({
    id: 'vocab.monotone',
    name: '言い換えの候補がある語',
    category: 'vocabulary',
    severity: 'hint',
    description: '「すごい」「思う」「見る」など、輪郭のぼやけやすい語に言い換え候補を出します。',
    params: [
      { key: 'minCount', label: '何回目から提案するか', type: 'number', value: 2, min: 1, max: 10, step: 1 },
      { key: 'maxPerWord', label: '1語あたりの提案上限', type: 'number', value: 3, min: 1, max: 20, step: 1 }
    ],
    run: function (ctx, add, params) {
      var keys = Object.keys(D.synonyms);
      var extra = ctx.dictionary.synonyms;
      Object.keys(extra).forEach(function (k) {
        if (keys.indexOf(k) < 0) keys.push(k);
      });
      for (var i = 0; i < keys.length; i++) {
        var word = keys[i];
        var hits = [];
        U.scan(ctx.text, new RegExp(U.escapeRegExp(word), 'g'), function (m, idx) {
          hits.push({ start: idx, end: idx + m[0].length });
        });
        if (hits.length < params.minCount) continue;
        var cands = (extra[word] || []).concat(D.synonyms[word] || []);
        var limit = Math.min(hits.length, params.maxPerWord);
        for (var h = 0; h < limit; h++) {
          add({
            start: hits[h].start, end: hits[h].end,
            message: '「' + word + '」が ' + hits.length + ' 回。ここは言い換えられます。',
            advice: '候補をそのまま使うのではなく、「自分ならどう言うか」を一度考えてみてください。',
            suggestions: cands.length ? cands : null
          });
        }
      }
    }
  });

  /* ---------------- 抽象語の多用 ---------------- */
  S.registerRule({
    id: 'vocab.abstract',
    name: '抽象語・漢語の多用',
    category: 'vocabulary',
    severity: 'info',
    description: '「〜性」「〜化」「〜的」「〜論」で組み立てた文は、意味が薄いまま重く見えます。',
    params: [{ key: 'per1000', label: '1000文字あたりの上限', type: 'number', value: 10, min: 2, max: 40, step: 1 }],
    run: function (ctx, add, params) {
      var body = ctx.text.replace(/[\s\u3000]/g, '').length;
      if (body < 300) return;
      var hits = [];
      U.scan(ctx.text, /[\u4E00-\u9FFF]{2,}(?:性|化|的|論|主義|システム|メカニズム)/g, function (m, idx) {
        hits.push({ start: idx, end: idx + m[0].length, text: m[0] });
      });
      var allowed = Math.max(2, Math.round((body / 1000) * params.per1000));
      if (hits.length <= allowed) return;
      for (var i = allowed; i < hits.length; i++) {
        add({
          start: hits[i].start, end: hits[i].end,
          message: '抽象語が多いです（「' + hits[i].text + '」ほか ' + hits.length + ' 語 / 目安 ' + allowed + ' 語）。',
          advice: 'この語を、具体的な場面・人・動作に置き換えられませんか。エッセイで効くのはほとんど具体のほうです。'
        });
      }
    }
  });

  /* ---------------- 五感の偏り ---------------- */
  var SENSES = {
    視覚: ['見', '眺', '光', '影', '色', '白', '黒', '赤', '青', '暗', '明る', '眩', '姿', '景色', '風景', '瞳', '目'],
    聴覚: ['聞', '聴', '音', '声', '響', '静寂', '騒', '囁', '鳴', '沈黙', '足音', '軋'],
    触覚: ['触', '冷た', '温か', '硬', '柔ら', '肌', '痛', '重', '軽', '濡れ', '乾', '風が', 'ざらつ'],
    嗅覚: ['匂', '香', '臭', '薫', '嗅'],
    味覚: ['味', '甘', '苦', '辛', '酸', '塩', '食べ', '飲', '喉']
  };

  S.registerRule({
    id: 'vocab.senses',
    name: '五感の使い方',
    category: 'vocabulary',
    severity: 'hint',
    description: '描写が視覚に偏っていないかを見ます。エッセイでは音・匂い・触感が効きます。',
    params: [{ key: 'minLength', label: '判定する最小文字数', type: 'number', value: 600, min: 200, max: 5000, step: 100 }],
    run: function (ctx, add, params) {
      var body = ctx.text.replace(/[\s\u3000]/g, '').length;
      if (body < params.minLength) return;
      var counts = {};
      var total = 0;
      Object.keys(SENSES).forEach(function (sense) {
        var n = 0;
        U.scan(ctx.text, U.alternation(SENSES[sense]), function () { n++; });
        counts[sense] = n;
        total += n;
      });
      if (total < 6) {
        add({
          start: 0, end: Math.min(20, ctx.text.length),
          message: '感覚に触れる語がほとんどありません（全 ' + total + ' 語）。',
          advice: '説明だけで進んでいる可能性があります。一箇所でも、見えたもの・聞こえた音を入れると温度が変わります。'
        });
        return;
      }
      var weak = Object.keys(SENSES).filter(function (s) { return counts[s] === 0; });
      if (counts['視覚'] / total > 0.7 && weak.length >= 2) {
        add({
          start: 0, end: Math.min(20, ctx.text.length),
          message: '描写が視覚に偏っています（視覚 ' + counts['視覚'] + ' / 全 ' + total + '。' + weak.join('・') + ' はゼロ）。',
          advice: '匂いと音は、読者の記憶に最も残る二つです。一行だけ足してみてください。'
        });
      }
    }
  });

  /* ---------------- 語彙の多様性 ---------------- */
  S.registerRule({
    id: 'vocab.diversity',
    name: '語彙の多様性',
    category: 'vocabulary',
    severity: 'hint',
    description: '異なり語数の比率（TTR）が低いときに知らせます。',
    params: [{ key: 'threshold', label: '下限（%）', type: 'number', value: 42, min: 10, max: 90, step: 1 }],
    run: function (ctx, add, params) {
      var words = T.contentWords(ctx.text);
      if (words.length < 80) return;
      var uniqCount = Object.keys(T.frequency(words)).length;
      var ttr = (uniqCount / words.length) * 100;
      if (ttr < params.threshold) {
        add({
          start: 0, end: Math.min(20, ctx.text.length),
          message: '語彙の多様性が低めです（異なり語比 ' + U.round(ttr, 1) + '% / 目安 ' + params.threshold + '%以上）。',
          advice: '同じ語で説明を反復している可能性があります。「指摘」タブの頻出語も見てください。'
        });
      }
    }
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
