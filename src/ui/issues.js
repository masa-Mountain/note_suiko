/* 推敲 (suikou) — 指摘タブ：絞り込み、一覧、片付け */
(function (global) {
  'use strict';

  var S = global.Suikou;
  var UI = S.ui;

  /**
   * フィルタと片付け状態を通した、いま表示すべき指摘。
   * @returns {Array<Object>} 表示対象の指摘
   */
  /**
   * いま選んでいる指摘。なければ null。
   * @returns {Object|null} 指摘
   */
  UI.selectedIssue = function () {
    if (!UI.state.result || !UI.state.selectedId) return null;
    var list = UI.state.result.issues;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === UI.state.selectedId) return list[i];
    }
    return null;
  };

  UI.visibleIssues = function () {
    if (!UI.state.result) return [];
    var showDone = UI.state.config.display.showResolved;
    return UI.state.result.issues.filter(function (i) {
      if (i.dismissed && !showDone) return false;
      if (UI.state.filters.severity[i.severity] === false) return false;
      if (UI.state.filters.category[i.category] === false) return false;
      return true;
    });
  };

  /**
   * 指摘を片付ける。
   * @param {Object} issue 対象の指摘
   * @param {'resolved'|'suppressed'} mode resolved はこの箇所だけ、suppressed は同じ語を今後も出さない
   * @returns {void}
   */
  UI.dismissIssue = function (issue, mode) {
    if (mode === 'suppressed') UI.state.suppressed[issue.suppressKey] = 1;
    else {
      UI.state.resolved[issue.fingerprint] = 1;
      UI.archiveIssue(issue, 'resolved');
    }
    UI.saveMarks();
    UI.runAnalyze();
  };

  /**
   * 片付けを取り消す。
   * @param {Object} issue 対象の指摘
   * @returns {void}
   */
  UI.undismissIssue = function (issue) {
    delete UI.state.resolved[issue.fingerprint];
    delete UI.state.suppressed[issue.suppressKey];
    UI.saveMarks();
    UI.runAnalyze();
  };

  /**
   * 片付け記録をまとめて消す。
   * @param {'resolved'|'suppressed'|'all'} which 消す対象
   * @returns {void}
   */
  UI.clearMarks = function (which) {
    if (which === 'resolved' || which === 'all') UI.state.resolved = {};
    if (which === 'suppressed' || which === 'all') UI.state.suppressed = {};
    UI.saveMarks();
    UI.runAnalyze();
    if (UI.state.activeTab === 'settings') UI.renderSettings();
  };

  /**
   * 絞り込みボタンを1つ作る。
   * @param {string} label 表示名
   * @param {number} count 件数
   * @param {boolean} off いま外れているか
   * @param {string} color 文字色（CSS 値）
   * @param {function(): void} onToggle 押されたときの処理
   * @returns {HTMLElement} ボタン
   */
  function _chip(label, count, off, color, onToggle) {
    return UI.h('button', {
      class: 'chip' + (off ? ' off' : ''),
      style: color ? 'color:' + color : null,
      onclick: onToggle
    }, [
      color ? UI.h('i', { class: 'dot' }) : null,
      document.createTextNode(label),
      UI.h('span', { class: 'n', text: String(count) })
    ]);
  }

  /**
   * 深刻度・分類・片付け済みの絞り込みを描く。
   * @returns {void}
   */
  UI.renderFilters = function () {
    var host = UI.el.filters;
    UI.clear(host);
    var r = UI.state.result;
    if (!r) return;

    /**
     * 絞り込みを切り替えて一覧と下線だけ描き直す。
     * @param {'severity'|'category'} kind 絞り込みの種類
     * @param {string} key 深刻度または分類のキー
     * @param {boolean} off 押す前の状態
     * @returns {void}
     */
    function toggle(kind, key, off) {
      UI.state.filters[kind][key] = off;
      UI.renderIssues();
      UI.renderHighlights();
    }

    ['error', 'warn', 'info', 'hint'].forEach(function (sev) {
      var off = UI.state.filters.severity[sev] === false;
      host.appendChild(_chip(UI.severityLabel(sev), r.bySeverity[sev] || 0, off,
        'var(--' + sev + ')', function () { toggle('severity', sev, off); }));
    });

    Object.keys(S.CATEGORIES)
      .sort(function (a, b) { return S.CATEGORIES[a].order - S.CATEGORIES[b].order; })
      .forEach(function (cat) {
        var n = r.byCategory[cat] || 0;
        if (!n) return;
        var off = UI.state.filters.category[cat] === false;
        host.appendChild(_chip(S.CATEGORIES[cat].label, n, off, S.CATEGORIES[cat].color,
          function () { toggle('category', cat, off); }));
      });

    if (r.dismissedCount) {
      var showing = UI.state.config.display.showResolved;
      var btn = _chip('片付け済み', r.dismissedCount, !showing, null, function () {
        UI.state.config.display.showResolved = !showing;
        UI.state.showArchive = false;
        UI.saveConfig();
        UI.renderIssues();
        UI.renderHighlights();
      });
      btn.title = '対応済み・無視にした指摘の表示を切り替えます';
      host.appendChild(btn);
    }

    if (UI.state.issueArchive.length) {
      var arch = UI.state.showArchive;
      var ab = _chip('履歴', UI.state.issueArchive.length, !arch, null, function () {
        UI.state.showArchive = !arch;
        UI.renderIssues();
      });
      ab.title = '対応済み・直して消えた指摘をあとから見る';
      host.appendChild(ab);
    }
  };

  /**
   * 指摘パネルのスクロール位置。一覧を作り直すと中身が一度空になり、
   * ブラウザが scrollTop を 0 に戻すので、描画の前後で持ち直す。
   * @returns {number} 現在の scrollTop
   */
  function _issueScrollTop() {
    var pane = UI.el.tabBodies && UI.el.tabBodies.issues;
    return pane ? pane.scrollTop : 0;
  }

  /**
   * 指摘パネルのスクロールを戻す。
   * @param {number} y 戻す位置
   * @returns {void}
   */
  function _restoreIssueScroll(y) {
    var pane = UI.el.tabBodies && UI.el.tabBodies.issues;
    if (!pane) return;
    pane.scrollTop = y;
    if (global.requestAnimationFrame) {
      global.requestAnimationFrame(function () { pane.scrollTop = y; });
    }
  }

  /**
   * 指摘の一覧を描く。
   * @returns {void}
   */
  UI.renderIssues = function () {
    var y = _issueScrollTop();
    UI.renderFilters();
    var host = UI.el.issueList;
    UI.clear(host);
    if (!UI.state.result) {
      _restoreIssueScroll(y);
      return;
    }

    if (!UI.el.editor.value.trim()) {
      host.appendChild(UI.h('div', { class: 'empty' }, [
        'エディタに原稿を書くか、note のエディタからコピーして貼り付けてください。',
        UI.h('br'),
        '解析はこの端末の中だけで動きます。AI 補助を自分で有効にした場合を除き、通信は行いません。'
      ]));
      _restoreIssueScroll(y);
      return;
    }

    var list = UI.visibleIssues();
    if (UI.state.showArchive) {
      if (!UI.state.issueArchive.length) {
        host.appendChild(UI.h('div', { class: 'empty', text: '履歴はありません。' }));
      } else {
        var frag = document.createDocumentFragment();
        UI.state.issueArchive.forEach(function (entry) { frag.appendChild(UI.archiveCard(entry)); });
        host.appendChild(frag);
      }
      _restoreIssueScroll(y);
      return;
    }

    if (!list.length) {
      host.appendChild(UI.h('div', { class: 'empty' }, [
        '表示できる指摘はありません。',
        UI.h('br'),
        'フィルタを外すか、プリセットを厳しめにしてみてください。'
      ]));
      _restoreIssueScroll(y);
      return;
    }

    var frag = document.createDocumentFragment();
    UI.groupIssues(list).forEach(function (g) { frag.appendChild(UI.issueGroupCard(g)); });
    host.appendChild(frag);
    _restoreIssueScroll(y);
  };

  /**
   * 次（または前）の指摘へ移動する。
   * @param {number} dir 1 で次、-1 で前
   * @returns {void}
   */
  UI.nextIssue = function (dir) {
    var list = UI.visibleIssues();
    if (!list.length) return;
    var idx = -1;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === UI.state.selectedId) { idx = i; break; }
    }
    var next = idx < 0 ? (dir > 0 ? 0 : list.length - 1) : (idx + dir + list.length) % list.length;
    UI.state.activeTab = 'issues';
    UI.renderTabs();
    UI.jumpTo(list[next]);
    var node = UI.el.issueList.querySelector('.issue.selected');
    if (node && node.scrollIntoView) node.scrollIntoView({ block: 'nearest' });
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
