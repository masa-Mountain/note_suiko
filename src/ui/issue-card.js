/* 推敲 (suikou) — 指摘カード1枚の組み立て */
(function (global) {
  'use strict';

  var S = global.Suikou;
  var UI = S.ui;

  /**
   * 分類・深刻度・ルール ID の見出し行。
   * @param {Object} issue 指摘
   * @returns {HTMLElement} 見出し行
   */
  function _head(issue) {
    return UI.h('div', { class: 'issue-head' }, [
      UI.h('span', {
        class: 'badge',
        style: 'color:' + S.CATEGORIES[issue.category].color,
        text: S.CATEGORIES[issue.category].label
      }),
      UI.h('span', { class: 'badge sev-' + issue.severity, text: UI.severityLabel(issue.severity) }),
      UI.h('span', { class: 'issue-rule', text: issue.ruleId })
    ]);
  }

  /**
   * 該当箇所を前後の文脈つきで示す行。
   * @param {{before: string, hit: string, after: string}} ctx 文脈
   * @returns {HTMLElement} 文脈の行
   */
  function _context(ctx) {
    return UI.h('div', { class: 'issue-ctx' }, [
      document.createTextNode(ctx.before),
      UI.h('span', { class: 'hit', text: ctx.hit }),
      document.createTextNode(ctx.after)
    ]);
  }

  /**
   * 表記統一の置換ボタン。原則として本文は書き換えないが、
   * 表記の統一だけは機械的な作業なので例外として出す。
   * @param {Object} issue 指摘
   * @returns {Array<HTMLElement>} ボタン
   */
  function _unifyButtons(issue) {
    return [
      UI.h('button', {
        class: 'tiny',
        onclick: function (ev) {
          ev.stopPropagation();
          UI.replaceRange(issue.start, issue.end, issue.meta.unifyTo);
        },
        text: 'ここを「' + issue.meta.unifyTo + '」に'
      }),
      UI.h('button', {
        class: 'tiny',
        onclick: function (ev) {
          ev.stopPropagation();
          if (confirm('本文中の「' + issue.meta.unifyFrom + '」をすべて「' +
            issue.meta.unifyTo + '」に置き換えます。よろしいですか。')) {
            UI.unifyAll(issue.meta.unifyFrom, issue.meta.unifyTo);
          }
        },
        text: 'すべて統一'
      })
    ];
  }

  /**
   * 片付ける／片付けを戻すボタン。
   * @param {Object} issue 指摘
   * @returns {Array<HTMLElement>} ボタン
   */
  function _dismissButtons(issue) {
    if (issue.dismissed) {
      return [UI.h('button', {
        class: 'tiny',
        onclick: function (ev) {
          ev.stopPropagation();
          UI.undismissIssue(issue);
        },
        text: issue.dismissed === 'suppressed' ? '無視をやめる' : '戻す'
      })];
    }
    return [
      UI.h('button', {
        class: 'tiny done', title: '見た・直した。この原稿では出さない',
        onclick: function (ev) {
          ev.stopPropagation();
          UI.dismissIssue(issue, 'resolved');
        },
        text: '✓ 対応済み'
      }),
      UI.h('button', {
        class: 'tiny ignore',
        title: '「' + (issue.context ? issue.context.hit : issue.ruleName) + '」については今後も指摘しない',
        onclick: function (ev) {
          ev.stopPropagation();
          UI.dismissIssue(issue, 'suppressed');
        },
        text: '⊘ 今後も無視'
      })
    ];
  }

  /**
   * 言い換え候補。押すとコピーするだけで、本文は書き換えない。
   * @param {string[]} suggestions 候補
   * @returns {Array<HTMLElement>} 候補の並びと注記
   */
  function _suggestions(suggestions) {
    return [
      UI.h('div', { class: 'sugg' }, suggestions.map(function (sg) {
        return UI.h('span', {
          title: 'クリックでコピー',
          onclick: function (ev) {
            ev.stopPropagation();
            UI.copyText(sg);
          },
          text: sg
        });
      })),
      UI.h('div', {
        class: 'sugg-note',
        text: '候補はクリックでコピーできます。置き換えは行いません。自分の言葉を選んでください。'
      })
    ];
  }

  /**
   * 指摘カードを組み立てる。
   * @param {Object} issue 指摘
   * @returns {HTMLElement} カード要素
   */
  UI.issueCard = function (issue) {
    var cfg = UI.state.config;
    var kids = [_head(issue), UI.h('div', { class: 'issue-msg', text: issue.message })];

    if (issue.context) kids.push(_context(issue.context));
    if (issue.advice) kids.push(UI.h('div', { class: 'issue-advice', text: issue.advice }));

    var hasSugg = !!(issue.suggestions && issue.suggestions.length);
    var revealed = UI.state.revealed[issue.id] || !cfg.display.hideSuggestions;
    var actions = [];

    if (hasSugg && !revealed) {
      actions.push(UI.h('button', {
        class: 'tiny',
        onclick: function (ev) {
          ev.stopPropagation();
          UI.state.revealed[issue.id] = true;
          UI.renderIssues();
        },
        text: '候補を見る（' + issue.suggestions.length + '）'
      }));
    }
    if (cfg.allowUnify && issue.meta && issue.meta.unifyFrom && issue.category === 'consistency') {
      actions = actions.concat(_unifyButtons(issue));
    }
    actions = actions.concat(_dismissButtons(issue));
    kids.push(UI.h('div', { class: 'issue-actions' }, actions));

    if (hasSugg && revealed) kids = kids.concat(_suggestions(issue.suggestions));

    return UI.h('div', {
      class: 'issue sev-' + issue.severity +
        (issue.id === UI.state.selectedId ? ' selected' : '') +
        (issue.dismissed ? ' dismissed' : ''),
      onclick: function () { UI.jumpTo(issue); }
    }, kids);
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
