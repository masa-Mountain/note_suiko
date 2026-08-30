/* 推敲 (suikou) — 表現・違和感・リズムのルール
 * ここは「間違い」ではなく「読者がつまずく箇所」を拾う領域。
 * したがって既定は警告よりも弱い severity にしてある。 */
(function (global) {
  'use strict';

  var S = global.Suikou;
  var T = S.text;
  var D = S.dict;
  var U = S.util;

  function countMatches(text, re) {
    var n = 0;
    U.scan(text, re, function () { n++; });
    return n;
  }

  /**
   * 近接反復から外す主題語。タイトルの内容語と、本文で突出して多い1語。
   * @param {{title: string, text: string}} ctx 解析文脈
   * @param {number} minLen 対象にする語の最小長
   * @returns {Object<string, number>} 除外する語の集合
   */
  function _themeWords(ctx, minLen) {
    var skip = Object.create(null);
    var titleWords = T.contentWords(ctx.title || '');
    for (var i = 0; i < titleWords.length; i++) {
      var tw = titleWords[i].text;
      if (tw.replace(/[ー・]/g, '').length >= minLen) skip[tw] = 1;
    }
    var freq = T.frequency(T.contentWords(ctx.text));
    var top = null;
    Object.keys(freq).forEach(function (w) {
      if (!top || freq[w].count > top.count) top = freq[w];
    });
    if (top && top.count >= 8) skip[top.word] = 1;
    return skip;
  }

  /* ---------------- 一文の長さ ---------------- */
  S.registerRule({
    id: 'expr.long-sentence',
    name: '一文が長い',
    category: 'expression',
    severity: 'warn',
    description: '長い文は主語と述語が離れ、意味が崩れやすくなります。スマホでは特に読みにくくなります。',
    params: [
      { key: 'warnAt', label: '注意する長さ（文字）', type: 'number', value: 60, min: 20, max: 200, step: 5 },
      { key: 'errorAt', label: '強く指摘する長さ（文字）', type: 'number', value: 100, min: 40, max: 300, step: 5 }
    ],
    run: function (ctx, add, params) {
      for (var i = 0; i < ctx.sentences.length; i++) {
        var s = ctx.sentences[i];
        var len = s.text.replace(/[\s\u3000]/g, '').length;
        if (len < params.warnAt) continue;
        var hard = len >= params.errorAt;
        add({
          start: s.start,
          end: s.end,
          severity: hard ? 'warn' : 'info',
          message: 'この文は ' + len + ' 文字あります。',
          advice: hard
            ? '二文以上に割れないか検討してください。分割点は「そして」「が」「ので」「たり」のあたりに眠っています。'
            : '読点の位置と、切れる場所がないかを確認してください。'
        });
      }
    }
  });

  /* ---------------- 読点の密度 ---------------- */
  S.registerRule({
    id: 'expr.comma-density',
    name: '読点の密度',
    category: 'expression',
    severity: 'info',
    description: '読点がなくて息継ぎできない文、読点が多すぎて途切れる文を拾います。',
    params: [
      { key: 'noCommaAt', label: '読点なしで指摘する長さ', type: 'number', value: 45, min: 20, max: 120, step: 5 },
      { key: 'maxComma', label: '一文の読点の上限', type: 'number', value: 5, min: 2, max: 15, step: 1 }
    ],
    run: function (ctx, add, params) {
      for (var i = 0; i < ctx.sentences.length; i++) {
        var s = ctx.sentences[i];
        var body = s.text.replace(/[\s\u3000]/g, '');
        var commas = countMatches(s.text, /[、,]/g);
        if (commas === 0 && body.length >= params.noCommaAt) {
          add({
            start: s.start, end: s.end,
            message: 'この文（' + body.length + '文字）に読点がありません。',
            advice: '声に出して読んで、息を継ぐ場所に読点を置いてみてください。'
          });
        } else if (commas > params.maxComma) {
          add({
            start: s.start, end: s.end,
            message: 'この文に読点が ' + commas + ' 個あります。',
            advice: '読点で継ぎ足した文は、たいてい二文に割ったほうが速く読めます。'
          });
        }
      }
    }
  });

  /* ---------------- 文末の同形連続 ---------------- */
  S.registerRule({
    id: 'expr.ending-repeat',
    name: '文末が同じ形で続く',
    category: 'expression',
    severity: 'warn',
    description: '「〜た。〜た。〜た。」のような同じ語尾の連続は、文章を平板にします。',
    params: [{ key: 'run', label: '何回続いたら指摘するか', type: 'number', value: 3, min: 2, max: 8, step: 1 }],
    run: function (ctx, add, params) {
      var chain = [];
      var lastShape = null;
      function flush() {
        if (chain.length >= params.run) {
          var first = chain[0];
          var last = chain[chain.length - 1];
          add({
            start: first.start,
            end: last.end,
            message: '文末「' + lastShape + '」が ' + chain.length + ' 文続いています。',
            advice: '一文だけ体言止めにする、語順を入れ替える、二文を一文にまとめる。どれかで流れが変わります。'
          });
        }
        chain = [];
      }
      for (var i = 0; i < ctx.sentences.length; i++) {
        var s = ctx.sentences[i];
        var shape = T.endingShape(s.text);
        if (!shape || shape.length === 0) { flush(); lastShape = null; continue; }
        if (shape === lastShape) {
          chain.push(s);
        } else {
          flush();
          lastShape = shape;
          chain = [s];
        }
      }
      flush();
    }
  });

  /* ---------------- 近接反復 ---------------- */
  S.registerRule({
    id: 'expr.near-repeat',
    name: '同じ語の近接反復',
    category: 'expression',
    severity: 'info',
    description: '同じ語が短い間隔で繰り返されている箇所を拾います。意図的な反復なら残してください。',
    params: [
      { key: 'window', label: '近接とみなす文字数', type: 'number', value: 60, min: 20, max: 200, step: 10 },
      { key: 'minLen', label: '対象とする語の最小長', type: 'number', value: 2, min: 2, max: 6, step: 1 }
    ],
    run: function (ctx, add, params) {
      var theme = _themeWords(ctx, params.minLen);
      var words = T.contentWords(ctx.text);
      var byWord = Object.create(null);
      for (var i = 0; i < words.length; i++) {
        var w = words[i];
        if (w.text.replace(/[ー・]/g, '').length < params.minLen) continue;
        if (T.STOPWORDS[w.text]) continue;
        if (theme[w.text]) continue;
        if (!byWord[w.text]) byWord[w.text] = [];
        byWord[w.text].push(w);
      }
      Object.keys(byWord).forEach(function (word) {
        var list = byWord[word];
        for (var k = 1; k < list.length; k++) {
          var gap = list[k].start - list[k - 1].end;
          if (gap >= 0 && gap <= params.window) {
            add({
              start: list[k].start,
              end: list[k].end,
              message: '「' + word + '」が ' + (gap + word.length) + ' 文字のあいだに繰り返されています。',
              advice: '代名詞に置き換える、後半を削る、または言い換える。三つの選択肢があります。',
              suggestions: D.synonyms[word] || null
            });
            k++; // 連鎖の過剰指摘を避ける
          }
        }
      });
    }
  });

  /* ---------------- 文頭の接続詞 ---------------- */
  S.registerRule({
    id: 'expr.conjunction',
    name: '文頭の接続詞',
    category: 'expression',
    severity: 'info',
    description: '文頭の接続詞が連続する箇所、同じ接続詞が多用されている箇所を拾います。',
    params: [{ key: 'maxSame', label: '同じ接続詞の許容回数', type: 'number', value: 4, min: 1, max: 20, step: 1 }],
    run: function (ctx, add, params) {
      var conj = ['しかし', 'だが', 'でも', 'そして', 'それから', 'だから', 'なので', 'つまり', 'また',
        'ただ', 'ただし', 'けれど', 'けれども', 'ところが', 'そのため', 'したがって', 'ちなみに', 'さらに', 'そこで', 'あるいは'];
      var counts = Object.create(null);
      var prevHadConj = null;
      for (var i = 0; i < ctx.sentences.length; i++) {
        var s = ctx.sentences[i];
        var hit = null;
        for (var c = 0; c < conj.length; c++) {
          if (s.text.indexOf(conj[c]) === 0) { hit = conj[c]; break; }
        }
        if (hit) {
          counts[hit] = (counts[hit] || 0) + 1;
          if (prevHadConj) {
            add({
              start: s.start, end: s.start + hit.length,
              message: '接続詞で始まる文が連続しています（前文は「' + prevHadConj + '」）。',
              advice: '接続詞は落としても意味が通ることが多いです。落としてみて、通じなければ残してください。'
            });
          }
          prevHadConj = hit;
        } else {
          prevHadConj = null;
        }
      }
      Object.keys(counts).forEach(function (k) {
        if (counts[k] > params.maxSame) {
          var idx = ctx.text.indexOf(k);
          add({
            start: idx, end: idx + k.length, severity: 'hint',
            message: '「' + k + '」が文頭で ' + counts[k] + ' 回使われています。',
            advice: '同じ接続詞に頼ると論の運びが単調に見えます。'
          });
        }
      });
    }
  });

  /* ---------------- 助詞の連鎖 ---------------- */
  S.registerRule({
    id: 'expr.particle-chain',
    name: '助詞の連鎖',
    category: 'expression',
    severity: 'info',
    description: '「の」の三連続、「〜て、〜て」の連鎖、一文中の「が」の重複などを拾います。',
    run: function (ctx, add) {
      U.scan(ctx.text, /[^\s、。]{1,6}の[^\s、。]{1,6}の[^\s、。]{1,6}の/g, function (m, idx) {
        add({
          start: idx, end: idx + m[0].length,
          message: '「の」が三つ続いています。',
          advice: '所有・修飾の連鎖は意味が滑ります。語順を変えるか、一つを動詞に変えてみてください。'
        });
      });
      for (var i = 0; i < ctx.sentences.length; i++) {
        var s = ctx.sentences[i];
        var ga = countMatches(s.text, /が、|が[^、。]{2,}が/g);
        var gaAll = countMatches(s.text, /が/g);
        if (gaAll >= 3) {
          add({
            start: s.start, end: s.end, severity: 'hint',
            message: 'この文に「が」が ' + gaAll + ' 回あります。',
            advice: '主格の「が」と逆接の「が」が混ざると、読者は主語を取り違えます。'
          });
        } else if (ga >= 2) {
          add({
            start: s.start, end: s.end, severity: 'hint',
            message: 'この文で逆接の「が」が重なっています。',
            advice: '逆接を二度使うと、結論がどちらなのか分からなくなります。'
          });
        }
        var teChain = countMatches(s.text, /て、/g);
        if (teChain >= 3) {
          add({
            start: s.start, end: s.end,
            message: '「〜て、」が ' + teChain + ' 回続いています。',
            advice: '動作の羅列で文が伸びています。どこかで句点を打てないか探してください。'
          });
        }
      }
    }
  });

  /* ---------------- 受動態 ---------------- */
  S.registerRule({
    id: 'expr.passive',
    name: '受動態の多用',
    category: 'expression',
    severity: 'info',
    description: '受け身が重なると、誰が何をしたのかが曖昧になります。',
    params: [{ key: 'perSentence', label: '一文あたりの上限', type: 'number', value: 2, min: 1, max: 6, step: 1 }],
    run: function (ctx, add, params) {
      for (var i = 0; i < ctx.sentences.length; i++) {
        var s = ctx.sentences[i];
        var n = countMatches(s.text, /(?:られ|され)(?:る|た|て|ます|ました|ない|ぬ)/g);
        if (n > params.perSentence) {
          add({
            start: s.start, end: s.end,
            message: 'この文に「られる／される」が ' + n + ' 回あります。',
            advice: '受け身と可能が混ざると、誰が何をしたのかが曖昧になります。主体を書けるところは能動に直してください。'
          });
        }
      }
    }
  });

  /* ---------------- 二重否定 ---------------- */
  S.registerRule({
    id: 'expr.double-negative',
    name: '二重否定',
    category: 'expression',
    severity: 'info',
    description: '「〜ないわけではない」のような二重否定は、読者に一手間かけさせます。',
    run: function (ctx, add) {
      var patterns = [
        /な(?:い|く)(?:わけ|こと|の)ではな(?:い|く)/g,
        /ないとは(?:言え|限ら)な(?:い|く)/g,
        /なくはな(?:い|く)/g,
        /ざるを得な(?:い|く)/g,
        /ないでもな(?:い|く)/g,
        /無縁ではな(?:い|く)/g
      ];
      for (var i = 0; i < patterns.length; i++) {
        U.scan(ctx.text, patterns[i], function (m, idx) {
          add({
            start: idx, end: idx + m[0].length,
            message: '二重否定になっています（「' + m[0] + '」）。',
            advice: '肯定で言い切れないか試してください。言い切れないなら、そのニュアンスに意味があります。'
          });
        });
      }
    }
  });

  /* ---------------- 指示語 ---------------- */
  S.registerRule({
    id: 'expr.demonstrative',
    name: '指示語の多用',
    category: 'expression',
    severity: 'hint',
    description: '「これ」「それ」「その」が続くと、何を指しているかが霞みます。',
    params: [{ key: 'perSentence', label: '一文あたりの上限', type: 'number', value: 2, min: 1, max: 6, step: 1 }],
    run: function (ctx, add, params) {
      for (var i = 0; i < ctx.sentences.length; i++) {
        var s = ctx.sentences[i];
        var n = countMatches(s.text, /(?:これ|それ|あれ|この|その|あの|そこ|ここ|そういう|こうした|そうした)/g);
        if (n > params.perSentence) {
          add({
            start: s.start, end: s.end,
            message: 'この文に指示語が ' + n + ' 個あります。',
            advice: '一つを具体的な名詞に戻すだけで、文の輪郭が出ます。'
          });
        }
      }
    }
  });

  /* ---------------- 冗長表現 ---------------- */
  S.registerRule({
    id: 'expr.verbose',
    name: '冗長な言い回し',
    category: 'expression',
    severity: 'info',
    description: '「することができる」など、短くできる言い回しを指摘します。',
    run: function (ctx, add) {
      for (var i = 0; i < D.verbose.length; i++) {
        var v = D.verbose[i];
        (function (v) {
          U.scan(ctx.text, v.re, function (m, idx) {
            add({
              start: idx, end: idx + m[0].length,
              message: '「' + m[0] + '」は縮められます。',
              advice: v.note,
              suggestions: [v.suggest]
            });
          });
        })(v);
      }
    }
  });

  /* ---------------- 強調語・ぼかし・前置き ---------------- */
  function densityRule(id, name, words, label, advice, defaultPer1000, severity) {
    S.registerRule({
      id: id,
      name: name,
      category: 'expression',
      severity: severity || 'info',
      description: label,
      params: [{ key: 'per1000', label: '1000文字あたりの上限', type: 'number', value: defaultPer1000, min: 1, max: 50, step: 1 }],
      run: function (ctx, add, params) {
        var body = ctx.text.replace(/[\s\u3000]/g, '').length;
        if (body < 200) return;
        var hits = [];
        var re = U.alternation(words);
        U.scan(ctx.text, re, function (m, idx) {
          hits.push({ start: idx, end: idx + m[0].length, text: m[0] });
        });
        var allowed = Math.max(1, Math.round((body / 1000) * params.per1000));
        if (hits.length <= allowed) return;
        for (var i = allowed; i < hits.length; i++) {
          add({
            start: hits[i].start, end: hits[i].end,
            message: name + '「' + hits[i].text + '」（本文中 ' + hits.length + ' 回 / 目安 ' + allowed + ' 回）。',
            advice: advice,
            suggestions: D.synonyms[hits[i].text] || null
          });
        }
      }
    });
  }

  densityRule('expr.intensifier', '強調語の多用',
    D.intensifiers, '「とても」「本当に」などの程度副詞が多すぎないかを見ます。',
    '強調語は使うほど効かなくなります。数字か具体例に置き換えると、強調しなくても強くなります。', 6);

  densityRule('expr.hedge', 'ぼかし表現の多用',
    D.hedges, '「かもしれない」「気がする」など断定を避ける表現の量を見ます。',
    '一つひとつは悪くありません。ただし重なると、書き手が何を思っているのか読者に届かなくなります。', 8);

  densityRule('expr.filler', '前置きの多用',
    D.fillers, '「基本的に」「そもそも」など、削っても意味が変わらない語を拾います。',
    '削って読み直してみてください。減らないなら必要な語です。', 5, 'hint');

  /* ---------------- 主語と述語の距離 ---------------- */
  S.registerRule({
    id: 'expr.subject-distance',
    name: '主語と述語が遠い',
    category: 'expression',
    severity: 'info',
    description: '「〜は」から文末までが長いと、読者は主語を忘れます。',
    params: [{ key: 'maxDistance', label: '許容する距離（文字）', type: 'number', value: 50, min: 20, max: 150, step: 5 }],
    run: function (ctx, add, params) {
      for (var i = 0; i < ctx.sentences.length; i++) {
        var s = ctx.sentences[i];
        var idx = s.text.indexOf('は');
        if (idx < 1) continue;
        var dist = s.text.length - idx;
        if (dist > params.maxDistance) {
          add({
            start: s.start + idx, end: s.start + idx + 1,
            message: '主題「は」から文末まで ' + dist + ' 文字あります。',
            advice: '主題を受ける述語を前に寄せるか、文を割ってください。'
          });
        }
      }
    }
  });

  /* ---------------- 体言止めの連続 ---------------- */
  S.registerRule({
    id: 'expr.taigen',
    name: '体言止めの連続',
    category: 'expression',
    severity: 'hint',
    description: '体言止めが続くと、メモのような印象になります。',
    run: function (ctx, add) {
      var chain = [];
      function flush() {
        if (chain.length >= 3) {
          add({
            start: chain[0].start, end: chain[chain.length - 1].end,
            message: '体言止めが ' + chain.length + ' 文続いています。',
            advice: '一文でも述語で締めると、文章に体温が戻ります。'
          });
        }
        chain = [];
      }
      for (var i = 0; i < ctx.sentences.length; i++) {
        if (T.endingStyle(ctx.sentences[i].text) === 'taigen') chain.push(ctx.sentences[i]);
        else flush();
      }
      flush();
    }
  });

  /* ---------------- い抜き言葉 ---------------- */
  S.registerRule({
    id: 'expr.inuki',
    name: 'い抜き言葉',
    category: 'expression',
    severity: 'info',
    enabled: false,
    description: '「〜してる」など「い」の抜けた口語表現を拾います。口語調のエッセイでは既定で無効です。',
    run: function (ctx, add) {
      var words = ['してる', 'してた', 'してます', '見てる', '来てる', '寝てる', '食べてる', '待ってる',
        'やってる', 'なってる', '思ってる', '言ってる', '知ってる', '持ってる', '覚えてる',
        '読んでる', '呼んでる', '住んでる', '遊んでる', '飲んでる', '見てた', 'やってた', '思ってた'];
      U.scan(ctx.text, U.alternation(words), function (m, idx) {
        add({
          start: idx, end: idx + m[0].length,
          message: '「' + m[0] + '」は「い」が抜けた口語形です。',
          advice: '書き言葉に寄せるなら「〜している」。地の文の距離感を決めてから選んでください。'
        });
      });
    }
  });

  /* ---------------- 括弧内注釈 ---------------- */
  S.registerRule({
    id: 'expr.parenthetical',
    name: '括弧による補足の多用',
    category: 'expression',
    severity: 'hint',
    description: '（）での補足が多いと、本文のリズムが途切れます。',
    params: [{ key: 'per1000', label: '1000文字あたりの上限', type: 'number', value: 4, min: 1, max: 20, step: 1 }],
    run: function (ctx, add, params) {
      var body = ctx.text.replace(/[\s\u3000]/g, '').length;
      if (body < 300) return;
      var hits = [];
      U.scan(ctx.text, /（[^）]{2,60}）/g, function (m, idx) {
        hits.push({ start: idx, end: idx + m[0].length });
      });
      var allowed = Math.max(1, Math.round((body / 1000) * params.per1000));
      if (hits.length <= allowed) return;
      for (var i = allowed; i < hits.length; i++) {
        add({
          start: hits[i].start, end: hits[i].end,
          message: '括弧の補足が多いです（' + hits.length + ' 箇所 / 目安 ' + allowed + ' 箇所）。',
          advice: '本文に溶かすか、思い切って削るか。括弧は逃げ道になりやすい記号です。'
        });
      }
    }
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
