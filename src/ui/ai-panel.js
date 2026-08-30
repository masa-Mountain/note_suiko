/* 推敲 (suikou) — AI 補助の設定欄（任意・既定オフ）
 *
 * 有効にしても、送信はボタンを押した瞬間だけ。判断は ai-review.js が行う。
 */
(function (global) {
  'use strict';

  var S = global.Suikou;
  var UI = S.ui;

  /**
   * AI に任せる範囲と、外部へ送る危険についての説明。
   * @returns {HTMLElement} 説明の塊
   */
  function _notice() {
    return UI.h('div', { class: 'callout neutral' }, [
      UI.h('div', { text: 'ここまでの指摘はすべて、この端末の中の辞書と規則だけで出しています。文意（論理の飛躍、主張と根拠のずれ、段落のつながり）は規則では扱えないので、そこだけを言語モデルに読ませる口を用意しました。' }),
      UI.h('div', { style: 'margin-top:6px', text: '有効にしても、ボタンを押した瞬間しか送信しません。送る内容は事前に全文表示します。誤字・表記の判定に AI は使いません（規則のほうが速く、根拠が読めるからです）。' }),
      UI.h('div', { style: 'margin-top:6px;color:var(--warn)', text: 'R-18 レーティングでは、localhost 以外への送信を止めています。成人向けの原稿を外部の API に送ると、提供元の規約に触れる可能性と、未公開原稿が第三者のサーバーに残る問題があります。Ollama や LM Studio をこの端末で動かすのが安全です。' })
    ]);
  }

  /**
   * 接続先の候補を選ぶ欄。選ぶと URL とモデル名を差し替える。
   * @param {Object} cfg 設定
   * @returns {HTMLElement} 行の要素
   */
  function _presetRow(cfg) {
    return UI.settingRow([
      UI.h('span', { text: '接続先の例' }),
      UI.h('select', {
        onchange: function (ev) {
          var p = S.ai.PRESET_ENDPOINTS[parseInt(ev.target.value, 10)];
          if (!p) return;
          cfg.ai.endpoint = p.url;
          cfg.ai.model = p.model;
          UI.saveConfig();
          UI.renderSettings();
        }
      }, [UI.h('option', { value: '', text: '選ぶ…' })].concat(
        S.ai.PRESET_ENDPOINTS.map(function (p, i) {
          return UI.h('option', { value: String(i), text: p.label });
        })
      ))
    ]);
  }

  /**
   * 接続先・モデル・鍵・上限の入力欄。
   * @param {Object} cfg 設定
   * @returns {Array<HTMLElement>} 行の要素
   */
  function _connectionRows(cfg) {
    return [
      _presetRow(cfg),
      UI.settingRow([
        UI.h('span', { text: 'エンドポイント' }),
        UI.h('input', {
          type: 'text', value: cfg.ai.endpoint, style: 'flex:1 1 300px',
          onchange: function (ev) {
            cfg.ai.endpoint = ev.target.value.trim();
            UI.saveConfig();
            UI.renderSettings();
          }
        }),
        UI.h('span', {
          class: 'hint',
          text: S.ai.isLocalEndpoint(cfg.ai.endpoint)
            ? 'この端末の中です。原稿は外に出ません。'
            : '外部のサーバーです。送った本文は提供元の規約に従って扱われます。R-18 では送信を止めます。'
        })
      ]),
      UI.settingRow([
        UI.h('span', { text: 'モデル名' }),
        UI.h('input', {
          type: 'text', value: cfg.ai.model,
          onchange: function (ev) { cfg.ai.model = ev.target.value.trim(); UI.saveConfig(); }
        })
      ]),
      UI.settingRow([
        UI.h('span', { text: 'API キー' }),
        UI.h('input', {
          type: 'password', value: cfg.ai.apiKey, placeholder: 'ローカルなら空でよい',
          onchange: function (ev) { cfg.ai.apiKey = ev.target.value; UI.saveConfig(); }
        }),
        UI.h('span', {
          class: 'hint',
          text: 'この端末の localStorage に平文で残ります。共有端末では入れないでください。'
        })
      ]),
      UI.settingRow([
        UI.h('span', { text: '一度に送る上限（文字）' }),
        UI.h('input', {
          type: 'number', value: cfg.ai.maxChars, min: 500, max: 40000, step: 500,
          onchange: function (ev) {
            cfg.ai.maxChars = parseInt(ev.target.value, 10) || 6000;
            UI.saveConfig();
          }
        })
      ]),
      UI.settingRow([
        UI.h('input', {
          type: 'checkbox', checked: cfg.ai.allowRemoteForR18 ? 'checked' : null,
          onchange: function (ev) {
            if (ev.target.checked && !confirm(
              'R-18 の原稿を localhost 以外へ送ることを許可します。\n\n' +
              '提供元の利用規約に触れる可能性があり、未公開の原稿が第三者のサーバーに残ります。\n' +
              '本当に許可しますか。')) {
              ev.target.checked = false;
              return;
            }
            cfg.ai.allowRemoteForR18 = ev.target.checked;
            UI.saveConfig();
          }
        }),
        UI.h('span', { text: 'R-18 でも外部への送信を許可する（非推奨）' })
      ])
    ];
  }

  /**
   * 問い合わせボタンと、返ってきた状態の表示。
   * @returns {Array<HTMLElement>} 行の要素
   */
  function _actionRows() {
    return [
      UI.settingRow([
        UI.h('button', { class: 'primary', onclick: UI.askAi, text: '本文を AI に読ませる' }),
        UI.state.aiIssues.length ? UI.h('button', {
          onclick: function () {
            UI.state.aiIssues = [];
            UI.state.aiState = null;
            UI.runAnalyze();
            UI.renderSettings();
          },
          text: 'AI の指摘を消す（' + UI.state.aiIssues.length + '）'
        }) : null
      ]),
      UI.h('div', {
        class: 'ai-status' + (UI.state.aiError ? ' err' : ''),
        text: UI.state.aiError || UI.state.aiState || ''
      }),
      UI.h('div', { class: 'notation-help', style: 'margin-top:10px' }, [
        UI.h('p', { text: 'つながらない場合：ブラウザから localhost へ通信するには、モデル側で CORS を許す必要があります。Ollama なら環境変数 OLLAMA_ORIGINS を "*" にして起動し直してください。serve.ps1 でこのツールを http で開いていると通りやすくなります。' })
      ])
    ];
  }

  /**
   * AI 補助の節を描く。無効なら入り口のチェックボックスだけを出す。
   * @param {HTMLElement} host 追加先
   * @param {Object} cfg 設定
   * @returns {void}
   */
  UI.renderAiSettings = function (host, cfg) {
    host.appendChild(UI.h('h3', { class: 'section', text: 'AI 補助（任意・既定オフ）' }));
    host.appendChild(_notice());
    host.appendChild(UI.settingRow([
      UI.h('input', {
        type: 'checkbox', checked: cfg.ai.enabled ? 'checked' : null,
        onchange: function (ev) {
          cfg.ai.enabled = ev.target.checked;
          UI.saveConfig();
          UI.renderSettings();
        }
      }),
      UI.h('span', { text: 'AI 補助を有効にする' })
    ]));
    if (!cfg.ai.enabled) return;

    _connectionRows(cfg).concat(_actionRows()).forEach(function (n) {
      host.appendChild(n);
    });
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
