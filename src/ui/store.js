/* 推敲 (suikou) — localStorage への保存・復元と、テーマの適用 */
(function (global) {
  'use strict';

  var S = global.Suikou;
  var C = S.config;
  var UI = S.ui;

  /**
   * 原稿（タイトル・タグ・本文）を保存する。
   * @returns {void}
   */
  UI.saveDraft = function () {
    try {
      localStorage.setItem(UI.STORE.draft, JSON.stringify({
        title: UI.el.title.value,
        hashtags: UI.el.hashtags ? UI.el.hashtags.value : '',
        text: UI.el.editor.value,
        at: Date.now()
      }));
      UI.state.draftSaveError = false;
    } catch (e) {
      if (UI.state.draftSaveError) return;
      UI.state.draftSaveError = true;
      if (UI.dialog) {
        UI.dialog('原稿を保存できませんでした', [
          '画像などが大きすぎて、この端末の保存領域に入りません。画像を減らすか、小さい画像にしてください。今の編集内容はタブを閉じると消えることがあります。'
        ]);
      }
    }
  };

  /**
   * 設定を保存する。
   * @returns {void}
   */
  UI.saveConfig = function () {
    try {
      localStorage.setItem(UI.STORE.config, JSON.stringify(UI.state.config));
    } catch (e) { /* 同上 */ }
  };

  /**
   * 片付けた指摘の記録を保存する。
   * @returns {void}
   */
  UI.saveMarks = function () {
    try {
      localStorage.setItem(UI.STORE.marks, JSON.stringify({
        resolved: UI.state.resolved,
        suppressed: UI.state.suppressed
      }));
    } catch (e) { /* 同上 */ }
  };

  /**
   * 指摘の履歴を保存する。
   * @returns {void}
   */
  UI.saveArchive = function () {
    try {
      localStorage.setItem(UI.STORE.archive, JSON.stringify(UI.state.issueArchive));
    } catch (e) { /* 同上 */ }
  };

  /**
   * 保存済みの設定に、既定値から足りないキーを補う。
   * 版が上がって項目が増えても、古い設定のまま起動できるようにするため。
   * @param {Object} cfg 読み込んだ設定
   * @returns {Object} 補完した設定
   */
  function _fillDefaults(cfg) {
    var base = C.defaults();
    Object.keys(base).forEach(function (k) {
      if (cfg[k] === undefined) cfg[k] = base[k];
    });
    ['display', 'note', 'dictionary', 'ai'].forEach(function (group) {
      if (!cfg[group]) cfg[group] = {};
      Object.keys(base[group]).forEach(function (k) {
        if (cfg[group][k] === undefined) cfg[group][k] = base[group][k];
      });
    });
    return cfg;
  }

  /**
   * @param {string} key localStorage のキー
   * @returns {Object|null} 読めた値（壊れていれば null）
   */
  function _readJson(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || 'null');
    } catch (e) {
      return null;
    }
  }

  /**
   * 設定・原稿・片付け記録を復元する。
   * @returns {void}
   */
  UI.loadStored = function () {
    var cfg = _readJson(UI.STORE.config);
    if (cfg) UI.state.config = _fillDefaults(cfg);

    var draft = _readJson(UI.STORE.draft);
    if (draft) {
      UI.el.title.value = draft.title || '';
      if (UI.el.hashtags) UI.el.hashtags.value = draft.hashtags || '';
      UI.el.editor.value = draft.text || '';
    }

    var marks = _readJson(UI.STORE.marks);
    if (marks) {
      UI.state.resolved = marks.resolved || {};
      UI.state.suppressed = marks.suppressed || {};
    }

    var archive = _readJson(UI.STORE.archive);
    if (Array.isArray(archive)) UI.state.issueArchive = archive;
  };

  /**
   * 設定のテーマを html 要素に反映し、切り替えボタンの見た目を合わせる。
   * @returns {void}
   */
  UI.applyTheme = function () {
    var theme = UI.state.config.display.theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    if (UI.el.themeBtn) {
      UI.el.themeBtn.textContent = theme === 'dark' ? '☀' : '☾';
      UI.el.themeBtn.title = theme === 'dark' ? '明るいテーマに切り替える' : '暗いテーマに切り替える';
    }
  };

  /**
   * 明るいテーマと暗いテーマを入れ替える。
   * @returns {void}
   */
  UI.toggleTheme = function () {
    UI.state.config.display.theme = UI.state.config.display.theme === 'dark' ? 'light' : 'dark';
    UI.applyTheme();
    UI.saveConfig();
  };

  /**
   * 設定を JSON ファイルに書き出す。
   * @returns {void}
   */
  UI.exportConfig = function () {
    UI.download('suikou-settings-' + UI.stamp() + '.json',
      JSON.stringify(UI.state.config, null, 2), 'application/json');
  };

  /**
   * 書き出した設定を読み込む。
   * @returns {void}
   */
  UI.importConfig = function () {
    UI.pickFile('.json,application/json', function (content) {
      var cfg;
      try {
        cfg = JSON.parse(content);
      } catch (e) {
        UI.dialog('設定を読み込めませんでした', ['JSON として解釈できませんでした。']);
        return;
      }
      UI.state.config = _fillDefaults(cfg);
      UI.saveConfig();
      UI.applyTheme();
      UI.syncHeaderControls();
      UI.runAnalyze();
      UI.renderSettings();
    });
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
