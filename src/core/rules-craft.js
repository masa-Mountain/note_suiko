/* 推敲 (suikou) — 執筆癖の指摘（言い換え二周・抽象タイトル） */
(function (global) {
  'use strict';

  var S = global.Suikou;
  var U = S.util;

  /**
   * @param {string} text 本文
   * @returns {number} 空白を除いた文字数
   */
  function _bodyLen(text) {
    return text.replace(/[\s\u3000]/g, '').length;
  }

  /**
   * @param {Object} cfg 設定
   * @returns {boolean} 個人レイヤがオンか
   */
  function _strict(cfg) {
    return !!(cfg && cfg.craftStrict);
  }

  S.craftUtil = {
    bodyLen: _bodyLen,
    strict: _strict,
    /**
     * @param {string[]} base 汎用語
     * @param {string[]} extra strict 用
     * @param {boolean} on craftStrict
     * @returns {string[]} 使う語
     */
    words: function (base, extra, on) {
      return on ? base.concat(extra || []) : base.slice();
    },
    /**
     * @param {boolean} on craftStrict
     * @param {string} soft 既定
     * @param {string} hard 厳しめ
     * @returns {string} 深刻度
     */
    sev: function (on, soft, hard) {
      return on ? hard : soft;
    }
  };

  S.registerRule({
    id: 'craft.restate',
    name: '言い換えの二周',
    category: 'expression',
    severity: 'info',
    description: '「つまり」「要するに」などで同じ意味を言い直していないかを見ます。',
    run: function (ctx, add) {
      if (_bodyLen(ctx.text) < 120) return;
      var on = _strict(ctx.config);
      var craft = (S.dict && S.dict.craft) || {};
      var words = S.craftUtil.words(craft.restate || [], craft.restateStrict || [], on);
      var seen = Object.create(null);
      words.forEach(function (word) {
        U.scan(ctx.text, new RegExp(U.escapeRegExp(word), 'g'), function (m, idx) {
          if (seen[idx]) return;
          seen[idx] = 1;
          add({
            start: idx, end: idx + m[0].length,
            severity: S.craftUtil.sev(on, 'info', 'warn'),
            message: '「' + word + '」で言い直しが入っています。',
            advice: '一度うまく言えたあとに同じ意味を二周していないか。マーカーの後ろを削るか、次の段落は新しい具体だけにしてください。'
          });
        });
      });
    }
  });

  S.registerRule({
    id: 'craft.title-abstract',
    name: '抽象だけのタイトル',
    category: 'note',
    severity: 'hint',
    description: 'タイトルが抽象名詞だけで、出来事や主張が見えない状態を指摘します。採点はしません。',
    run: function (ctx, add) {
      var title = (ctx.title || '').trim();
      if (!title || title.length < 4 || !S.titleFacts) return;
      var facts = S.titleFacts(title);
      var on = _strict(ctx.config);
      if (!facts.abstractOnly) return;
      add({
        start: 0, end: 0,
        severity: S.craftUtil.sev(on, 'hint', 'info'),
        message: 'タイトルが抽象的な語に寄っています（' + facts.abstractWords.join('、') + '）。',
        advice: '出来事や言いにくい主張をそのまま名前にする。きれいなテーマ名だけで終わらせない。問いなら具体のあとに置く。'
      });
    }
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
