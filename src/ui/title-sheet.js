/* 推敲 (suikou) — 1件の自己評価シート。採点はユーザーが行う。 */
(function (global) {
  'use strict';

  var S = global.Suikou;
  var UI = S.ui;

  /**
   * 事実のチップを描き直す。
   * @param {HTMLElement} box 入れ先
   * @param {string} text タイトル案
   * @returns {void}
   */
  function _fillFacts(box, text) {
    var facts = S.titleFacts(text);
    var lines = [
      '文字数 ' + facts.chars,
      facts.questionMark ? '疑問符あり' : '疑問符なし',
      facts.exclaimMark ? '感嘆符あり' : '感嘆符なし',
      facts.number ? '数字あり' : '数字なし',
      '疑問の言い方: ' + (facts.questionPhrases.join('、') || '該当なし'),
      '感情の語: ' + (facts.emotionWords.join('、') || '該当なし'),
      '抽象的な語: ' + (facts.abstractWords.join('、') || '該当なし'),
      '時間・場所・出来事: ' + (facts.concreteWords.join('、') || '該当なし')
    ];
    if (facts.seriesMark) lines.push('連番: ' + facts.seriesMark);
    box.textContent = '';
    lines.forEach(function (line) {
      box.appendChild(UI.h('span', { class: 'title-chip', text: line }));
    });
  }

  /**
   * 合計と呼び名を書き換える。
   * @param {HTMLElement} totalEl 合計
   * @param {HTMLElement} bandEl 呼び名
   * @param {Object} item 案
   * @returns {void}
   */
  function _paintScore(totalEl, bandEl, item) {
    var total = UI.titleTotal(item);
    totalEl.textContent = total + '/25';
    bandEl.textContent = UI.titleBand(total);
  }

  /**
   * 1項目のスライダーと任意の理由。
   * @param {Object} item 案
   * @param {{key: string, label: string}} axis 項目
   * @param {function(boolean): void} onChange 点数変更。引数は離したとき true
   * @returns {HTMLElement} 行
   */
  function _axis(item, axis, onChange) {
    var score = UI.h('span', { class: 'title-n', text: item.scores[axis.key] + '/5' });
    var range = UI.h('input', {
      type: 'range', min: '1', max: '5', step: '1',
      value: String(item.scores[axis.key]), 'aria-label': axis.label
    });
    range.addEventListener('input', function () {
      item.scores[axis.key] = Number(range.value);
      score.textContent = range.value + '/5';
      onChange(false);
    });
    range.addEventListener('change', function () { onChange(true); });
    var note = UI.h('input', {
      type: 'text', class: 'title-note-input', value: item.notes[axis.key],
      placeholder: '理由（任意）', spellcheck: 'false'
    });
    note.hidden = !item.notes[axis.key];
    note.addEventListener('input', function () {
      item.notes[axis.key] = note.value;
      UI.saveTitles();
    });
    return UI.h('div', { class: 'title-axis' }, [
      UI.h('span', { text: axis.label }),
      score,
      range,
      UI.h('button', {
        type: 'button', class: 'title-reason', text: '理由',
        onclick: function () {
          note.hidden = !note.hidden;
          if (!note.hidden) note.focus();
        }
      }),
      note
    ]);
  }

  /**
   * 選択中の案のシートを描く。
   * @param {HTMLElement} host 入れ先
   * @param {Object|null} item 案
   * @returns {void}
   */
  UI.renderTitleSheet = function (host, item) {
    host.textContent = '';
    if (!item) return;
    var facts = UI.h('div', { class: 'title-facts' });
    _fillFacts(facts, item.text);
    var totalEl = UI.h('b', { class: 'title-total' });
    var bandEl = UI.h('span', { class: 'title-band' });
    _paintScore(totalEl, bandEl, item);
    var entrance = UI.h('input', {
      type: 'text', id: 'title-entrance-input', class: 'title-draft',
      value: item.entrance || '', placeholder: '未読の入口（場面、相手、起きたこと）', spellcheck: 'false'
    });
    entrance.addEventListener('input', function () {
      item.entrance = entrance.value;
      UI.saveTitles();
      if (UI.paintTitleRow) UI.paintTitleRow(item);
    });
    var draft = UI.h('input', {
      type: 'text', id: 'title-draft-input', class: 'title-draft',
      value: item.text, placeholder: 'タイトル案', spellcheck: 'false'
    });
    draft.addEventListener('input', function () {
      item.text = draft.value;
      _fillFacts(facts, item.text);
      UI.saveTitles();
      if (UI.paintTitleRow) UI.paintTitleRow(item);
    });
    var axes = UI.TITLE_AXES.map(function (axis) {
      return _axis(item, axis, function (committed) {
        _paintScore(totalEl, bandEl, item);
        UI.saveTitles();
        if (committed && UI.state.titleSort === 'score') UI.renderTitles();
        else if (UI.paintTitleRow) UI.paintTitleRow(item);
      });
    });
    var reset = UI.h('button', { type: 'button', class: 'title-reset', text: 'リセット' });
    reset.addEventListener('click', function () {
      UI.TITLE_AXES.forEach(function (axis) {
        item.scores[axis.key] = 3;
        item.notes[axis.key] = '';
      });
      UI.saveTitles();
      UI.renderTitles();
    });
    host.appendChild(UI.h('section', { class: 'title-sheet' }, [
      UI.h('h3', { class: 'title-sheet-h', text: 'タイトル評価シート' }),
      UI.h('p', { class: 'title-lead', text: '未読の人に何の話かを先に書き、それからタイトルを点で見ます。語句の有無だけを表示します。良し悪しは判断しません。' }),
      entrance,
      draft,
      UI.h('p', { class: 'title-lead', text: '入口に書いた出来事が、タイトル単体でも分かるか。分からなければ、その言葉をタイトルに残す。' }),
      facts
    ].concat(axes, [
      UI.h('div', { class: 'title-foot' }, [
        UI.h('div', {}, [UI.h('div', { class: 'title-foot-label', text: '合計点' }), totalEl]),
        bandEl
      ]),
      reset
    ])));
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
