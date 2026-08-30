/* 推敲 (suikou) — 起動と結線
 *
 * 依存ライブラリなし。テキストはこの端末から出ない（AI 補助を自分で有効にした場合を除く）。
 * UI の実体は src/ui/ の各ファイルにあり、すべて Suikou.ui に集めている。
 */
(function (global) {
  'use strict';

  var S = global.Suikou;
  var C = S.config;
  var UI = S.ui;

  var MENUS = ['menu-import', 'menu-export'];

  /**
   * 開いているメニューをすべて閉じる。
   * @returns {void}
   */
  function _closeMenus(ev) {
    MENUS.forEach(function (id) {
      var m = UI.$(id);
      if (m) m.hidden = true;
    });
    var inTop = ev && ev.target && ev.target.closest && ev.target.closest('.topbar');
    if (!inTop) document.body.classList.remove('more-open');
  }

  /**
   * ボタンとメニューを結ぶ。項目は data-act 属性で処理を選ぶ。
   * @param {string} btnId ボタンの id
   * @param {string} menuId メニューの id
   * @param {Object<string, function(): void>} handlers data-act と処理の対応
   * @returns {void}
   */
  function _bindMenu(btnId, menuId, handlers) {
    var btn = UI.$(btnId);
    var menu = UI.$(menuId);
    btn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      var opening = menu.hidden;
      _closeMenus();
      menu.hidden = !opening;
    });
    menu.addEventListener('click', function (ev) {
      var act = ev.target.getAttribute && ev.target.getAttribute('data-act');
      if (!act) return;
      menu.hidden = true;
      if (handlers[act]) handlers[act]();
    });
  }

  /**
   * ヘッダの選択欄を結線する。
   * @returns {void}
   */
  function _bindHeader() {
    UI.el.preset.addEventListener('change', function () {
      C.applyPreset(UI.state.config, UI.el.preset.value);
      UI.syncHeaderControls();
      UI.saveConfig();
      UI.runAnalyze();
      if (UI.state.activeTab === 'settings') UI.renderSettings();
    });
    UI.el.rating.addEventListener('change', function () {
      UI.state.config.rating = UI.el.rating.value;
      UI.saveConfig();
      UI.runAnalyze();
      if (UI.state.activeTab === 'settings') UI.renderSettings();
    });
    UI.el.style.addEventListener('change', function () {
      UI.state.config.style = UI.el.style.value;
      UI.saveConfig();
      UI.runAnalyze();
    });

    _bindMenu('btn-import', 'menu-import', UI.importActions());
    _bindMenu('btn-export', 'menu-export', UI.exportActions());
    document.addEventListener('click', _closeMenus);

    UI.$('btn-theme').addEventListener('click', UI.toggleTheme);
    UI.$('btn-clear').addEventListener('click', UI.clearDraft);
    UI.$('btn-focus').addEventListener('click', function () {
      document.body.classList.toggle('focus-mode');
    });
    Array.prototype.forEach.call(UI.el.viewSwitch.querySelectorAll('button[data-view]'), function (b) {
      b.addEventListener('click', function () { UI.setView(b.getAttribute('data-view')); });
    });
  }

  /**
   * キーボード操作を結線する。
   * @returns {void}
   */
  function _bindShortcuts() {
    document.addEventListener('keydown', function (ev) {
      var mod = ev.ctrlKey || ev.metaKey;
      var key = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
      if (mod && !ev.shiftKey && key === 's') {
        ev.preventDefault();
        UI.saveMarkdown();
      } else if (mod && key === 'Enter') {
        ev.preventDefault();
        if (UI.state.timer) clearTimeout(UI.state.timer);
        UI.runAnalyze();
      } else if (key === 'F8') {
        ev.preventDefault();
        UI.nextIssue(ev.shiftKey ? -1 : 1);
      } else if (mod && ev.shiftKey && key === 'f') {
        ev.preventDefault();
        document.body.classList.toggle('focus-mode');
      } else if (mod && ev.shiftKey && key === 'p') {
        ev.preventDefault();
        UI.setView(UI.state.view === 'preview' ? 'write' : 'preview');
      } else if (mod && ev.shiftKey && key === 'l') {
        ev.preventDefault();
        UI.toggleTheme();
      }
    });
  }

  /**
   * DOM 参照をまとめて取る。
   * @returns {void}
   */
  function _collectElements() {
    var el = UI.el;
    el.editor = UI.$('editor');
    el.backdrop = UI.$('backdrop');
    el.highlights = UI.$('highlights');
    el.title = UI.$('title');
    el.hashtags = UI.$('hashtags');
    el.counters = UI.$('counters');
    el.status = UI.$('editor-status');
    el.filters = UI.$('filters');
    el.issueList = UI.$('issue-list');
    el.preset = UI.$('preset');
    el.rating = UI.$('rating');
    el.style = UI.$('style');
    el.preview = UI.$('preview');
    el.viewSwitch = UI.$('view-switch');
    el.toolbar = UI.$('toolbar');
    el.themeBtn = UI.$('btn-theme');
  }

  /**
   * 起動する。
   * @returns {void}
   */
  function init() {
    _collectElements();
    UI.buildTabs();
    UI.loadStored();
    UI.applyTheme();
    UI.buildHeaderControls();
    UI.syncHeaderControls();
    _bindHeader();
    UI.bindLayout();
    _bindShortcuts();
    UI.bindEditor();
    UI.bindToolbar();
    UI.runAnalyze();
    UI.setView(UI.state.config.display.view === 'preview' ? 'preview' : 'write');
    window.addEventListener('beforeunload', UI.saveDraft);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
