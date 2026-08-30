/* 推敲 (suikou) — UI の共有状態
 *
 * UI 層は複数のファイルに分かれているが、DOM 参照と状態はここ一箇所に置く。
 * 各ファイルは Suikou.ui から取り出して使い、他ファイルの関数も
 * 呼び出し時に Suikou.ui から引く（定義時に解決しないので読み込み順に依存しない）。
 */
(function (global) {
  'use strict';

  var S = global.Suikou;
  var UI = (S.ui = S.ui || {});

  /** localStorage のキー。原稿・設定・片付け記録を別々に持つ。 */
  UI.STORE = {
    draft: 'suikou.draft.v1',
    config: 'suikou.config.v1',
    marks: 'suikou.marks.v1'
  };

  /** DOM 参照。init() で埋める。 */
  UI.el = {};

  UI.state = {
    config: S.config.defaults(),
    result: null,
    selectedId: null,
    filters: { severity: {}, category: {} },
    revealed: {},
    expandedGroups: {},
    activeTab: 'issues',
    timer: null,
    /* 片付けた指摘。resolved は原稿ごと、suppressed は「今後も指摘しない」として残す。 */
    resolved: {},
    suppressed: {},
    /* AI の指摘は解析のたびに作り直さず、引用文字列から位置を取り直して使い回す。 */
    aiIssues: [],
    aiState: null,
    aiError: null,
    view: 'write',
    /* 狭い画面だけで使う。広い画面の二分割には影響しない。 */
    mobilePane: 'write'
  };

  /**
   * タグ欄の文字列をタグ名の配列にする。
   * @param {string} value タグ欄の入力値
   * @returns {string[]} 先頭の # を外したタグ名
   */
  UI.parseHashtags = function (value) {
    return String(value || '')
      .split(/[\s\u3000,、]+/)
      .map(function (t) { return t.replace(/^#/, '').trim(); })
      .filter(function (t) { return t.length > 0; });
  };

  /**
   * 解析に渡す入力をまとめる。
   * @returns {{text: string, title: string, hashtags: string[], config: Object,
   *            resolved: Object, suppressed: Object}} 解析の入力
   */
  UI.currentInput = function () {
    return {
      text: UI.el.editor.value,
      title: UI.el.title.value,
      hashtags: UI.parseHashtags(UI.el.hashtags && UI.el.hashtags.value),
      config: UI.state.config,
      resolved: UI.state.resolved,
      suppressed: UI.state.suppressed
    };
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
