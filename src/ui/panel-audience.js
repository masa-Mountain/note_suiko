/* 推敲 (suikou) — 読者像タブ：文章の姿・ジャンル・想定読者・タグ候補 */
(function (global) {
  'use strict';

  var S = global.Suikou;
  var UI = S.ui;

  /**
   * @param {string} label 左の見出し
   * @param {string} value 右に出す値
   * @param {number} percent 棒の長さ（%）
   * @param {string} low 左端の注記
   * @param {string} high 右端の注記
   * @returns {HTMLElement} 横棒グラフの行
   */
  function _bar(label, value, percent, low, high) {
    return UI.h('div', { class: 'bar-row' }, [
      UI.h('div', { class: 'bar-label' }, [UI.h('span', { text: label }), UI.h('b', { text: value })]),
      UI.h('div', { class: 'bar' }, [UI.h('i', { style: 'width:' + percent + '%' })]),
      UI.h('div', { class: 'bar-ends' }, [UI.h('span', { text: low }), UI.h('span', { text: high })])
    ]);
  }

  /**
   * 想定読者の要約。
   * @param {Object} a 読者像の推定結果
   * @returns {HTMLElement} 説明の塊
   */
  function _readerBox(a) {
    return UI.h('div', { class: 'kv' }, [
      UI.h('b', { text: '年齢帯　' }), document.createTextNode(a.ageBands.join('、')), UI.h('br'),
      UI.h('b', { text: '読解水準　' }), document.createTextNode(a.easeLabel + '（' + a.easeReader + '）'), UI.h('br'),
      UI.h('b', { text: 'トーン　' }), document.createTextNode(a.polarityLabel + '（極性 ' + a.polarity + '）'), UI.h('br'),
      UI.h('b', { text: '読まれる場面　' }), document.createTextNode(a.scene)
    ]);
  }

  /**
   * 読者像タブを描く。
   * @returns {void}
   */
  UI.renderAudience = function () {
    var host = UI.el.tabBodies.audience;
    UI.clear(host);
    var r = UI.state.result;
    if (!r || !r.audience) {
      host.appendChild(UI.h('div', { class: 'empty', text: '80字以上の本文があると読者像を推定します。' }));
      return;
    }
    var a = r.audience;

    host.appendChild(UI.h('div', { class: 'summary-box', text: a.summary }));

    host.appendChild(UI.h('h3', { class: 'section', text: '文章の姿' }));
    a.axes.forEach(function (ax) {
      host.appendChild(_bar(ax.label, String(ax.value), ax.value, ax.low, ax.high));
    });

    host.appendChild(UI.h('h3', { class: 'section', text: 'ジャンルの推定' }));
    a.genres.slice(0, 4).forEach(function (g) {
      host.appendChild(_bar(g.label, g.percent + '%', g.percent, g.matched.join('・'), ''));
    });

    host.appendChild(UI.h('h3', { class: 'section', text: '想定される読者' }));
    host.appendChild(_readerBox(a));
    host.appendChild(UI.h('ul', { class: 'plain' }, a.traits.map(function (t) {
      return UI.h('li', { text: t });
    })));

    if (a.mismatches.length) {
      host.appendChild(UI.h('h3', { class: 'section', text: '噛み合っていない点' }));
      a.mismatches.forEach(function (msg) {
        host.appendChild(UI.h('div', { class: 'callout', text: msg }));
      });
    }

    host.appendChild(UI.h('h3', { class: 'section', text: '本文の頻出語' }));
    host.appendChild(UI.h('div', { class: 'tags' }, a.keywords.slice(0, 12).map(function (k) {
      return UI.h('span', { text: k.word + ' ' + k.count });
    })));

    host.appendChild(UI.h('h3', { class: 'section', text: '公開前チェックリスト' }));
    var list = S.rating.zoningChecklist[UI.state.config.rating] || [];
    host.appendChild(UI.h('ul', { class: 'checklist' }, list.map(function (item) {
      return UI.h('li', {}, [UI.h('input', { type: 'checkbox' }), UI.h('span', { text: item })]);
    })));
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
