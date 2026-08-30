/* 推敲 (suikou) — 設定タブの組み立て（プリセットと表示の節、各節の呼び出し） */
(function (global) {
  'use strict';

  var S = global.Suikou;
  var C = S.config;
  var UI = S.ui;

  var DISPLAY_OPTIONS = [
    {
      key: 'hideSuggestions', label: '言い換え候補を伏せる（自力で考えるモード）',
      hint: '候補は「候補を見る」を押したときだけ表示されます。'
    },
    { key: 'highlight', label: '本文に下線でハイライトする', hint: '' },
    {
      key: 'skipQuotes', label: '引用行（>）とコード（`）を対象外にする',
      hint: '他人の文章を校正しないためのスイッチです。'
    }
  ];

  /**
   * 設定の1行。設定タブの各節が共通で使う。
   * @param {Array<Node|string|null>} kids 行に並べる要素
   * @returns {HTMLElement} 行の要素
   */
  UI.settingRow = function (kids) {
    return UI.h('div', { class: 'setting-row' }, kids);
  };

  /**
   * 変更した設定を保存して解析をやり直す。
   * @param {boolean} redraw 設定タブ自体も描き直すか（表示項目が増減する場合に真）
   * @returns {void}
   */
  UI.commitSettings = function (redraw) {
    UI.saveConfig();
    UI.runAnalyze();
    if (redraw) UI.renderSettings();
  };

  /**
   * プリセットの説明と、初期状態に戻すボタンを描く。
   * @param {HTMLElement} host 追加先
   * @param {Object} cfg 設定
   * @returns {void}
   */
  function _presetSection(host, cfg) {
    var preset = C.presetById(cfg.presetId);
    host.appendChild(UI.h('h3', { class: 'section', text: 'プリセット' }));
    host.appendChild(UI.h('div', {
      class: 'callout neutral', text: preset.label + ' — ' + preset.description
    }));
    host.appendChild(UI.settingRow([UI.h('button', {
      onclick: function () {
        if (confirm('プリセット「' + preset.label + '」の初期状態に戻します。個別に変えたルール設定は失われます。')) {
          C.applyPreset(cfg, cfg.presetId);
          UI.commitSettings(true);
        }
      },
      text: 'このプリセットの初期状態に戻す'
    })]));
  }

  /**
   * 表示と方針の節を描く。
   * @param {HTMLElement} host 追加先
   * @param {Object} cfg 設定
   * @returns {void}
   */
  function _displaySection(host, cfg) {
    host.appendChild(UI.h('h3', { class: 'section', text: '表示と方針' }));
    DISPLAY_OPTIONS.forEach(function (opt) {
      host.appendChild(UI.settingRow([
        UI.h('input', {
          type: 'checkbox', checked: cfg.display[opt.key] ? 'checked' : null,
          onchange: function (ev) {
            cfg.display[opt.key] = ev.target.checked;
            UI.commitSettings(false);
          }
        }),
        UI.h('span', { text: opt.label }),
        opt.hint ? UI.h('span', { class: 'hint', text: opt.hint }) : null
      ]));
    });
    host.appendChild(UI.settingRow([
      UI.h('input', {
        type: 'checkbox', checked: cfg.allowUnify ? 'checked' : null,
        onchange: function (ev) {
          cfg.allowUnify = ev.target.checked;
          UI.saveConfig();
          UI.renderIssues();
        }
      }),
      UI.h('span', { text: '表記統一だけは一括置換を許可する' }),
      UI.h('span', {
        class: 'hint',
        text: 'このツールは原則として本文を書き換えません。表記の統一は機械的な作業なので、例外として置換ボタンを出せます。'
      })
    ]));
    host.appendChild(UI.settingRow([
      UI.h('span', { text: '指摘の表示上限' }),
      UI.h('input', {
        type: 'number', value: cfg.display.maxIssues, min: 50, max: 3000, step: 50,
        onchange: function (ev) {
          cfg.display.maxIssues = parseInt(ev.target.value, 10) || 400;
          UI.commitSettings(false);
        }
      })
    ]));
  }

  /**
   * 設定タブを描く。
   * @returns {void}
   */
  UI.renderSettings = function () {
    var host = UI.el.tabBodies.settings;
    UI.clear(host);
    var cfg = UI.state.config;

    _presetSection(host, cfg);
    _displaySection(host, cfg);
    UI.renderNoteSettings(host, cfg);
    UI.renderMarkSettings(host);
    UI.renderAiSettings(host, cfg);
    UI.renderDictSettings(host, cfg);
    UI.renderRuleList(host, cfg);
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
