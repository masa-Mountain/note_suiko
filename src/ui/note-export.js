/* 推敲 (suikou) — note への書き出し
 *
 * 日常は「note用HTMLをコピー」で足りる。まとめて渡すときだけ WXR / MT を使う。
 */
(function (global) {
  'use strict';

  var S = global.Suikou;
  var UI = S.ui;

  /**
   * いまの原稿を note へ渡す形にまとめる。
   * @returns {{title: string, html: string, tags: string[], date: Date}} 記事1件
   */
  UI.noteArticle = function () {
    return {
      title: UI.el.title.value || '無題',
      html: S.noteio.toNoteHtml(UI.el.editor.value),
      tags: UI.parseHashtags(UI.el.hashtags.value),
      date: new Date()
    };
  };

  /**
   * ClipboardItem が使えない環境向けに、選択範囲を作って execCommand でコピーする。
   * @param {string} html コピーする HTML
   * @returns {void}
   */
  function _copyHtmlLegacy(html) {
    var holder = document.createElement('div');
    holder.setAttribute('contenteditable', 'true');
    holder.style.position = 'fixed';
    holder.style.left = '-10000px';
    holder.innerHTML = html;
    document.body.appendChild(holder);
    var range = document.createRange();
    range.selectNodeContents(holder);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    try { document.execCommand('copy'); } catch (e) { /* 対応していない環境では諦める */ }
    sel.removeAllRanges();
    document.body.removeChild(holder);
  }

  /**
   * note のエディタに貼ったときに装飾が生きるよう、HTML 形式でクリップボードへ置く。
   * @returns {Promise<void>} コピーの完了
   */
  UI.copyAsNoteHtml = function () {
    var html = S.noteio.toNoteHtml(UI.el.editor.value);
    if (global.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
      var plain = S.noteio.toPlainText(UI.el.editor.value);
      return navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plain], { type: 'text/plain' })
      })]);
    }
    _copyHtmlLegacy(html);
    return Promise.resolve();
  };

  /**
   * @param {string} suffix ファイル名の中に入れる区別（例 note, note-mt）
   * @param {string} ext 拡張子（ドットなし）
   * @returns {string} 保存するファイル名
   */
  function _fileName(suffix, ext) {
    return UI.safeName() + (suffix ? '-' + suffix : '') + '-' + UI.stamp() + '.' + ext;
  }

  /**
   * 本文を Markdown として保存する。タイトルは見出しとして先頭に置く。
   * @returns {void}
   */
  UI.saveMarkdown = function () {
    var head = UI.el.title.value ? '# ' + UI.el.title.value + '\n\n' : '';
    UI.download(_fileName('', 'md'), head + UI.el.editor.value, 'text/markdown');
  };

  /**
   * 書き出しメニューの割り当て。
   * @returns {Object<string, function(): void>} data-act と処理の対応
   */
  UI.exportActions = function () {
    return {
      'copy-html': function () {
        UI.copyAsNoteHtml().then(function () {
          UI.flash(UI.$('btn-export'), 'コピーしました');
        }).catch(function () {
          UI.dialog('コピーできませんでした', [
            'この環境ではクリップボードへの HTML 書き込みが許可されていません。' +
            '「WXR形式で保存」で書き出して note のインポートを使うか、「文字だけコピー」で貼ってから note 側で装飾してください。'
          ]);
        });
      },
      'copy-plain': function () {
        UI.copyText(S.noteio.toPlainText(UI.el.editor.value));
        UI.flash(UI.$('btn-export'), 'コピーしました');
      },
      'save-wxr': function () {
        var xml = S.noteio.toWxr([UI.noteArticle()], {
          author: UI.state.config.note.author || 'suikou',
          siteTitle: '推敲'
        });
        UI.download(_fileName('note', 'xml'), xml, 'text/xml');
        UI.dialog('WXR形式で保存しました', [
          'note の 設定 > インポート からこのファイルを読ませてください。',
          '記事は下書きとして入ります。結果はインポート開始から3日以内にメールで届きます。',
          '画像は img タグの src が http(s) の URL の場合だけ取り込まれます。手元の画像は note 側で貼り直してください。'
        ]);
      },
      'save-mt': function () {
        var mt = S.noteio.toMt([UI.noteArticle()], {
          author: UI.state.config.note.author || 'suikou'
        });
        UI.download(_fileName('note-mt', 'txt'), mt, 'text/plain');
        UI.dialog('MT形式で保存しました', [
          'WXR で通らなかったときの代替です。note の 設定 > インポート に読ませてください。'
        ]);
      },
      'save-md': UI.saveMarkdown,
      'save-report': function () {
        if (!UI.state.result) return;
        UI.download(UI.safeName() + '-推敲レポート-' + UI.stamp() + '.md',
          S.buildReport(UI.state.result, UI.currentInput()), 'text/markdown');
      }
    };
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
