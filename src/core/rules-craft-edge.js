/* 推敲 (suikou) — 執筆癖の指摘（弱い結び・弱い冒頭） */
(function (global) {
  'use strict';

  var S = global.Suikou;
  var CU = S.craftUtil;

  S.registerRule({
    id: 'craft.closing-generic',
    name: '一般論で閉じる結び',
    category: 'structure',
    severity: 'hint',
    description: '末尾が「〜が大事」「ということだ」など、誰の末尾にも置ける文になっていないかを見ます。',
    run: function (ctx, add) {
      if (CU.bodyLen(ctx.text) < 400 || ctx.paragraphs.length < 3) return;
      var on = CU.strict(ctx.config);
      var craft = (S.dict && S.dict.craft) || {};
      var words = CU.words(craft.closing || [], craft.closingStrict || [], on);
      var tail = ctx.paragraphs.slice(-(on ? 3 : 2));
      for (var i = 0; i < tail.length; i++) {
        var p = tail[i];
        for (var w = 0; w < words.length; w++) {
          var at = p.text.indexOf(words[w]);
          if (at < 0) continue;
          add({
            start: p.start + at, end: p.start + at + words[w].length,
            severity: CU.sev(on, 'hint', 'info'),
            message: '結びが「' + words[w] + '」で一般論に寄っています。',
            advice: '最後の段落だけ読んでください。誰のエッセイ末尾にも置ける文なら削る。残すのはこの話固有の具体（固有名詞・身体・欲望・最後の行動）。事態は終わってよいが、欲や恥を綺麗に終わらせなくてよい。'
          });
          return;
        }
      }
    }
  });

  S.registerRule({
    id: 'craft.opening-soft',
    name: 'ふんわりした冒頭',
    category: 'structure',
    severity: 'info',
    description: '一文目が結論・自己紹介・ふんわりした言葉で始まっていないかを見ます。',
    run: function (ctx, add) {
      if (CU.bodyLen(ctx.text) < 200 || !ctx.sentences.length) return;
      var on = CU.strict(ctx.config);
      var craft = (S.dict && S.dict.craft) || {};
      var words = CU.words(craft.opening || [], craft.openingStrict || [], on);
      var first = ctx.sentences[0];
      var lead = first.text.replace(/^[#\s\u3000]*/, '');
      for (var i = 0; i < words.length; i++) {
        var word = words[i];
        if (word === '私は') {
          if (!/^私は(?:、|[^。]{0,24}です)/.test(lead)) continue;
        } else if (word.indexOf('について') === 0) {
          var mid = lead.indexOf(word);
          if (mid < 0 || mid > 16) continue;
        } else if (lead.indexOf(word) !== 0) {
          continue;
        }
        add({
          start: first.start, end: Math.min(first.start + word.length + 4, first.end),
          severity: CU.sev(on, 'info', 'warn'),
          message: '一文目が「' + word + '」寄りで始まっています。',
          advice: '結論や自己紹介、ふんわりした言葉から入らない。起きていること、身体の反応、言えなかった一言から入ると、この先が少し気になります。'
        });
        return;
      }
    }
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
