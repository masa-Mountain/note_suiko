/* 執筆画面パネルのタイトル案。採点はユーザーが行う */
(function (global) {
  'use strict';

  var E = (global.SuikouExt = global.SuikouExt || {});
  var S = function () { return global.Suikou; };

  E.noteMode = 'issues';

  /**
   * 前後の空白を外す。
   * @param {string} text 文言
   * @returns {string} 空白を除いた文字列
   */
  function _trim(text) {
    return String(text || '').replace(/^[\s\u3000]+|[\s\u3000]+$/g, '');
  }

  /**
   * 一覧用の短い事実。
   * @param {string} text タイトル案
   * @returns {string} 1行
   */
  function _brief(text) {
    var facts = S().titleFacts(text);
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
   * 事実のチップを描き直す。
   * @param {HTMLElement} box 入れ先
   * @param {string} text タイトル案
   * @returns {void}
   */
  function _fillFacts(box, text) {
    var facts = S().titleFacts(text);
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
      var chip = document.createElement('span');
      chip.className = 'suikou-title-chip';
      chip.textContent = line;
      box.appendChild(chip);
    });
  }

  /**
   * 行の文字を今の案に合わせる。
   * @param {HTMLElement} row 行
   * @param {Object} item 案
   * @returns {void}
   */
  function _fillRow(row, item) {
    var total = E.titleTotal(item);
    row.querySelector('.suikou-title-text').textContent = item.text || '（無題）';
    var entrance = row.querySelector('.suikou-title-entrance');
    if (entrance) entrance.textContent = item.entrance ? '入口: ' + item.entrance : '';
    row.querySelector('.suikou-title-facts').textContent = _brief(item.text);
    row.querySelector('.suikou-title-total').textContent = total + '/25 ' + E.titleBand(total);
    row.querySelector('.suikou-title-scores').textContent = E.TITLE_AXES.map(function (axis) {
      return axis.short + item.scores[axis.key];
    }).join(' ');
  }

  function _paintRow(item) {
    var row = document.querySelector('[data-note-title="' + item.id + '"]');
    if (row) _fillRow(row, item);
  }

  /**
   * ボタンを作る。
   * @param {string} label ラベル
   * @param {function(): void} onClick 押したとき
   * @returns {HTMLButtonElement} ボタン
   */
  function _button(label, onClick) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'suikou-done';
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    return btn;
  }

  /**
   * 一覧の1行。
   * @param {Object} item 案
   * @param {boolean} current 選択中
   * @returns {HTMLElement} 行
   */
  function _row(item, current) {
    var row = document.createElement('article');
    row.className = 'suikou-title-row' + (current ? ' is-current' : '');
    row.setAttribute('data-note-title', item.id);
    row.innerHTML = '<div class="suikou-title-text"></div><div class="suikou-title-entrance"></div><div class="suikou-title-facts"></div>' +
      '<div class="suikou-title-total"></div><div class="suikou-title-scores"></div>';
    var actions = document.createElement('div');
    actions.className = 'suikou-title-actions';
    actions.appendChild(_button('編集', function () {
      E.noteTitleId = item.id;
      E.renderNoteTitles();
      var input = document.getElementById('suikou-title-entrance');
      if (input) input.focus();
    }));
    actions.appendChild(_button('削除', function () {
      if (!confirm('このタイトル案を消します。')) return;
      E.removeNoteTitle(item.id);
      E.renderNoteTitles();
    }));
    actions.appendChild(_button('このタイトルを使う', function () {
      E.writeNoteTitle(item.text || '');
    }));
    row.appendChild(actions);
    _fillRow(row, item);
    return row;
  }

  /**
   * 1項目のスライダーと任意の理由。
   * @param {Object} item 案
   * @param {{key: string, label: string}} axis 項目
   * @param {HTMLElement} totalEl 合計
   * @param {HTMLElement} bandEl 呼び名
   * @returns {HTMLElement} 行
   */
  function _axis(item, axis, totalEl, bandEl) {
    var wrap = document.createElement('div');
    wrap.className = 'suikou-title-axis';
    var name = document.createElement('span');
    name.textContent = axis.label;
    var score = document.createElement('span');
    score.className = 'suikou-title-n';
    score.textContent = item.scores[axis.key] + '/5';
    var range = document.createElement('input');
    range.type = 'range';
    range.min = '1';
    range.max = '5';
    range.step = '1';
    range.value = String(item.scores[axis.key]);
    range.setAttribute('aria-label', axis.label);
    var paint = function () {
      var total = E.titleTotal(item);
      totalEl.textContent = total + '/25';
      bandEl.textContent = E.titleBand(total);
      _paintRow(item);
    };
    range.addEventListener('input', function () {
      item.scores[axis.key] = Number(range.value);
      score.textContent = range.value + '/5';
      paint();
      E.saveNoteTitles();
    });
    range.addEventListener('change', function () {
      if (E.noteTitleSort === 'score') E.renderNoteTitles();
    });
    var note = document.createElement('input');
    note.type = 'text';
    note.className = 'suikou-title-note';
    note.placeholder = '理由（任意）';
    note.value = item.notes[axis.key];
    note.hidden = !item.notes[axis.key];
    note.addEventListener('input', function () {
      item.notes[axis.key] = note.value;
      E.saveNoteTitles();
    });
    var reason = _button('理由', function () {
      note.hidden = !note.hidden;
      if (!note.hidden) note.focus();
    });
    wrap.appendChild(name);
    wrap.appendChild(score);
    wrap.appendChild(range);
    wrap.appendChild(reason);
    wrap.appendChild(note);
    return wrap;
  }

  /**
   * 選択中の案を描く。
   * @param {HTMLElement} host 入れ先
   * @param {Object|null} item 案
   * @returns {void}
   */
  function _sheet(host, item) {
    if (!item) return;
    var sheet = document.createElement('section');
    sheet.className = 'suikou-title-sheet';
    var head = document.createElement('strong');
    head.textContent = 'タイトル評価シート';
    var lead = document.createElement('p');
    lead.className = 'suikou-title-lead';
    lead.textContent = '未読の人に何の話かを先に書き、それからタイトルを点で見ます。語句の有無だけを表示します。良し悪しは判断しません。';
    var entrance = document.createElement('input');
    entrance.type = 'text';
    entrance.id = 'suikou-title-entrance';
    entrance.className = 'suikou-title-draft';
    entrance.placeholder = '未読の入口（場面、相手、起きたこと）';
    entrance.value = item.entrance || '';
    entrance.addEventListener('input', function () {
      item.entrance = entrance.value;
      _paintRow(item);
      E.saveNoteTitles();
    });
    var hint = document.createElement('p');
    hint.className = 'suikou-title-lead';
    hint.textContent = '入口に書いた出来事が、タイトル単体でも分かるか。分からなければ、その言葉をタイトルに残す。';
    var draft = document.createElement('input');
    draft.type = 'text';
    draft.id = 'suikou-title-draft';
    draft.className = 'suikou-title-draft';
    draft.placeholder = 'タイトル案';
    draft.value = item.text;
    var facts = document.createElement('div');
    facts.className = 'suikou-title-facts';
    _fillFacts(facts, item.text);
    var totalEl = document.createElement('b');
    totalEl.className = 'suikou-title-sum';
    var bandEl = document.createElement('span');
    var total = E.titleTotal(item);
    totalEl.textContent = total + '/25';
    bandEl.textContent = E.titleBand(total);
    draft.addEventListener('input', function () {
      item.text = draft.value;
      _fillFacts(facts, item.text);
      _paintRow(item);
      E.saveNoteTitles();
    });
    var foot = document.createElement('div');
    foot.className = 'suikou-title-foot';
    var label = document.createElement('div');
    label.textContent = '合計点';
    var left = document.createElement('div');
    left.appendChild(label);
    left.appendChild(totalEl);
    foot.appendChild(left);
    foot.appendChild(bandEl);
    var reset = _button('リセット', function () {
      E.TITLE_AXES.forEach(function (axis) {
        item.scores[axis.key] = 3;
        item.notes[axis.key] = '';
      });
      E.saveNoteTitles();
      E.renderNoteTitles();
    });
    reset.className = 'suikou-done suikou-title-reset';
    sheet.appendChild(head);
    sheet.appendChild(lead);
    sheet.appendChild(entrance);
    sheet.appendChild(draft);
    sheet.appendChild(hint);
    sheet.appendChild(facts);
    E.TITLE_AXES.forEach(function (axis) {
      sheet.appendChild(_axis(item, axis, totalEl, bandEl));
    });
    sheet.appendChild(foot);
    sheet.appendChild(reset);
    host.appendChild(sheet);
  }

  /**
   * タイトル側を描く。
   * @returns {void}
   */
  E.renderNoteTitles = function () {
    var box = document.getElementById('suikou-note-titles');
    if (!box) return;
    if (E.noteTitlePage !== location.pathname) E.noteTitlesReady = false;
    if (!E.noteTitlesReady) {
      if (E.noteTitlesLoading) return;
      E.noteTitlesLoading = true;
      box.textContent = 'タイトル案を読んでいます。';
      E.loadNoteTitles(function () {
        E.noteTitlesLoading = false;
        E.noteTitlesReady = true;
        E.renderNoteTitles();
      });
      return;
    }
    var current = _trim(E.readNoteTitle ? E.readNoteTitle() : '');
    box.textContent = '';
    var tools = document.createElement('div');
    tools.className = 'suikou-title-tools';
    tools.appendChild(_button('案を追加', function () {
      E.addNoteTitle('');
      E.renderNoteTitles();
      var input = document.getElementById('suikou-title-entrance');
      if (input) input.focus();
    }));
    var take = _button('いまのタイトルを案に入れる', function () {
      if (!current) return;
      E.addNoteTitle(current);
      E.renderNoteTitles();
    });
    take.disabled = !current;
    tools.appendChild(take);
    tools.appendChild(_button(E.noteTitleSort === 'score' ? '追加順に戻す' : '合計点で並べる', function () {
      E.noteTitleSort = E.noteTitleSort === 'score' ? 'added' : 'score';
      E.renderNoteTitles();
    }));
    box.appendChild(tools);
    if (!E.noteTitles.length) {
      var empty = document.createElement('p');
      empty.className = 'suikou-title-lead';
      empty.textContent = 'タイトル案はまだありません。';
      box.appendChild(empty);
    }
    var sorted = E.sortedNoteTitles();
    var selected = null;
    sorted.forEach(function (item) {
      if (item.id === E.noteTitleId) selected = item;
    });
    if (!selected && sorted.length) {
      selected = sorted[0];
      E.noteTitleId = selected.id;
    }
    sorted.forEach(function (item) {
      box.appendChild(_row(item, selected && item.id === selected.id));
    });
    var caution = document.createElement('p');
    caution.className = 'suikou-title-lead';
    caution.textContent = '点数は自分の評価です。一番高い案を自動では使いません。';
    box.appendChild(caution);
    _sheet(box, selected);
  };

  /**
   * 指摘とタイトルを切り替える。
   * @param {string} mode issues か titles
   * @returns {void}
   */
  E.setNoteMode = function (mode) {
    E.noteMode = mode === 'titles' ? 'titles' : 'issues';
    var host = document.getElementById('suikou-note-panel');
    if (!host) return;
    host.classList.toggle('is-titles', E.noteMode === 'titles');
    var buttons = host.querySelectorAll('[data-note-mode]');
    var i;
    for (i = 0; i < buttons.length; i++) {
      buttons[i].classList.toggle('is-on', buttons[i].getAttribute('data-note-mode') === E.noteMode);
    }
    if (E.noteMode === 'titles') E.renderNoteTitles();
  };
})(globalThis);
