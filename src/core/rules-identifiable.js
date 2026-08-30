/* 推敲 (suikou) — 公開文で特定に近づきうる組み合わせ */
(function (global) {
  'use strict';

  var S = global.Suikou;
  var U = S.util;

  var CATS = [
    { id: 'place', words: ['駅', '近辺', '周辺', '丁目', '市内'] },
    { id: 'work', words: ['上司', '部下', '職場', '同僚', 'パワハラ'] },
    { id: 'private', words: ['彼女', '彼氏', '妻', '夫', '恋人'] }
  ];

  /**
   * いずれかの語が本文にあれば true。複合語ガードは掛けない（「池袋駅」の「駅」を残す）。
   * @param {string} text 本文
   * @param {string[]} words 目印の語
   * @returns {boolean} 1語でも当たれば true
   */
  function _hasAny(text, words) {
    var found = false;
    U.scan(text, U.alternation(words), function () { found = true; });
    return found;
  }

  S.registerRule({
    id: 'risk.identifiable',
    name: '特定されうる組み合わせ',
    category: 'risk',
    severity: 'info',
    description: '場所・職場・私生活のうち複数が同時に書かれているとき、第三者が辿れないか確認を促します。',
    run: function (ctx, add) {
      var hit = [];
      for (var i = 0; i < CATS.length; i++) {
        if (_hasAny(ctx.text, CATS[i].words)) hit.push(CATS[i].id);
      }
      if (hit.length < 2) return;
      add({
        start: 0,
        end: Math.min(12, ctx.text.length),
        message: '場所・職場・私生活のうち複数が同時に書かれています。',
        advice: '第三者が誰のことか辿れないか。当人が読んだときに困らないか。この二点だけ確認してください。'
      });
    }
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
