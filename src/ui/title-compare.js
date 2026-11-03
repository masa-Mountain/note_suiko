/* 推敲 (suikou) — タイトル案の一覧。最高点を自動では使わない。 */
(function (global) {
  'use strict';

  var S = global.Suikou;
  var UI = S.ui;

  /**
   * 一覧用の短い事実。
   * @param {string} text タイトル案
   * @returns {string} 1行
   */
  function _brief(text) {
    var facts = S.titleFacts(text);
    var bits = [facts.chars + '字'];
    if (facts.questionMark) bits.push('疑問符');
    if (facts.exclaimMark) bits.push('感嘆符');
    if (facts.number) bits.push('数字');
    if (facts.seriesMark) bits.push('連番 ' + facts.seriesMark);
    var words = facts.questionPhrases.concat(facts.emotionWords, facts.abstractWords, facts.concreteWords);
    if (words.length) bits.push(words.slice(0, 4).join('・'));
    return bits.join(' / ');
  }

  /**
   * 5項目の点数。
   * @param {Object} item 案
   * @returns {string} 短い点数
   */
  function _scoreLine(item) {
    return UI.TITLE_AXES.map(function (axis) {
      return axis.short + item.scores[axis.key];
    }).join(' ');
  }

  /**
   * 行の文字を今の案に合わせる。
   * @param {Object} item 案
   * @returns {void}
   */
  /**
   * 行の文字を今の案に合わせる。
   * @param {HTMLElement} row 行
   * @param {Object} item 案
   * @returns {void}
   */
  function _paint(row, item) {
    var total = UI.titleTotal(item);
    row.querySelector('.title-row-text').textContent = item.text || '（無題）';
    row.querySelector('.title-row-entrance').textContent = item.entrance ? '入口: ' + item.entrance : '';
    row.querySelector('.title-row-facts').textContent = _brief(item.text);
    row.querySelector('.title-row-total').textContent = total + '/25 ' + UI.titleBand(total);
    row.querySelector('.title-row-scores').textContent = _scoreLine(item);
  }

  UI.paintTitleRow = function (item) {
    var row = document.querySelector('[data-title-id="' + item.id + '"]');
    if (row) _paint(row, item);
  };

  /**
   * 一覧の1行。
   * @param {Object} item 案
   * @param {boolean} current 選択中
   * @returns {HTMLElement} 行
   */
  function _row(item, current) {
    var row = UI.h('article', {
      class: 'title-row' + (current ? ' is-current' : ''),
      'data-title-id': item.id
    }, [
      UI.h('div', { class: 'title-row-text' }),
      UI.h('div', { class: 'title-row-entrance' }),
      UI.h('div', { class: 'title-row-facts' }),
      UI.h('div', { class: 'title-row-total' }),
      UI.h('div', { class: 'title-row-scores' }),
      UI.h('div', { class: 'title-row-actions' }, [
        UI.h('button', { type: 'button', text: '編集', onclick: function () {
          UI.state.titleId = item.id;
          UI.renderTitles();
          var input = UI.$('title-entrance-input');
          if (input) input.focus();
        } }),
        UI.h('button', { type: 'button', text: '削除', onclick: function () {
          if (!confirm('このタイトル案を消します。')) return;
          UI.removeTitle(item.id);
          UI.renderTitles();
        } }),
        UI.h('button', { type: 'button', text: 'このタイトルを使う', onclick: function () {
          UI.adoptTitle(item);
        } })
      ])
    ]);
    _paint(row, item);
    return row;
  }

  /**
   * タイトルタブを描く。
   * @returns {void}
   */
  UI.renderTitles = function () {
    var host = UI.$('tab-titles');
    if (!host) return;
    var currentText = UI.el.title ? UI.el.title.value.replace(/^[\s\u3000]+|[\s\u3000]+$/g, '') : '';
    var sortLabel = UI.state.titleSort === 'score' ? '追加順に戻す' : '合計点で並べる';
    host.textContent = '';
    host.appendChild(UI.h('div', { class: 'title-tools' }, [
      UI.h('button', { type: 'button', text: '案を追加', onclick: function () {
        UI.addTitle('');
        UI.renderTitles();
        var input = UI.$('title-entrance-input');
        if (input) input.focus();
      } }),
      UI.h('button', {
        type: 'button', text: 'いまのタイトルを案に入れる',
        disabled: currentText ? null : 'disabled',
        onclick: function () {
          if (!currentText) return;
          UI.addTitle(currentText);
          UI.renderTitles();
        }
      }),
      UI.h('button', { type: 'button', text: sortLabel, onclick: function () {
        UI.state.titleSort = UI.state.titleSort === 'score' ? 'added' : 'score';
        UI.renderTitles();
      } })
    ]));
    var list = UI.h('div', { class: 'title-list' });
    if (!UI.state.titles.length) {
      list.appendChild(UI.h('p', { class: 'title-empty', text: 'タイトル案はまだありません。' }));
    }
    var sorted = UI.sortedTitles();
    var selected = null;
    sorted.forEach(function (item) {
      if (item.id === UI.state.titleId) selected = item;
    });
    if (!selected && sorted.length) {
      selected = sorted[0];
      UI.state.titleId = selected.id;
    }
    sorted.forEach(function (item) {
      list.appendChild(_row(item, item.id === selected.id));
    });
    host.appendChild(list);
    host.appendChild(UI.h('p', { class: 'title-caution', text: '点数は自分の評価です。一番高い案を自動では使いません。' }));
    var sheet = UI.h('div', { class: 'title-sheet-host' });
    host.appendChild(sheet);
    UI.renderTitleSheet(sheet, selected);
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
