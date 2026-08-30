/* 推敲 (suikou) — AI への問い合わせ
 *
 * 送る前に必ず全文を見せて確認を取る。R-18 の原稿を外部へ出さない判定は
 * S.ai.precheck が持っていて、ここはその結果を表示するだけ。
 */
(function (global) {
  'use strict';

  var S = global.Suikou;
  var UI = S.ui;

  /**
   * 送信内容の要約（宛先・モデル・字数）。
   * @param {Object} cfg 設定
   * @param {{chars: number, truncated: boolean}} payload 送信内容
   * @param {boolean} local 宛先がこの端末の中か
   * @returns {HTMLElement} 要約の塊
   */
  function _summary(cfg, payload, local) {
    return UI.h('div', { class: 'kv' }, [
      UI.h('b', { text: '宛先　' }),
      document.createTextNode(cfg.ai.endpoint + (local ? '（この端末の中）' : '（外部のサーバー）')),
      UI.h('br'),
      UI.h('b', { text: 'モデル　' }), document.createTextNode(cfg.ai.model), UI.h('br'),
      UI.h('b', { text: '本文　' }),
      document.createTextNode(payload.chars + ' 字' +
        (payload.truncated ? '（上限で切りました。続きは別途送ってください）' : ''))
    ]);
  }

  /**
   * 送る内容を確認するダイアログを開く。
   * @returns {void}
   */
  UI.askAi = function () {
    var input = UI.currentInput();
    var cfg = UI.state.config;
    var reason = S.ai.precheck(input, cfg);
    if (reason) {
      UI.dialog('送信できません', [UI.h('div', { style: 'white-space:pre-wrap', text: reason })]);
      return;
    }
    var payload = S.ai.buildPayload(input, cfg);
    var local = S.ai.isLocalEndpoint(cfg.ai.endpoint);
    UI.dialog('この内容を送信します', [
      _summary(cfg, payload, local),
      UI.h('p', {
        style: 'margin-top:10px',
        text: '返ってくるのは指摘だけです。本文の書き換えは求めていません。'
      }),
      UI.h('pre', { class: 'payload', text: payload.system + '\n\n---\n\n' + payload.user })
    ], [
      UI.h('button', {
        class: 'primary',
        onclick: function () {
          UI.closeDialog();
          UI.sendToAi(input);
        },
        text: local ? '送信する' : '外部に送信する'
      })
    ]);
  };

  /**
   * 状態表示を更新する。設定タブを開いていればそちらも描き直す。
   * @returns {void}
   */
  function _refresh() {
    UI.renderStatus();
    if (UI.state.activeTab === 'settings') UI.renderSettings();
  }

  /**
   * 決めた形式で返ってこなかった回答を、そのまま見せる。
   * @param {string} raw 回答の生テキスト
   * @returns {void}
   */
  function _showRaw(raw) {
    UI.state.aiState = '回答を指摘の形に読み取れませんでした';
    UI.dialog('AI の回答', [
      UI.h('p', { text: '決めた形式で返ってこなかったので、そのまま表示します。' }),
      UI.h('pre', { class: 'payload', text: raw })
    ]);
  }

  /**
   * 問い合わせて、返ってきた指摘を state に取り込む。
   * @param {Object} input 解析の入力（UI.currentInput の戻り値）
   * @returns {void}
   */
  UI.sendToAi = function (input) {
    UI.state.aiError = null;
    UI.state.aiState = '問い合わせ中…';
    _refresh();
    S.ai.review(input, UI.state.config).then(function (res) {
      UI.state.aiIssues = res.issues;
      UI.state.aiState = res.issues.length
        ? res.issues.length + ' 件の指摘'
        : '文意の問題は見つからないという回答でした';
      if (!res.issues.length && res.raw && res.raw.trim() && res.raw.indexOf('[]') < 0) {
        _showRaw(res.raw);
      }
      UI.runAnalyze();
      if (UI.state.activeTab === 'settings') UI.renderSettings();
    }).catch(function (e) {
      UI.state.aiState = null;
      UI.state.aiError = String(e && e.message ? e.message : e);
      _refresh();
      UI.dialog('問い合わせに失敗しました', [
        UI.h('div', { style: 'white-space:pre-wrap', text: UI.state.aiError })
      ]);
    });
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
