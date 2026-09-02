/* 推敲 (suikou) — 対応済み・直して消えた指摘の履歴 */
(function (global) {
  'use strict';

  var S = global.Suikou;
  var UI = S.ui;

  var MAX = 200;

  /**
   * 指摘を履歴用に写す。
   * @param {Object} issue 指摘
   * @param {'resolved'|'fixed'} status 対応済みか、直して消えたか
   * @returns {Object} 履歴1件
   */
  function _snapshot(issue, status) {
    return {
      status: status,
      at: Date.now(),
      fingerprint: issue.fingerprint || '',
      ruleId: issue.ruleId,
      ruleName: issue.ruleName,
      category: issue.category,
      severity: issue.severity,
      message: issue.message,
      advice: issue.advice || '',
      context: issue.context ? {
        hit: issue.context.hit,
        before: issue.context.before,
        after: issue.context.after
      } : null,
      suggestions: issue.suggestions || null,
      quote: issue.quote || (issue.context ? issue.context.hit : '')
    };
  }

  /**
   * 履歴に同じ指摘が既にあるか。
   * @param {string} fp 指紋
   * @param {'resolved'|'fixed'} status 状態
   * @returns {boolean} あるとき true
   */
  function _hasEntry(fp, status) {
    return UI.state.issueArchive.some(function (a) {
      return a.fingerprint === fp && a.status === status;
    });
  }

  /**
   * 同じ指紋が履歴に既にあるか（状態は問わない）。
   * @param {string} fp 指紋
   * @returns {boolean} あるとき true
   */
  function _hasAny(fp) {
    return UI.state.issueArchive.some(function (a) { return a.fingerprint === fp; });
  }

  /**
   * 指摘を履歴に残す。
   * @param {Object} issue 指摘
   * @param {'resolved'|'fixed'} status 状態
   * @returns {void}
   */
  UI.archiveIssue = function (issue, status) {
    if (!issue || !issue.fingerprint) return;
    if (_hasEntry(issue.fingerprint, status)) return;
    UI.state.issueArchive.unshift(_snapshot(issue, status));
    if (UI.state.issueArchive.length > MAX) {
      UI.state.issueArchive.length = MAX;
    }
    UI.saveArchive();
  };

  /**
   * 解析の前後で消えた指摘を「直して消えた」として残す。
   * @param {Object|null} prev 前回の解析結果
   * @param {Object} next 今回の解析結果
   * @returns {void}
   */
  UI.trackFixedIssues = function (prev, next) {
    if (!prev || !prev.issues || !next || !next.issues) return;
    var still = Object.create(null);
    next.issues.forEach(function (i) { still[i.fingerprint] = 1; });
    prev.issues.forEach(function (i) {
      if (i.dismissed || still[i.fingerprint] || _hasAny(i.fingerprint)) return;
      UI.archiveIssue(i, 'fixed');
    });
  };

  /**
   * 履歴を空にする。
   * @returns {void}
   */
  UI.clearArchive = function () {
    UI.state.issueArchive = [];
    UI.saveArchive();
    if (UI.state.activeTab === 'settings') UI.renderSettings();
    UI.renderIssues();
  };

  /**
   * 履歴1件のカード。
   * @param {Object} entry 履歴
   * @returns {HTMLElement} カード
   */
  UI.archiveCard = function (entry) {
    var kids = [
      UI.h('div', { class: 'issue-head' }, [
        UI.h('span', {
          class: 'badge',
          style: 'color:' + S.CATEGORIES[entry.category].color,
          text: S.CATEGORIES[entry.category].label
        }),
        UI.h('span', { class: 'badge sev-' + entry.severity, text: UI.severityLabel(entry.severity) }),
        UI.h('span', {
          class: 'badge',
          text: entry.status === 'resolved' ? '対応済み' : '直して消えた'
        })
      ]),
      UI.h('div', { class: 'issue-msg', text: entry.message })
    ];
    if (entry.context) {
      kids.push(UI.h('div', { class: 'issue-ctx' }, [
        document.createTextNode(entry.context.before),
        UI.h('span', { class: 'hit', text: entry.context.hit }),
        document.createTextNode(entry.context.after)
      ]));
    }
    if (entry.advice) kids.push(UI.h('div', { class: 'issue-advice', text: entry.advice }));
    if (entry.suggestions && entry.suggestions.length) {
      kids.push(UI.h('div', { class: 'sugg' }, entry.suggestions.map(function (sg) {
        return UI.h('span', {
          title: 'クリックでコピー',
          onclick: function (ev) { ev.stopPropagation(); UI.copyText(sg); },
          text: sg
        });
      })));
    }
    return UI.h('div', {
      class: 'issue archive sev-' + entry.severity,
      onclick: function () {
        var hit = entry.quote || (entry.context && entry.context.hit);
        if (!hit) return;
        var idx = UI.el.editor.value.indexOf(hit);
        if (idx < 0) return;
        UI.jumpTo({ id: 'archive', start: idx, end: idx + hit.length });
      }
    }, kids);
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
