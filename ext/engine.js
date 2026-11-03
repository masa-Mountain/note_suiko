/* 執筆中の本文を、入力が止まってから解析する */
(function (global) {
  'use strict';

  var S = global.Suikou;
  var E = global.SuikouExt;
  var timer = null;
  var idle = null;
  var prefs = null;
  var lastKey = '';

  /**
   * 原稿そのものが変わっていないときの比較用。
   * @param {Object} cap 本文
   * @returns {string} 比較キー
   */
  function _key(cap) {
    var marks = Object.keys(E.resolved || {}).sort().join('|');
    return cap.text + '\n' + cap.title + '\n' + prefs.presetId + prefs.rating + prefs.style + '\n' + marks;
  }

  /**
   * いまの本文を解析してパネルを更新する。
   * @returns {void}
   */
  function _run() {
    if (!prefs) return;
    var cap = E.capture();
    if (!cap) {
      E.renderPanel(null, []);
      return;
    }
    var key = _key(cap);
    if (key === lastKey) return;
    lastKey = key;
    var result = S.analyze({
      text: cap.text,
      title: cap.title,
      hashtags: [],
      config: E.configFromPrefs(prefs),
      resolved: E.resolved || {},
      suppressed: {},
      profile: false
    });
    var live = result.issues;
    var rank = { error: 0, warn: 1, info: 2, hint: 3 };
    live.sort(function (a, b) {
      var d = (rank[a.severity] || 9) - (rank[b.severity] || 9);
      return d || a.start - b.start;
    });
    E.renderPanel(cap, live);
  }

  /**
   * 連続入力のあいだは解析を遅らせ、空いた時間に走らせる。
   * @returns {void}
   */
  function _schedule() {
    if (timer) global.clearTimeout(timer);
    if (idle && global.cancelIdleCallback) global.cancelIdleCallback(idle);
    timer = global.setTimeout(function () {
      timer = null;
      var start = function () { _run(); };
      if (global.requestIdleCallback) idle = global.requestIdleCallback(start, { timeout: 1500 });
      else start();
    }, 2800);
  }

  /**
   * 本文かタイトルを編集したときだけ解析する。
   * @param {Event} ev 入力イベント
   * @returns {void}
   */
  function _onEdit(ev) {
    if (ev.isComposing) return;
    var t = ev.target;
    if (!t || !t.closest) return;
    var inBody = t.closest('.ProseMirror');
    var inTitle = t.closest('textarea, [placeholder*="タイトル"], [data-placeholder*="タイトル"]');
    if (!inBody && !inTitle) return;
    _schedule();
  }

  E.ensurePanel();
  E.resolved = {};
  E.afterMarks = function () {
    lastKey = '';
    _run();
  };
  E.loadMarks(function () {
    E.readPrefs(function (stored) {
      prefs = stored;
      E.mountPrefs(function (next) {
        prefs = next;
        lastKey = '';
        _run();
      }, stored);
      _run();
    });
  });
  document.addEventListener('input', _onEdit, true);
  document.addEventListener('compositionend', _onEdit, true);
  S._noteExtReady = true;
})(globalThis);
