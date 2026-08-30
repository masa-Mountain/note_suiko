/* 推敲 (suikou) — 診断タブ：分量・文のかたち・読みやすさ・段落の負荷 */
(function (global) {
  'use strict';

  var S = global.Suikou;
  var UI = S.ui;

  var RATIO_LABEL = { kanjiRatio: '漢字', kanaRatio: 'ひらがな', katakanaRatio: 'カタカナ' };
  var RATIO_IDEAL = { kanjiRatio: '目安 25〜35%', kanaRatio: '目安 50〜70%', katakanaRatio: '目安 5〜15%' };

  /**
   * @param {string} label 項目名
   * @param {string|number} value 値
   * @returns {HTMLElement} 表の行
   */
  function _row(label, value) {
    return UI.h('tr', {}, [UI.h('td', { text: label }), UI.h('td', { text: String(value) })]);
  }

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
      UI.h('div', { class: 'bar' }, [UI.h('i', { style: 'width:' + Math.min(100, percent) + '%' })]),
      UI.h('div', { class: 'bar-ends' }, [UI.h('span', { text: low }), UI.h('span', { text: high })])
    ]);
  }

  /**
   * @param {Object} m 計量
   * @returns {Array<HTMLElement>} 分量と文のかたちの表
   */
  function _tables(m) {
    return [
      UI.h('h3', { class: 'section', text: '分量' }),
      UI.h('table', { class: 'metrics' }, [
        _row('本文文字数（空白除く）', m.body),
        _row('総文字数', m.chars),
        _row('原稿用紙換算（400字）', m.sheets + ' 枚'),
        _row('文数 / 段落数', m.sentences + ' / ' + m.paragraphs),
        _row('読了時間の目安', '約 ' + m.readingMinutes + ' 分'),
        _row('モーラ数（概算）', m.mora)
      ]),
      UI.h('h3', { class: 'section', text: '文のかたち' }),
      UI.h('table', { class: 'metrics' }, [
        _row('平均文長', m.avgSentence + ' 字'),
        _row('最長文', m.maxSentence + ' 字'),
        _row('文長のばらつき（標準偏差）', m.sdSentence),
        _row('文長の変動係数', m.cvSentence + '（0.35〜0.7 が読みやすい目安）'),
        _row('読点', m.commas + ' 個（1文あたり ' + m.commaPerSentence + '）'),
        _row('文体', '敬体 ' + m.style.polite + ' / 常体 ' + m.style.plain +
          ' / 体言止め ' + m.style.taigen + ' / その他 ' + m.style.other)
      ])
    ];
  }

  /**
   * 見出しの一覧。クリックでその位置へ飛ぶ。
   * @param {Array<{level: number, title: string, start: number}>} headings 見出し
   * @returns {HTMLElement} 一覧
   */
  function _headingList(headings) {
    return UI.h('ul', { class: 'plain' }, headings.map(function (hd) {
      return UI.h('li', {}, [UI.h('a', {
        href: '#',
        onclick: function (ev) {
          ev.preventDefault();
          UI.jumpTo({ id: 'heading', start: hd.start, end: hd.start + 1 });
        },
        text: '　'.repeat(Math.max(0, hd.level - 1)) + hd.title
      })]);
    }));
  }

  /**
   * 段落ごとの読みの負荷。横棒が長い段落は読者の負担が大きい。
   * @param {Array<Object>} profile 段落ごとの計量
   * @returns {HTMLElement} 一覧
   */
  function _heatmap(profile) {
    var heat = UI.h('div', { class: 'heatmap' });
    profile.forEach(function (p, i) {
      var color = p.load > 72 ? 'var(--error)'
        : p.load > 52 ? 'var(--warn)'
          : p.load > 32 ? 'var(--info)' : 'var(--cat-structure)';
      heat.appendChild(UI.h('div', {
        class: 'heat-row',
        onclick: function () { UI.jumpTo({ id: 'para' + i, start: p.start, end: p.end }); }
      }, [
        UI.h('span', { class: 'idx', text: String(i + 1) }),
        UI.h('div', { class: 'gauge' }, [
          UI.h('i', { style: 'width:' + p.load + '%;background:' + color }),
          UI.h('span', { text: p.preview })
        ]),
        UI.h('span', { class: 'val', text: p.chars + '字' })
      ]));
    });
    return heat;
  }

  /**
   * 診断タブを描く。
   * @returns {void}
   */
  UI.renderMetrics = function () {
    var host = UI.el.tabBodies.metrics;
    UI.clear(host);
    var r = UI.state.result;
    if (!r || !r.metrics.body) {
      host.appendChild(UI.h('div', { class: 'empty', text: '本文を入力すると計量が表示されます。' }));
      return;
    }
    var m = r.metrics;

    _tables(m).forEach(function (n) { host.appendChild(n); });

    host.appendChild(UI.h('h3', { class: 'section', text: '文字と語彙' }));
    Object.keys(RATIO_LABEL).forEach(function (key) {
      host.appendChild(_bar(RATIO_LABEL[key] + '率', m[key] + '%', m[key], RATIO_IDEAL[key], ''));
    });
    host.appendChild(UI.h('table', { class: 'metrics' }, [
      _row('異なり語比 (TTR)', m.ttr + '%（内容語 ' + m.contentWords + ' / 異なり ' + m.uniqueWords + '）'),
      _row('抽象語の密度', m.abstractPer1000 + ' /千字'),
      _row('英字 / 数字', m.latinRatio + '% / ' + m.digitRatio + '%')
    ]));

    host.appendChild(UI.h('h3', { class: 'section', text: '読みやすさ' }));
    host.appendChild(_bar(m.easeLabel + '（' + m.easeReader + ' / ' + m.easeGrade + '）',
      String(m.ease), m.ease, '硬い', 'やさしい'));

    if (r.headings.length) {
      host.appendChild(UI.h('h3', { class: 'section', text: '見出し（' + r.headings.length + '）' }));
      host.appendChild(_headingList(r.headings));
    }

    host.appendChild(UI.h('h3', { class: 'section', text: '段落ごとの読みの負荷' }));
    host.appendChild(UI.h('div', {
      class: 'kv',
      text: '横棒が長い段落は、文字量・文長・漢字率から見て読者の負担が大きい箇所です。クリックでその段落に移動します。'
    }));
    host.appendChild(_heatmap(m.paragraphProfile));
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
