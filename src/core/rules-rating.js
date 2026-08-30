/* 推敲 (suikou) — レーティング／ゾーニング／リスクのルール
 *
 * レーティングは「strict（全年齢・厳格）」「all-ages（全年齢）」「r18（成人向け）」の3段。
 * r18 では性的表現そのものを問題にせず、規約・法令リスクと表現の単調さを見る。 */
(function (global) {
  'use strict';

  var S = global.Suikou;
  var R = S.rating;
  var U = S.util;

  /* レーティング系のマーカーは短い語が多く、そのまま部分一致させると
   * 「慢性的」の中の「性的」のような誤検知が出る。複合語ガードと除外語で潰す。 */
  var GUARD = { compoundGuard: true, exclude: R.exclusions };

  function markerRule(opts) {
    S.registerRule({
      id: opts.id,
      name: opts.name,
      category: opts.category || 'rating',
      severity: opts.severity,
      enabled: opts.enabled !== false,
      ratings: opts.ratings,
      description: opts.description,
      run: function (ctx, add) {
        var words = opts.words.concat(ctx.dictionary.watchWords || []);
        var sev = opts.severityByRating && opts.severityByRating[ctx.config.rating];
        U.wordScan(ctx.text, words, GUARD, function (m, idx) {
          add({
            start: idx, end: idx + m[0].length,
            severity: sev || opts.severity,
            message: opts.message.replace('{word}', m[0]),
            advice: opts.advice
          });
        });
      }
    });
  }

  /* ---------------- 性的表現（全年齢モードのみ） ---------------- */
  markerRule({
    id: 'rating.sensual',
    name: '性的な気配のある表現',
    words: R.sensualMarkers,
    ratings: ['strict', 'all-ages'],
    severity: 'warn',
    severityByRating: { strict: 'error', 'all-ages': 'warn' },
    description: '全年齢向けの設定で、性的に読まれうる語を拾います。R-18 モードでは動きません。',
    message: '「{word}」は全年齢向けとしては注意が必要です。',
    advice: '示唆にとどめる、視点をずらす、時間を飛ばす。この三つで多くの場面は書けます。削る必要はありません。'
  });

  /* ---------------- 暴力表現 ---------------- */
  markerRule({
    id: 'rating.violence',
    name: '暴力・残酷表現',
    words: R.violenceMarkers,
    severity: 'info',
    severityByRating: { strict: 'warn', 'all-ages': 'info', r18: 'hint' },
    description: 'レーティングに応じて、暴力・残酷描写の語を拾います。',
    message: '「{word}」— 暴力表現です。',
    advice: '設定したレーティングに対して強すぎないかを確認してください。冒頭に注意書きが必要な場合もあります。'
  });

  /* ---------------- 違法行為 ---------------- */
  markerRule({
    id: 'rating.illegal',
    name: '違法行為の描写',
    words: R.illegalMarkers,
    severity: 'info',
    description: '薬物・犯罪の手口に触れる語を拾います。',
    message: '「{word}」— 違法行為に関わる語です。',
    advice: '手順として読めるほど具体的だと、プラットフォームの規約に触れる場合があります。物語上の必要とのバランスを見てください。'
  });

  /* ---------------- 自傷・自死 ---------------- */
  S.registerRule({
    id: 'rating.self-harm',
    name: '自傷・自死の描写',
    category: 'rating',
    severity: 'warn',
    description: '自傷・自死に触れる語を検出し、配慮の観点を示します。表現を止めるためのものではありません。',
    run: function (ctx, add) {
      var hits = [];
      U.wordScan(ctx.text, R.selfHarmMarkers, GUARD, function (m, idx) {
        hits.push({ start: idx, end: idx + m[0].length, text: m[0] });
      });
      if (!hits.length) return;
      var hasNotice = /相談|窓口|いのち|ダイヤル|一人で抱え|専門家|支援/.test(ctx.text);
      add({
        start: hits[0].start, end: hits[0].end,
        severity: hasNotice ? 'info' : 'warn',
        message: '自傷・自死に触れる語が ' + hits.length + ' 箇所あります（「' + hits[0].text + '」など）。',
        advice: hasNotice
          ? '相談先への言及があります。冒頭にも注意書きを置くかを検討してください。'
          : '手段の具体的な描写を避け、記事末に相談窓口を添える形が広く採られています。作品として必要な描写を削る必要はありません。'
      });
    }
  });

  /* ---------------- R-18: 未成年描写との共起（最重要） ---------------- */
  S.registerRule({
    id: 'rating.minor-risk',
    name: '未成年を示す表現との共起',
    category: 'rating',
    severity: 'error',
    ratings: ['r18'],
    description: '性的な文脈と未成年を示す語が近接している箇所を検出します。R-18 モードで最も優先度の高い検査です。',
    params: [{ key: 'window', label: '共起とみなす距離（文字）', type: 'number', value: 400, min: 100, max: 2000, step: 50 }],
    run: function (ctx, add, params) {
      var minors = [];
      U.scan(ctx.text, U.alternation(R.minorMarkers), function (m, idx) {
        minors.push({ start: idx, end: idx + m[0].length, text: m[0] });
      });
      if (!minors.length) return;
      var sensual = [];
      var watch = R.sensualMarkers.concat(ctx.dictionary.watchWords || []);
      U.wordScan(ctx.text, watch, GUARD, function (m, idx) {
        sensual.push({ start: idx, end: idx + m[0].length, text: m[0] });
      });
      if (!sensual.length) return;
      var declared = /(?:18歳以上|十八歳以上|成人|大学生以上|全員成人)/.test(ctx.text.slice(0, 600));
      for (var i = 0; i < minors.length; i++) {
        var near = null;
        for (var j = 0; j < sensual.length; j++) {
          if (Math.abs(sensual[j].start - minors[i].start) <= params.window) { near = sensual[j]; break; }
        }
        if (!near) continue;
        add({
          start: minors[i].start, end: minors[i].end,
          severity: declared ? 'warn' : 'error',
          message: '「' + minors[i].text + '」の近くに性的な文脈（「' + near.text + '」）があります。',
          advice: declared
            ? '冒頭に成人であることの記載はありますが、この語は誤読を招きます。学齢を示す語を避けるか、年齢の明示を近くに置いてください。'
            : '未成年を想起させる語と性的表現の共起は、note の規約および法令上の重大なリスクです。学齢を示す語を外し、登場人物が18歳以上であることを本文または前書きで明示してください。'
        });
      }
    }
  });

  /* ---------------- R-18: ゾーニング ---------------- */
  S.registerRule({
    id: 'rating.zoning',
    name: 'ゾーニングの確認',
    category: 'rating',
    severity: 'warn',
    ratings: ['r18'],
    description: '年齢制限の告知、冒頭の注意書き、タグの有無を確認します。',
    run: function (ctx, add) {
      var head = ctx.text.slice(0, 400);
      var noticeRe = /(?:R-?18|年齢制限|18歳未満|十八歳未満|成人向け|閲覧注意|センシティブ|注意書き)/;
      if (!noticeRe.test(head)) {
        add({
          start: 0, end: Math.min(30, ctx.text.length),
          message: '冒頭 400 字に年齢制限の注意書きが見つかりません。',
          advice: '一覧カードと検索結果には冒頭が誰にでも表示されます。冒頭に注意書きを置き、note 側の記事設定でも年齢制限を有効にしてください。'
        });
      }
      var tagText = ctx.hashtags.join(' ');
      if (!/R-?18|大人|成人|センシティブ|官能/i.test(tagText)) {
        add({
          start: 0, end: 0, severity: 'info',
          message: 'タグに成人向けを示すものがありません。',
          advice: '読者側のフィルタが効くよう、識別できるタグを付けてください。'
        });
      }
      var freeHead = ctx.text.slice(0, 150);
      var strong = false;
      U.wordScan(freeHead, R.sensualMarkers.concat(ctx.dictionary.watchWords || []), GUARD, function () { strong = true; });
      if (strong) {
        add({
          start: 0, end: Math.min(150, ctx.text.length), severity: 'warn',
          message: '冒頭 150 字に直接的な語があります。',
          advice: 'この範囲は一覧カード・検索結果・SNS シェアで全年齢に露出します。前書きや注意書きを先に置いてください。'
        });
      }
    }
  });

  /* ---------------- R-18: 表現の単調さ ---------------- */
  S.registerRule({
    id: 'rating.sensual-monotone',
    name: '官能表現の単調さ',
    category: 'rating',
    severity: 'hint',
    ratings: ['r18'],
    description: '同じ感覚語の反復を拾い、言い換えの方向を示します（候補は参考です）。',
    params: [{ key: 'minCount', label: '何回目から提案するか', type: 'number', value: 3, min: 2, max: 20, step: 1 }],
    run: function (ctx, add, params) {
      var keys = Object.keys(R.sensualSynonyms);
      for (var i = 0; i < keys.length; i++) {
        var word = keys[i];
        var hits = [];
        U.scan(ctx.text, new RegExp(U.escapeRegExp(word), 'g'), function (m, idx) {
          hits.push({ start: idx, end: idx + m[0].length });
        });
        if (hits.length < params.minCount) continue;
        add({
          start: hits[hits.length - 1].start, end: hits[hits.length - 1].end,
          message: '「' + word + '」が ' + hits.length + ' 回出てきます。',
          advice: '同じ語を繰り返すと、場面が進んでいる感覚が失われます。感覚の対象を変える（音→温度→時間の感覚）と密度が上がります。',
          suggestions: R.sensualSynonyms[word]
        });
      }
    }
  });

  /* ---------------- 実在の人物・団体 ---------------- */
  S.registerRule({
    id: 'risk.real-world',
    name: '実在の人物・団体への言及',
    category: 'risk',
    severity: 'info',
    description: '特定の人や組織を指しうる語を拾います。エッセイで最も事故が起きやすい箇所です。',
    params: [{ key: 'maxReports', label: '指摘の上限', type: 'number', value: 8, min: 1, max: 50, step: 1 }],
    run: function (ctx, add, params) {
      var hits = [];
      U.wordScan(ctx.text, R.realWorldMarkers, GUARD, function (m, idx) {
        hits.push({ start: idx, end: idx + m[0].length, text: m[0] });
      });
      var limit = Math.min(hits.length, params.maxReports);
      for (var i = 0; i < limit; i++) {
        add({
          start: hits[i].start, end: hits[i].end,
          message: '「' + hits[i].text + '」— 実在の人物・団体を特定できませんか。',
          advice: '当人が読んだときに困らないか。第三者が誰のことか分かってしまわないか。この二点だけ確認してください。'
        });
      }
    }
  });

  /* ---------------- 個人情報 ---------------- */
  S.registerRule({
    id: 'risk.personal-info',
    name: '個人情報の混入',
    category: 'risk',
    severity: 'error',
    description: '電話番号・メールアドレス・住所などの混入を検出します。',
    run: function (ctx, add) {
      for (var i = 0; i < R.personalInfoPatterns.length; i++) {
        var p = R.personalInfoPatterns[i];
        (function (p) {
          U.scan(ctx.text, p.re, function (m, idx) {
            add({
              start: idx, end: idx + m[0].length,
              severity: p.id === 'account' ? 'info' : 'error',
              message: p.label + 'が含まれています。',
              advice: p.id === 'account'
                ? '意図した言及ならそのままで構いません。'
                : '公開後の削除は間に合いません。掲載の必要が本当にあるか確認してください。'
            });
          });
        })(p);
      }
    }
  });

  /* ---------------- 配慮表現 ---------------- */
  S.registerRule({
    id: 'risk.consideration',
    name: '配慮したい表現',
    category: 'risk',
    severity: 'info',
    description: '報道・出版の用語集で言い換えが示されている語に、代案を添えます。文脈によっては原語が適切です。',
    run: function (ctx, add) {
      /* 「主人」が「主人公」に当たるような取り違えを避けるため、
       * 語の前後が漢字で続く場合は複合語として扱って捨てる。 */
      var guard = { compoundGuard: true, guardTail: true, exclude: R.exclusions };
      for (var i = 0; i < R.consideration.length; i++) {
        var c = R.consideration[i];
        (function (c) {
          U.wordScan(ctx.text, [c.word], guard, function (m, idx) {
            add({
              start: idx, end: idx + m[0].length,
              message: '「' + c.word + '」には言い換えの慣行があります。',
              advice: (c.note || '') + ' 会話文・当事者の自称・作品の時代設定では原語のままが適切な場合もあります。',
              suggestions: [c.suggest]
            });
          });
        })(c);
      }
    }
  });

  /**
   * 「必ず医師の指示に従って」のような、残すべき注意書きか。
   * @param {string} text 本文
   * @param {number} idx 「必ず」の位置
   * @returns {boolean} 注意書きなら true
   */
  function _isRequiredInstruction(text, idx) {
    var win = text.slice(Math.max(0, idx - 24), idx + 28);
    return /医師|医者|厳禁|禁止|指示に従|自己判断/.test(win);
  }

  /* ---------------- 断定と煽り ---------------- */
  S.registerRule({
    id: 'risk.assertion',
    name: '根拠のない断定',
    category: 'risk',
    severity: 'info',
    description: '「絶対」「誰でも」「100%」など、裏づけを要求される断定を拾います。',
    run: function (ctx, add) {
      var words = ['絶対に', '必ず', '100%', '誰でも', 'すべての人', '間違いなく', '確実に儲',
        '一切', '例外なく', '常識です', '当然です', '科学的に証明', '医学的に'];
      var strict = ctx.config.rating === 'strict';
      U.scan(ctx.text, U.alternation(words), function (m, idx) {
        if (m[0] === '必ず' && _isRequiredInstruction(ctx.text, idx)) return;
        add({
          start: idx, end: idx + m[0].length,
          severity: strict ? 'warn' : 'info',
          message: '「' + m[0] + '」— 断定の強い表現です。',
          advice: '出典を示すか、範囲を限定するか、経験としての記述に直すか。エッセイなら三つめが自然です。'
        });
      });
    }
  });

  /* ---------------- ユーザー禁止語 ---------------- */
  S.registerRule({
    id: 'risk.banned',
    name: 'ユーザー禁止語',
    category: 'risk',
    severity: 'error',
    description: '「設定 > ユーザー辞書 > 使わない語」に登録した語を検出します。',
    run: function (ctx, add) {
      var words = ctx.dictionary.banned;
      if (!words.length) return;
      U.scan(ctx.text, U.alternation(words), function (m, idx) {
        add({
          start: idx, end: idx + m[0].length,
          message: '自分で禁止した語です（「' + m[0] + '」）。',
          advice: 'ユーザー辞書の「使わない語」に登録されています。'
        });
      });
    }
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
