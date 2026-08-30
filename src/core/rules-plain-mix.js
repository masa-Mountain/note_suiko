/* 推敲 (suikou) — 常体内部の「だ／である」混在 */
(function (global) {
  'use strict';

  var S = global.Suikou;

  /**
   * 文末が「だ」系か「である」系か。どちらでもなければ null。
   * @param {string} sentence 1文
   * @returns {'da'|'dearu'|null} 常体の下位区分
   */
  function _plainKind(sentence) {
    var s = sentence.replace(/[\s\u3000]+$/, '').replace(/[。！？…‥」』）\)]*$/, '');
    if (/であった$/.test(s) || /である$/.test(s)) return 'dearu';
    if (/だった$/.test(s) || /(?:な)?のだ$/.test(s) || /だ$/.test(s)) return 'da';
    return null;
  }

  S.registerRule({
    id: 'consistency.plain-mix',
    name: 'だ／であるの混在',
    category: 'consistency',
    severity: 'info',
    description: '常体の中で「だ」と「である」が両方使われている状態を知らせます。',
    params: [
      { key: 'minEach', label: '少ない側の最小文数', type: 'number', value: 1, min: 1, max: 10, step: 1 },
      { key: 'minMajor', label: '多い側の最小文数', type: 'number', value: 3, min: 1, max: 20, step: 1 }
    ],
    run: function (ctx, add, params) {
      var da = [];
      var dearu = [];
      for (var i = 0; i < ctx.sentences.length; i++) {
        var s = ctx.sentences[i];
        if (/^[>|#「『]/.test(s.text)) continue;
        var kind = _plainKind(s.text);
        if (kind === 'da') da.push(s);
        else if (kind === 'dearu') dearu.push(s);
      }
      if (!da.length || !dearu.length) return;
      if (Math.min(da.length, dearu.length) < params.minEach) return;
      if (Math.max(da.length, dearu.length) < params.minMajor) return;
      var minority = da.length <= dearu.length ? da : dearu;
      var major = da.length > dearu.length ? 'だ' : 'である';
      var limit = Math.min(minority.length, 4);
      for (var k = 0; k < limit; k++) {
        add({
          start: minority[k].start,
          end: minority[k].end,
          message: '常体の「だ」と「である」が混ざっています（だ ' + da.length +
            ' / である ' + dearu.length + '）。',
          advice: 'どちらも常体ですが、語り手の距離が変わります。「' + major + '」に寄せると像が安定します。'
        });
      }
    }
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
