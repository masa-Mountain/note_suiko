/* 推敲 (suikou) — DOM とファイル入出力の小道具 */
(function (global) {
  'use strict';

  var S = global.Suikou;
  var UI = S.ui;

  /**
   * @param {string} id 要素の id
   * @returns {HTMLElement|null} 見つかった要素
   */
  UI.$ = function (id) {
    return document.getElementById(id);
  };

  /**
   * 要素を組み立てる。attrs のキーは class / text / on〜（イベント）を特別扱いし、
   * それ以外は属性として設定する。
   * @param {string} tag タグ名
   * @param {Object|null} [attrs] 属性・イベントハンドラ
   * @param {Array<Node|string|null>} [children] 子ノード（null は無視）
   * @returns {HTMLElement} 組み立てた要素
   */
  UI.h = function (tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach(function (c) {
      if (c === null || c === undefined) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  };

  /**
   * @param {Node} node 中身を空にする要素
   * @returns {void}
   */
  UI.clear = function (node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  };

  /**
   * @param {string} sev 深刻度のキー
   * @returns {string} 画面に出す表記
   */
  UI.severityLabel = function (sev) {
    return S.SEVERITIES[sev].label;
  };

  /**
   * 文字列をファイルとして保存させる。
   * @param {string} filename ファイル名
   * @param {string} content 中身
   * @param {string} [type] MIME タイプ（既定 text/plain）
   * @returns {void}
   */
  UI.download = function (filename, content, type) {
    var blob = new Blob([content], { type: (type || 'text/plain') + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  };

  /**
   * クリップボードに文字列を置く。Clipboard API が無い環境では execCommand に落とす。
   * @param {string} text 置く文字列
   * @returns {void}
   */
  UI.copyText = function (text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
      return;
    }
    var ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* 対応していない環境では諦める */ }
    document.body.removeChild(ta);
  };

  /**
   * @returns {string} ファイル名に使う日時（YYYYMMDD-hhmm）
   */
  UI.stamp = function () {
    var d = new Date();
    /**
     * @param {number} n 0〜59 の値
     * @returns {string} 2桁に揃えた文字列
     */
    function _pad(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + _pad(d.getMonth() + 1) + _pad(d.getDate()) +
      '-' + _pad(d.getHours()) + _pad(d.getMinutes());
  };

  /**
   * @returns {string} タイトルからファイル名に使える文字列
   */
  UI.safeName = function () {
    return (UI.el.title.value || '無題').replace(/[\\/:*?"<>|\n]/g, '_').slice(0, 40);
  };

  /**
   * ファイル選択ダイアログを開き、中身を UTF-8 のテキストとして読む。
   * @param {string} accept input[accept] に渡す拡張子・MIME
   * @param {function(string, string): void} onText 読み込み後に呼ぶ（中身, ファイル名）
   * @returns {void}
   */
  UI.pickFile = function (accept, onText) {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = function () {
      var f = input.files && input.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () { onText(String(reader.result), f.name); };
      reader.readAsText(f, 'utf-8');
    };
    input.click();
  };

  /**
   * ボタンの文字を一時的に差し替えて、処理が通ったことを示す。
   * @param {HTMLElement} btn 対象のボタン
   * @param {string} msg 表示する文字
   * @returns {void}
   */
  UI.flash = function (btn, msg) {
    var old = btn.textContent;
    btn.textContent = msg;
    setTimeout(function () { btn.textContent = old; }, 1400);
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
