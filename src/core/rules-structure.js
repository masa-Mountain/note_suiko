/* 推敲 (suikou) — 構成のルールと note 最適化のルール */
(function (global) {
  'use strict';

  var S = global.Suikou;
  var T = S.text;
  var U = S.util;

  function bodyLength(text) {
    return text.replace(/[\s\u3000]/g, '').length;
  }

  /**
   * 注意書き・免責の段落か。掴み診断から外す。
   * @param {string} para 1段落
   * @returns {boolean} 注意書きなら true
   */
  function _isDisclaimer(para) {
    var p = para.replace(/^[#\s]*/, '');
    return /^(?:[【\[]?(?:⚠|注意|閲覧注意|ネタバレ)|※)/.test(p) ||
      /自己判断|非医療|医師の指示|閲覧注意/.test(p);
  }

  /**
   * 先頭の注意書きを読み飛ばした位置。
   * @param {string} text 本文
   * @returns {number} 掴み診断を始める文字位置
   */
  function _skipDisclaimer(text) {
    var offset = 0;
    var parts = text.split(/(\n+)/);
    for (var i = 0; i < parts.length; i++) {
      var chunk = parts[i];
      if (/^\n+$/.test(chunk) || !chunk.trim()) {
        offset += chunk.length;
        continue;
      }
      if (_isDisclaimer(chunk) && bodyLength(chunk) <= 240) {
        offset += chunk.length;
        continue;
      }
      break;
    }
    return offset;
  }

  /* =========================================================
   * 構成
   * ========================================================= */

  S.registerRule({
    id: 'struct.paragraph',
    name: '段落が長い',
    category: 'structure',
    severity: 'warn',
    description: 'note の読者は大半がスマホです。一段落が長いと画面が文字で埋まり、離脱します。',
    params: [
      { key: 'maxChars', label: '一段落の上限（文字）', type: 'number', value: 140, min: 40, max: 600, step: 10 },
      { key: 'maxSentences', label: '一段落の上限（文数）', type: 'number', value: 4, min: 1, max: 15, step: 1 }
    ],
    run: function (ctx, add, params) {
      for (var i = 0; i < ctx.paragraphs.length; i++) {
        var p = ctx.paragraphs[i];
        if (/^(#{1,6}\s|>|\||```)/.test(p.text)) continue;
        var len = bodyLength(p.text);
        var sents = T.splitSentences(p.text).length;
        if (len > params.maxChars || sents > params.maxSentences) {
          add({
            start: p.start, end: p.end,
            message: 'この段落は ' + len + ' 文字 / ' + sents + ' 文です。',
            advice: '意味の切れ目で改行を入れてください。note では段落間の空行がそのまま「呼吸」になります。'
          });
        }
      }
    }
  });

  S.registerRule({
    id: 'struct.rhythm',
    name: '文の長さが単調',
    category: 'structure',
    severity: 'hint',
    description: '文の長さがそろいすぎている、または極端にばらついている状態を知らせます。',
    params: [{ key: 'minSentences', label: '判定に必要な文数', type: 'number', value: 12, min: 5, max: 100, step: 1 }],
    run: function (ctx, add, params) {
      var lens = [];
      for (var i = 0; i < ctx.sentences.length; i++) {
        lens.push(bodyLength(ctx.sentences[i].text));
      }
      if (lens.length < params.minSentences) return;
      var mean = lens.reduce(function (a, b) { return a + b; }, 0) / lens.length;
      var variance = lens.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / lens.length;
      var sd = Math.sqrt(variance);
      var cv = sd / mean;
      if (cv < 0.32) {
        add({
          start: ctx.sentences[0].start, end: ctx.sentences[0].end,
          message: '文の長さがそろいすぎています（平均 ' + U.round(mean, 1) + '字 / ばらつき ' + U.round(cv, 2) + '）。',
          advice: '短い一文を挿すだけでリズムが立ちます。長・長・短の並びは日本語で最も読ませる形の一つです。'
        });
      } else if (cv > 1.0) {
        add({
          start: ctx.sentences[0].start, end: ctx.sentences[0].end,
          message: '文の長さのばらつきが大きいです（平均 ' + U.round(mean, 1) + '字 / ばらつき ' + U.round(cv, 2) + '）。',
          advice: '意図的な緩急なら効果的です。そうでなければ、極端に長い文を割ってください。'
        });
      }
    }
  });

  S.registerRule({
    id: 'struct.opening',
    name: '冒頭の掴み',
    category: 'structure',
    severity: 'warn',
    description: 'note は一覧カードと検索結果に冒頭が露出します。ここで読むかどうかが決まります。',
    params: [{ key: 'window', label: '診断する冒頭の文字数', type: 'number', value: 150, min: 50, max: 400, step: 10 }],
    run: function (ctx, add, params) {
      if (bodyLength(ctx.text) < 200) return;
      var from = _skipDisclaimer(ctx.text);
      var body = ctx.text.slice(from);
      var head = body.slice(0, params.window);
      var headEnd = Math.min(ctx.text.length, from + params.window);
      var lead = body.replace(/^[#\s]*/, '');

      if (/^(こんにちは|こんばんは|おはよう|はじめまして|どうも|お久しぶり)/.test(lead)) {
        add({
          start: from, end: Math.min(from + 12, ctx.text.length),
          message: '挨拶から始まっています。',
          advice: '一覧カードに出る最初の一行が挨拶だと、記事の中身が伝わりません。挨拶は二段落目に下げるか、省いてください。'
        });
      }
      if (/^(この記事では|今回は|今日は|本記事では)/.test(lead)) {
        add({
          start: from, end: Math.min(from + 12, ctx.text.length), severity: 'info',
          message: '記事の説明から始まっています。',
          advice: '要約から入るのは実用記事では有効ですが、エッセイでは温度が下がります。場面か一文の断定から入る手もあります。'
        });
      }
      var firstSentence = null;
      for (var i = 0; i < ctx.sentences.length; i++) {
        if (ctx.sentences[i].start >= from) { firstSentence = ctx.sentences[i]; break; }
      }
      if (firstSentence && bodyLength(firstSentence.text) > 70) {
        add({
          start: firstSentence.start, end: firstSentence.end, severity: 'warn',
          message: '一文目が ' + bodyLength(firstSentence.text) + ' 文字あります。',
          advice: '一文目は短く。読者が最初に払うコストを、できるだけ小さくしてください。'
        });
      }
      var concrete = /[0-9０-９]|「|『|[ぁ-ん]、|だった|した|見|聞|匂|触/.test(head);
      if (!concrete) {
        add({
          start: from, end: headEnd, severity: 'info',
          message: '冒頭 ' + params.window + '字に具体物がありません。',
          advice: '固有名詞、数字、場面、セリフ。どれか一つ入るだけで、冒頭は一気に読ませるようになります。'
        });
      }
    }
  });

  S.registerRule({
    id: 'struct.closing',
    name: '結びの弱さ',
    category: 'structure',
    severity: 'hint',
    description: '締めが定型句だけで終わっていないかを見ます。',
    run: function (ctx, add) {
      if (bodyLength(ctx.text) < 400 || ctx.paragraphs.length < 3) return;
      var tail = ctx.paragraphs.slice(-2);
      for (var i = 0; i < tail.length; i++) {
        var p = tail[i];
        if (/^(以上|最後まで読|読んでくれ|読んでいただ|ありがとうございました|それでは|また次回|スキ|フォロー)/.test(p.text) &&
            bodyLength(p.text) < 80) {
          add({
            start: p.start, end: p.end,
            message: '結びが定型のあいさつだけになっています。',
            advice: 'その前に一行、この文章で自分が何に触れたのかを書けませんか。読後感はほぼ最後の一行で決まります。'
          });
        }
      }
    }
  });

  S.registerRule({
    id: 'struct.heading',
    name: '見出しの間隔',
    category: 'structure',
    severity: 'info',
    description: '長い記事に見出しがない、または見出しの間隔が広すぎる状態を指摘します。',
    params: [
      { key: 'requireAt', label: '見出しを求める文字数', type: 'number', value: 2800, min: 500, max: 10000, step: 100 },
      { key: 'maxGap', label: '見出しの最大間隔（文字）', type: 'number', value: 1400, min: 300, max: 6000, step: 100 }
    ],
    run: function (ctx, add, params) {
      var body = bodyLength(ctx.text);
      var heads = ctx.headings;
      if (body >= params.requireAt && heads.length === 0) {
        add({
          start: 0, end: Math.min(20, ctx.text.length), severity: 'warn',
          message: body + '文字の記事に見出しがありません。',
          advice: '見出しは目次になり、読者が「読み切れる」と判断する材料になります。3〜5個が目安です。'
        });
        return;
      }
      if (heads.length === 0) return;
      var marks = [0];
      for (var i = 0; i < heads.length; i++) marks.push(heads[i].span.start);
      marks.push(ctx.text.length);
      for (var k = 1; k < marks.length; k++) {
        var gap = bodyLength(ctx.text.slice(marks[k - 1], marks[k]));
        if (gap > params.maxGap) {
          add({
            start: marks[k - 1], end: Math.min(marks[k - 1] + 20, ctx.text.length),
            message: '見出しのない区間が ' + gap + ' 文字続いています。',
            advice: 'ここに一つ見出しを入れられませんか。話題が変わる箇所を探してください。'
          });
        }
      }
    }
  });

  /* =========================================================
   * note 最適化
   * ========================================================= */

  S.registerRule({
    id: 'note.length',
    name: '記事の長さと読了時間',
    category: 'note',
    severity: 'info',
    description: '文字数が note で読まれやすい帯に入っているかを見ます。',
    params: [
      { key: 'min', label: '下限の目安（文字）', type: 'number', value: 1200, min: 200, max: 5000, step: 100 },
      { key: 'max', label: '上限の目安（文字）', type: 'number', value: 4500, min: 1000, max: 20000, step: 100 },
      { key: 'cps', label: '読書速度（文字/分）', type: 'number', value: 500, min: 200, max: 1200, step: 50 }
    ],
    run: function (ctx, add, params) {
      var body = bodyLength(ctx.text);
      if (body < 100) return;
      var minutes = Math.max(1, Math.round(body / params.cps));
      if (body < params.min) {
        add({
          start: 0, end: Math.min(20, ctx.text.length),
          message: body + '文字（読了 約' + minutes + '分）。note の目安より短めです。',
          advice: '短さ自体は欠点ではありません。ただし一つの主題を深めるには ' + params.min + '字前後が扱いやすい長さです。'
        });
      } else if (body > params.max) {
        add({
          start: 0, end: Math.min(20, ctx.text.length),
          message: body + '文字（読了 約' + minutes + '分）。長めです。',
          advice: '前後編に割るか、見出しで読み飛ばせる構造にしてください。10分を超えると完読率が落ちます。'
        });
      }
    }
  });

  function patternRule(id, name, severity, description, patterns, when) {
    S.registerRule({
      id: id,
      name: name,
      category: 'note',
      severity: severity,
      description: description,
      run: function (ctx, add) {
        if (when && !when(ctx)) return;
        for (var i = 0; i < patterns.length; i++) {
          var p = patterns[i];
          (function (p) {
            U.scan(ctx.text, p.re, function (m, idx) {
              add({
                start: idx, end: idx + m[0].length,
                message: p.msg + 'が使われています。',
                advice: p.advice
              });
            });
          })(p);
        }
      }
    });
  }

  /* note 側に対応する機能がないもの。受け渡しの方法にかかわらず崩れる。 */
  patternRule('note.unsupported', 'note に対応機能がない記法', 'warn',
    'note のエディタに存在しない装飾を指摘します。書き出し方を変えても再現できません。', [
      { re: /^\s*\|.+\|\s*$/gm, msg: '表の記法', advice: 'note に表はありません。箇条書きか画像に置き換えてください。「note用HTMLをコピー」した場合も箇条書きに落とします。' },
      { re: /\[\^[^\]]+\]/g, msg: '脚注の記法', advice: 'note に脚注はありません。括弧書きか、記事末の注記にしてください。' },
      { re: /(?:^|[^*\n])\*[^*\s][^*\n]{0,58}\*(?:[^*]|$)/g, msg: '斜体の「*」記法', advice: 'note に斜体はありません。太字か引用で置き換えてください。' },
      { re: /~~[^~\n]{1,60}~~/g, msg: '取り消し線の記法', advice: 'note に取り消し線はありません。' },
      { re: /^#{3,6}\s+\S/gm, msg: '3階層以上の見出し', advice: 'note の見出しは「大」「小」の2階層だけです。# と ## に収めてください。' },
      { re: /^[ \t]+[-*+]\s+\S/gm, msg: '入れ子の箇条書き', advice: 'note のリストは1階層です。字下げは失われます。' }
    ]);

  /* note へ「文字だけ」で持っていく場合にだけ問題になる記法。
   * 既定では note用HTML でのコピー／WXR での書き出しを前提にしているので黙っている。 */
  patternRule('note.plain-paste', 'プレーンテキストで貼ると残る記法', 'warn',
    '「note への渡し方」を「文字だけ」に設定したときだけ、記号が本文に残る箇所を指摘します。', [
      { re: /^#{1,2}\s+\S/gm, msg: '見出しの「#」記法', advice: 'note では本文を選択して見出しを指定します。文字だけで貼ると「#」が残ります。' },
      { re: /\*\*[^*\n]{1,60}\*\*/g, msg: '太字の「**」記法', advice: 'note の太字ボタンで指定してください。文字だけで貼ると「**」が残ります。' },
      { re: /\[[^\]\n]{1,60}\]\((?:https?:)?[^)\n]{1,200}\)/g, msg: 'リンクの「[]()」記法', advice: 'note では URL を単独行に貼ると埋め込みカードになります。' },
      { re: /^>\s?\S/gm, msg: '引用の「>」記法', advice: 'note の引用ボタンで指定してください。' }
    ], function (ctx) { return ctx.config.note.transfer === 'plain'; });

  S.registerRule({
    id: 'note.blank-line',
    name: '空行の使い方',
    category: 'note',
    severity: 'info',
    description: 'note では空行が読みやすさを決めます。空行ゼロと過剰な連続をそれぞれ指摘します。',
    params: [{ key: 'maxRun', label: '連続する空行の上限', type: 'number', value: 2, min: 1, max: 6, step: 1 }],
    run: function (ctx, add, params) {
      var body = bodyLength(ctx.text);
      var blanks = 0;
      U.scan(ctx.text, /\n[ \u3000]*\n/g, function () { blanks++; });
      if (body > 800 && blanks === 0) {
        var paraN = 0;
        var paraChars = 0;
        for (var i = 0; i < ctx.paragraphs.length; i++) {
          var plen = bodyLength(ctx.paragraphs[i].text);
          if (!plen) continue;
          paraN++;
          paraChars += plen;
        }
        var avgPara = paraN ? paraChars / paraN : body;
        if (avgPara > 80) {
          add({
            start: 0, end: Math.min(20, ctx.text.length), severity: 'warn',
            message: '空行がありません（本文 ' + body + '文字）。',
            advice: 'スマホでは文字の壁になります。3〜4行ごとに空行を入れてください。'
          });
        }
      }
      var re = new RegExp('(?:\\n[ \\u3000]*){' + (params.maxRun + 2) + ',}', 'g');
      U.scan(ctx.text, re, function (m, idx) {
        add({
          start: idx, end: idx + m[0].length, severity: 'hint',
          message: '空行が連続しすぎています。',
          advice: '間を作る手法として意図的ならそのままで構いません。'
        });
      });
    }
  });

  S.registerRule({
    id: 'note.visual',
    name: '視覚要素の間隔',
    category: 'note',
    severity: 'hint',
    description: '画像・引用・箇条書きなど、文字以外の要素が長く出てこない区間を指摘します。',
    params: [{ key: 'maxGap', label: '視覚要素なしで許容する文字数', type: 'number', value: 1600, min: 400, max: 8000, step: 100 }],
    run: function (ctx, add, params) {
      var body = bodyLength(ctx.text);
      if (body < params.maxGap) return;
      var marks = [0];
      for (var i = 0; i < ctx.paragraphs.length; i++) {
        var p = ctx.paragraphs[i];
        if (/^(!\[|>|[-*+・](?:\s|$)|・|[0-9０-９]+[.)．）]\s|【|#{1,6}\s|\[画像|\[写真)/.test(p.text)) marks.push(p.start);
      }
      marks.push(ctx.text.length);
      for (var k = 1; k < marks.length; k++) {
        var gap = bodyLength(ctx.text.slice(marks[k - 1], marks[k]));
        if (gap > params.maxGap) {
          add({
            start: marks[k - 1], end: Math.min(marks[k - 1] + 20, ctx.text.length),
            message: '文字だけの区間が ' + gap + ' 文字続いています。',
            advice: '画像、引用、箇条書き、見出し。どれか一つ挟むと読者の目が休みます。'
          });
        }
      }
    }
  });

  S.registerRule({
    id: 'note.title',
    name: 'タイトルの診断',
    category: 'note',
    severity: 'info',
    description: 'note のタイトルは一覧・検索・SNS で切り取られます。長さと具体性を診断します。',
    params: [
      { key: 'ideal', label: '理想の上限（文字）', type: 'number', value: 32, min: 10, max: 100, step: 1 }
    ],
    run: function (ctx, add, params) {
      var title = (ctx.title || '').trim();
      if (!title) {
        add({
          start: 0, end: 0, severity: 'hint',
          message: 'タイトルが未入力です。',
          advice: 'タイトル欄に入れると、長さ・具体性・記号の使い方を診断します。'
        });
        return;
      }
      if (title.length > params.ideal) {
        add({
          start: 0, end: 0,
          message: 'タイトルが ' + title.length + ' 文字です（目安 ' + params.ideal + ' 文字以内）。',
          advice: '一覧やSNSでは後半が切れます。伝えたい語を前半に寄せてください。'
        });
      }
      if (title.length < 8) {
        add({
          start: 0, end: 0,
          message: 'タイトルが短いです（' + title.length + ' 文字）。',
          advice: '短いタイトルは強いこともありますが、検索では拾われにくくなります。'
        });
      }
      if (!/[0-9０-９]|「|『|、|。|？|——/.test(title) && title.length > 12) {
        add({
          start: 0, end: 0, severity: 'hint',
          message: 'タイトルに具体物（数字・引用・句読点）がありません。',
          advice: '数字か、記事内の一文をそのまま切り出す。この二つがタイトルの定石です。'
        });
      }
      if (/[!！]{1,}|[?？]{2,}|【.*】.*【/.test(title)) {
        add({
          start: 0, end: 0, severity: 'hint',
          message: 'タイトルの記号が強めです。',
          advice: '煽りの記号は、書き手の硬さと矛盾して見えることがあります。'
        });
      }
      // タイトルの内容語がどれだけ本文に出てくるかを見る（完全一致ではなく重なり）
      var titleWords = T.contentWords(title).filter(function (w) {
        return !T.STOPWORDS[w.text];
      });
      if (titleWords.length >= 2) {
        var found = titleWords.filter(function (w) {
          return ctx.text.indexOf(w.text) >= 0;
        }).length;
        if (found / titleWords.length < 0.5) {
          add({
            start: 0, end: 0, severity: 'hint',
            message: 'タイトルの言葉が本文にあまり出てきません（' + found + '/' + titleWords.length + ' 語）。',
            advice: 'タイトルの語が本文にあると、読者は「約束が守られた」と感じます。'
          });
        }
      }
    }
  });

  S.registerRule({
    id: 'note.hashtag',
    name: 'ハッシュタグ',
    category: 'note',
    severity: 'hint',
    enabled: false,
    description: 'タグの数を確認し、本文の頻出語からタグ候補を提案します。執筆中は使わず、公開時に note 側で付ける前提なので既定ではオフです。',
    params: [
      { key: 'min', label: '推奨する下限', type: 'number', value: 3, min: 0, max: 10, step: 1 },
      { key: 'max', label: '推奨する上限', type: 'number', value: 6, min: 1, max: 10, step: 1 }
    ],
    run: function (ctx, add, params) {
      var tags = ctx.hashtags;
      var kw = T.keywords(ctx.text, 8).map(function (k) { return '#' + k.word; });
      if (tags.length < params.min) {
        add({
          start: 0, end: 0,
          message: 'タグが ' + tags.length + ' 個です（推奨 ' + params.min + '〜' + params.max + ' 個）。',
          advice: '大きなタグ（#エッセイ など）1つと、記事固有のタグを組み合わせるのが基本です。',
          suggestions: kw.length ? kw : null
        });
      } else if (tags.length > params.max) {
        add({
          start: 0, end: 0,
          message: 'タグが ' + tags.length + ' 個あります。',
          advice: 'タグを増やしても流入は比例しません。関係の薄いタグは外したほうが読者の期待とずれません。'
        });
      }
    }
  });

  S.registerRule({
    id: 'note.paid',
    name: '有料記事の無料部分',
    category: 'note',
    severity: 'info',
    description: '有料ラインの位置と、無料部分の内容を診断します（設定で有料記事を有効にした場合）。',
    run: function (ctx, add) {
      if (!ctx.config.note.paidArticle) return;
      var marker = ctx.config.note.paidMarker;
      var idx = marker ? ctx.text.indexOf(marker) : -1;
      var body = bodyLength(ctx.text);
      if (idx < 0) {
        add({
          start: 0, end: Math.min(20, ctx.text.length),
          message: '有料ラインの目印「' + marker + '」が本文にありません。',
          advice: '無料部分をどこで切るかを原稿の段階で決めておくと、構成が引き締まります。'
        });
        return;
      }
      var freeRatio = (bodyLength(ctx.text.slice(0, idx)) / body) * 100;
      if (freeRatio < 15) {
        add({
          start: idx, end: idx + marker.length, severity: 'warn',
          message: '無料部分が全体の ' + U.round(freeRatio, 1) + '% しかありません。',
          advice: '無料部分は「買う理由」を作る場所です。20〜40% を目安に、問いを立てて切ってください。'
        });
      } else if (freeRatio > 60) {
        add({
          start: idx, end: idx + marker.length,
          message: '無料部分が全体の ' + U.round(freeRatio, 1) + '% あります。',
          advice: '無料で結論まで出ていないか確認してください。'
        });
      }
      var free = ctx.text.slice(0, idx);
      if (!/[？?]/.test(free)) {
        add({
          start: Math.max(0, idx - 40), end: idx, severity: 'hint',
          message: '無料部分に問いがありません。',
          advice: '無料部分の最後に問いを置くと、続きを読む動機になります。'
        });
      }
    }
  });

  S.registerRule({
    id: 'note.raw-url',
    name: '生の URL',
    category: 'note',
    severity: 'hint',
    description: '文中の URL は note で埋め込みにならず、読みを邪魔します。',
    run: function (ctx, add) {
      U.scan(ctx.text, /https?:\/\/[^\s、。」』）]+/g, function (m, idx) {
        var lineStart = ctx.text.lastIndexOf('\n', idx - 1) + 1;
        var lineEnd = ctx.text.indexOf('\n', idx);
        if (lineEnd < 0) lineEnd = ctx.text.length;
        var line = ctx.text.slice(lineStart, lineEnd).trim();
        if (line === m[0]) return; // 単独行なら埋め込みカードになる
        add({
          start: idx, end: idx + m[0].length,
          message: '文中に URL が埋まっています。',
          advice: 'note では URL を単独の行に置くと埋め込みカードになります。'
        });
      });
    }
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
