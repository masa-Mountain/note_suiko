/* 推敲 (suikou) — 本文への記法挿入
 *
 * note のツールバーに近い操作で、選択中の行（または今の行）に記法を付ける。
 * 本文は textarea のままなので、ハイライトと両立する。
 */
(function (global) {
  'use strict';

  var S = global.Suikou;
  var UI = S.ui;

  var ANY_PREFIX = /^(?:#{1,6}\s+|>\s?|[-*+・]\s+|[0-9０-９]+[.)．）]\s+)/;

  /**
   * 選択がまたがる行の範囲。末尾が改行の直後なら、その空行は含めない。
   * @param {string} text 本文
   * @param {number} from 選択の始点
   * @param {number} to 選択の終点
   * @returns {{start: number, end: number}} 行頭から行末まで
   */
  function _lineRange(text, from, to) {
    var a = Math.min(from, to);
    var b = Math.max(from, to);
    if (b > a && text.charAt(b - 1) === '\n') b -= 1;
    var start = text.lastIndexOf('\n', a - 1) + 1;
    var end = text.indexOf('\n', b);
    if (end < 0) end = text.length;
    return { start: start, end: end };
  }

  /**
   * 行頭の見出し・引用・リスト記号を外す。
   * @param {string} line 1行
   * @returns {string} 記号を外した行
   */
  function _strip(line) {
    return line.replace(ANY_PREFIX, '');
  }

  /**
   * 選んだ行（または今の行）の接頭辞を付け外しする。
   * @param {RegExp} match いま付いているとみなす接頭辞
   * @param {function(string, number): string} apply 外した本文と行番号から新しい行を作る
   * @returns {void}
   */
  function _toggleLines(match, apply) {
    var ed = UI.el.editor;
    var text = ed.value;
    var range = _lineRange(text, ed.selectionStart, ed.selectionEnd);
    var lines = text.slice(range.start, range.end).split('\n');
    var nonempty = lines.filter(function (l) { return l.trim(); });
    var allOn = nonempty.length > 0 && nonempty.every(function (l) { return match.test(l); });
    var n = 0;
    var next = lines.map(function (l) {
      if (!l.trim()) return nonempty.length ? l : apply('', n++);
      var body = _strip(l);
      return allOn ? body : apply(body, n++);
    }).join('\n');
    UI.applyEdit(range.start, range.end, next, range.start, range.start + next.length);
  }

  /**
   * 今の行が空ならそこに置き、何か書いてあれば次の段落として入れる。
   * @param {string} line 挿入する1行
   * @returns {void}
   */
  UI.insertBlock = function (line) {
    var ed = UI.el.editor;
    var text = ed.value;
    var pos = ed.selectionStart;
    var start = text.lastIndexOf('\n', pos - 1) + 1;
    var end = text.indexOf('\n', pos);
    if (end < 0) end = text.length;
    if (!text.slice(start, end).trim()) {
      UI.applyEdit(start, end, line, start + line.length);
      return;
    }
    var insert = (end > 0 && text.charAt(end) !== '\n' ? '\n' : '') + '\n' + line + '\n';
    UI.applyEdit(end, end, insert, end + insert.length);
  };

  /**
   * 選択範囲を太字にする。選択がなければ挿入位置に空の太字を置く。
   * @returns {void}
   */
  function _bold() {
    var ed = UI.el.editor;
    var a = ed.selectionStart;
    var b = ed.selectionEnd;
    var text = ed.value;
    if (b > a) {
      var inner = text.slice(a, b);
      if (inner.length >= 4 && inner.slice(0, 2) === '**' && inner.slice(-2) === '**') {
        var un = inner.slice(2, -2);
        UI.applyEdit(a, b, un, a, a + un.length);
      } else {
        UI.applyEdit(a, b, '**' + inner + '**', a + 2, a + 2 + inner.length);
      }
      return;
    }
    UI.applyEdit(a, a, '****', a + 2, a + 2);
  }

  /**
   * @returns {void}
   */
  function _embed() {
    var url = window.prompt('埋め込む URL（単独行に置くと note ではカードになります）', 'https://');
    if (url === null || !url.trim()) return;
    UI.insertBlock(url.trim());
  }

  /**
   * @returns {void}
   */
  function _ruby() {
    var ed = UI.el.editor;
    var a = ed.selectionStart;
    var b = ed.selectionEnd;
    var base = b > a ? ed.value.slice(a, b) : (window.prompt('ルビを振る語', '') || '');
    if (!base) return;
    var ruby = window.prompt('ふりがな', '');
    if (ruby === null || !ruby) return;
    var marked = '｜' + base + '《' + ruby + '》';
    if (b > a) UI.applyEdit(a, b, marked);
    else UI.applyEdit(a, a, marked);
  }

  /**
   * @returns {void}
   */
  function _paywall() {
    UI.insertBlock(UI.state.config.note.paidMarker || '===有料ライン===');
  }

  /**
   * 挿入バーを組み立てて結線する。
   * @returns {void}
   */
  UI.bindToolbar = function () {
    var host = UI.el.toolbar;
    if (!host) return;
    UI.clear(host);

    /**
     * @param {string} label ボタンの文字
     * @param {string} title 説明
     * @param {function(): void} onClick 押したときの処理
     * @returns {HTMLElement} ボタン
     */
    function btn(label, title, onClick) {
      return UI.h('button', { type: 'button', title: title, onclick: onClick, text: label });
    }

    [
      btn('見出し', '行頭を # にする（大見出し）', function () {
        _toggleLines(/^#\s+/, function (body) { return '# ' + body; });
      }),
      btn('小見出し', '行頭を ## にする', function () {
        _toggleLines(/^##\s+/, function (body) { return '## ' + body; });
      }),
      UI.h('i', { class: 'sep' }),
      btn('引用', '行頭を > にする。もう一度押すと外す', function () {
        _toggleLines(/^>\s?/, function (body) { return '> ' + body; });
      }),
      btn('箇条書き', '行頭を - にする', function () {
        _toggleLines(/^[-*+・]\s+/, function (body) { return '- ' + body; });
      }),
      btn('番号', '行頭を 1. 2. … にする', function () {
        _toggleLines(/^[0-9０-９]+[.)．）]\s+/, function (body, i) { return (i + 1) + '. ' + body; });
      }),
      UI.h('i', { class: 'sep' }),
      btn('太字', '選択範囲を ** で囲む', _bold),
      UI.h('i', { class: 'sep' }),
      btn('区切り', '区切り線を入れる', function () { UI.insertBlock('---'); }),
      btn('目次', '目次ブロックの位置を示す', function () { UI.insertBlock('[目次]'); }),
      btn('有料ライン', '無料部分の終わりの目印', _paywall),
      UI.h('i', { class: 'sep' }),
      btn('画像', 'エクスプローラーから画像を選ぶ。貼り付け・ドロップもできます', UI.pickImages),
      btn('埋め込み', 'URL だけの行を入れる', _embed),
      btn('ルビ', '選択中の語にふりがなを付ける', _ruby),
      UI.h('i', { class: 'sep' }),
      btn('類語', '選択中の語の言い換え候補・Weblio 類語辞典', UI.showThesaurus)
    ].forEach(function (n) { host.appendChild(n); });
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
