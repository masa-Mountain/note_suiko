/* 同じ指摘を1枚に畳む */
(function (global) {
  'use strict';

  var E = (global.SuikouExt = global.SuikouExt || {});
  var S = function () { return global.Suikou; };

  E.expanded = {};

  /**
   * 束ねるキー。短いヒット語ごと、それ以外はルール単位。
   * @param {Object} issue 指摘
   * @returns {string} キー
   */
  function _groupKey(issue) {
    var hit = issue.context && issue.context.hit;
    if (hit && hit.length <= 12 && hit.indexOf('\n') < 0) return issue.ruleId + '|' + hit;
    return issue.ruleId + '|' + issue.message;
  }

  /**
   * 表示用に指摘を束ねる。
   * @param {Array<Object>} list 指摘
   * @returns {Array<{key: string, items: Array<Object>}>} グループ
   */
  E.groupIssues = function (list) {
    var order = [];
    var map = Object.create(null);
    var i;
    for (i = 0; i < list.length; i++) {
      var key = _groupKey(list[i]);
      if (!map[key]) {
        map[key] = [];
        order.push(key);
      }
      map[key].push(list[i]);
    }
    return order.map(function (key) {
      return { key: key, items: map[key] };
    });
  };

  /**
   * 複数箇所のカード。1件なら通常のカード。
   * @param {{key: string, items: Array<Object>}} group グループ
   * @param {Object} cap 本文
   * @returns {HTMLElement} カード
   */
  E.groupCard = function (group, cap) {
    var items = group.items;
    if (items.length === 1) return E.issueButton(items[0], cap);
    var first = items[0];
    var open = !!E.expanded[group.key];
    var card = document.createElement('div');
    card.className = 'suikou-issue sev-' + first.severity;
    var sev = S().SEVERITIES[first.severity];
    var cat = S().CATEGORIES[first.category];
    var head = document.createElement('span');
    head.className = 'suikou-issue-head';
    head.textContent = (sev ? sev.label : '') + ' · ' + (cat ? cat.label : '') + ' · ' + items.length + ' 箇所';
    var msg = document.createElement('span');
    msg.className = 'suikou-issue-msg';
    msg.textContent = first.message;
    card.appendChild(head);
    card.appendChild(msg);
    if (open) {
      items.forEach(function (issue) {
        var row = document.createElement('div');
        row.className = 'suikou-sub';
        row.textContent = issue.context ? issue.context.before + issue.context.hit + issue.context.after : issue.message;
        row.addEventListener('mousedown', function (ev) { ev.preventDefault(); });
        row.addEventListener('click', function (ev) {
          ev.stopPropagation();
          E.reveal(cap, issue);
        });
        card.appendChild(row);
      });
    }
    var bar = document.createElement('span');
    bar.className = 'suikou-suggs';
    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'suikou-done';
    toggle.textContent = open ? '畳む' : '各箇所を見る';
    toggle.addEventListener('click', function (ev) {
      ev.stopPropagation();
      E.expanded[group.key] = !open;
      E.panelSign = '';
      E.renderPanel(E.lastCap, E.lastIssues);
    });
    var done = document.createElement('button');
    done.type = 'button';
    done.className = 'suikou-done';
    done.textContent = 'この束を対応済み';
    done.addEventListener('click', function (ev) {
      ev.stopPropagation();
      E.hideMarks(items);
    });
    bar.appendChild(toggle);
    bar.appendChild(done);
    card.appendChild(bar);
    card.addEventListener('mousedown', function (ev) {
      if (ev.target === card || ev.target.className === 'suikou-issue-msg' || ev.target.className === 'suikou-issue-head') {
        ev.preventDefault();
      }
    });
    card.addEventListener('click', function () { E.reveal(cap, first); });
    return card;
  };
})(globalThis);
