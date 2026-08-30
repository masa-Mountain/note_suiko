/* 推敲 (suikou) — 校正ルール（誤字・誤用・記号） */
(function (global) {
  'use strict';

  var S = global.Suikou;
  var T = S.text;
  var D = S.dict;
  var U = S.util;

  function typoRule(id, name, tag, severity, description) {
    S.registerRule({
      id: id,
      name: name,
      category: 'typo',
      severity: severity,
      description: description,
      run: function (ctx, add) {
        var entries = D.typos.filter(function (e) {
          return (e.tag || null) === tag;
        });
        for (var i = 0; i < entries.length; i++) {
          var e = entries[i];
          var re = e.regex || new RegExp(U.escapeRegExp(e.wrong), 'g');
          U.scan(ctx.text, re, function (m, idx) {
            add({
              start: idx,
              end: idx + m[0].length,
              message: '「' + m[0] + '」は誤りです。',
              advice: e.note || '',
              suggestions: [e.right]
            });
          });
        }
      }
    });
  }

  typoRule('typo.dict', '明確な誤字・誤用', null, 'error',
    '誤りが一意に決まる語（慣用句の誤り、外来語の綴り違いなど）を指摘します。');
  typoRule('typo.ranuki', 'ら抜き言葉', 'ranuki', 'warn',
    '「見れる」など可能動詞の「ら」抜けを指摘します。口語文体では意図的に使うこともあります。');
  typoRule('typo.saire', 'さ入れ言葉', 'saire', 'warn',
    '「行かさせて」など不要な「さ」を指摘します。');
  typoRule('typo.keigo', '二重敬語', 'keigo', 'warn',
    '敬語が重複している箇所を指摘します。');

  /* ---------------- 同音異義語 ---------------- */
  S.registerRule({
    id: 'typo.homophone',
    name: '同音異義語の取り違え',
    category: 'typo',
    severity: 'info',
    description: '「意外／以外」のように取り違えやすい語を、文脈から怪しい場合だけ拾います。',
    run: function (ctx, add) {
      for (var i = 0; i < D.homophones.length; i++) {
        var h = D.homophones[i];
        (function (h) {
          U.scan(ctx.text, h.re, function (m, idx) {
            add({
              start: idx,
              end: idx + m[0].length,
              message: '「' + m[0] + '」— 同音異義語の取り違えかもしれません。',
              advice: h.note,
              suggestions: [h.suggest]
            });
          });
        })(h);
      }
    }
  });

  /* ---------------- 重言 ---------------- */
  S.registerRule({
    id: 'typo.redundancy',
    name: '重言（意味の重複）',
    category: 'typo',
    severity: 'warn',
    description: '「一番最初」「過半数を超える」など同じ意味が重なっている箇所を指摘します。',
    run: function (ctx, add) {
      for (var i = 0; i < D.redundancies.length; i++) {
        var e = D.redundancies[i];
        var re = e.regex || new RegExp(U.escapeRegExp(e.wrong), 'g');
        (function (e) {
          U.scan(ctx.text, re, function (m, idx) {
            add({
              start: idx,
              end: idx + m[0].length,
              message: '「' + m[0] + '」は意味が重複しています。',
              advice: '重言は読者に「雑さ」として伝わりやすい箇所です。',
              suggestions: [e.right]
            });
          });
        })(e);
      }
    }
  });

  /* ---------------- 助詞の重複 ---------------- */
  S.registerRule({
    id: 'typo.particle-dup',
    name: '助詞の打ち間違い',
    category: 'typo',
    severity: 'error',
    description: '「がが」「をを」など助詞の重複を拾います。誤植の代表です。',
    run: function (ctx, add) {
      /* 「のの」は「ものの」「ののしる」「のの字」に当たってしまうので入れていない。
       * 「にに」「でで」も後続で絞り込む。誤植検出は誤検知が一番きらわれる箇所なので、
       * 取りこぼしてもいいから確実なものだけを見る。 */
      U.scan(ctx.text, /がが|をを|にに(?![んやこ])|でで(?![きし])/g, function (m, idx) {
        add({
          start: idx,
          end: idx + m[0].length,
          message: '助詞が重複しています（「' + m[0] + '」）。',
          advice: '打ち間違いの可能性が高い箇所です。',
          suggestions: [m[0].charAt(0)]
        });
      });
      U.scan(ctx.text, /、、+|。。(?!。)/g, function (m, idx) {
        add({
          start: idx,
          end: idx + m[0].length,
          message: '句読点が重複しています。',
          advice: '',
          suggestions: [m[0].charAt(0)]
        });
      });
    }
  });

  /* ---------------- 同一かなの連続 ---------------- */
  S.registerRule({
    id: 'typo.repeat-char',
    name: '同じ文字の連続',
    category: 'typo',
    severity: 'info',
    description: '同じ仮名が3文字以上続く箇所を拾います（打ち間違いか、意図的な強調か）。',
    run: function (ctx, add) {
      U.scan(ctx.text, /([\u3041-\u3096\u30A1-\u30FA])\1{2,}/g, function (m, idx) {
        add({
          start: idx,
          end: idx + m[0].length,
          message: '「' + m[0] + '」— 同じ文字が続いています。',
          advice: '意図的な引き伸ばしなら問題ありません。打ち間違いでないか確認してください。'
        });
      });
    }
  });

  /* ---------------- 記号・文字幅 ---------------- */
  S.registerRule({
    id: 'typo.symbol',
    name: '記号・文字幅の乱れ',
    category: 'typo',
    severity: 'warn',
    description: '半角カナ、全角英数、三点リーダ、感嘆符の連打などを指摘します。',
    params: [
      { key: 'allowMultiBang', label: '「!!」「??」の連打を許可', type: 'bool', value: false }
    ],
    run: function (ctx, add, params) {
      U.scan(ctx.text, /[\uFF61-\uFF9F]+/g, function (m, idx) {
        add({
          start: idx, end: idx + m[0].length, severity: 'error',
          message: '半角カナが使われています。',
          advice: '環境によって表示が崩れます。全角に直してください。'
        });
      });
      U.scan(ctx.text, /[\uFF10-\uFF19\uFF21-\uFF3A\uFF41-\uFF5A]{1,}/g, function (m, idx) {
        add({
          start: idx, end: idx + m[0].length,
          message: '全角の英数字が使われています（「' + m[0] + '」）。',
          advice: '日本語の本文では半角英数が標準です。固有名詞やロゴなら意図を優先してください。',
          suggestions: [T.toHalfWidth(m[0])]
        });
      });
      U.scan(ctx.text, /\.{2,}|・{3,}|。{3,}|‥+/g, function (m, idx) {
        add({
          start: idx, end: idx + m[0].length,
          message: '三点リーダの表記が崩れています（「' + m[0] + '」）。',
          advice: '日本語の組版では全角の「……」（2つ重ね）が基本です。',
          suggestions: ['……']
        });
      });
      if (!params.allowMultiBang) {
        U.scan(ctx.text, /[!！]{2,}|[?？]{2,}|[!！][?？]|[?？][!！]/g, function (m, idx) {
          add({
            start: idx, end: idx + m[0].length, severity: 'info',
            message: '感嘆符・疑問符が連続しています。',
            advice: '記号で押し上げた熱量は、文そのものの熱量を下げて見せることがあります。'
          });
        });
      }
      U.scan(ctx.text, /[〜～]{2,}/g, function (m, idx) {
        add({
          start: idx, end: idx + m[0].length, severity: 'info',
          message: '波ダッシュが連続しています。',
          advice: ''
        });
      });
    }
  });

  /* ---------------- 括弧の対応 ---------------- */
  var PAIRS = { '「': '」', '『': '』', '（': '）', '(': ')', '【': '】', '〈': '〉', '《': '》', '［': '］', '[': ']', '｛': '｝', '{': '}' };
  var CLOSE_TO_OPEN = {};
  Object.keys(PAIRS).forEach(function (k) { CLOSE_TO_OPEN[PAIRS[k]] = k; });

  S.registerRule({
    id: 'typo.bracket',
    name: '括弧の対応',
    category: 'typo',
    severity: 'error',
    description: '閉じ忘れ・開き忘れの括弧を検出します。長い会話文で起きやすい事故です。',
    run: function (ctx, add) {
      var stack = [];
      for (var i = 0; i < ctx.text.length; i++) {
        var ch = ctx.text.charAt(i);
        if (PAIRS[ch]) {
          stack.push({ ch: ch, index: i });
        } else if (CLOSE_TO_OPEN[ch]) {
          var expectOpen = CLOSE_TO_OPEN[ch];
          var found = -1;
          for (var k = stack.length - 1; k >= 0; k--) {
            if (stack[k].ch === expectOpen) { found = k; break; }
          }
          if (found < 0) {
            add({
              start: i, end: i + 1,
              message: '対応する開き括弧のない「' + ch + '」があります。',
              advice: ''
            });
          } else {
            stack.splice(found, 1);
          }
        }
      }
      for (var j = 0; j < stack.length; j++) {
        add({
          start: stack[j].index, end: stack[j].index + 1,
          message: '「' + stack[j].ch + '」が閉じられていません。',
          advice: '対応する「' + PAIRS[stack[j].ch] + '」を確認してください。'
        });
      }
    }
  });

  /* ---------------- 会話文の句点 ---------------- */
  S.registerRule({
    id: 'typo.quote-period',
    name: '会話文の句点',
    category: 'typo',
    severity: 'hint',
    enabled: false,
    description: '「〜です。」のように閉じ括弧の直前に句点がある箇所を拾います（小説では省くのが慣習）。',
    run: function (ctx, add) {
      U.scan(ctx.text, /。[」』]/g, function (m, idx) {
        add({
          start: idx, end: idx + 1,
          message: '閉じ括弧の直前に句点があります。',
          advice: '小説・脚本では句点を省くのが一般的です。エッセイの引用では残す流儀もあります。'
        });
      });
    }
  });

  /* ---------------- 段落末の句点 ---------------- */
  S.registerRule({
    id: 'typo.missing-period',
    name: '文末の句点もれ',
    category: 'typo',
    severity: 'info',
    description: '句点で終わっていない段落を拾います（見出し・箇条書きは除外）。',
    params: [{ key: 'minLength', label: '対象とする段落の最小文字数', type: 'number', value: 20, min: 5, max: 200, step: 5 }],
    run: function (ctx, add, params) {
      for (var i = 0; i < ctx.paragraphs.length; i++) {
        var p = ctx.paragraphs[i];
        if (p.text.length < params.minLength) continue;
        if (/^(#{1,6}\s|[-*+・]\s|[0-9０-９]+[.)．）]\s|>|\||```)/.test(p.text)) continue;
        if (/[。！？…‥」』）\)\]】〉》:：]$/.test(p.text)) continue;
        if (/^[■◆●▼▲◇□★☆※【]/.test(p.text)) continue;
        /* 埋め込み用の URL 行、画像、目次、有料ラインの目印は文ではない */
        if (/^(https?:\/\/\S+|!\[[^\]]*\]\([^)]*\)|\[目次\]|={3,}.*={3,})$/.test(p.text.trim())) continue;
        add({
          start: p.end - 1, end: p.end,
          message: 'この段落は句点で終わっていません。',
          advice: '体言止めや余韻として意図しているなら問題ありません。'
        });
      }
    }
  });

  /* ---------------- 空白の扱い ---------------- */
  S.registerRule({
    id: 'typo.space',
    name: '空白の乱れ',
    category: 'typo',
    severity: 'info',
    description: '行末の空白、連続空白、日本語の中の不自然な半角空白を拾います。',
    run: function (ctx, add) {
      U.scan(ctx.text, /[ \u3000]+$/gm, function (m, idx) {
        add({ start: idx, end: idx + m[0].length, message: '行末に空白があります。', advice: '', severity: 'hint' });
      });
      U.scan(ctx.text, /\u3000{2,}| {3,}/g, function (m, idx) {
        add({ start: idx, end: idx + m[0].length, message: '空白が連続しています。', advice: 'note では字下げの代わりに空行を使うのが読みやすいです。' });
      });
      U.scan(ctx.text, /[\u3041-\u3096\u4E00-\u9FFF] [\u3041-\u3096\u4E00-\u9FFF]/g, function (m, idx) {
        add({ start: idx + 1, end: idx + 2, message: '日本語の途中に半角空白があります。', advice: '変換ミスの残りかもしれません。' });
      });
    }
  });

  /* ---------------- 呼応の崩れ ---------------- */
  S.registerRule({
    id: 'typo.correlation',
    name: '副詞の呼応',
    category: 'typo',
    severity: 'warn',
    description: '「決して〜ない」「たとえ〜ても」のような呼応が崩れている箇所を指摘します。',
    params: [{ key: 'includeSoft', label: '口語で許容される呼応（全然〜など）も見る', type: 'bool', value: false }],
    run: function (ctx, add, params) {
      for (var s = 0; s < ctx.sentences.length; s++) {
        var sent = ctx.sentences[s];
        for (var i = 0; i < D.correlations.length; i++) {
          var c = D.correlations[i];
          if (c.soft && !params.includeSoft) continue;
          (function (c, sent) {
            U.scan(sent.text, c.trigger, function (m, idx) {
              if (c.boundary) {
                // 「何もしない」の中の「もし」のような、別の語の一部を拾わないようにする
                var prev = sent.text.charAt(idx - 1);
                if (prev && !/[、。，．\s\u3000「『（(：:]/.test(prev)) return;
              }
              var tail = sent.text.slice(idx, idx + c.window);
              if (c.expect.test(tail)) return;
              add({
                start: sent.start + idx,
                end: sent.start + idx + m[0].length,
                message: '「' + m[0] + '」の受け方が見当たりません。',
                advice: c.note,
                severity: c.soft ? 'info' : 'warn'
              });
            });
          })(c, sent);
        }
      }
    }
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
