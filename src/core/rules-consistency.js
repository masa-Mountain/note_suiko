/* 推敲 (suikou) — 表記揺れルール */
(function (global) {
  'use strict';

  var S = global.Suikou;
  var T = S.text;
  var D = S.dict;
  var U = S.util;

  var HIRA = '\u3041-\u3096';
  var KANJI = '\u4E00-\u9FFF';

  /* 単漢字の形式名詞は前後の文脈で絞り込む（「仕事」「事件」を拾わないため） */
  var SUFFIX_EXCLUDE = {
    '訳': /[すしさせ]/,
    '中': /[毒継]/,
    '方': /[々法向面針角]/,
    '様': /[子々式態]/,
    '上': /[手下位]/
  };

  function formRegex(form) {
    var isSingleKanji = form.length === 1 && new RegExp('[' + KANJI + ']').test(form);
    if (isSingleKanji) {
      return {
        re: new RegExp('([' + HIRA + '])(' + U.escapeRegExp(form) + ')(?![' + KANJI + '])', 'g'),
        group: 2
      };
    }
    return { re: new RegExp('(' + U.escapeRegExp(form) + ')', 'g'), group: 1 };
  }

  /* カタカナ語・英単語は、より長い語の一部を拾わないよう前後を確かめる。
   * 例）「ユーザ」が「ユーザー」の中に含まれてしまうのを防ぐ。 */
  function sameRunClass(cls) {
    return cls === 'katakana' || cls === 'halfKatakana' || cls === 'latin' || cls === 'fullLatin';
  }

  /**
   * ヒットが除外語の一部なら捨てる（「なかなか」の中の「なか」など）。
   * @param {string} text 本文
   * @param {number} start ヒット開始
   * @param {string} word 当たった語
   * @param {string[]|undefined} list 除外語
   * @returns {boolean} 除外するなら true
   */
  function _inExclude(text, start, word, list) {
    if (!list || !list.length) return false;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      var at = e.indexOf(word);
      while (at >= 0) {
        if (text.substr(start - at, e.length) === e) return true;
        at = e.indexOf(word, at + 1);
      }
    }
    return false;
  }

  function findForm(text, form, needHiraPrefix, skipWords) {
    var spec = formRegex(form);
    var hits = [];
    var exclude = SUFFIX_EXCLUDE[form];
    var headCls = T.charClass(form.charAt(0));
    var tailCls = T.charClass(form.charAt(form.length - 1));
    var guardRun = sameRunClass(headCls) || sameRunClass(tailCls);
    U.scan(text, spec.re, function (m, idx) {
      var offset = idx;
      for (var g = 1; g < spec.group; g++) offset += (m[g] || '').length;
      var end = offset + m[spec.group].length;
      if (exclude && exclude.test(text.charAt(end))) return;
      if (_inExclude(text, offset, form, skipWords)) return;
      if (guardRun) {
        var prevCh = text.charAt(offset - 1);
        var nextCh = text.charAt(end);
        if (prevCh && sameRunClass(T.charClass(prevCh))) return;
        if (nextCh && (sameRunClass(T.charClass(nextCh)) || nextCh === 'ー' || nextCh === '・')) return;
      }
      if (needHiraPrefix && spec.group === 1) {
        var prev = text.charAt(offset - 1);
        if (prev && !new RegExp('[' + HIRA + ']').test(prev)) return;
      }
      hits.push({ start: offset, end: end, text: m[spec.group] });
    });
    return hits;
  }

  /* ---------------- 辞書ベースの表記統一 ---------------- */
  S.registerRule({
    id: 'consistency.variants',
    name: '表記の揺れ（辞書）',
    category: 'consistency',
    severity: 'warn',
    description: '「できる／出来る」のように同じ語が2通り以上で書かれている箇所を、少数派のほうに印を付けます。',
    params: [
      { key: 'reportPreferred', label: '推奨形も併記する', type: 'bool', value: true }
    ],
    run: function (ctx, add, params) {
      var text = ctx.text;
      for (var i = 0; i < D.variantGroups.length; i++) {
        var g = D.variantGroups[i];
        var forms = [g.preferred].concat(g.variants);
        var hasSingleKanji = forms.some(function (f) {
          return f.length === 1 && new RegExp('[' + KANJI + ']').test(f);
        });
        var found = [];
        for (var f = 0; f < forms.length; f++) {
          var hits = findForm(text, forms[f], hasSingleKanji, g.exclude);
          if (hits.length) found.push({ form: forms[f], hits: hits });
        }
        if (found.length < 2) continue;

        found.sort(function (a, b) { return b.hits.length - a.hits.length; });
        var major = found[0];
        for (var k = 1; k < found.length; k++) {
          var minor = found[k];
          for (var h = 0; h < minor.hits.length; h++) {
            var hit = minor.hits[h];
            add({
              start: hit.start,
              end: hit.end,
              message: '表記が揺れています（「' + minor.form + '」' + minor.hits.length +
                '回 / 「' + major.form + '」' + major.hits.length + '回）。',
              advice: (g.note ? g.note + ' ' : '') +
                (params.reportPreferred && g.preferred !== major.form
                  ? '一般には「' + g.preferred + '」に寄せることが多い語です（' + g.kind + '）。'
                  : 'どちらに寄せるかを決め、原稿全体で揃えてください（' + g.kind + '）。'),
              suggestions: [major.form].concat(g.preferred !== major.form ? [g.preferred] : []),
              meta: { unifyFrom: minor.form, unifyTo: major.form }
            });
          }
        }
      }
    }
  });

  /* ---------------- カタカナ・英字の自動揺れ検出 ---------------- */
  S.registerRule({
    id: 'consistency.auto',
    name: '表記の揺れ（自動検出）',
    category: 'consistency',
    severity: 'warn',
    description: '辞書になくても、長音・中黒・大小文字の違いだけで一致するカタカナ語・英単語を検出します。',
    run: function (ctx, add) {
      var tokens = T.tokenize(ctx.text);
      var known = Object.create(null);
      for (var g = 0; g < D.variantGroups.length; g++) {
        var grp = D.variantGroups[g];
        [grp.preferred].concat(grp.variants).forEach(function (f) { known[f] = 1; });
      }
      var groups = Object.create(null);
      for (var i = 0; i < tokens.length; i++) {
        var t = tokens[i];
        if (t.cls !== 'katakana' && t.cls !== 'latin') continue;
        if (t.text.length < 3) continue;
        if (known[t.text]) continue; // 辞書側のルールに任せる
        var key = T.normalizeForCompare(t.text);
        if (key.length < 2) continue;
        if (!groups[key]) groups[key] = {};
        if (!groups[key][t.text]) groups[key][t.text] = [];
        groups[key][t.text].push(t);
      }
      Object.keys(groups).forEach(function (key) {
        var forms = Object.keys(groups[key]);
        if (forms.length < 2) return;
        forms.sort(function (a, b) { return groups[key][b].length - groups[key][a].length; });
        var major = forms[0];
        for (var k = 1; k < forms.length; k++) {
          var list = groups[key][forms[k]];
          for (var h = 0; h < list.length; h++) {
            add({
              start: list[h].start,
              end: list[h].end,
              message: '「' + forms[k] + '」と「' + major + '」が混在しています。',
              advice: '長音符や中黒の有無だけが違う表記です。原稿内でどちらかに統一してください。',
              suggestions: [major],
              meta: { unifyFrom: forms[k], unifyTo: major }
            });
          }
        }
      });
    }
  });

  /* ---------------- 文体の混在 ---------------- */
  S.registerRule({
    id: 'consistency.style',
    name: '文体の混在（です・ます／だ・である）',
    category: 'consistency',
    severity: 'warn',
    description: '敬体と常体が混ざっている文を指摘します。意図的な使い分けなら許容比率を上げてください。',
    params: [
      { key: 'minSentences', label: '判定に必要な最小文数', type: 'number', value: 6, min: 2, max: 50, step: 1 },
      { key: 'maxReports', label: '指摘する最大件数', type: 'number', value: 12, min: 1, max: 100, step: 1 }
    ],
    run: function (ctx, add, params) {
      var polite = [], plain = [];
      for (var i = 0; i < ctx.sentences.length; i++) {
        var s = ctx.sentences[i];
        if (/^[>|#]/.test(s.text)) continue; // 引用・見出しは除外
        if (/^[「『]/.test(s.text)) continue; // 会話文は文体判定の対象外
        var st = T.endingStyle(s.text);
        if (st === 'polite') polite.push(s);
        else if (st === 'plain') plain.push(s);
      }
      var total = polite.length + plain.length;
      if (total < params.minSentences) return;

      var forced = ctx.config.style;
      var majority;
      if (forced === 'desu') majority = 'polite';
      else if (forced === 'dearu') majority = 'plain';
      else majority = polite.length >= plain.length ? 'polite' : 'plain';

      var minorityList = majority === 'polite' ? plain : polite;
      if (minorityList.length === 0) return;
      var ratio = (minorityList.length / total) * 100;
      var label = majority === 'polite' ? '敬体（です・ます）' : '常体（だ・である）';
      var otherLabel = majority === 'polite' ? '常体（だ・である）' : '敬体（です・ます）';
      var undecided = forced === 'auto' && ratio > 45;

      var limit = Math.min(minorityList.length, params.maxReports);
      for (var j = 0; j < limit; j++) {
        var sent = minorityList[j];
        add({
          start: sent.start,
          end: Math.min(sent.end, sent.start + 40),
          severity: undecided ? 'info' : 'warn',
          message: undecided
            ? '文体が定まっていません（敬体 ' + polite.length + '文 / 常体 ' + plain.length + '文）。'
            : 'この文は' + otherLabel + 'です（本文の基調は' + label + '、混在 ' + U.round(ratio, 1) + '%）。',
          advice: undecided
            ? 'まず原稿全体の文体を決めてください。エッセイでは敬体のほうが距離が近く、常体のほうが硬質で速くなります。'
            : '地の文の文体は原則そろえます。引用・回想・独白として意図的に切り替えているなら残してください。'
        });
      }
      if (minorityList.length > limit) {
        add({
          start: minorityList[limit].start,
          end: Math.min(minorityList[limit].end, minorityList[limit].start + 40),
          severity: 'info',
          message: 'ほか ' + (minorityList.length - limit) + ' 文で文体が揺れています。',
          advice: '件数が多いので表示を打ち切りました。'
        });
      }
    }
  });

  /* ---------------- 一人称の混在 ---------------- */
  S.registerRule({
    id: 'consistency.first-person',
    name: '一人称の混在',
    category: 'consistency',
    severity: 'info',
    description: '「私」「僕」「自分」などが混ざっている場合に指摘します（キャラクターの語りでは意図的な場合あり）。',
    run: function (ctx, add) {
      var forms = ['私', 'わたし', 'ワタシ', '僕', 'ぼく', 'ボク', '俺', 'おれ', 'オレ', '自分', 'あたし', 'わたくし', '小生'];
      var found = [];
      for (var i = 0; i < forms.length; i++) {
        var hits = [];
        U.scan(ctx.text, new RegExp(U.escapeRegExp(forms[i]) + '(?![' + KANJI + '])', 'g'), function (m, idx) {
          hits.push({ start: idx, end: idx + m[0].length });
        });
        if (hits.length) found.push({ form: forms[i], hits: hits });
      }
      if (found.length < 2) return;
      found.sort(function (a, b) { return b.hits.length - a.hits.length; });
      var major = found[0];
      var names = found.map(function (f) { return f.form + '×' + f.hits.length; }).join('、');
      // 過剰指摘を避けるため、少数派ごとに最初の1件だけ印を付ける
      for (var k = 1; k < found.length; k++) {
        var hit = found[k].hits[0];
        add({
          start: hit.start,
          end: hit.end,
          message: '一人称が複数使われています（' + names + '）。',
          advice: '語り手が同一人物なら「' + major.form + '」に統一するのが基本です。会話文の中は対象外と考えてください。',
          suggestions: [major.form]
        });
      }
    }
  });

  /* ---------------- 数の表記 ---------------- */
  S.registerRule({
    id: 'consistency.number',
    name: '数の表記の揺れ',
    category: 'consistency',
    severity: 'info',
    description: '「1つ／一つ／ひとつ」のような数の表記が混在しているかを見ます。',
    run: function (ctx, add) {
      var sets = [
        { label: '個数（〜つ）', forms: [/[0-9]+つ/g, /[一二三四五六七八九十]つ/g, /(ひと|ふた|みっ|よっ|いつ)つ/g] },
        { label: '順序（〜番目）', forms: [/[0-9]+番目/g, /[一二三四五六七八九十]番目/g] },
        { label: '年', forms: [/[0-9]{4}年/g, /[一二三四五六七八九十百千]+年(?![間齢])/g] }
      ];
      for (var i = 0; i < sets.length; i++) {
        var groups = [];
        for (var f = 0; f < sets[i].forms.length; f++) {
          var hits = [];
          U.scan(ctx.text, sets[i].forms[f], function (m, idx) {
            hits.push({ start: idx, end: idx + m[0].length, text: m[0] });
          });
          if (hits.length) groups.push(hits);
        }
        if (groups.length < 2) continue;
        groups.sort(function (a, b) { return b.length - a.length; });
        for (var g = 1; g < groups.length; g++) {
          for (var h = 0; h < groups[g].length; h++) {
            add({
              start: groups[g][h].start,
              end: groups[g][h].end,
              message: sets[i].label + 'の表記が混在しています（「' + groups[g][h].text + '」）。',
              advice: '算用数字と漢数字のどちらを基本にするかを決めてください。慣用句（一つひとつ など）は例外で構いません。'
            });
          }
        }
      }
    }
  });

  /* ---------------- 句読点・括弧のスタイル ---------------- */
  S.registerRule({
    id: 'consistency.punctuation-style',
    name: '句読点・括弧のスタイル混在',
    category: 'consistency',
    severity: 'info',
    description: '「、」と「,」、「」と“”などの混在を検出します。',
    run: function (ctx, add) {
      var pairs = [
        { a: '、', b: ',', label: '読点' },
        { a: '。', b: '.', label: '句点' },
        { a: '（', b: '(', label: '丸括弧' },
        { a: '「', b: '“', label: '引用符' }
      ];
      for (var i = 0; i < pairs.length; i++) {
        var p = pairs[i];
        var ca = ctx.text.split(p.a).length - 1;
        var cbHits = [];
        U.scan(ctx.text, new RegExp(U.escapeRegExp(p.b), 'g'), function (m, idx) {
          if (p.b === '.' && /[0-9A-Za-z]/.test(ctx.text.charAt(idx - 1) || '')) return;
          if (p.b === ',' && /[0-9０-９]/.test(ctx.text.charAt(idx - 1) || '') &&
              /[0-9０-９]/.test(ctx.text.charAt(idx + 1) || '')) return;
          if (p.b === '(' && /[0-9A-Za-z]/.test(ctx.text.charAt(idx - 1) || '')) return;
          cbHits.push(idx);
        });
        if (ca > 0 && cbHits.length > 0) {
          for (var h = 0; h < cbHits.length; h++) {
            add({
              start: cbHits[h], end: cbHits[h] + p.b.length,
              message: p.label + 'の表記が混在しています（「' + p.a + '」' + ca + '回 / 「' + p.b + '」' + cbHits.length + '回）。',
              advice: '日本語の本文では全角側に寄せるのが一般的です。',
              suggestions: [p.a]
            });
          }
        }
      }
    }
  });

  /* ---------------- ユーザー辞書の統一ルール ---------------- */
  S.registerRule({
    id: 'consistency.custom',
    name: 'ユーザー辞書の統一ルール',
    category: 'consistency',
    severity: 'error',
    description: '「設定 > ユーザー辞書 > 表記統一」に書いた「正しい表記 = 誤った表記」を強制します。',
    run: function (ctx, add) {
      var rules = ctx.dictionary.preferred;
      for (var i = 0; i < rules.length; i++) {
        var r = rules[i];
        for (var v = 0; v < r.variants.length; v++) {
          (function (r, variant) {
            U.scan(ctx.text, new RegExp(U.escapeRegExp(variant), 'g'), function (m, idx) {
              add({
                start: idx, end: idx + m[0].length,
                message: 'あなたの表記ルールでは「' + r.preferred + '」です。',
                advice: 'ユーザー辞書で指定した統一ルールに違反しています。',
                suggestions: [r.preferred],
                meta: { unifyFrom: variant, unifyTo: r.preferred }
              });
            });
          })(r, r.variants[v]);
        }
      }
    }
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
