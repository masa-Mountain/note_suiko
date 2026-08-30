/* 推敲 (suikou) — 同じルールの指摘を1枚に畳む */
(function (global) {
  'use strict';

  var S = global.Suikou;
  var UI = S.ui;

  /**
   * 束ねるキー。短いヒット語ごと、長文指摘はルール単位。
   * @param {Object} issue 指摘
   * @returns {string} グループキー
   */
  function _groupKey(issue) {
    var hit = issue.context && issue.context.hit;
    if (hit && hit.length <= 8 && hit.indexOf('⏎') < 0) return issue.ruleId + '|' + hit;
    return issue.ruleId;
  }

  UI.issueGroupKey = _groupKey;

  /**
   * 表示用に指摘を束ねる。出現順を保つ。
   * @param {Object[]} list 表示対象の指摘
   * @returns {{key: string, items: Object[]}[]} グループ
   */
  UI.groupIssues = function (list) {
    var order = [];
    var map = Object.create(null);
    for (var i = 0; i < list.length; i++) {
      var k = _groupKey(list[i]);
      if (!map[k]) {
        map[k] = [];
        order.push(k);
      }
      map[k].push(list[i]);
    }
    return order.map(function (key) {
      return { key: key, items: map[key] };
    });
  };

  /**
   * 束ねたカード。1件なら通常カードと同じ。
   * @param {{key: string, items: Object[]}} group グループ
   * @returns {HTMLElement} カード
   */
  UI.issueGroupCard = function (group) {
    var items = group.items;
    if (items.length === 1) return UI.issueCard(items[0]);

    var first = items[0];
    var open = !!UI.state.expandedGroups[group.key];
    var selected = items.some(function (it) { return it.id === UI.state.selectedId; });
    var kids = [
      UI.h('div', { class: 'issue-head' }, [
        UI.h('span', {
          class: 'badge',
          style: 'color:' + S.CATEGORIES[first.category].color,
          text: S.CATEGORIES[first.category].label
        }),
        UI.h('span', { class: 'badge sev-' + first.severity, text: UI.severityLabel(first.severity) }),
        UI.h('span', { class: 'issue-count', text: items.length + ' 件' }),
        UI.h('span', { class: 'issue-rule', text: first.ruleId })
      ]),
      UI.h('div', { class: 'issue-msg', text: first.ruleName + 'が ' + items.length + ' 件あります。' }),
      UI.h('div', { class: 'issue-advice', text: first.advice || first.message })
    ];

    if (open) {
      items.forEach(function (it) {
        kids.push(UI.h('div', {
          class: 'issue-sub' + (it.id === UI.state.selectedId ? ' selected' : ''),
          onclick: function (ev) {
            ev.stopPropagation();
            UI.state.expandedGroups[group.key] = true;
            UI.jumpTo(it);
          }
        }, it.context
          ? [document.createTextNode(it.context.before),
            UI.h('span', { class: 'hit', text: it.context.hit }),
            document.createTextNode(it.context.after)]
          : [document.createTextNode(it.message)]));
      });
    }

    kids.push(UI.h('div', { class: 'issue-actions' }, [
      UI.h('button', {
        class: 'tiny',
        onclick: function (ev) {
          ev.stopPropagation();
          UI.state.expandedGroups[group.key] = !open;
          UI.renderIssues();
        },
        text: open ? '畳む' : '各箇所を見る'
      }),
      UI.h('button', {
        class: 'tiny done',
        onclick: function (ev) {
          ev.stopPropagation();
          items.forEach(function (it) { UI.state.resolved[it.fingerprint] = 1; });
          UI.saveMarks();
          UI.runAnalyze();
        },
        text: '✓ この束を対応済み'
      })
    ]));

    return UI.h('div', {
      class: 'issue grouped sev-' + first.severity + (selected ? ' selected' : ''),
      onclick: function () {
        UI.state.expandedGroups[group.key] = true;
        UI.jumpTo(first);
      }
    }, kids);
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
