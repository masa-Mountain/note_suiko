/* 推敲 (suikou) — 自己テスト
 * ルールが意図どおりに発火するか、誤検知していないかを確認する。
 * test.html を開くと実行される。 */
(function (global) {
  'use strict';

  var S = global.Suikou;
  var results = [];

  function analyze(text, overrides) {
    var cfg = S.config.defaults();
    if (overrides) {
      Object.keys(overrides).forEach(function (k) {
        if (k === 'rules') {
          Object.keys(overrides.rules).forEach(function (id) { cfg.rules[id] = overrides.rules[id]; });
        } else if (['dictionary', 'note', 'display', 'ai'].indexOf(k) >= 0) {
          Object.keys(overrides[k]).forEach(function (dk) { cfg[k][dk] = overrides[k][dk]; });
        } else {
          cfg[k] = overrides[k];
        }
      });
    }
    return S.analyze({
      text: text, title: '', hashtags: [], config: cfg,
      resolved: overrides && overrides.resolved, suppressed: overrides && overrides.suppressed
    });
  }

  function hits(result, ruleId) {
    return result.issues.filter(function (i) { return i.ruleId === ruleId; });
  }

  function check(name, condition, detail) {
    results.push({ name: name, ok: !!condition, detail: detail || '' });
  }

  function expectRule(name, text, ruleId, min, overrides) {
    var r = analyze(text, overrides);
    var n = hits(r, ruleId).length;
    check(name, n >= (min === undefined ? 1 : min), ruleId + ' の検出数 = ' + n);
  }

  function expectNoRule(name, text, ruleId, overrides) {
    var r = analyze(text, overrides);
    var list = hits(r, ruleId);
    check(name, list.length === 0, ruleId + ' が ' + list.length + ' 件発火（' +
      list.map(function (i) { return i.message; }).join(' / ') + '）');
  }

  S.runSelfTest = function () {
    results = [];

    /* ---- 文分割 ---- */
    var sents = S.text.splitSentences('今日は晴れだ。だから歩いた。\n「そうだね」と彼は言った。3.14は円周率。');
    check('文分割: 4文になる', sents.length === 4, '実際は ' + sents.length + ' 文: ' +
      sents.map(function (s) { return s.text; }).join(' | '));
    check('文分割: 小数点で切らない', sents[3] && sents[3].text.indexOf('3.14') === 0, sents[3] && sents[3].text);

    /* ---- 文体判定 ---- */
    check('文体: 敬体', S.text.endingStyle('私は書きます。') === 'polite');
    check('文体: 常体', S.text.endingStyle('私は書いた。') === 'plain');
    check('文体: 体言止め', S.text.endingStyle('静かな夜。') === 'taigen');

    /* ---- 校正 ---- */
    expectRule('誤字: 的を得る', '彼の指摘は的を得ている。', 'typo.dict');
    expectRule('ら抜き: 食べれる', 'これは食べれると思う。', 'typo.ranuki');
    expectRule('重言: 一番最初', '一番最初に思ったことを書く。', 'typo.redundancy');
    expectRule('助詞重複: がが', '私がが書いた文章。', 'typo.particle-dup');
    expectNoRule('助詞重複: 「ものの」を誤検知しない',
      '間に合わなかったものの、書き終えた。', 'typo.particle-dup');
    expectNoRule('助詞重複: 「ののしる」を誤検知しない',
      '彼はののしるように言った。', 'typo.particle-dup');
    expectRule('括弧: 閉じ忘れ', '彼は「そうだね と言った。', 'typo.bracket');
    expectNoRule('括弧: 正常な対応は検出しない', '彼は「そうだね」と言った（たぶん）。', 'typo.bracket');
    expectRule('記号: 半角カナ', 'ﾃｽﾄです。', 'typo.symbol');
    expectRule('記号: 三点リーダ', 'そして...彼は消えた。', 'typo.symbol');
    expectRule('呼応: 決して', '決してそれは正しいと思う。', 'typo.correlation');
    expectNoRule('呼応: 決して〜ない は検出しない', '決してそれは正しくない。', 'typo.correlation');
    expectRule('二重敬語', 'お伺いしますのでお待ちください。', 'typo.keigo');

    /* ---- 表記揺れ ---- */
    expectRule('表記揺れ: できる/出来る', 'それはできる。あれも出来る。これもできる。', 'consistency.variants');
    expectNoRule('表記揺れ: 単一表記なら検出しない', 'それはできる。あれもできる。', 'consistency.variants');
    expectNoRule('表記揺れ: 「仕事」を「事」と誤認しない', '仕事のことを考える。事件は起きた。', 'consistency.variants');
    expectRule('表記揺れ: 長音の自動検出（辞書外）', 'メンバーの声。メンバの反応。メンバーの数。', 'consistency.auto');
    expectRule('表記揺れ: 長音（辞書側）', 'ユーザーの声。ユーザの反応。ユーザーの数。', 'consistency.variants');
    expectNoRule('表記揺れ: 短い語を長い語の一部と誤認しない', 'サーバーを再起動した。サーバーは無事だ。', 'consistency.variants');
    expectRule('文体混在', [
      '私は書いた。', '文章を練る。', '推敲を重ねる。', '朝が来た。',
      'それでも書きます。', '毎日続けた。', '言葉を選んだ。'
    ].join(''), 'consistency.style');

    /* ---- 表現 ---- */
    expectRule('長文の検出',
      'この文章はとても長くて主語と述語の距離が離れているうえに読点も多く挿入されているため読者が意味を取りづらくなっており、結果として理解に時間がかかる構造になってしまっている。',
      'expr.long-sentence');
    expectRule('文末の連続', '朝が来た。鳥が鳴いた。私は起きた。窓を開けた。', 'expr.ending-repeat');
    expectRule('二重否定', 'それは正しくないわけではない。', 'expr.double-negative');
    expectRule('冗長表現', 'ここで確認することができる。', 'expr.verbose');
    expectRule('「の」の三連続', '私の友人の父の会社は大きい。', 'expr.particle-chain');

    /* ---- 語彙 ---- */
    expectRule('言い換え候補', 'すごい景色だった。本当にすごい。すごいと思う。', 'vocab.monotone');

    var kwNoise = S.text.keywords('詳しくは https://example.com/summer と test@example.com を見てください。記憶と記憶。', 8);
    check('語彙: URL とメールを頻出語から外す',
      kwNoise.every(function (k) { return !/example|https|com/.test(k.word); }),
      kwNoise.map(function (k) { return k.word; }).join(','));

    /* ---- 構成・note ---- */
    expectRule('note: 表は対応機能がない', '| A | B |\n| --- | --- |\n', 'note.unsupported');
    expectNoRule('note: 既定（HTML/WXR で渡す）では # を指摘しない',
      '# 見出し\n\n本文です。', 'note.plain-paste');
    expectRule('note: 文字だけで渡す設定なら # を指摘する',
      '# 見出し\n\n本文です。', 'note.plain-paste', 1, { note: { transfer: 'plain' } });
    expectRule('note: 生URL', '詳しくは https://example.com/page を見てください。', 'note.raw-url');
    expectNoRule('note: 単独行のURLは指摘しない', '詳しくはこちら。\nhttps://example.com/page\n続きます。', 'note.raw-url');
    expectRule('構成: 挨拶で始まる',
      'こんにちは。今日は文章について書きます。' + 'ここに本文が続きます。'.repeat(30), 'struct.opening');

    /* ---- レーティング ---- */
    expectRule('全年齢: 性的な気配', '二人は裸で抱き合った。', 'rating.sensual', 1, { rating: 'all-ages' });
    expectNoRule('R-18: 性的表現は指摘しない', '二人は裸で抱き合った。', 'rating.sensual', { rating: 'r18' });
    expectRule('R-18: 未成年描写との共起', '高校生の彼女と裸で抱き合った。', 'rating.minor-risk', 1, { rating: 'r18' });
    expectNoRule('全年齢モードでは未成年チェックを動かさない', '高校生の彼女と裸で抱き合った。', 'rating.minor-risk', { rating: 'all-ages' });
    expectRule('R-18: ゾーニング未記載', '本文が始まります。' + 'あ'.repeat(200), 'rating.zoning', 1, { rating: 'r18' });
    expectNoRule('全年齢: 「慢性的」を「性的」と誤検知しない',
      '慢性的な寝不足が続いている。', 'rating.sensual', { rating: 'all-ages' });
    expectNoRule('全年齢: 「個性的」を誤検知しない',
      '個性的な文章だと言われた。', 'rating.sensual', { rating: 'all-ages' });
    expectRule('全年齢: 素の「性的」は拾う',
      'その表現は性的だと言われた。', 'rating.sensual', 1, { rating: 'all-ages' });
    expectNoRule('全年齢: 「裸足」を誤検知しない',
      '裸足で砂浜を歩いた。', 'rating.sensual', { rating: 'all-ages' });
    expectNoRule('暴力: 「見殺し」を誤検知しない', '彼を見殺しにはできない。', 'rating.violence');
    expectNoRule('配慮表現: 「主人公」を「主人」と誤検知しない',
      '主人公の名前を決めた。', 'risk.consideration');
    expectRule('配慮表現: 素の「主人」は拾う', '主人が帰ってきた。', 'risk.consideration');
    expectRule('個人情報: 電話番号', '連絡先は 090-1234-5678 です。', 'risk.personal-info');
    expectRule('個人情報: メール', '連絡は test.user@example.com まで。', 'risk.personal-info');
    expectRule('配慮表現', '看護婦さんが来た。', 'risk.consideration');

    /* ---- ユーザー辞書 ---- */
    expectNoRule('辞書: 指摘しない語で誤検知を止める',
      '的を得るという名前の店に行った。', 'typo.dict',
      { dictionary: { ignore: '的を得る' } });
    expectRule('辞書: 禁止語', 'それはヤバいと思った。', 'risk.banned', 1,
      { dictionary: { banned: 'ヤバい' } });
    expectRule('辞書: 表記統一ルール', '推稿を重ねる。', 'consistency.custom', 1,
      { dictionary: { preferred: '推敲 = 推稿' } });

    /* ---- 引用の除外 ---- */
    expectNoRule('引用行は校正しない', '> 一番最初に彼は言った。', 'typo.redundancy');

    /* ---- 指摘の片付け ---- */
    var dismissText = '一番最初に思ったことを書く。';
    var beforeDismiss = analyze(dismissText);
    var target = hits(beforeDismiss, 'typo.redundancy')[0];
    check('片付け: 指紋が付く', !!(target && target.fingerprint), target ? target.fingerprint : 'なし');
    if (target) {
      var sup = {};
      sup[target.suppressKey] = 1;
      var afterDismiss = analyze(dismissText, { suppressed: sup });
      var still = hits(afterDismiss, 'typo.redundancy')[0];
      check('片付け: 無視すると数に入らない',
        !!still && still.dismissed === 'suppressed' && afterDismiss.activeCount < beforeDismiss.activeCount,
        '前 ' + beforeDismiss.activeCount + ' → 後 ' + afterDismiss.activeCount);
      var res = {};
      res[target.fingerprint] = 1;
      var afterResolve = analyze(dismissText, { resolved: res });
      check('片付け: 対応済みの印が付く',
        hits(afterResolve, 'typo.redundancy')[0].dismissed === 'resolved');
    }

    /* ---- note との相互変換 ---- */
    var notation = [
      '# 大見出し', '', '本文の**太字**です。', '', '> 引用の一行',
      '', '- 箇条書き1', '- 箇条書き2', '', '## 小見出し', '', 'https://example.com/embed'
    ].join('\n');
    var noteHtml = S.noteio.toNoteHtml(notation);
    check('note: 見出しが h2/h3 になる',
      noteHtml.indexOf('<h2>大見出し</h2>') >= 0 && noteHtml.indexOf('<h3>小見出し</h3>') >= 0, noteHtml);
    check('note: 太字が strong になる', noteHtml.indexOf('<strong>太字</strong>') >= 0);
    check('note: 引用が blockquote になる', noteHtml.indexOf('<blockquote>') >= 0);
    check('note: 箇条書きが ul になる', /<ul><li>箇条書き1<\/li><li>箇条書き2<\/li><\/ul>/.test(noteHtml), noteHtml);

    var tightHtml = S.noteio.toNoteHtml('一行目。\n二行目。');
    check('note: 書き出し HTML に余計な改行がない', tightHtml.indexOf('\n') < 0, tightHtml);
    var tightIn = S.noteio.fromHtml('<p>一行目。</p><p>二行目。</p>');
    check('note: 取り込みで段落間の空行を増やさない', tightIn === '一行目。\n二行目。', tightIn);
    var tocIn = S.noteio.fromHtml('<div data-name="tableOfContents">目次</div><p>本文</p>');
    check('note: 目次ブロックを [目次] にする', tocIn.indexOf('[目次]') >= 0 && tocIn.indexOf('本文') >= 0, tocIn);

    var roundTrip = S.noteio.fromHtml(noteHtml);
    check('note: HTML から記法に戻せる（見出し）', roundTrip.indexOf('# 大見出し') >= 0, roundTrip);
    check('note: HTML から記法に戻せる（小見出し）', roundTrip.indexOf('## 小見出し') >= 0, roundTrip);
    check('note: HTML から記法に戻せる（引用）', roundTrip.indexOf('> 引用の一行') >= 0, roundTrip);
    check('note: HTML から記法に戻せる（箇条書き）', roundTrip.indexOf('- 箇条書き1') >= 0, roundTrip);
    check('note: HTML から記法に戻せる（太字）', roundTrip.indexOf('**太字**') >= 0, roundTrip);

    var quoteDiv = S.noteio.fromHtml('<div class="blockquote"><p>箱だけの引用</p><p>出典名</p></div>');
    check('note: class=blockquote の箱を引用にする',
      quoteDiv.indexOf('> 箱だけの引用') >= 0 && quoteDiv.indexOf('> 出典名') >= 0, quoteDiv);
    var wrapped = S.noteio.fromHtml(
      '<div><h2>包まれた見出し</h2><blockquote><p>包まれた引用</p></blockquote></div>');
    check('note: 外側の div を潰さず中の見出しと引用を残す',
      wrapped.indexOf('# 包まれた見出し') >= 0 && wrapped.indexOf('> 包まれた引用') >= 0, wrapped);
    var blocks = S.noteio.parseBlocks('# 見出し\n\n本文です。');
    check('note: ブロックに end がある',
      blocks.length >= 2 && blocks[0].end > blocks[0].start && blocks[1].end > blocks[1].start);

    var ruby = S.noteio.fromHtml('<p><ruby>推敲<rt>すいこう</rt></ruby>を重ねる。</p>');
    check('note: ルビを青空文庫式に変換', ruby.indexOf('｜推敲《すいこう》') >= 0, ruby);

    var wxr = S.noteio.toWxr([{ title: 'テスト記事', html: '<h2>見出し</h2><p>本文</p>', tags: ['エッセイ'], date: new Date() }]);
    check('note: WXR に wxr_version がある', wxr.indexOf('<wp:wxr_version>1.2</wp:wxr_version>') >= 0);
    check('note: WXR は下書き状態', wxr.indexOf('<wp:status><![CDATA[draft]]></wp:status>') >= 0);
    var parsedBack = S.noteio.parseWxr(wxr);
    check('note: 自分で作った WXR を読み戻せる',
      parsedBack.length === 1 && parsedBack[0].title === 'テスト記事' &&
      parsedBack[0].text.indexOf('# 見出し') >= 0,
      JSON.stringify(parsedBack[0] || null));

    var mt = S.noteio.toMt([{ title: 'MT記事', html: '<p>本文</p>', tags: ['日記'], date: new Date() }]);
    var parsedMt = S.noteio.parseMt(mt);
    check('note: MT形式を読み戻せる',
      parsedMt.length === 1 && parsedMt[0].title === 'MT記事' && parsedMt[0].tags[0] === '日記',
      JSON.stringify(parsedMt[0] || null));

    var blocks = S.noteio.parseBlocks('# 見出し\n\n本文。\n\n[目次]\n\n---\n\n```\ncode\n```');
    var types = blocks.map(function (b) { return b.type; }).filter(function (t) { return t !== 'blank'; });
    check('note: ブロック種別を判定できる',
      types.join(',') === 'heading,p,toc,hr,code', types.join(','));

    /* ---- AI 層（通信なしで解析だけ確認） ---- */
    var aiParsed = S.ai.parse(
      '```json\n[{"quote":"だから正しい","kind":"論理の飛躍","message":"前提がない","advice":"根拠を置く"}]\n```',
      'これは事実だ。だから正しい。');
    check('AI: JSON を指摘に変換できる',
      aiParsed.length === 1 && aiParsed[0].located && aiParsed[0].category === 'ai',
      JSON.stringify(aiParsed[0] || null));
    check('AI: ローカル判定', S.ai.isLocalEndpoint('http://localhost:11434/v1/chat/completions') === true &&
      S.ai.isLocalEndpoint('https://api.example.com/v1/chat/completions') === false);
    var r18cfg = S.config.defaults();
    r18cfg.rating = 'r18';
    r18cfg.ai.enabled = true;
    r18cfg.ai.endpoint = 'https://api.example.com/v1/chat/completions';
    check('AI: R-18 は外部送信を止める',
      /localhost 以外/.test(S.ai.precheck({ text: '本文' }, r18cfg) || ''),
      String(S.ai.precheck({ text: '本文' }, r18cfg)));
    r18cfg.ai.endpoint = 'http://localhost:11434/v1/chat/completions';
    check('AI: R-18 でも localhost なら通す', S.ai.precheck({ text: '本文' }, r18cfg) === null,
      String(S.ai.precheck({ text: '本文' }, r18cfg)));

    /* ---- 部分一致・主題語・エッセイ向け閾値 ---- */
    expectNoRule('表記揺れ: 「なかなか」と「頭の中」をなか/中と誤認しない',
      'なかなか進まない。頭の中で考える。集中する。', 'consistency.variants');
    var themeBody = '不機嫌が続く。不機嫌が抜けない。不機嫌なまま歩く。不機嫌を選ぶ。不機嫌は残る。';
    var themeRes = S.analyze({
      text: themeBody + themeBody + themeBody,
      title: '選ばれたのは、不機嫌でした。',
      hashtags: [], config: S.config.defaults(), resolved: {}, suppressed: {}
    });
    check('主題語は近接反復しない',
      hits(themeRes, 'expr.near-repeat').every(function (i) {
        return !i.context || i.context.hit !== '不機嫌';
      }),
      hits(themeRes, 'expr.near-repeat').map(function (i) { return i.context && i.context.hit; }).join(','));
    expectNoRule('見出し: 2800字未満は求めない',
      'これはエッセイの本文です。'.repeat(160), 'struct.heading');
    expectRule('見出し: 十分長い記事には求める',
      'これはエッセイの本文です。'.repeat(230), 'struct.heading');
    var shortParas = [];
    for (var sp = 0; sp < 90; sp++) shortParas.push('短い段落を重ねて書いています。');
    expectNoRule('空行: 1行1段落なら出さない', shortParas.join('\n'), 'note.blank-line');
    var visMid = 'あいうえお。'.repeat(170) + '\n・対照の説明です\n' + 'かきくけこ。'.repeat(170);
    expectNoRule('視覚: 「・」始まりを箇条書きとみなす', visMid, 'note.visual');
    expectRule('常体のだ/である混在',
      '私は書いた。それは事実だ。朝が来た。夜も同じだ。しかし理由は別である。結論はこうである。終わりである。',
      'consistency.plain-mix');
    expectRule('特定されうる組み合わせ',
      '池袋駅の近くで彼女と待った。上司に呼ばれた。', 'risk.identifiable');
    expectNoRule('特定: 職場だけなら出さない',
      '上司に呼ばれた。職場は遠かった。同僚もいた。', 'risk.identifiable');
    var herOnly = ('彼女と歩いた。記憶を辿る。思う。'.repeat(12));
    var herAud = analyze(herOnly);
    var fiction = herAud.audience && herAud.audience.genres.filter(function (g) {
      return g.id === 'fiction';
    })[0];
    check('読者像: 「彼女」を「彼」と数えない',
      !fiction || fiction.matched.indexOf('彼') < 0,
      fiction ? fiction.matched.join(',') : 'no-fiction');
    var fukkiAud = analyze('私は不機嫌だ。'.repeat(20));
    check('極性: 「不機嫌」の「嫌」を数えない',
      !fukkiAud.audience || fukkiAud.audience.polarity === 0,
      fukkiAud.audience ? String(fukkiAud.audience.polarity) : 'null');
    expectNoRule('読点: 「4,5年」「5,6℃」は混在としない',
      '4,5年ほど悩んだ。札幌は氷点下5,6℃まで冷え込む。それでも雪は白い。',
      'consistency.punctuation-style');
    expectNoRule('断定: 「必ず医師の指示」は残す',
      '減薬は必ず医師の指示に従ってください。自己判断は厳禁です。',
      'risk.assertion');
    expectRule('断定: 素の「必ず」は拾う',
      'この方法なら必ずうまくいく。', 'risk.assertion');
    var watashi = analyze('私は歩いた。記憶を辿る。思う。日常の風景だ。'.repeat(10));
    var watashiFic = watashi.audience && watashi.audience.genres.filter(function (g) {
      return g.id === 'fiction';
    })[0];
    check('読者像: 「私は」を小説語と数えない',
      !watashiFic || watashiFic.matched.indexOf('私は') < 0,
      watashiFic ? watashiFic.matched.join(',') : 'no-fiction');
    expectNoRule('冒頭: 注意書きの長文を一文目としない',
      '【注意】非医療従事者による体験談です。自己判断の減薬は厳禁です。\n\n' +
      '1月から薬を減らした。' + '本文がここに続きます。'.repeat(12),
      'struct.opening');

    /* ---- 計量 ---- */
    var m = S.metrics.compute('私は書いた。彼も書いた。', '', S.config.defaults());
    check('計量: 文数', m.sentences === 2, '実際 ' + m.sentences);
    check('計量: 本文文字数', m.body === 12, '実際 ' + m.body);

    /* ---- 読者像 ---- */
    var long = 'かつて祖母の家には、夏の匂いがした。縁側の板は日に焼けて温かく、風鈴の音が遠くから聞こえた。私はそこで、何もしない時間の使い方を覚えたのだと思う。'.repeat(4);
    var ar = analyze(long);
    check('読者像: 推定が返る', !!ar.audience && ar.audience.axes.length === 8, ar.audience ? 'ok' : 'null');
    check('読者像: ジャンル候補がある', !!ar.audience && ar.audience.genres.length > 0);

    /* ---- プリセット ---- */
    var cfg = S.config.defaults();
    S.config.applyPreset(cfg, 'novel-r18');
    check('プリセット: R-18 でレーティングが切り替わる', cfg.rating === 'r18', cfg.rating);
    S.config.applyPreset(cfg, 'minimal');
    var offCount = 0;
    S.rules.forEach(function (r) {
      if (!S.config.resolveRule(cfg, r).enabled) offCount++;
    });
    check('プリセット: 最小限で大半のルールが無効', offCount > S.rules.length * 0.6,
      '無効 ' + offCount + ' / 全 ' + S.rules.length);

    /* ---- 全ルールが例外なく動くか ---- */
    var stress = '# 見出し\n\nこんにちは。私は書いた。でも、それはできる、出来る、とても、とても長い文章であり、'
      + '一番最初にお伺いしますし、決して正しいと思うし、私の友人の父の会社の話をすることができるのである。\n\n'
      + '> 引用文です。\n\n連絡は 090-1234-5678、test@example.com。ユーザとユーザーが混在。ﾃｽﾄ...\n';
    ['essay-general', 'essay-hard', 'diary', 'novel-general', 'novel-r18', 'business', 'public-strict', 'minimal']
      .forEach(function (pid) {
        var c = S.config.defaults();
        S.config.applyPreset(c, pid);
        var res = S.analyze({ text: stress, title: 'テストの記事', hashtags: ['エッセイ'], config: c });
        var errs = res.issues.filter(function (i) { return i.id.indexOf(':error') > 0; });
        check('プリセット「' + pid + '」で例外なし', errs.length === 0,
          errs.map(function (e) { return e.ruleId + ': ' + e.advice; }).join(' / '));
      });

    return results;
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
