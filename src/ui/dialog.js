/* 推敲 (suikou) — 確認・一覧表示に使う簡易ダイアログ */
(function (global) {
  'use strict';

  var S = global.Suikou;
  var UI = S.ui;

  /**
   * ダイアログを開く。「閉じる」ボタンは常に足す。
   * @param {string} title 見出し
   * @param {Array<Node|string|null>} [bodyNodes] 本体。文字列は段落として置く
   * @param {Array<Node>} [footNodes] 「閉じる」の左に並べるボタン
   * @returns {HTMLDialogElement} 開いたダイアログ
   */
  UI.dialog = function (title, bodyNodes, footNodes) {
    var dlg = UI.$('dialog');
    UI.$('dlg-title').textContent = title;
    var body = UI.$('dlg-body');
    var foot = UI.$('dlg-foot');
    UI.clear(body);
    UI.clear(foot);
    (bodyNodes || []).forEach(function (n) {
      if (n === null || n === undefined) return;
      body.appendChild(typeof n === 'string' ? UI.h('p', { text: n }) : n);
    });
    (footNodes || []).forEach(function (n) { foot.appendChild(n); });
    foot.appendChild(UI.h('button', {
      onclick: function () { dlg.close(); },
      text: '閉じる'
    }));
    if (!dlg.open) dlg.showModal();
    return dlg;
  };

  /**
   * 開いているダイアログを閉じる。
   * @returns {void}
   */
  UI.closeDialog = function () {
    var dlg = UI.$('dialog');
    if (dlg.open) dlg.close();
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
