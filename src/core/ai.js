/* 推敲 (suikou) — AI 補助（任意・既定オフ）
 *
 * 設計上の約束
 *  1. 既定では無効。有効にしても、ボタンを押した瞬間しか送信しない。自動送信はしない。
 *  2. 送信する内容は事前に全文表示して確認を取る。
 *  3. R-18 レーティングでは、宛先が localhost 以外なら送信を拒否する。
 *     成人向けの原稿を外部の API に投げるのは、規約・秘匿の両面でリスクが大きい。
 *  4. AI に任せるのは「文意」だけ。誤字・表記・記号はルールエンジンの担当で、
 *     そちらのほうが速く、確実で、根拠が読める。
 *  5. 返ってくるのは指摘のみ。書き換え文は求めない（プロンプトで明示的に禁じている）。
 *
 * 通信先は OpenAI 互換の /chat/completions を想定している。
 *   Ollama    : http://localhost:11434/v1/chat/completions
 *   LM Studio : http://localhost:1234/v1/chat/completions
 *   llama.cpp : http://localhost:8080/v1/chat/completions
 */
(function (global) {
  'use strict';

  var S = global.Suikou;
  var AI = (S.ai = {});

  AI.PRESET_ENDPOINTS = [
    { label: 'Ollama（ローカル）', url: 'http://localhost:11434/v1/chat/completions', model: 'qwen2.5:14b' },
    { label: 'LM Studio（ローカル）', url: 'http://localhost:1234/v1/chat/completions', model: 'local-model' },
    { label: 'llama.cpp server（ローカル）', url: 'http://localhost:8080/v1/chat/completions', model: 'local-model' }
  ];

  AI.KINDS = ['論理の飛躍', '主張と根拠', '段落のつながり', '要確認の断定', '話題の重複', '約束のずれ', '誤読の恐れ'];

  AI.isLocalEndpoint = function (url) {
    try {
      var u = new URL(url);
      var h = u.hostname;
      return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]';
    } catch (e) {
      return false;
    }
  };

  AI.SYSTEM_PROMPT = [
    'あなたは日本語の文章の校閲者です。相手は自分の手で書き切ることを大事にしている書き手です。',
    '本文を書き換えず、指摘と、書き手が自分で考えるための視点だけを返してください。修正後の文章は絶対に書かないでください。',
    '',
    '見るのは次の観点だけです。誤字・脱字・表記の揺れ・句読点・助詞の誤りは別のツールが担当するので、いっさい触れないでください。',
    '1. 論理の飛躍（前提が示されないまま結論に進んでいる箇所）',
    '2. 主張と根拠の不一致',
    '3. 段落間のつながりの欠落',
    '4. 事実確認が必要な断定',
    '5. 話題の重複（同じことを二度言っている箇所）',
    '6. タイトルや冒頭で読者に与えた期待と、本文の内容のずれ',
    '7. 読者が誤読しうる箇所（主語の取り違え、指示語の指す先が曖昧）',
    '',
    '指摘は多くても8件までに絞ってください。些細なものより、読者がつまずく大きいものを優先します。',
    '',
    '出力は次の形の JSON 配列だけにしてください。前後に説明やコードブロックの記号を付けないこと。',
    '[{"quote":"本文からの引用（10〜40字。原文と一字も違わないように写す）","kind":"観点名","message":"何が起きているか（1〜2文）","advice":"書き手が自分で考えるための視点（1〜2文）。修正文は書かない"}]',
    '指摘がなければ [] だけを返してください。'
  ].join('\n');

  /** 送信する内容を組み立てる。UI はこれを表示して確認を取る。 */
  AI.buildPayload = function (input, config) {
    var body = String(input.text || '');
    var limit = config.ai.maxChars;
    var truncated = body.length > limit;
    if (truncated) body = body.slice(0, limit);

    var user = [];
    if (input.title) user.push('タイトル: ' + input.title);
    if (input.hashtags && input.hashtags.length) user.push('タグ: ' + input.hashtags.join(' '));
    user.push('レーティング: ' + ({ strict: '全年齢（厳格）', 'all-ages': '全年齢', r18: 'R-18' }[config.rating] || ''));
    user.push('');
    user.push('--- 本文 ---');
    user.push(body);

    return {
      system: AI.SYSTEM_PROMPT,
      user: user.join('\n'),
      truncated: truncated,
      chars: body.length
    };
  };

  /** 送信前の検査。問題があれば理由の文字列を返す（問題なければ null）。 */
  AI.precheck = function (input, config) {
    if (!config.ai.enabled) return 'AI 補助が無効です。設定タブで有効にしてください。';
    if (!config.ai.endpoint) return '送信先のエンドポイントが設定されていません。';
    if (!String(input.text || '').trim()) return '本文が空です。';
    var local = AI.isLocalEndpoint(config.ai.endpoint);
    if (config.rating === 'r18' && !local && !config.ai.allowRemoteForR18) {
      return 'R-18 レーティングでは、localhost 以外への送信を止めています。\n\n' +
        '成人向けの原稿を外部の API に送るのは、(1) 提供元の利用規約に触れる可能性、' +
        '(2) 未公開原稿が第三者のサーバーに残る、という二つのリスクがあります。\n\n' +
        'Ollama や LM Studio をこの端末で動かして、そのエンドポイントを指定してください。' +
        'どうしても外部を使う場合は、設定の「R-18 でも外部送信を許可する」を明示的にオンにしてください。';
    }
    return null;
  };

  /** 実際に問い合わせる。戻り値は Promise。 */
  AI.review = function (input, config) {
    var reason = AI.precheck(input, config);
    if (reason) return Promise.reject(new Error(reason));

    var payload = AI.buildPayload(input, config);
    var headers = { 'Content-Type': 'application/json' };
    if (config.ai.apiKey) headers['Authorization'] = 'Bearer ' + config.ai.apiKey;

    return fetch(config.ai.endpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        model: config.ai.model,
        temperature: config.ai.temperature,
        stream: false,
        messages: [
          { role: 'system', content: payload.system },
          { role: 'user', content: payload.user }
        ]
      })
    }).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) {
          throw new Error('エンドポイントが ' + res.status + ' を返しました。\n' + t.slice(0, 400));
        });
      }
      return res.json();
    }).then(function (json) {
      var content = '';
      if (json.choices && json.choices[0]) {
        content = (json.choices[0].message && json.choices[0].message.content) || json.choices[0].text || '';
      } else if (json.message && json.message.content) {
        content = json.message.content; // Ollama のネイティブ形式
      } else if (typeof json.response === 'string') {
        content = json.response;
      }
      return {
        issues: AI.parse(content, input.text),
        raw: content,
        truncated: payload.truncated
      };
    });
  };

  /** モデルの出力から JSON を取り出し、指摘の形に整える。 */
  AI.parse = function (content, text) {
    var body = String(content || '').trim();
    body = body.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    var start = body.indexOf('[');
    var end = body.lastIndexOf(']');
    if (start < 0 || end <= start) return [];
    var arr;
    try {
      arr = JSON.parse(body.slice(start, end + 1));
    } catch (e) {
      return [];
    }
    if (!Array.isArray(arr)) return [];

    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var it = arr[i] || {};
      var quote = String(it.quote || '').trim();
      var at = quote ? text.indexOf(quote) : -1;
      if (at < 0 && quote.length > 8) {
        // 一字違いで見つからないことがあるので、頭のほうだけで探し直す
        at = text.indexOf(quote.slice(0, Math.min(12, quote.length)));
      }
      out.push({
        ruleId: 'ai.review',
        ruleName: 'AI の読み（文意）',
        category: 'ai',
        severity: 'info',
        kind: String(it.kind || '文意'),
        quote: quote,
        start: at >= 0 ? at : 0,
        end: at >= 0 ? at + quote.length : 0,
        located: at >= 0,
        message: '[' + String(it.kind || '文意') + '] ' + String(it.message || ''),
        advice: String(it.advice || '')
      });
    }
    return out;
  };

  /** 本文が編集されたあと、引用文字列から位置を取り直す。 */
  AI.relocate = function (issues, text) {
    return issues.map(function (i) {
      var at = i.quote ? text.indexOf(i.quote) : -1;
      var copy = {};
      Object.keys(i).forEach(function (k) { copy[k] = i[k]; });
      copy.start = at >= 0 ? at : 0;
      copy.end = at >= 0 ? at + i.quote.length : 0;
      copy.located = at >= 0;
      return copy;
    });
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
