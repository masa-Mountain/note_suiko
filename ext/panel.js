/* 執筆画面の端に出す指摘パネル */
(function (global) {
  'use strict';

  var E = (global.SuikouExt = global.SuikouExt || {});
  var S = function () { return global.Suikou; };

  E.flags = { warn: true, info: false, hint: false, done: false };

  /**
   * パネルの枠を作る。
   * @returns {HTMLElement} パネル
   */
  function _host() {
    var el = document.getElementById('suikou-note-panel');
    if (el) return el;
    el = document.createElement('aside');
    el.id = 'suikou-note-panel';
    el.innerHTML = '<header><strong>推敲</strong><span id="suikou-note-count"></span>' +
      '<button type="button" id="suikou-note-toggle">しまう</button></header>' +
      '<div class="suikou-body"><div id="suikou-note-prefs"></div>' +
      '<div id="suikou-note-modes"><button type="button" class="suikou-flag is-on" data-note-mode="issues">指摘</button>' +
      '<button type="button" class="suikou-flag" data-note-mode="titles">タイトル</button></div>' +
      '<div id="suikou-note-filters"></div>' +
      '<div id="suikou-note-list"></div><div id="suikou-note-titles"></div>' +
      '<p class="suikou-foot">推敲 <a href="https://masa-mountain.github.io/note_suiko/" target="_blank" rel="noopener">辞書・詳細設定</a></p></div>';
    document.documentElement.appendChild(el);
    el.querySelector('#suikou-note-toggle').addEventListener('click', function () {
      if (E.placeMoved) {
        E.placeMoved = false;
        return;
      }
      el.classList.toggle('is-collapsed');
      this.textContent = el.classList.contains('is-collapsed') ? '開く' : 'しまう';
    });
    el.querySelector('#suikou-note-modes').addEventListener('click', function (ev) {
      var mode = ev.target.getAttribute && ev.target.getAttribute('data-note-mode');
      if (mode && E.setNoteMode) E.setNoteMode(mode);
    });
    E.bindPlace(el);
    E.loadPlace(el);
    return el;
  }

  /**
   * 確認・参考の表示を切り替えるボタン。
   * @param {string} key flags のキー
   * @param {string} label 表示名
   * @param {number} count 件数
   * @returns {HTMLButtonElement} ボタン
   */
  function _flagButton(key, label, count) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'suikou-flag' + (E.flags[key] ? ' is-on' : '');
    btn.textContent = label + ' ' + count;
    btn.addEventListener('click', function () {
      E.flags[key] = !E.flags[key];
      E.renderPanel(E.lastCap, E.lastIssues);
    });
    return btn;
  }

  /**
   * いま一覧に出す指摘。
   * @param {Array<Object>} issues 全指摘
   * @returns {Array<Object>} 表示分
   */
  function _visible(issues) {
    return issues.filter(function (issue) {
      if (issue.dismissed && !E.flags.done) return false;
      if (issue.severity === 'warn' && !E.flags.warn) return false;
      if (issue.severity === 'info' && !E.flags.info) return false;
      if (issue.severity === 'hint' && !E.flags.hint) return false;
      return true;
    });
  }

  /**
   * 指摘が無いときの説明。
   * @param {Array<Object>} issues 全指摘
   * @param {number} hidden 隠している件数
   * @returns {string} 説明
   */
  function _emptyText(hidden) {
    var text = 'いま出している区分に、指摘はありません。';
    if (hidden) text += ' 隠している指摘が ' + hidden + ' 件あります。上のボタンで開けます。';
    return text;
  }

  /**
   * 同じ指摘ならパネルを作り直さない。
   * @param {Array<Object>} issues 指摘
   * @returns {string} 比較用の文字列
   */
  function _sign(issues) {
    var flags = (E.flags.warn ? 'w' : '') + (E.flags.info ? 'i' : '') +
      (E.flags.hint ? 'h' : '') + (E.flags.done ? 'd' : '');
    var parts = [flags];
    var i;
    for (i = 0; i < issues.length; i++) {
      parts.push(issues[i].fingerprint || '', issues[i].severity, issues[i].dismissed ? '1' : '0');
    }
    return parts.join('\n');
  }

  /**
   * 指摘一覧を描く。
   * @param {Object|null} cap 本文
   * @param {Array<Object>} issues 指摘
   * @returns {void}
   */
  E.renderPanel = function (cap, issues) {
    E.lastCap = cap;
    E.lastIssues = issues || [];
    var host = _host();
    var sign = _sign(issues);
    if (sign === E.panelSign && cap) return;
    E.panelSign = sign;
    var list = host.querySelector('#suikou-note-list');
    var filters = host.querySelector('#suikou-note-filters');
    var count = host.querySelector('#suikou-note-count');
    list.textContent = '';
    filters.textContent = '';
    if (!cap) {
      count.textContent = '';
      list.textContent = '執筆画面の本文を待っています。';
      return;
    }
    var warnN = 0;
    var infoN = 0;
    var hintN = 0;
    var doneN = 0;
    issues.forEach(function (issue) {
      if (issue.dismissed) {
        doneN++;
        return;
      }
      if (issue.severity === 'warn') warnN++;
      if (issue.severity === 'info') infoN++;
      if (issue.severity === 'hint') hintN++;
    });
    if (warnN) filters.appendChild(_flagButton('warn', '検討', warnN));
    if (infoN) filters.appendChild(_flagButton('info', '確認', infoN));
    if (hintN) filters.appendChild(_flagButton('hint', '参考', hintN));
    if (doneN) filters.appendChild(_flagButton('done', '対応済み', doneN));
    var visible = _visible(issues);
    var shown = visible.slice(0, 80);
    count.textContent = shown.length ? String(shown.length) : '';
    if (!shown.length) {
      list.textContent = _emptyText(issues.length - visible.length);
      return;
    }
    var frag = document.createDocumentFragment();
    E.groupIssues(shown).forEach(function (group) {
      frag.appendChild(E.groupCard(group, cap));
    });
    list.appendChild(frag);
  };

  E.ensurePanel = _host;
})(globalThis);
