/* 執筆画面の本文を、位置つきの文字列にする */
(function (global) {
  'use strict';

  var E = (global.SuikouExt = global.SuikouExt || {});

  /**
   * 本文のエディタ。
   * @returns {Element|null} ProseMirror
   */
  function _editor() {
    return document.querySelector('.ProseMirror[role="textbox"]') || document.querySelector('.ProseMirror');
  }

  /**
   * タイトル欄。
   * @returns {Element|null} 入力欄
   */
  function _titleNode() {
    return document.querySelector(
      'textarea[placeholder*="タイトル"], [placeholder*="タイトル"], [data-placeholder*="タイトル"], [aria-label*="タイトル"]'
    );
  }

  /**
   * 要素内の文字を集める。
   * @param {Element} el 対象
   * @param {{text: string, segs: Array<Object>}} bucket 蓄積先
   * @returns {void}
   */
  function _collect(el, bucket) {
    var nodes = el.childNodes;
    var i;
    for (i = 0; i < nodes.length; i++) {
      var c = nodes[i];
      if (c.nodeType === 3) {
        var v = c.nodeValue.replace(/\u00a0/g, ' ');
        if (!v) continue;
        bucket.segs.push({ start: bucket.text.length, end: bucket.text.length + v.length, node: c });
        bucket.text += v;
      } else if (c.nodeType === 1 && c.tagName !== 'UL' && c.tagName !== 'OL') {
        if (c.tagName === 'BR') bucket.text += '\n';
        else _collect(c, bucket);
      }
    }
  }

  /**
   * 要素が見出しなら段数、そうでなければ 0。
   * @param {Element} el ブロック
   * @returns {number} 1 が見出し、2 が小見出し
   */
  function _headingLevel(el) {
    var tag = el.tagName || '';
    if (tag === 'H1' || tag === 'H2') return 1;
    if (/^H[3-6]$/.test(tag)) return 2;
    var hint = [
      el.className || '',
      el.getAttribute('data-name') || '',
      el.getAttribute('data-type') || '',
      el.getAttribute('data-node-type') || ''
    ].join(' ');
    if (/heading|見出し/i.test(hint)) return /small|sub|h3/i.test(hint) ? 2 : 1;
    var head = el.querySelector('h1, h2, h3, h4, h5, h6');
    if (!head) return 0;
    if (el.textContent.trim() !== head.textContent.trim()) return 0;
    return head.tagName === 'H1' || head.tagName === 'H2' ? 1 : 2;
  }

  /**
   * 引用ブロックか。
   * @param {Element} el ブロック
   * @returns {boolean} 引用なら true
   */
  function _isQuote(el) {
    if (el.tagName === 'BLOCKQUOTE') return true;
    var hint = [
      el.className || '',
      el.getAttribute('data-name') || '',
      el.getAttribute('data-type') || '',
      el.getAttribute('data-node-type') || ''
    ].join(' ');
    return /quote|blockquote|引用/i.test(hint);
  }

  /**
   * ブロックを本文へ足す。見出しと引用には記法を付ける。
   * @param {{text: string, segs: Array<Object>}} out 全体
   * @param {Element} el ブロック
   * @returns {void}
   */
  function _appendFrom(out, el) {
    var i;
    if (el.tagName === 'UL' || el.tagName === 'OL') {
      for (i = 0; i < el.children.length; i++) _appendFrom(out, el.children[i]);
      return;
    }
    if (_isQuote(el)) {
      var quoted = el.children;
      if (!quoted.length) _appendMarked(out, el, '> ');
      else for (i = 0; i < quoted.length; i++) _appendMarked(out, quoted[i], '> ');
      return;
    }
    var level = _headingLevel(el);
    if (level) {
      _appendMarked(out, el, level === 1 ? '# ' : '## ');
      return;
    }
    _appendMarked(out, el, '');
  }

  /**
   * 1ブロック分の文字を、必要なら行頭の記法つきで足す。
   * @param {{text: string, segs: Array<Object>}} out 全体
   * @param {Element} el ブロック
   * @param {string} prefix 行頭に足す記法
   * @returns {void}
   */
  function _appendMarked(out, el, prefix) {
    var piece = { text: '', segs: [] };
    _collect(el, piece);
    if (!piece.text.trim()) return;
    if (out.text) out.text += '\n';
    if (prefix) out.text += prefix;
    var base = out.text.length;
    var i;
    for (i = 0; i < piece.segs.length; i++) {
      out.segs.push({
        start: piece.segs[i].start + base,
        end: piece.segs[i].end + base,
        node: piece.segs[i].node
      });
    }
    out.text += piece.text;
  }

  /**
   * いまの本文とタイトル。
   * @returns {{text: string, title: string, segs: Array<Object>, root: Element}|null} 取れなければ null
   */
  E.capture = function () {
    var root = _editor();
    if (!root) return null;
    var out = { text: '', title: '', segs: [], root: root };
    var title = _titleNode();
    if (title) out.title = title.value != null && title.value !== '' ? title.value : (title.textContent || '');
    var kids = root.children;
    var i;
    if (!kids.length) _appendFrom(out, root);
    else for (i = 0; i < kids.length; i++) _appendFrom(out, kids[i]);
    return out;
  };

  /**
   * 文字位置に対応するテキストノード。
   * @param {Array<Object>} segs 区間
   * @param {number} index 本文中の位置
   * @returns {{node: Text, offset: number}|null} 位置
   */
  function _at(segs, index) {
    var i;
    var prev = null;
    for (i = 0; i < segs.length; i++) {
      if (index < segs[i].start) return prev;
      if (index < segs[i].end) {
        return { node: segs[i].node, offset: index - segs[i].start };
      }
      prev = { node: segs[i].node, offset: segs[i].end - segs[i].start };
    }
    return prev;
  }

  /**
   * 指摘の位置を選択して見せる。
   * @param {Object} cap capture の戻り
   * @param {Object} issue 指摘
   * @returns {void}
   */
  E.reveal = function (cap, issue) {
    if (!cap) return;
    if (issue.ruleId === 'note.title') {
      var title = _titleNode();
      if (title) {
        title.scrollIntoView({ block: 'center' });
        if (title.focus) title.focus();
      }
      return;
    }
    var a = _at(cap.segs, issue.start);
    if (!a || !a.node || !a.node.parentElement) {
      cap.root.scrollIntoView({ block: 'center' });
      return;
    }
    var endAt = _at(cap.segs, Math.max(issue.start, issue.end));
    var range = document.createRange();
    range.setStart(a.node, a.offset);
    try {
      if (endAt && endAt.node) range.setEnd(endAt.node, endAt.offset);
      else range.setEnd(a.node, a.offset);
    } catch (e) {
      range.setEnd(a.node, a.offset);
    }
    var sel = window.getSelection();
    if (cap.root && cap.root.focus) cap.root.focus({ preventScroll: true });
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
    a.node.parentElement.scrollIntoView({ block: 'center' });
  };

  /**
   * いまのタイトル欄の文言。
   * @returns {string} タイトル
   */
  E.readNoteTitle = function () {
    var title = _titleNode();
    if (!title) return '';
    if (title.tagName === 'INPUT' || title.tagName === 'TEXTAREA') return title.value || '';
    return title.textContent || '';
  };

  /**
   * タイトル欄だけを書き換える。本文は触らない。
   * @param {string} text 入れる文言
   * @returns {void}
   */
  E.writeNoteTitle = function (text) {
    var node = _titleNode();
    if (!node) return;
    var value = text || '';
    if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') {
      var proto = node.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      var desc = Object.getOwnPropertyDescriptor(proto, 'value');
      if (desc && desc.set) desc.set.call(node, value);
      else node.value = value;
      node.dispatchEvent(new Event('input', { bubbles: true }));
      if (node.focus) node.focus();
      return;
    }
    node.focus();
    var sel = window.getSelection();
    if (sel) {
      var range = document.createRange();
      range.selectNodeContents(node);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    if (!document.execCommand('insertText', false, value)) node.textContent = value;
  };
})(globalThis);
