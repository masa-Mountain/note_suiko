/* 推敲 (suikou) — エディタ本体：ハイライト、位置移動、置換、貼り付けの取り込み
 *
 * ハイライトは textarea の背後に同じ書体・行送りの div を重ね、
 * 指摘の範囲を mark で描いている。両者の余白と行高が一致していることが前提。
 */
(function (global) {
  'use strict';

  var S = global.Suikou;
  var UI = S.ui;

  var SEV_WEIGHT = { error: 3, warn: 2, info: 1, hint: 0 };

  /**
   * 重なった指摘の範囲を一つにまとめる。深刻度は高いほうを残す。
   * @param {Array<Object>} issues 表示対象の指摘
   * @returns {Array<{start: number, end: number, sev: string, id: string}>} まとめた範囲
   */
  function _mergeRanges(issues) {
    var ranges = issues
      .filter(function (i) { return i.end > i.start; })
      .slice(0, 500)
      .map(function (i) { return { start: i.start, end: i.end, sev: i.severity, id: i.id }; })
      .sort(function (a, b) { return a.start - b.start || b.end - a.end; });

    var merged = [];
    for (var i = 0; i < ranges.length; i++) {
      var last = merged[merged.length - 1];
      if (last && ranges[i].start < last.end) {
        if (SEV_WEIGHT[ranges[i].sev] > SEV_WEIGHT[last.sev]) last.sev = ranges[i].sev;
        if (ranges[i].id === UI.state.selectedId) last.id = ranges[i].id;
        last.end = Math.max(last.end, ranges[i].end);
      } else {
        merged.push(ranges[i]);
      }
    }
    return merged;
  }

  /**
   * 背景のスクロール位置を textarea に合わせる。
   * @returns {void}
   */
  function _syncScroll() {
    UI.el.backdrop.scrollTop = UI.el.editor.scrollTop;
    UI.el.backdrop.scrollLeft = UI.el.editor.scrollLeft;
  }

  /**
   * 指摘の位置に下線を引いた背景を描く。
   * @returns {void}
   */
  UI.renderHighlights = function () {
    var host = UI.el.highlights;
    UI.clear(host);
    if (!UI.state.config.display.highlight || !UI.state.result) {
      host.appendChild(document.createTextNode(UI.el.editor.value));
      return;
    }
    var text = UI.el.editor.value;
    var merged = _mergeRanges(UI.visibleIssues());
    var frag = document.createDocumentFragment();
    var pos = 0;
    merged.forEach(function (r) {
      if (r.start > pos) frag.appendChild(document.createTextNode(text.slice(pos, r.start)));
      frag.appendChild(UI.h('mark', {
        class: 'sev-' + r.sev + (r.id === UI.state.selectedId ? ' active' : ''),
        text: text.slice(r.start, r.end)
      }));
      pos = r.end;
    });
    frag.appendChild(document.createTextNode(text.slice(pos) + '\n'));
    host.appendChild(frag);
    _syncScroll();
  };

  /**
   * 入力直後は解析前なので、下線なしの素のテキストで背景を追従させる。
   * @returns {void}
   */
  UI.renderHighlightsPlain = function () {
    UI.clear(UI.el.highlights);
    UI.el.highlights.appendChild(document.createTextNode(UI.el.editor.value + '\n'));
    UI.el.backdrop.scrollTop = UI.el.editor.scrollTop;
  };

  /**
   * 指摘の位置を選択して見える位置までスクロールする。
   * @param {{id: string, start: number, end: number}} issue 移動先
   * @returns {void}
   */
  UI.jumpTo = function (issue) {
    if (UI.isNarrow && UI.isNarrow()) UI.setMobilePane('write');
    UI.state.selectedId = issue.id;
    if (issue.ruleId && UI.issueGroupKey) {
      UI.state.expandedGroups[UI.issueGroupKey(issue)] = true;
    }
    if (UI.state.view === 'preview') {
      UI.renderPreview();
    } else if (issue.end > issue.start) {
      UI.el.editor.focus();
      UI.el.editor.setSelectionRange(issue.start, issue.end);
      var ratio = issue.start / Math.max(1, UI.el.editor.value.length);
      var target = ratio * UI.el.editor.scrollHeight - UI.el.editor.clientHeight / 2.4;
      UI.el.editor.scrollTop = Math.max(0, target);
      UI.el.backdrop.scrollTop = UI.el.editor.scrollTop;
    }
    UI.renderIssues();
    UI.renderHighlights();
  };

  /**
   * タイトルと本文を空にする。確認してから消す。
   * 対応済みはこの原稿のものなので一緒に消す。無視リストは残す。
   * 本文は Ctrl+Z で戻せる。
   * @returns {void}
   */
  UI.clearDraft = function () {
    var hasText = !!(UI.el.title.value || UI.el.editor.value);
    var hasMarks = Object.keys(UI.state.resolved).length > 0;
    if (!hasText && !hasMarks) return;
    if (!confirm('タイトルと本文を消します。対応済みの指摘も消えます。本文は Ctrl+Z で戻せます。')) return;
    UI.el.title.value = '';
    if (UI.el.hashtags) UI.el.hashtags.value = '';
    UI.state.selectedId = null;
    UI.state.aiIssues = [];
    UI.state.aiState = null;
    UI.state.resolved = {};
    UI.state.revealed = {};
    UI.state.issueArchive = [];
    UI.state.showArchive = false;
    UI.saveMarks();
    UI.saveArchive();
    UI.setBody('');
    if (UI.state.activeTab === 'settings') UI.renderSettings();
  };

  /**
   * 選択範囲を replacement で置き換える。insertText を使い、Ctrl+Z の履歴に乗せる。
   * @param {number} start 開始位置
   * @param {number} end 終了位置
   * @param {string} replacement 置き換える文字列
   * @returns {boolean} ブラウザの履歴に乗ったか
   */
  function _nativeReplace(start, end, replacement) {
    var ed = UI.el.editor;
    ed.focus();
    ed.setSelectionRange(start, end);
    var ok = false;
    try {
      if (replacement === '' && end > start) ok = document.execCommand('delete');
      else ok = document.execCommand('insertText', false, replacement);
    } catch (e) {
      ok = false;
    }
    if (!ok) {
      var text = ed.value;
      ed.value = text.slice(0, start) + replacement + text.slice(end);
    }
    return ok;
  }

  /**
   * 本文を丸ごと差し替える。履歴に乗るので Ctrl+Z で戻せる。
   * @param {string} text 新しい本文
   * @returns {void}
   */
  UI.setBody = function (text) {
    UI.applyEdit(0, UI.el.editor.value.length, text);
  };

  /**
   * 指定範囲を置き換える（表記統一のみで使う）。
   * @param {number} start 開始位置
   * @param {number} end 終了位置
   * @param {string} replacement 置き換える文字列
   * @returns {void}
   */
  UI.replaceRange = function (start, end, replacement) {
    UI.applyEdit(start, end, replacement);
  };

  /**
   * 本文の一部を差し替え、キャレットを置く。
   * @param {number} start 開始位置
   * @param {number} end 終了位置
   * @param {string} replacement 置き換える文字列
   * @param {number} [caretStart] 選択の始点（省略時は置換後の末尾）
   * @param {number} [caretEnd] 選択の終点（省略時は始点と同じ）
   * @returns {void}
   */
  UI.applyEdit = function (start, end, replacement, caretStart, caretEnd) {
    _nativeReplace(start, end, replacement);
    var a = caretStart !== undefined ? caretStart : start + replacement.length;
    var b = caretEnd !== undefined ? caretEnd : a;
    UI.el.editor.setSelectionRange(a, b);
    if (UI.state.view === 'preview') UI.el.editor.blur();
    UI.runAnalyze();
    UI.saveDraft();
  };

  /**
   * 本文中の語をすべて置き換える（表記統一のみで使う）。
   * @param {string} from 置き換え元
   * @param {string} to 置き換え先
   * @returns {void}
   */
  UI.unifyAll = function (from, to) {
    UI.setBody(UI.el.editor.value.split(from).join(to));
  };

  /**
   * クリップボードまたはドロップから画像ファイルを集める。
   * @param {DataTransfer|null} data 転送データ
   * @returns {File[]} 画像ファイル
   */
  function _imageFiles(data) {
    var out = [];
    if (!data) return out;
    var files = data.files;
    var i;
    if (files && files.length) {
      for (i = 0; i < files.length; i++) {
        if (/^image\//.test(files[i].type)) out.push(files[i]);
      }
    }
    if (!out.length && data.items) {
      for (i = 0; i < data.items.length; i++) {
        if (data.items[i].kind === 'file' && /^image\//.test(data.items[i].type)) {
          var f = data.items[i].getAsFile();
          if (f) out.push(f);
        }
      }
    }
    return out;
  }

  /**
   * note のエディタからコピーした内容は HTML を持っている。
   * 画像ならファイルとして取り込み、構造がある HTML は記法へ変換する。
   * @param {ClipboardEvent} ev 貼り付けイベント
   * @returns {void}
   */
  function _onPaste(ev) {
    var data = ev.clipboardData;
    if (!data) return;
    var images = _imageFiles(data);
    if (images.length) {
      ev.preventDefault();
      UI.insertImageFiles(images);
      return;
    }
    var html = data.getData('text/html');
    if (!html || !S.noteio.looksStructured(html)) return;
    ev.preventDefault();
    var converted = S.noteio.fromHtml(html);
    if (!converted.trim()) {
      converted = data.getData('text/plain');
      if (!converted) return;
    }
    UI.applyEdit(UI.el.editor.selectionStart, UI.el.editor.selectionEnd, converted);
  }

  /**
   * エディタとメタ欄のイベントを結線する。
   * @returns {void}
   */
  UI.bindEditor = function () {
    var ed = UI.el.editor;
    ed.addEventListener('input', function () {
      UI.renderHighlightsPlain();
      UI.scheduleAnalyze();
    });
    ed.addEventListener('paste', _onPaste);
    ed.addEventListener('dragover', function (ev) {
      if (_imageFiles(ev.dataTransfer).length) ev.preventDefault();
    });
    ed.addEventListener('drop', function (ev) {
      var images = _imageFiles(ev.dataTransfer);
      if (!images.length) return;
      ev.preventDefault();
      UI.insertImageFiles(images);
    });
    ed.addEventListener('scroll', _syncScroll);
    UI.el.title.addEventListener('input', UI.scheduleAnalyze);
    if (UI.el.hashtags) UI.el.hashtags.addEventListener('input', UI.scheduleAnalyze);
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
