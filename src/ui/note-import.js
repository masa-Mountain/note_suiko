/* 推敲 (suikou) — note からの取り込み
 *
 * 経路は4つ。
 *  (1) note のエディタで選択してコピー → 推敲に貼る（HTML を記法へ変換）
 *  (2) 下書きの共有用リンクのページを保存した HTML を開く（一記事だけ渡すとき）
 *  (3) note のエクスポート ZIP を解いた XML（WXR）または MT 形式の txt を開く
 *  (4) 手元のテキスト・Markdown を開く
 *
 * note のエクスポートは全記事の一括書き出ししかなく、記事を選んで出せない。
 * 一記事だけを書式ごと持ってくるなら (1) か (2) を使う。
 */
(function (global) {
  'use strict';

  var S = global.Suikou;
  var UI = S.ui;

  /**
   * 取り込んだ本文を、入れ替えるか挿入するかを選ばせて反映する。
   * @param {string} text 記法に変換済みの本文
   * @returns {void}
   */
  function _insertOrReplace(text) {
    if (!UI.el.editor.value.trim()) {
      UI.setBody(text);
      return;
    }
    UI.dialog('取り込み方を選ぶ', [
      UI.h('p', { text: 'すでに本文があります。どちらにしますか。' }),
      UI.h('pre', { class: 'payload', text: text.slice(0, 1200) + (text.length > 1200 ? '\n…' : '') })
    ], [
      UI.h('button', {
        class: 'primary',
        onclick: function () {
          UI.closeDialog();
          UI.setBody(text);
        },
        text: '入れ替える'
      }),
      UI.h('button', {
        onclick: function () {
          UI.closeDialog();
          var at = UI.el.editor.selectionStart;
          var v = UI.el.editor.value;
          UI.setBody(v.slice(0, at) + text + v.slice(at));
        },
        text: 'カーソル位置に挿入'
      })
    ]);
  }

  /**
   * note との受け渡しの手順を表示する。
   * @param {string} [extra] 失敗の理由など、先頭に足したい注意書き
   * @returns {void}
   */
  UI.pasteHelp = function (extra) {
    UI.dialog('note との受け渡し', [
      UI.h('div', { class: 'notation-help' }, [
        UI.h('h4', { text: '下書き1本を note から推敲へ' }),
        UI.h('p', { text: 'note のエクスポートは全記事の一括書き出しだけで、記事を選んで出すことはできません。1本だけ持ってくるなら次の2つを使ってください。どちらも見出し・小見出し・引用・箇条書き・太字・ルビ・画像・埋め込みを推敲記法のまま取り込みます。' }),
        UI.h('p', { text: '① エディタからコピーする　note の編集画面で本文の中をクリックし、Ctrl+A で本文を全選択して Ctrl+C。推敲のエディタに Ctrl+V で貼るだけです。貼り付けの瞬間に記法へ変換します。' }),
        UI.h('p', { text: '② 共有用リンクのページを保存する　note の記事一覧（または編集画面）で記事の […] から「共有用リンクをコピー」を選ぶと、下書きのままプレビューできる URL が手に入ります。そのページをブラウザで開き、Ctrl+S で保存してから「取り込み ▾ > 保存した note のページを開く」で読み込みます。選択範囲の取りこぼしがないので、長い記事はこちらが確実です。' }),
        UI.h('p', { text: '有料記事の場合、共有用リンクにも公開ページにも無料部分しか出てきません。有料エリアはエディタからのコピーで足してください。' }),
        UI.h('h4', { text: '推敲から note へ' }),
        UI.h('p', { text: '「書き出し ▾ > note用HTMLをコピー」を使います。note のエディタに貼ると装飾がそのまま反映されます。日常はこれで足ります。' }),
        UI.h('p', { text: '複数の記事をまとめて渡すときは「WXR形式で保存」で書き出し、note の 設定 > インポート に読ませてください。下書きとして入ります（note の仕様上、公開はされません）。' }),
        UI.h('p', { text: 'note のエクスポート（設定 > エクスポート）で届く ZIP を解くと XML と assets フォルダが出てきます。その XML は「取り込み ▾ > note のエクスポートを開く」で読めます。全記事が対象なので、過去記事をまとめて見直すときに向いています。' }),
        extra ? UI.h('p', { style: 'color:var(--warn)', text: extra }) : null
      ])
    ]);
  };

  /**
   * テキスト・Markdown を開く。先頭が「# 」ならタイトルとして扱う。
   * @returns {void}
   */
  UI.openTextFile = function () {
    UI.pickFile('.txt,.md,.markdown,text/plain', function (content) {
      var lines = content.split(/\r?\n/);
      if (lines[0] && /^#\s+/.test(lines[0]) && !UI.el.title.value) {
        UI.el.title.value = lines[0].replace(/^#\s+/, '');
        content = lines.slice(1).join('\n').replace(/^\n+/, '');
      }
      UI.setBody(content);
    });
  };

  /**
   * 保存した note のページ（HTML）を取り込む。共有用リンクのプレビューや公開記事のページを、
   * ブラウザの「名前を付けて保存」で残したものを想定している。
   * @returns {void}
   */
  UI.openNotePage = function () {
    UI.pickFile('.html,.htm,.mhtml,text/html', function (content, name) {
      var article = S.noteio.parseNotePage(content);
      if (!article.text.trim()) {
        UI.dialog('本文が見つかりませんでした', [
          name + ' から記事本文を取り出せませんでした。',
          'note の記事ページ（共有用リンクのプレビュー、または公開記事）を、ブラウザの「名前を付けて保存」で保存したファイルを選んでください。'
        ]);
        return;
      }
      if (article.title && !UI.el.title.value) UI.el.title.value = article.title;
      if (article.tags.length && !UI.el.hashtags.value.trim()) {
        UI.el.hashtags.value = article.tags.map(function (t) { return '#' + t; }).join(' ');
      }
      _insertOrReplace(article.text);
      if (article.paid) {
        UI.dialog('有料記事のようです', [
          '有料エリアは共有用リンクにも公開ページにも出てこないため、取り込めたのは無料部分だけです。',
          '有料部分は note のエディタから選択してコピーし、推敲に貼り付けて続けてください。'
        ]);
      }
    });
  };

  /**
   * クリップボードの HTML を記法に変換して取り込む。
   * @returns {void}
   */
  UI.importFromClipboard = function () {
    if (!navigator.clipboard || !navigator.clipboard.read) {
      UI.pasteHelp('この環境ではクリップボードの読み取りが使えません。エディタに直接貼り付けてください（Ctrl+V）。貼り付け時に自動で記法へ変換します。');
      return;
    }
    navigator.clipboard.read().then(function (items) {
      for (var i = 0; i < items.length; i++) {
        if (items[i].types.indexOf('text/html') >= 0) {
          return items[i].getType('text/html')
            .then(function (b) { return b.text(); })
            .then(function (html) {
              var text = S.noteio.fromHtml(html);
              if (!text.trim()) UI.pasteHelp('取り込める内容が見つかりませんでした。');
              else _insertOrReplace(text);
            });
        }
      }
      return navigator.clipboard.readText().then(function (t) {
        if (t) _insertOrReplace(t);
      });
    }).catch(function () {
      UI.pasteHelp('クリップボードの読み取りが許可されませんでした。エディタに直接 Ctrl+V で貼り付けてください。そのときも記法へ変換します。');
    });
  };

  /**
   * 記事の一覧から1件選ばせる。
   * @param {Array<Object>} articles 解析した記事
   * @returns {void}
   */
  function _pickArticle(articles) {
    var list = UI.h('div', { class: 'pick-list' }, articles.map(function (a) {
      return UI.h('div', {
        class: 'pick-item',
        onclick: function () {
          UI.closeDialog();
          UI.el.title.value = a.title || '';
          UI.el.hashtags.value = (a.tags || []).map(function (t) { return '#' + t; }).join(' ');
          UI.setBody(a.text);
        }
      }, [
        UI.h('div', { class: 't', text: a.title || '（無題）' }),
        UI.h('div', {
          class: 'm',
          text: [a.date, a.status === 'draft' ? '下書き' : a.status, a.text.length + '字',
            (a.tags || []).length ? 'タグ ' + a.tags.length : null].filter(Boolean).join(' / ')
        })
      ]);
    }));
    UI.dialog(articles.length + ' 件の記事が見つかりました', [
      UI.h('p', { text: '推敲に読み込む記事を選んでください。' }),
      list
    ]);
  }

  /**
   * note のエクスポート（WXR / MT）を開く。
   * @returns {void}
   */
  UI.openNoteExport = function () {
    UI.pickFile('.xml,.txt,text/xml,application/xml,text/plain', function (content, name) {
      var articles;
      try {
        articles = /^\s*</.test(content) ? S.noteio.parseWxr(content) : S.noteio.parseMt(content);
      } catch (e) {
        UI.dialog('読み込めませんでした', [String(e.message || e)]);
        return;
      }
      if (!articles.length) {
        UI.dialog('読み込めませんでした', ['記事が見つかりませんでした（' + name + '）。' +
          ' note のエクスポート ZIP を解いて出てくる XML を選んでください。']);
        return;
      }
      _pickArticle(articles);
    });
  };

  /**
   * 取り込みメニューの割り当て。
   * @returns {Object<string, function(): void>} data-act と処理の対応
   */
  UI.importActions = function () {
    return {
      'file-text': UI.openTextFile,
      'file-page': UI.openNotePage,
      'file-note': UI.openNoteExport,
      'paste-note': UI.importFromClipboard,
      'paste-help': function () { UI.pasteHelp(); }
    };
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
