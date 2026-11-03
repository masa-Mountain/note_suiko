/* 執筆画面で消した指摘。原稿（URL）ごとに覚える */
(function (global) {
  'use strict';

  var E = (global.SuikouExt = global.SuikouExt || {});
  var KEY = 'suikouNoteMarks';

  /**
   * いま開いている原稿のキー。
   * @returns {string} パス
   */
  function _page() {
    return location.pathname;
  }

  /**
   * この原稿の対応済みを読む。
   * @param {function(): void} done 読めたあと
   * @returns {void}
   */
  E.loadMarks = function (done) {
    chrome.storage.local.get({ suikouNoteMarks: {} }, function (data) {
      var all = data.suikouNoteMarks || {};
      E.resolved = all[_page()] || {};
      done();
    });
  };

  /**
   * この原稿の対応済みを保存して、一覧を描き直す。
   * @returns {void}
   */
  function _save() {
    chrome.storage.local.get({ suikouNoteMarks: {} }, function (data) {
      var all = data.suikouNoteMarks || {};
      all[_page()] = E.resolved;
      var next = {};
      next[KEY] = all;
      chrome.storage.local.set(next, function () {
        if (E.afterMarks) E.afterMarks();
      });
    });
  }

  /**
   * 複数の指摘を一度に一覧から外す。
   * @param {Array<Object>} issues 指摘
   * @returns {void}
   */
  E.hideMarks = function (issues) {
    var i;
    for (i = 0; i < issues.length; i++) {
      if (issues[i] && issues[i].fingerprint) E.resolved[issues[i].fingerprint] = 1;
    }
    _save();
  };

  /**
   * 指摘を一覧から外す。
   * @param {Object} issue 指摘
   * @returns {void}
   */
  E.hideMark = function (issue) {
    if (!issue || !issue.fingerprint) return;
    E.resolved[issue.fingerprint] = 1;
    _save();
  };

  /**
   * 外した指摘を戻す。
   * @param {Object} issue 指摘
   * @returns {void}
   */
  E.restoreMark = function (issue) {
    if (!issue || !issue.fingerprint) return;
    delete E.resolved[issue.fingerprint];
    _save();
  };
})(globalThis);
