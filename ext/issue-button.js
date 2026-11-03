/* 指摘カード1件 */
(function (global) {
  'use strict';

  var E = (global.SuikouExt = global.SuikouExt || {});
  var S = function () { return global.Suikou; };

  /**
   * 候補をコピーするチップ。
   * @param {string} text 候補
   * @returns {HTMLElement} チップ
   */
  function _suggest(text) {
    var span = document.createElement('span');
    span.className = 'suikou-sugg';
    span.textContent = text;
    span.title = 'クリックでコピー';
    span.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text);
    });
    return span;
  }

  /**
   * 指摘ボタン。
   * @param {Object} issue 指摘
   * @param {Object} cap 本文
   * @returns {HTMLButtonElement} ボタン
   */
  E.issueButton = function (issue, cap) {
    var card = document.createElement('div');
    card.className = 'suikou-issue sev-' + issue.severity;
    var cat = S().CATEGORIES[issue.category];
    var sev = S().SEVERITIES[issue.severity];
    var head = document.createElement('span');
    head.className = 'suikou-issue-head';
    head.textContent = (sev ? sev.label : '') + ' · ' + (cat ? cat.label : '');
    var msg = document.createElement('span');
    msg.className = 'suikou-issue-msg';
    msg.textContent = issue.message;
    card.appendChild(head);
    card.appendChild(msg);
    if (issue.context && issue.context.hit) {
      var hit = document.createElement('span');
      hit.className = 'suikou-issue-hit';
      hit.textContent = issue.context.hit;
      card.appendChild(hit);
    }
    if (issue.advice) {
      var advice = document.createElement('span');
      advice.className = 'suikou-advice';
      advice.textContent = issue.advice;
      card.appendChild(advice);
    }
    if (issue.suggestions && issue.suggestions.length) {
      var row = document.createElement('span');
      row.className = 'suikou-suggs';
      issue.suggestions.slice(0, 6).forEach(function (sg) { row.appendChild(_suggest(sg)); });
      card.appendChild(row);
    }
    var done = document.createElement('button');
    done.type = 'button';
    done.className = 'suikou-done';
    done.textContent = issue.dismissed ? '戻す' : '対応済み';
    done.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (issue.dismissed) E.restoreMark(issue);
      else E.hideMark(issue);
    });
    card.appendChild(done);
    card.addEventListener('click', function () { E.reveal(cap, issue); });
    return card;
  };
})(globalThis);
