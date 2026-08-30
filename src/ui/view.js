/* 推敲 (suikou) — タブ、執筆／プレビューの切り替え、ヘッダの選択欄 */
(function (global) {
  'use strict';

  var S = global.Suikou;
  var C = S.config;
  var UI = S.ui;

  var TABS = [
    { key: 'issues', label: '指摘' },
    { key: 'metrics', label: '診断' },
    { key: 'audience', label: '読者像' },
    { key: 'settings', label: '設定' }
  ];

  var RATINGS = [
    { value: 'strict', label: '全年齢（厳格）' },
    { value: 'all-ages', label: '全年齢' },
    { value: 'r18', label: 'R-18（成人向け）' }
  ];

  var STYLES = [
    { value: 'auto', label: '自動判定' },
    { value: 'desu', label: '敬体で統一' },
    { value: 'dearu', label: '常体で統一' }
  ];

  /**
   * タブのボタンを作り、el.tabButtons / el.tabBodies を埋める。
   * @returns {void}
   */
  UI.buildTabs = function () {
    UI.el.tabButtons = {};
    UI.el.tabBodies = {
      issues: UI.$('tab-issues'),
      metrics: UI.$('tab-metrics'),
      audience: UI.$('tab-audience'),
      settings: UI.$('tab-settings')
    };
    var nav = UI.$('tabs');
    TABS.forEach(function (d) {
      var btn = UI.h('button', {
        onclick: function () {
          UI.state.activeTab = d.key;
          UI.renderTabs();
          UI.renderActive();
        }
      }, [document.createTextNode(d.label), UI.h('span', { class: 'count' })]);
      UI.el.tabButtons[d.key] = btn;
      nav.appendChild(btn);
    });
  };

  /**
   * タブの選択状態と件数を反映する。
   * @returns {void}
   */
  UI.renderTabs = function () {
    var counts = { issues: UI.state.result ? UI.state.result.activeCount : 0 };
    Object.keys(UI.el.tabButtons).forEach(function (key) {
      var btn = UI.el.tabButtons[key];
      btn.className = key === UI.state.activeTab ? 'active' : '';
      var c = btn.querySelector('.count');
      if (c) c.textContent = counts[key] !== undefined ? String(counts[key]) : '';
    });
    Object.keys(UI.el.tabBodies).forEach(function (key) {
      UI.el.tabBodies[key].hidden = key !== UI.state.activeTab;
    });
    if (UI.syncMobileNav) UI.syncMobileNav();
  };

  /**
   * 開いているタブの中身だけを描く。
   * @returns {void}
   */
  UI.renderActive = function () {
    if (UI.state.activeTab === 'issues') UI.renderIssues();
    else if (UI.state.activeTab === 'metrics') UI.renderMetrics();
    else if (UI.state.activeTab === 'audience') UI.renderAudience();
    else if (UI.state.activeTab === 'settings') UI.renderSettings();
  };

  /**
   * note 風プレビューを描く。
   * @returns {void}
   */
  UI.renderPreview = function () {
    var issue = UI.selectedIssue();
    S.preview.render(UI.el.preview, UI.el.editor.value, UI.el.title.value, {
      selected: issue && issue.end > issue.start ? { start: issue.start, end: issue.end } : null
    });
    var hit = UI.el.preview.querySelector('.np-hit');
    if (hit && hit.scrollIntoView) hit.scrollIntoView({ block: 'center' });
  };

  /**
   * 執筆とプレビューを切り替える。
   * @param {'write'|'preview'} view 表示するもの
   * @returns {void}
   */
  UI.setView = function (view) {
    UI.state.view = view;
    UI.state.config.display.view = view;
    UI.saveConfig();
    var preview = view === 'preview';
    UI.el.preview.hidden = !preview;
    UI.el.editor.style.visibility = preview ? 'hidden' : '';
    UI.el.backdrop.hidden = preview;
    Array.prototype.forEach.call(UI.el.viewSwitch.querySelectorAll('button[data-view]'), function (b) {
      b.className = b.getAttribute('data-view') === view ? 'active' : '';
    });
    if (preview) UI.renderPreview();
    else UI.el.editor.focus();
  };

  /**
   * ヘッダの選択欄に項目を並べる。
   * @returns {void}
   */
  UI.buildHeaderControls = function () {
    C.presets.forEach(function (p) {
      UI.el.preset.appendChild(UI.h('option', { value: p.id, text: p.label }));
    });
    RATINGS.forEach(function (o) {
      UI.el.rating.appendChild(UI.h('option', { value: o.value, text: o.label }));
    });
    STYLES.forEach(function (o) {
      UI.el.style.appendChild(UI.h('option', { value: o.value, text: o.label }));
    });
  };

  /**
   * ヘッダの選択欄を設定の値に合わせる。
   * @returns {void}
   */
  UI.syncHeaderControls = function () {
    UI.el.preset.value = UI.state.config.presetId;
    UI.el.rating.value = UI.state.config.rating;
    UI.el.style.value = UI.state.config.style;
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
