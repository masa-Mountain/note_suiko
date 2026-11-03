/* note の執筆画面を見つけたら、推敲の本体を読み込む */
(function (global) {
  'use strict';

  /**
   * 執筆・編集の URL かどうか。
   * @returns {boolean} 執筆画面なら true
   */
  function _isEditorPath() {
    var host = location.hostname;
    var path = location.pathname;
    if (host === 'editor.note.com') return path.indexOf('/notes/') >= 0;
    if (host !== 'note.com') return false;
    return path === '/notes/new' || /\/notes\/[^/]+\/edit\/?$/.test(path);
  }

  /**
   * 本文エディタが出ていれば、未読み込みのときだけ本体を頼む。
   * @returns {void}
   */
  function _tick() {
    if (global.Suikou && global.Suikou._noteExtReady) return;
    if (_isEditorPath() && document.querySelector('.ProseMirror')) {
      chrome.runtime.sendMessage({ type: 'suikou-attach' });
    }
    global.setTimeout(_tick, 1000);
  }

  _tick();
})(globalThis);
