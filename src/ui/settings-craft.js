/* 推敲 (suikou) — 追加の執筆チェック（隠し解除） */
(function (global) {
  'use strict';

  var UI = global.Suikou.ui;
  var taps = 0;
  var tapTimer = null;

  /**
   * フッターを連続で押すと解除フラグが立つ。
   * @param {Object} cfg 設定
   * @returns {void}
   */
  function _onSecretTap(cfg) {
    taps += 1;
    if (tapTimer) clearTimeout(tapTimer);
    tapTimer = setTimeout(function () { taps = 0; }, 1600);
    if (taps < 5) return;
    taps = 0;
    cfg.craftUnlocked = true;
    UI.saveConfig();
    UI.renderSettings();
  }

  /**
   * 設定タブ末尾に、追加の執筆チェックを描く。
   * @param {HTMLElement} host 追加先
   * @param {Object} cfg 設定
   * @returns {void}
   */
  UI.renderCraftSettings = function (host, cfg) {
    var foot = UI.h('p', {
      class: 'hint craft-foot',
      text: '推敲 ' + (global.Suikou.VERSION || '')
    });
    foot.addEventListener('click', function () { _onSecretTap(cfg); });
    host.appendChild(foot);

    if (!cfg.craftUnlocked && !cfg.craftStrict) return;

    cfg.craftUnlocked = true;
    host.appendChild(UI.h('h3', { class: 'section', text: '追加の執筆チェック' }));
    host.appendChild(UI.h('p', {
      class: 'hint',
      text: '言い換え二周・結び・冒頭・タイトルの指摘を厚くします。作者名は使いません。'
    }));
    host.appendChild(UI.settingRow([
      UI.h('input', {
        type: 'checkbox',
        checked: cfg.craftStrict ? 'checked' : null,
        onchange: function (ev) {
          cfg.craftStrict = !!ev.target.checked;
          UI.commitSettings(false);
        }
      }),
      UI.h('span', { text: '追加の執筆チェックを使う' }),
      UI.h('span', {
        class: 'hint',
        text: 'オンにすると語リストが増え、指摘の段階が一段上がります。'
      })
    ]));
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
