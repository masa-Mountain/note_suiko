/* 推敲 (suikou) — 中核: 名前空間・ルール登録・共通ユーティリティ
 * 依存ゼロ。file:// でも動くよう classic script として読み込まれる。 */
(function (global) {
  'use strict';

  var S = (global.Suikou = global.Suikou || {});

  S.VERSION = '1.0.0';

  /* ---------------- カテゴリ定義 ---------------- */
  S.CATEGORIES = {
    typo: { label: '誤字・誤用', color: '#e5534b', order: 1 },
    consistency: { label: '表記の揺れ', color: '#d29922', order: 2 },
    expression: { label: '表現・違和感', color: '#58a6ff', order: 3 },
    vocabulary: { label: '語彙・単調さ', color: '#a371f7', order: 4 },
    structure: { label: '構成・リズム', color: '#3fb950', order: 5 },
    note: { label: 'note最適化', color: '#2dd4bf', order: 6 },
    rating: { label: 'レーティング', color: '#f778ba', order: 7 },
    risk: { label: 'リスク・配慮', color: '#ff7b72', order: 8 },
    ai: { label: 'AIの指摘', color: '#9ca9ff', order: 9 }
  };

  S.SEVERITIES = {
    error: { label: '要修正', weight: 3 },
    warn: { label: '検討', weight: 2 },
    info: { label: '確認', weight: 1 },
    hint: { label: '参考', weight: 0 }
  };

  /* ---------------- ルールレジストリ ---------------- */
  S.rules = [];
  S.ruleMap = {};

  /**
   * ルールを登録する。
   * rule = {
   *   id, name, category, description,
   *   severity: 既定の深刻度,
   *   enabled: 既定の有効/無効,
   *   params: [{key, label, type:'number'|'bool', min, max, step, value, help}],
   *   ratings: ['strict','all-ages','r18'] を制限したい場合のみ指定,
   *   run(ctx, add)
   * }
   */
  S.registerRule = function (rule) {
    if (S.ruleMap[rule.id]) {
      throw new Error('rule id 重複: ' + rule.id);
    }
    rule.severity = rule.severity || 'warn';
    rule.enabled = rule.enabled !== false;
    rule.params = rule.params || [];
    S.rules.push(rule);
    S.ruleMap[rule.id] = rule;
    return rule;
  };

  /* ---------------- ユーティリティ ---------------- */
  var U = (S.util = {});

  U.escapeRegExp = function (s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  U.uniq = function (arr) {
    var seen = Object.create(null);
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var k = String(arr[i]);
      if (!seen[k]) {
        seen[k] = 1;
        out.push(arr[i]);
      }
    }
    return out;
  };

  U.clamp = function (v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  };

  U.round = function (v, digits) {
    var p = Math.pow(10, digits || 0);
    return Math.round(v * p) / p;
  };

  /** 正規表現を g 付きで走らせ、各マッチをコールバックへ渡す。 */
  U.scan = function (text, regex, cb) {
    var flags = regex.flags.indexOf('g') >= 0 ? regex.flags : regex.flags + 'g';
    var re = new RegExp(regex.source, flags);
    var m;
    while ((m = re.exec(text)) !== null) {
      cb(m, m.index);
      if (m[0].length === 0) re.lastIndex++;
    }
  };

  /** 文字列リストから「いずれかに一致」する正規表現を作る（長い語を優先）。 */
  U.alternation = function (words, flags) {
    var sorted = words.slice().sort(function (a, b) {
      return b.length - a.length;
    });
    var src = sorted.map(U.escapeRegExp).join('|');
    return new RegExp('(?:' + src + ')', flags || 'g');
  };

  var KANJI_RE = /[\u3005\u3007\u3400-\u4DBF\u4E00-\u9FFF]/;

  /**
   * 語のリストを走査する。単純な部分文字列一致では
   * 「慢性的」の中の「性的」のような誤検知が出るため、次の２つで絞る。
   *
   *   compoundGuard: 語が漢字で始まり、直前も漢字なら「複合語の一部」として捨てる。
   *                  guardTail を立てると末尾側も同様に見る。
   *   exclude:       誤検知になる語（「裸足」など）を並べておくと、
   *                  ヒットがその語に完全に含まれている場合だけ捨てる。
   */
  U.wordScan = function (text, words, opts, cb) {
    opts = opts || {};
    if (!words || !words.length) return;
    U.scan(text, U.alternation(words), function (m, idx) {
      var word = m[0];
      var end = idx + word.length;
      if (opts.compoundGuard) {
        var prev = text.charAt(idx - 1);
        if (KANJI_RE.test(word.charAt(0)) && prev && KANJI_RE.test(prev)) return;
        if (opts.guardTail) {
          var next = text.charAt(end);
          if (KANJI_RE.test(word.charAt(word.length - 1)) && next && KANJI_RE.test(next)) return;
        }
      }
      if (opts.exclude) {
        for (var i = 0; i < opts.exclude.length; i++) {
          var e = opts.exclude[i];
          var at = e.indexOf(word);
          while (at >= 0) {
            if (text.substr(idx - at, e.length) === e) return;
            at = e.indexOf(word, at + 1);
          }
        }
      }
      cb(m, idx);
    });
  };

  /** 前後の文脈を切り出す（指摘カードの表示用）。 */
  U.context = function (text, start, end, pad) {
    pad = pad == null ? 14 : pad;
    var s = Math.max(0, start - pad);
    var e = Math.min(text.length, end + pad);
    return {
      before: (s > 0 ? '…' : '') + text.slice(s, start).replace(/\n/g, '⏎'),
      hit: text.slice(start, end).replace(/\n/g, '⏎'),
      after: text.slice(end, e).replace(/\n/g, '⏎') + (e < text.length ? '…' : '')
    };
  };

  /** 範囲が重なっているか。 */
  U.overlaps = function (a1, a2, b1, b2) {
    return a1 < b2 && b1 < a2;
  };

  U.parseLines = function (value) {
    return String(value || '')
      .split(/\r?\n/)
      .map(function (l) {
        return l.trim();
      })
      .filter(function (l) {
        return l.length > 0 && l.charAt(0) !== '#';
      });
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = S;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
