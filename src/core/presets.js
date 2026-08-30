/* 推敲 (suikou) — プリセットと設定の解決 */
(function (global) {
  'use strict';

  var S = global.Suikou;
  var C = (S.config = {});

  /* =========================================================
   * プリセット
   * ========================================================= */
  C.presets = [
    {
      id: 'essay-general',
      label: 'エッセイ（全年齢・標準）',
      description: '個人の随筆をnoteに載せる標準設定。校正は厳しく、表現は提案どまり。',
      rating: 'all-ages',
      style: 'auto',
      rules: {}
    },
    {
      id: 'essay-hard',
      label: '硬派な論考・評論',
      description: '常体で書く論考向け。冗長表現・ぼかし表現・抽象語に厳しくする。',
      rating: 'all-ages',
      style: 'dearu',
      rules: {
        'expr.hedge': { severity: 'warn', params: { per1000: 4 } },
        'expr.filler': { severity: 'info', params: { per1000: 3 } },
        'expr.verbose': { severity: 'warn' },
        'vocab.abstract': { severity: 'warn', params: { per1000: 8 } },
        'expr.long-sentence': { params: { warnAt: 55, errorAt: 90 } },
        'expr.inuki': { enabled: true, severity: 'warn' },
        'typo.ranuki': { severity: 'error' },
        'risk.assertion': { severity: 'warn' },
        'note.length': { params: { min: 2000, max: 8000 } },
        'vocab.monotone': { severity: 'info' }
      }
    },
    {
      id: 'diary',
      label: '日記・雑記（ゆるめ）',
      description: '気軽な更新向け。誤字と表記揺れだけ見て、表現には口を出さない。',
      rating: 'all-ages',
      style: 'auto',
      rules: {
        'expr.hedge': { enabled: false },
        'expr.filler': { enabled: false },
        'expr.intensifier': { enabled: false },
        'expr.verbose': { enabled: false },
        'expr.subject-distance': { enabled: false },
        'expr.demonstrative': { enabled: false },
        'expr.passive': { enabled: false },
        'vocab.abstract': { enabled: false },
        'vocab.diversity': { enabled: false },
        'vocab.senses': { enabled: false },
        'struct.opening': { enabled: false },
        'struct.closing': { enabled: false },
        'struct.rhythm': { enabled: false },
        'struct.heading': { enabled: false },
        'note.length': { enabled: false, params: { min: 400, max: 6000 } },
        'note.visual': { enabled: false },
        'typo.ranuki': { severity: 'hint' },
        'consistency.style': { params: { maxReports: 4 } },
        'expr.long-sentence': { params: { warnAt: 80, errorAt: 130 } }
      }
    },
    {
      id: 'novel-general',
      label: '小説（全年齢）',
      description: '地の文と会話文が混ざる原稿向け。文体・体言止め・句点の慣習を小説寄りに。',
      rating: 'all-ages',
      style: 'auto',
      rules: {
        'typo.quote-period': { enabled: true, severity: 'info' },
        'typo.missing-period': { enabled: false },
        'consistency.first-person': { severity: 'hint' },
        'consistency.style': { enabled: false },
        'expr.taigen': { enabled: false },
        'expr.long-sentence': { params: { warnAt: 80, errorAt: 140 } },
        'expr.subject-distance': { enabled: false },
        'expr.inuki': { enabled: false },
        'expr.hedge': { enabled: false },
        'expr.demonstrative': { enabled: false },
        'vocab.abstract': { enabled: false },
        'vocab.overused': { params: { per1000: 4 } },
        'vocab.senses': { severity: 'info' },
        'struct.paragraph': { params: { maxChars: 240, maxSentences: 8 } },
        'struct.opening': { severity: 'info' },
        'struct.heading': { enabled: false },
        'note.unsupported': { severity: 'info' },
        'note.length': { params: { min: 2000, max: 12000 } },
        'note.visual': { enabled: false },
        'typo.ranuki': { severity: 'info' },
        'risk.real-world': { severity: 'hint' }
      }
    },
    {
      id: 'novel-r18',
      label: '小説（R-18・成人向け）',
      description: '性的表現そのものは指摘しない。代わりに年齢設定・未成年描写・実在人物・表現の単調さを厳しく見る。',
      rating: 'r18',
      style: 'auto',
      rules: {
        'typo.quote-period': { enabled: true, severity: 'info' },
        'typo.missing-period': { enabled: false },
        'consistency.first-person': { severity: 'hint' },
        'consistency.style': { enabled: false },
        'expr.taigen': { enabled: false },
        'expr.long-sentence': { params: { warnAt: 90, errorAt: 150 } },
        'expr.subject-distance': { enabled: false },
        'expr.inuki': { enabled: false },
        'expr.hedge': { enabled: false },
        'expr.demonstrative': { enabled: false },
        'expr.near-repeat': { severity: 'warn', params: { window: 45, minLen: 2 } },
        'expr.ending-repeat': { severity: 'warn', params: { run: 3 } },
        'vocab.abstract': { enabled: false },
        'vocab.overused': { params: { per1000: 4 } },
        'vocab.senses': { severity: 'info' },
        'struct.paragraph': { params: { maxChars: 240, maxSentences: 8 } },
        'struct.heading': { enabled: false },
        'note.unsupported': { severity: 'info' },
        'note.length': { params: { min: 2000, max: 15000 } },
        'note.visual': { enabled: false },
        'note.title': { severity: 'hint' },
        'risk.consideration': { severity: 'hint' },
        'risk.real-world': { severity: 'warn' },
        'rating.minor-risk': { enabled: true, severity: 'error' },
        'rating.zoning': { enabled: true, severity: 'warn' },
        'rating.sensual-monotone': { enabled: true, severity: 'info' }
      }
    },
    {
      id: 'business',
      label: 'ビジネス・技術記事',
      description: '敬体で書く実用記事向け。曖昧さ・冗長さ・表記の不統一に厳しくする。',
      rating: 'all-ages',
      style: 'desu',
      rules: {
        'expr.inuki': { enabled: true, severity: 'warn' },
        'typo.ranuki': { severity: 'error' },
        'expr.hedge': { severity: 'warn', params: { per1000: 5 } },
        'expr.verbose': { severity: 'warn' },
        'expr.long-sentence': { params: { warnAt: 50, errorAt: 80 } },
        'consistency.variants': { severity: 'error' },
        'consistency.auto': { severity: 'error' },
        'consistency.number': { severity: 'warn' },
        'vocab.senses': { enabled: false },
        'struct.heading': { severity: 'warn', params: { requireAt: 1200, maxGap: 900 } },
        'note.visual': { severity: 'info' },
        'risk.assertion': { severity: 'warn' }
      }
    },
    {
      id: 'public-strict',
      label: '教育・公共向け（厳格）',
      description: '学校・自治体・企業広報など、誰が読んでも問題ないことを最優先にする設定。',
      rating: 'strict',
      style: 'desu',
      rules: {
        'typo.ranuki': { severity: 'error' },
        'expr.inuki': { enabled: true, severity: 'error' },
        'typo.symbol': { severity: 'error' },
        'risk.assertion': { severity: 'warn' },
        'risk.consideration': { severity: 'warn' },
        'risk.personal-info': { severity: 'error' },
        'rating.sensual': { severity: 'error' },
        'rating.violence': { severity: 'warn' },
        'expr.long-sentence': { params: { warnAt: 45, errorAt: 70 } },
        'struct.paragraph': { params: { maxChars: 120, maxSentences: 3 } }
      }
    },
    {
      id: 'minimal',
      label: '最小限（誤字だけ）',
      description: '執筆中に邪魔をされたくないとき用。明確な誤字と括弧の対応だけを見る。',
      rating: 'all-ages',
      style: 'auto',
      allOff: true,
      rules: {
        'typo.dict': { enabled: true },
        'typo.particle-dup': { enabled: true },
        'typo.bracket': { enabled: true },
        'typo.symbol': { enabled: true },
        'risk.personal-info': { enabled: true },
        'consistency.custom': { enabled: true },
        'risk.banned': { enabled: true }
      }
    }
  ];

  C.presetById = function (id) {
    for (var i = 0; i < C.presets.length; i++) {
      if (C.presets[i].id === id) return C.presets[i];
    }
    return C.presets[0];
  };

  /* =========================================================
   * 設定オブジェクト
   * ========================================================= */
  C.defaults = function () {
    return {
      presetId: 'essay-general',
      rating: 'all-ages',
      style: 'auto',
      rules: {},              // ruleId -> {enabled, severity, params}
      note: {
        paidArticle: false,
        paidMarker: '===有料ライン===',
        cps: 500,
        /* note への渡し方。rich = note用HTMLをコピー / WXR で書き出す（記法が生きる）。
         * plain = 文字だけで貼る（記号が本文に残るので、その前提で指摘する）。 */
        transfer: 'rich',
        author: ''
      },
      display: {
        theme: 'light',
        view: 'write',           // write | preview
        hideSuggestions: true,   // 候補を伏せる（自力で考えるモード）
        highlight: true,
        skipQuotes: true,        // 引用行・コードブロックを対象外にする
        maxIssues: 400,
        showResolved: false
      },
      ai: {
        enabled: false,
        endpoint: 'http://localhost:11434/v1/chat/completions',
        model: 'qwen2.5:14b',
        apiKey: '',
        temperature: 0.2,
        maxChars: 6000,
        allowRemoteForR18: false
      },
      allowUnify: false,        // 表記統一のみ一括置換を許可するか
      dictionary: {
        ignore: '',      // 誤検知させたくない語（固有名詞など）
        banned: '',      // 使わない語
        watch: '',       // 追加で検出したい語（レーティング用）
        preferred: '',   // 「正しい表記 = 誤り1, 誤り2」形式
        synonyms: ''     // 「語 = 候補1, 候補2」形式
      }
    };
  };

  /** プリセットを config に適用する（ユーザーの個別調整はリセットされる）。 */
  C.applyPreset = function (config, presetId) {
    var p = C.presetById(presetId);
    config.presetId = p.id;
    config.rating = p.rating;
    config.style = p.style;
    config.rules = {};
    if (p.allOff) {
      for (var i = 0; i < S.rules.length; i++) {
        config.rules[S.rules[i].id] = { enabled: false };
      }
    }
    Object.keys(p.rules).forEach(function (id) {
      var src = p.rules[id];
      var dst = config.rules[id] || (config.rules[id] = {});
      if (src.enabled !== undefined) dst.enabled = src.enabled;
      if (src.severity) dst.severity = src.severity;
      if (src.params) {
        dst.params = dst.params || {};
        Object.keys(src.params).forEach(function (k) { dst.params[k] = src.params[k]; });
      }
    });
    return config;
  };

  /** ルールの実効設定を返す。 */
  C.resolveRule = function (config, rule) {
    var over = config.rules[rule.id] || {};
    var params = {};
    for (var i = 0; i < rule.params.length; i++) {
      var def = rule.params[i];
      params[def.key] = over.params && over.params[def.key] !== undefined ? over.params[def.key] : def.value;
    }
    var enabled = over.enabled !== undefined ? over.enabled : rule.enabled;
    if (rule.ratings && rule.ratings.indexOf(config.rating) < 0) enabled = false;
    return {
      enabled: enabled,
      severity: over.severity || rule.severity,
      params: params
    };
  };

  /* =========================================================
   * ユーザー辞書のパース
   * ========================================================= */
  C.parseDictionary = function (dict) {
    var U = S.util;
    var out = {
      ignore: U.parseLines(dict.ignore),
      banned: U.parseLines(dict.banned),
      watchWords: U.parseLines(dict.watch),
      preferred: [],
      synonyms: {}
    };
    U.parseLines(dict.preferred).forEach(function (line) {
      var parts = line.split(/\s*[=＝]\s*/);
      if (parts.length < 2) return;
      var variants = parts[1].split(/\s*[,、]\s*/).filter(function (v) { return v; });
      if (!parts[0] || !variants.length) return;
      out.preferred.push({ preferred: parts[0], variants: variants });
    });
    U.parseLines(dict.synonyms).forEach(function (line) {
      var parts = line.split(/\s*[=＝]\s*/);
      if (parts.length < 2) return;
      var cands = parts[1].split(/\s*[,、]\s*/).filter(function (v) { return v; });
      if (!parts[0] || !cands.length) return;
      out.synonyms[parts[0]] = cands;
    });
    return out;
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
