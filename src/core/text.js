/* 推敲 (suikou) — 日本語テキスト解析の基礎処理
 * 形態素解析器を使わず、文字種の切り替わりを利用した近似トークナイズを行う。
 * 精度より「オフラインで確実に動くこと」を優先している。 */
(function (global) {
  'use strict';

  var S = global.Suikou;
  var T = (S.text = {});

  /* ---------------- 文字種 ---------------- */
  var RE = (T.RE = {
    kanji: /[\u3005\u3007\u303B\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/,
    hiragana: /[\u3041-\u3096\u309D-\u309F]/,
    katakana: /[\u30A1-\u30FA\u30FC-\u30FF\u31F0-\u31FF]/,
    halfKatakana: /[\uFF66-\uFF9D]/,
    latin: /[A-Za-z]/,
    fullLatin: /[\uFF21-\uFF3A\uFF41-\uFF5A]/,
    digit: /[0-9]/,
    fullDigit: /[\uFF10-\uFF19]/,
    space: /[ \t\u3000]/,
    punct: /[、。，．！？!?…‥・「」『』（）()【】〈〉《》〔〕［］｛｝“”‘’"'：；:;ー〜～\-—–‐]/
  });

  T.charClass = function (ch) {
    if (RE.kanji.test(ch)) return 'kanji';
    if (RE.hiragana.test(ch)) return 'hiragana';
    if (RE.katakana.test(ch)) return 'katakana';
    if (RE.halfKatakana.test(ch)) return 'halfKatakana';
    if (RE.latin.test(ch)) return 'latin';
    if (RE.fullLatin.test(ch)) return 'fullLatin';
    if (RE.digit.test(ch)) return 'digit';
    if (RE.fullDigit.test(ch)) return 'fullDigit';
    if (ch === '\n') return 'newline';
    if (RE.space.test(ch)) return 'space';
    if (RE.punct.test(ch)) return 'punct';
    return 'other';
  };

  /** 本文の文字種構成を数える。 */
  T.charStats = function (text) {
    var st = {
      total: text.length,
      body: 0, // 空白・改行を除いた文字数
      kanji: 0,
      hiragana: 0,
      katakana: 0,
      latin: 0,
      digit: 0,
      punct: 0,
      space: 0,
      newline: 0,
      other: 0,
      halfKatakana: 0,
      fullWidthAlnum: 0
    };
    for (var i = 0; i < text.length; i++) {
      var c = T.charClass(text.charAt(i));
      switch (c) {
        case 'kanji': st.kanji++; st.body++; break;
        case 'hiragana': st.hiragana++; st.body++; break;
        case 'katakana': st.katakana++; st.body++; break;
        case 'halfKatakana': st.halfKatakana++; st.katakana++; st.body++; break;
        case 'latin': st.latin++; st.body++; break;
        case 'fullLatin': st.latin++; st.fullWidthAlnum++; st.body++; break;
        case 'digit': st.digit++; st.body++; break;
        case 'fullDigit': st.digit++; st.fullWidthAlnum++; st.body++; break;
        case 'punct': st.punct++; st.body++; break;
        case 'space': st.space++; break;
        case 'newline': st.newline++; break;
        default: st.other++; st.body++; break;
      }
    }
    return st;
  };

  /* ---------------- 文分割 ---------------- */
  var ENDERS = '。．.！？!?';
  var CLOSERS = '」』）)】〉》〕］｝”’"\'…‥';

  function isEnder(ch) {
    return ENDERS.indexOf(ch) >= 0;
  }

  function push(spans, text, start, end) {
    // 前後の空白を落として実体のある範囲だけを残す
    var s = start;
    var e = end;
    while (s < e && /[\s\u3000]/.test(text.charAt(s))) s++;
    while (e > s && /[\s\u3000]/.test(text.charAt(e - 1))) e--;
    if (e > s) spans.push({ start: s, end: e, text: text.slice(s, e) });
  }

  /**
   * 文に分割する。改行も文境界として扱う（note は1行=1段落になりやすい）。
   * 小数点（3.14）と 「…」 は文末とみなさない。
   */
  T.splitSentences = function (text) {
    var out = [];
    var start = 0;
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      if (ch === '\n') {
        push(out, text, start, i);
        start = i + 1;
        continue;
      }
      if (!isEnder(ch)) continue;
      if ((ch === '.' || ch === '．') &&
          /[0-9\uFF10-\uFF19]/.test(text.charAt(i - 1) || '') &&
          /[0-9\uFF10-\uFF19]/.test(text.charAt(i + 1) || '')) {
        continue; // 小数点
      }
      if (ch === '.' && /[A-Za-z]/.test(text.charAt(i + 1) || '')) continue; // 略記 e.g.
      var j = i + 1;
      while (j < text.length && (isEnder(text.charAt(j)) || CLOSERS.indexOf(text.charAt(j)) >= 0)) j++;
      push(out, text, start, j);
      start = j;
      i = j - 1;
    }
    push(out, text, start, text.length);
    return out;
  };

  /** 行（note の段落）に分割する。空行は段落として数えない。 */
  T.splitParagraphs = function (text) {
    var out = [];
    var start = 0;
    for (var i = 0; i <= text.length; i++) {
      if (i === text.length || text.charAt(i) === '\n') {
        push(out, text, start, i);
        start = i + 1;
      }
    }
    return out;
  };

  /** 見出し行（Markdown 記法 / note の擬似見出し）を抽出する。 */
  T.extractHeadings = function (paragraphs) {
    var out = [];
    for (var i = 0; i < paragraphs.length; i++) {
      var p = paragraphs[i];
      var m = /^(#{1,6})\s*(.+)$/.exec(p.text);
      if (m) {
        out.push({ level: m[1].length, title: m[2], span: p, markdown: true });
        continue;
      }
      // 「■ 見出し」「◆見出し」「【見出し】」のような擬似見出し
      if (/^[■◆●▼▲◇□★☆※]\s*\S/.test(p.text) && p.text.length <= 40) {
        out.push({ level: 2, title: p.text.replace(/^[■◆●▼▲◇□★☆※]\s*/, ''), span: p, markdown: false });
        continue;
      }
      if (/^【.+】$/.test(p.text) && p.text.length <= 40) {
        out.push({ level: 2, title: p.text.slice(1, -1), span: p, markdown: false });
      }
    }
    return out;
  };

  /* ---------------- モーラ（音の数） ---------------- */
  var SMALL = 'ぁぃぅぇぉゃゅょゎァィゥェォャュョヮ';

  T.countMora = function (s) {
    var n = 0;
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      var cls = T.charClass(ch);
      if (cls === 'hiragana' || cls === 'katakana' || cls === 'halfKatakana') {
        if (SMALL.indexOf(ch) >= 0) continue; // 拗音は直前に吸収される
        n++;
      } else if (cls === 'kanji') {
        n += 2; // 音読み1字≒2モーラという粗い近似
      } else if (cls === 'latin' || cls === 'digit') {
        n += 0.5;
      }
    }
    return Math.round(n);
  };

  /* ---------------- 近似トークナイズ ---------------- */
  /**
   * 文字種の連続をまとめて「語らしい塊」を返す。
   * 漢字連続・カタカナ連続・英字連続を内容語候補として扱う。
   */
  T.tokenize = function (text) {
    var out = [];
    var i = 0;
    while (i < text.length) {
      var cls = T.charClass(text.charAt(i));
      var j = i + 1;
      while (j < text.length) {
        var c2 = T.charClass(text.charAt(j));
        if (c2 === cls) { j++; continue; }
        // カタカナ語中の「・」「ー」は語内文字として許す
        if (cls === 'katakana' && (text.charAt(j) === '・' || text.charAt(j) === 'ー')) {
          if (j + 1 < text.length && T.charClass(text.charAt(j + 1)) === 'katakana') { j += 1; continue; }
        }
        if (cls === 'latin' && /[-'’]/.test(text.charAt(j)) &&
            j + 1 < text.length && T.charClass(text.charAt(j + 1)) === 'latin') { j += 1; continue; }
        break;
      }
      out.push({ start: i, end: j, text: text.slice(i, j), cls: cls });
      i = j;
    }
    return out;
  };

  /** ストップワード（内容語として数えたくない漢字・カナ語） */
  T.STOPWORDS = {
    '事': 1, '物': 1, '時': 1, '為': 1, '方': 1, '人': 1, '中': 1, '何': 1, '私': 1, '僕': 1,
    '自分': 1, '今回': 1, '今日': 1, '最近': 1, '本当': 1, '一番': 1, '場合': 1, '感じ': 1,
    '意味': 1, '部分': 1, '状態': 1, '内容': 1, '以上': 1, '以下': 1, '結果': 1, '必要': 1,
    'ソレ': 1, 'コレ': 1, 'ココ': 1, 'ソコ': 1, 'ドコ': 1, 'モノ': 1, 'コト': 1
  };

  /**
   * URL・メールアドレスを同じ長さの空白に置き換える。
   * 語彙の集計から外したいが、文字位置は保ちたいのでこの形にしている。
   */
  T.maskNoise = function (text) {
    function blank(m) {
      var s = '';
      for (var i = 0; i < m.length; i++) s += ' ';
      return s;
    }
    return text
      .replace(/https?:\/\/[^\s\u3000、。」』）\)]+/g, blank)
      .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, blank);
  };

  /** 内容語候補（漢字2字以上 / カタカナ3字以上 / 英字3字以上）を抽出する。 */
  T.contentWords = function (text) {
    var tokens = T.tokenize(T.maskNoise(text));
    var out = [];
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      var len = t.text.replace(/[ー・]/g, '').length;
      if (t.cls === 'kanji' && len >= 2) out.push(t);
      else if (t.cls === 'katakana' && len >= 3) out.push(t);
      else if (t.cls === 'latin' && len >= 3) out.push(t);
    }
    return out;
  };

  /** 語の出現頻度表を作る。 */
  T.frequency = function (tokens) {
    var map = Object.create(null);
    for (var i = 0; i < tokens.length; i++) {
      var w = tokens[i].text;
      if (T.STOPWORDS[w]) continue;
      if (!map[w]) map[w] = { word: w, count: 0, positions: [] };
      map[w].count++;
      map[w].positions.push(tokens[i]);
    }
    return map;
  };

  /** 頻度の高い語を並べて返す。 */
  T.keywords = function (text, limit) {
    var freq = T.frequency(T.contentWords(text));
    var arr = [];
    for (var k in freq) arr.push(freq[k]);
    arr.sort(function (a, b) {
      if (b.count !== a.count) return b.count - a.count;
      return b.word.length - a.word.length;
    });
    return arr.slice(0, limit || 20);
  };

  /* ---------------- 文体判定 ---------------- */
  var RE_POLITE = /(です|ます|ました|ません|でした|でしょう|ください|ますか|ですか|ございます|いたします|でしょうか)[。！？…‥」』）]*$/;
  var RE_PLAIN = /(だ|である|だった|であった|だろう|ではない|ない|のだ|のである|た|る|う|い|か|ぬ)[。！？…‥」』）]*$/;

  /** 文末の文体を返す: polite / plain / taigen / other */
  T.endingStyle = function (sentence) {
    var s = sentence.replace(/[\s\u3000]+$/, '');
    if (!s) return 'other';
    if (RE_POLITE.test(s)) return 'polite';
    var core = s.replace(/[。！？…‥」』）\)]*$/, '');
    if (!core) return 'other';
    var last = core.charAt(core.length - 1);
    var cls = T.charClass(last);
    if (cls === 'kanji' || cls === 'katakana' || cls === 'latin') return 'taigen';
    if (RE_PLAIN.test(s)) return 'plain';
    return 'other';
  };

  /** 文末の「かたち」（〜た。／〜だ。／〜思う。等）を粗く返す。連続検出に使う。 */
  T.endingShape = function (sentence) {
    var s = sentence.replace(/[。！？…‥」』）\)\s\u3000]*$/, '');
    if (!s) return '';
    var tails = [
      'ました', 'ません', 'でした', 'します', 'あります', 'います', 'ですね', 'でしょう',
      'と思います', 'と思う', 'のだ', 'である', 'だった', 'ている', 'ていた', 'かもしれない',
      'です', 'ます', 'した', 'ない', 'いる', 'ある', 'だ', 'た', 'る', 'う', 'い'
    ];
    for (var i = 0; i < tails.length; i++) {
      if (s.slice(-tails[i].length) === tails[i]) return tails[i];
    }
    return s.slice(-1);
  };

  /* ---------------- 全角半角 ---------------- */
  T.toHalfWidth = function (s) {
    return s.replace(/[\uFF01-\uFF5E]/g, function (c) {
      return String.fromCharCode(c.charCodeAt(0) - 0xfee0);
    });
  };

  T.normalizeForCompare = function (s) {
    return T.toHalfWidth(s).toLowerCase().replace(/[ー・\s\u3000]/g, '');
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
