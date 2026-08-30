/* 推敲 (suikou) — 設定タブのユーザー辞書と、設定ファイルの読み書き */
(function (global) {
  'use strict';

  var S = global.Suikou;
  var UI = S.ui;

  var FIELDS = [
    {
      key: 'ignore', label: '指摘しない語（固有名詞・造語・キャラクター名）',
      hint: '1行に1語。ここに書いた語を含む箇所は、すべてのルールの対象外になります。'
    },
    {
      key: 'preferred', label: '表記の統一ルール',
      hint: '「正しい表記 = 誤り1, 誤り2」の形式で1行に1件。例）　推敲 = 推稿, すいこう'
    },
    {
      key: 'synonyms', label: '自分用の言い換え候補',
      hint: '「語 = 候補1, 候補2」の形式。例）　美しい = 端正だ, 目を奪う'
    },
    {
      key: 'banned', label: '使わない語',
      hint: '自分で禁じた語。1行に1語。見つかると「要修正」で出ます。'
    },
    {
      key: 'watch', label: '追加で検出したい語（レーティング用）',
      hint: '直接的な語などを自分で登録します。R-18 モードでは未成年描写との共起チェックにも使われます。'
    }
  ];

  /**
   * ユーザー辞書の入力欄と、設定の書き出し・読み込みを描く。
   * @param {HTMLElement} host 追加先
   * @param {Object} cfg 設定
   * @returns {void}
   */
  UI.renderDictSettings = function (host, cfg) {
    host.appendChild(UI.h('h3', { class: 'section', text: 'ユーザー辞書' }));
    FIELDS.forEach(function (f) {
      var area = UI.h('textarea', {
        spellcheck: 'false',
        onchange: function (ev) {
          cfg.dictionary[f.key] = ev.target.value;
          UI.commitSettings(false);
        }
      });
      area.value = cfg.dictionary[f.key] || '';
      host.appendChild(UI.h('div', { class: 'dict-field' }, [
        UI.h('label', { text: f.label }),
        UI.h('div', { class: 'hint', text: f.hint }),
        area
      ]));
    });
    host.appendChild(UI.settingRow([
      UI.h('button', { onclick: UI.exportConfig, text: '設定を書き出す (JSON)' }),
      UI.h('button', { onclick: UI.importConfig, text: '設定を読み込む' })
    ]));
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
