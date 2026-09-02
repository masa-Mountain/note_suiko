/* 推敲 (suikou) — note との相互変換
 *
 * note の仕様（2026年時点）
 *  - インポート: WXR形式（WordPress の XML）または MT形式（MovableType の txt）。
 *               UTF-8 / 20MB まで / 1000記事まで。取り込まれた記事は「下書き」になる。
 *               取り込まれるのは タイトル・本文・画像・日時。
 *               埋め込み（iframe）や一部の装飾は、文字列としてそのまま入る。
 *  - エクスポート: WXR形式の XML と assets フォルダを含む ZIP。全記事が対象。
 *               埋め込み URL・ルビ・数式はテキストとして書き出される。
 *
 * したがって実用的な経路は次の3つ。
 *  (1) note のエディタから範囲選択してコピー → 推敲に貼る（HTML を記法へ変換）
 *  (2) note のエクスポート ZIP を解いた XML を読み込む
 *  (3) 推敲 → note: 「note用HTMLをコピー」して note のエディタに貼る（日常用）
 *                   または WXR / MT で書き出して note のインポートに掛ける（一括用）
 */
(function (global) {
  'use strict';

  var S = global.Suikou;
  var N = (S.noteio = {});

  /* =========================================================
   * 推敲記法
   * ---------------------------------------------------------
   *   # 見出し（大）        note の「見出し」
   *   ## 見出し（小）       note の「小見出し」
   *   > 引用
   *   - 箇条書き / 1. 番号付き
   *   **太字**
   *   ---                   区切り線
   *   [目次]                目次ブロック
   *   ![キャプション](URL)  画像
   *   URL だけの行          埋め込み
   *   ```〜```              コード
   *   ｜漢字《ふりがな》     ルビ
   *   ===有料ライン===      有料エリアの境界
   * ========================================================= */

  N.NOTATION = [
    { mark: '# ', label: '見出し（大）', note: 'note の「見出し」に対応します。' },
    { mark: '## ', label: '見出し（小）', note: 'note の「小見出し」に対応します。' },
    { mark: '> ', label: '引用', note: '' },
    { mark: '- ', label: '箇条書き', note: '' },
    { mark: '1. ', label: '番号付きリスト', note: '' },
    { mark: '**〜**', label: '太字', note: '' },
    { mark: '---', label: '区切り線', note: '' },
    { mark: '[目次]', label: '目次', note: 'note の目次ブロックが入る位置を示します。' },
    { mark: '![説明](URL)', label: '画像', note: '' },
    { mark: 'URL だけの行', label: '埋め込み', note: 'note では埋め込みカードになります。' },
    { mark: '```', label: 'コード', note: '' },
    { mark: '｜漢字《ふりがな》', label: 'ルビ', note: '' },
    { mark: '===有料ライン===', label: '有料ラインの目印', note: '' }
  ];

  /* =========================================================
   * ブロック解析（記法 → 構造）
   * ========================================================= */
  var RE_URL_ONLY = /^https?:\/\/\S+$/;

  N.parseBlocks = function (text) {
    var lines = String(text || '').split(/\r?\n/);
    var blocks = [];
    var i = 0;
    var offset = 0;
    var offsets = [];
    for (var n = 0; n < lines.length; n++) {
      offsets.push(offset);
      offset += lines[n].length + 1;
    }

    function push(b) { blocks.push(b); }

    while (i < lines.length) {
      var line = lines[i];
      var raw = line.replace(/[ \u3000]+$/, '');
      var start = offsets[i];

      if (/^```/.test(raw)) {
        var lang = raw.slice(3).trim();
        var buf = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
        i++;
        push({ type: 'code', lang: lang, text: buf.join('\n'), start: start });
        continue;
      }
      if (raw === '') { i++; push({ type: 'blank', start: start }); continue; }
      if (/^={3,}\s*有料ライン\s*={3,}$/.test(raw) || raw === '===有料ライン===') {
        push({ type: 'paywall', start: start }); i++; continue;
      }
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(raw)) { push({ type: 'hr', start: start }); i++; continue; }
      if (/^\[目次\]$/.test(raw)) { push({ type: 'toc', start: start }); i++; continue; }

      var mh = /^(#{1,6})\s+(.*)$/.exec(raw);
      if (mh) {
        push({ type: 'heading', level: mh[1].length, text: mh[2], start: start });
        i++; continue;
      }
      var mi = /^!\[([^\]]*)\]\(([^)]*)\)$/.exec(raw);
      if (mi) {
        push({ type: 'image', caption: mi[1], src: mi[2], start: start });
        i++; continue;
      }
      if (RE_URL_ONLY.test(raw)) {
        push({ type: 'embed', url: raw, start: start }); i++; continue;
      }
      if (/^>\s?/.test(raw)) {
        var q = [];
        var qStart = start;
        while (i < lines.length && /^>\s?/.test(lines[i])) {
          q.push(lines[i].replace(/^>\s?/, ''));
          i++;
        }
        push({ type: 'quote', lines: q, start: qStart });
        continue;
      }
      if (/^[-*+・]\s+/.test(raw)) {
        var ul = [];
        var uStart = start;
        while (i < lines.length && /^[-*+・]\s+/.test(lines[i])) {
          ul.push(lines[i].replace(/^[-*+・]\s+/, ''));
          i++;
        }
        push({ type: 'ul', items: ul, start: uStart });
        continue;
      }
      if (/^[0-9０-９]+[.)．）]\s+/.test(raw)) {
        var ol = [];
        var oStart = start;
        while (i < lines.length && /^[0-9０-９]+[.)．）]\s+/.test(lines[i])) {
          ol.push(lines[i].replace(/^[0-9０-９]+[.)．）]\s+/, ''));
          i++;
        }
        push({ type: 'ol', items: ol, start: oStart });
        continue;
      }
      push({ type: 'p', text: raw, start: start });
      i++;
    }
    var lastEnd = offsets.length ? offsets[offsets.length - 1] + (lines[lines.length - 1] || '').length : 0;
    for (var j = 0; j < blocks.length; j++) {
      blocks[j].end = j + 1 < blocks.length ? blocks[j + 1].start : lastEnd;
    }
    return blocks;
  };

  /** 装飾記法を落とした素の本文を返す（校正ルールが記号に反応しないようにする用途）。 */
  N.toPlainText = function (text) {
    return N.parseBlocks(text).map(function (b) {
      switch (b.type) {
        case 'heading': return b.text;
        case 'quote': return b.lines.join('\n');
        case 'ul': case 'ol': return b.items.join('\n');
        case 'p': return b.text;
        case 'image': return b.caption;
        default: return '';
      }
    }).join('\n');
  };

  /* =========================================================
   * インライン変換
   * ========================================================= */
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  N.escapeHtml = escapeHtml;

  /** note の目次ブロックかどうか（コピーでは構造だけ来ることが多い）。 */
  function _isTocNode(node) {
    if (!node || node.nodeType !== 1) return false;
    var hint = [
      node.getAttribute('class') || '',
      node.getAttribute('data-name') || '',
      node.getAttribute('data-type') || '',
      node.getAttribute('data-node-type') || ''
    ].join(' ');
    if (/table[-_ ]?of[-_ ]?contents|\btoc\b|目次/i.test(hint)) return true;
    var text = (node.textContent || '').trim();
    return text === '目次' || text === '[目次]';
  }

  function inlineToHtml(s) {
    var out = escapeHtml(s);
    // ルビ（青空文庫式）｜漢字《かんじ》
    out = out.replace(/｜([^《]{1,20})《([^》]{1,30})》/g, function (m, base, ruby) {
      return '<ruby>' + base + '<rt>' + ruby + '</rt></ruby>';
    });
    out = out.replace(/\*\*([^*]{1,200})\*\*/g, '<strong>$1</strong>');
    out = out.replace(/\[([^\]]{1,120})\]\((https?:\/\/[^)\s]+)\)/g,
      '<a href="$2">$1</a>');
    return out;
  }

  /* =========================================================
   * 記法 → note 貼り付け用 HTML
   * ========================================================= */
  N.toNoteHtml = function (text, options) {
    options = options || {};
    var blocks = N.parseBlocks(text);
    var out = [];
    if (options.title) out.push('<h1>' + escapeHtml(options.title) + '</h1>');
    blocks.forEach(function (b) {
      switch (b.type) {
        case 'heading':
          out.push('<h' + (b.level <= 1 ? 2 : 3) + '>' + inlineToHtml(b.text) + '</h' + (b.level <= 1 ? 2 : 3) + '>');
          break;
        case 'p':
          if (b.text.trim()) out.push('<p>' + inlineToHtml(b.text) + '</p>');
          break;
        case 'quote':
          out.push('<blockquote>' + b.lines.map(function (l) {
            return '<p>' + inlineToHtml(l) + '</p>';
          }).join('') + '</blockquote>');
          break;
        case 'ul':
          out.push('<ul>' + b.items.map(function (l) { return '<li>' + inlineToHtml(l) + '</li>'; }).join('') + '</ul>');
          break;
        case 'ol':
          out.push('<ol>' + b.items.map(function (l) { return '<li>' + inlineToHtml(l) + '</li>'; }).join('') + '</ol>');
          break;
        case 'hr':
          out.push('<hr>');
          break;
        case 'toc':
          out.push('<p>[目次]</p>');
          break;
        case 'paywall':
          out.push('<hr><p>――― ここから有料 ―――</p>');
          break;
        case 'image':
          out.push('<figure><img src="' + escapeHtml(b.src) + '" alt="' + escapeHtml(b.caption) + '">' +
            (b.caption ? '<figcaption>' + escapeHtml(b.caption) + '</figcaption>' : '') + '</figure>');
          break;
        case 'embed':
          out.push('<p>' + escapeHtml(b.url) + '</p>');
          break;
        case 'code':
          out.push('<pre><code>' + escapeHtml(b.text) + '</code></pre>');
          break;
        default:
          break;
      }
    });
    return out.join('');
  };

  /* =========================================================
   * note の HTML → 記法（エディタからコピーして貼ったとき）
   * ========================================================= */
  var BLOCK_CHILD_RE = /^(h[1-6]|blockquote|ul|ol|li|figure|img|pre|hr|table|iframe|embed)$/;
  var QUOTE_HINT_RE = /quote|blockquote|citation/i;

  /**
   * note の引用は <blockquote> のほか、class / data-name に quote が付いた箱で来る。
   * @param {Element} node 調べる要素
   * @returns {boolean} 引用として扱うべきか
   */
  function _isQuoteLike(node) {
    if (!node || !node.getAttribute) return false;
    if (node.tagName && node.tagName.toLowerCase() === 'blockquote') return true;
    var hint = [
      node.getAttribute('class') || '',
      node.getAttribute('data-name') || '',
      node.getAttribute('data-type') || '',
      node.getAttribute('data-node-type') || '',
      node.getAttribute('role') || ''
    ].join(' ');
    return QUOTE_HINT_RE.test(hint);
  }

  /**
   * 中に見出し・引用・リストなどのブロックがあるか。あるなら一段落に潰さない。
   * @param {Element} node 調べる要素
   * @returns {boolean} ブロックの子があるか
   */
  function _hasBlockChild(node) {
    var kids = node.children;
    for (var i = 0; i < kids.length; i++) {
      var tag = kids[i].tagName.toLowerCase();
      if (BLOCK_CHILD_RE.test(tag) || _isQuoteLike(kids[i])) return true;
      if (tag === 'div' && _hasBlockChild(kids[i])) return true;
    }
    return false;
  }

  /**
   * 引用の箱を `> ` 行に落とす。中の段落は行を分ける（出典欄のため）。
   * @param {Element} node 引用の要素
   * @param {string[]} out 行の配列
   * @returns {void}
   */
  function _pushQuote(node, out) {
    var paras = [];
    var kids = node.children;
    var used = false;
    for (var i = 0; i < kids.length; i++) {
      var tag = kids[i].tagName.toLowerCase();
      if (tag === 'p' || tag === 'div' || tag === 'cite' || tag === 'figcaption') {
        var line = inlineFromNode(kids[i]).trim();
        if (line) paras.push(line);
        used = true;
      }
    }
    if (!used || !paras.length) {
      inlineFromNode(node).split('\n').forEach(function (l) {
        if (l.trim()) paras.push(l.trim());
      });
    }
    paras.forEach(function (l) { out.push('> ' + l); });
  }

  function inlineFromNode(node) {
    var out = '';
    for (var i = 0; i < node.childNodes.length; i++) {
      var c = node.childNodes[i];
      if (c.nodeType === 3) {
        out += c.nodeValue.replace(/\s*\n\s*/g, '');
        continue;
      }
      if (c.nodeType !== 1) continue;
      var tag = c.tagName.toLowerCase();
      if (tag === 'br') { out += '\n'; continue; }
      if (tag === 'strong' || tag === 'b') { out += '**' + inlineFromNode(c) + '**'; continue; }
      if (tag === 'ruby') {
        var rt = c.querySelector('rt');
        var rtText = rt ? rt.textContent : '';
        var base = '';
        for (var k = 0; k < c.childNodes.length; k++) {
          var rc = c.childNodes[k];
          if (rc.nodeType === 3) base += rc.nodeValue;
          else if (rc.nodeType === 1 && ['rb', 'span'].indexOf(rc.tagName.toLowerCase()) >= 0) base += rc.textContent;
        }
        out += rtText ? '｜' + base.trim() + '《' + rtText + '》' : base;
        continue;
      }
      if (tag === 'a') {
        var href = c.getAttribute('href') || '';
        var label = inlineFromNode(c);
        out += (href && label && href !== label) ? '[' + label + '](' + href + ')' : (href || label);
        continue;
      }
      out += inlineFromNode(c);
    }
    return out;
  }

  function blockFromNode(node, out) {
    if (_isTocNode(node)) {
      out.push('[目次]');
      return true;
    }
    var tag = node.tagName ? node.tagName.toLowerCase() : '';
    switch (tag) {
      case 'h1':
      case 'h2':
        out.push('# ' + inlineFromNode(node).trim());
        return true;
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
        out.push('## ' + inlineFromNode(node).trim());
        return true;
      case 'blockquote':
        _pushQuote(node, out);
        return true;
      case 'ul':
      case 'ol':
        var items = node.querySelectorAll(':scope > li');
        if (!items.length) items = node.getElementsByTagName('li');
        for (var i = 0; i < items.length; i++) {
          var body = inlineFromNode(items[i]).trim();
          out.push(tag === 'ul' ? '- ' + body : (i + 1) + '. ' + body);
        }
        return true;
      case 'hr':
        out.push('---');
        return true;
      case 'pre':
        out.push('```');
        out.push(node.textContent.replace(/\n+$/, ''));
        out.push('```');
        return true;
      case 'figure':
        if (_isQuoteLike(node) && !node.querySelector('img')) {
          _pushQuote(node, out);
          return true;
        }
        var img = node.querySelector('img');
        var cap = node.querySelector('figcaption');
        if (img) {
          out.push('![' + (cap ? cap.textContent.trim() : '') + '](' + (img.getAttribute('src') || '') + ')');
        } else {
          /* 埋め込みは iframe のとき src、カード表示のとき中の a の href が実体。 */
          var frame = node.querySelector('iframe, embed');
          var link = node.querySelector('a[href]');
          var src = frame ? (frame.getAttribute('src') || '')
            : link ? (link.getAttribute('href') || '') : node.textContent.trim();
          if (src) out.push(src);
        }
        return true;
      case 'img':
        out.push('![](' + (node.getAttribute('src') || '') + ')');
        return true;
      case 'iframe':
      case 'embed':
        out.push(node.getAttribute('src') || '');
        return true;
      case 'p':
      case 'div':
        if (_isQuoteLike(node)) {
          _pushQuote(node, out);
          return true;
        }
        if (tag === 'div' && _hasBlockChild(node)) return false;
        var t = inlineFromNode(node);
        t.split('\n').forEach(function (l) {
          var trimmed = l.replace(/^[ \u3000]+|[ \u3000]+$/g, '');
          if (trimmed) out.push(trimmed);
        });
        return true;
      case 'table':
        // note に表はないので、行ごとの箇条書きに落とす
        var rows = node.getElementsByTagName('tr');
        for (var r = 0; r < rows.length; r++) {
          var cells = rows[r].children;
          var parts = [];
          for (var c2 = 0; c2 < cells.length; c2++) parts.push(cells[c2].textContent.trim());
          out.push('- ' + parts.join(' / '));
        }
        return true;
      default:
        return false;
    }
  }

  /* note の記事本文が入る器。前にあるものを優先して探す。
   * data-name="body" は note の本文ブロックそのもので、共有用リンクのプレビューでも
   * 公開記事でも同じ。article / main はページを保存した HTML のための保険。 */
  var BODY_SELECTORS = [
    '[data-name="body"]',
    '.note-common-styles__textnote-body',
    'article',
    'main'
  ];

  /**
   * HTML 文字列を DOM にして、走査の起点となる要素を返す。
   * @param {string} html HTML 文字列（断片でもページ全体でもよい）
   * @returns {HTMLElement|null} 走査の起点
   */
  function parseFragment(html) {
    var doc = new DOMParser().parseFromString(
      '<div id="suikou-root">' + html + '</div>', 'text/html');
    var root = doc.getElementById('suikou-root');
    if (!root) return null;
    root.querySelectorAll('script, style, noscript, template').forEach(function (n) { n.remove(); });
    return root;
  }

  /**
   * 走査の起点から、記事本文にあたる要素を選ぶ。
   * ページ全体を渡されたとき、ヘッダや関連記事を巻き込まないためのもの。
   * @param {HTMLElement} root 走査の起点
   * @returns {HTMLElement} 本文の要素（見つからなければ起点そのまま）
   */
  N.pickBody = function (root) {
    for (var i = 0; i < BODY_SELECTORS.length; i++) {
      var found = root.querySelector(BODY_SELECTORS[i]);
      if (found && found.textContent.trim()) return found;
    }
    return root;
  };

  /**
   * 要素の中身を推敲記法へ変換する。
   * @param {HTMLElement} root 変換する要素
   * @returns {string} 推敲記法
   */
  function renderFrom(root) {
    var out = [];
    function walk(node) {
      for (var i = 0; i < node.childNodes.length; i++) {
        var c = node.childNodes[i];
        if (c.nodeType !== 1) continue;
        if (!blockFromNode(c, out)) walk(c);
      }
    }
    walk(root);
    var lines = out.map(function (l) { return l.replace(/[ \u3000]+$/, ''); });
    while (lines.length && !lines[0].trim()) lines.shift();
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    var compact = [];
    for (var i = 0; i < lines.length; i++) {
      if (!lines[i].trim() && compact.length && !compact[compact.length - 1].trim()) continue;
      compact.push(lines[i]);
    }
    return compact.join('\n');
  }

  /** HTML 文字列を推敲記法へ変換する。ページ全体を渡した場合は本文だけを取り出す。 */
  N.fromHtml = function (html) {
    var parsed = parseFragment(html);
    return parsed ? renderFrom(N.pickBody(parsed)) : '';
  };

  /** 貼り付けられた HTML が note 由来（あるいは構造を持つ）かどうかを粗く判定する。
   * 段落だけの記事も対象にする。text/plain で受けると段落の境界が改行1つになり、
   * 推敲では段落が分かれない（空行が段落の境界）ためである。 */
  N.looksStructured = function (html) {
    if (/<(h[1-6]|blockquote|ul|ol|li|figure|img|pre|hr|table|ruby)\b/i.test(html)) return true;
    if (/(?:class|data-name|data-type|data-node-type)=["'][^"']*(?:quote|blockquote)/i.test(html)) return true;
    return (html.match(/<p\b/gi) || []).length >= 2;
  };

  /**
   * note の記事ページ（保存した HTML）から、タイトル・タグ・本文を取り出す。
   * @param {string} html ページの HTML
   * @returns {{title: string, tags: string[], text: string, paid: boolean}} 取り込んだ記事
   */
  N.parseNotePage = function (html) {
    var root = parseFragment(html);
    if (!root) return { title: '', tags: [], text: '', paid: false };

    var body = N.pickBody(root);

    var h1 = root.querySelector('h1');
    var title = h1 ? h1.textContent.trim() : '';
    if (!title) {
      var og = root.querySelector('meta[property="og:title"]');
      if (og) title = (og.getAttribute('content') || '').trim();
    }

    /* ハッシュタグはページ側で描かれるので、保存した DOM にだけ入っていることがある。 */
    var tags = [];
    root.querySelectorAll('a[href*="/hashtag/"]').forEach(function (a) {
      var t = a.textContent.replace(/^#/, '').trim();
      if (t && t.length < 40 && tags.indexOf(t) < 0) tags.push(t);
    });

    /* 有料記事は、共有用リンクでも公開ページでも無料部分しか出てこない。
     * 「ここから先は」は本文中にも書ける言い回しなので、本文の外側だけを見る。 */
    var paid = !!root.querySelector('[class*="paywall"]');
    if (!paid && body !== root) {
      var outside = root.textContent.replace(body.textContent, '');
      paid = /ここから先は|この続きをみるには/.test(outside);
    }

    return { title: title, tags: tags, text: renderFrom(body), paid: paid };
  };

  /* =========================================================
   * WXR（note のインポート用）
   * ========================================================= */
  function two(n) { return (n < 10 ? '0' : '') + n; }

  function rfc822(d) {
    var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var tz = -d.getTimezoneOffset();
    var sign = tz >= 0 ? '+' : '-';
    tz = Math.abs(tz);
    return days[d.getDay()] + ', ' + two(d.getDate()) + ' ' + months[d.getMonth()] + ' ' + d.getFullYear() +
      ' ' + two(d.getHours()) + ':' + two(d.getMinutes()) + ':' + two(d.getSeconds()) +
      ' ' + sign + two(Math.floor(tz / 60)) + two(tz % 60);
  }

  function sqlDate(d) {
    return d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate()) +
      ' ' + two(d.getHours()) + ':' + two(d.getMinutes()) + ':' + two(d.getSeconds());
  }

  function cdata(s) {
    return '<![CDATA[' + String(s == null ? '' : s).replace(/\]\]>/g, ']]&gt;') + ']]>';
  }

  /**
   * WXR形式の XML を作る。note のインポートに掛けると下書きとして入る。
   * articles = [{ title, html, tags: [], date: Date, author }]
   */
  N.toWxr = function (articles, options) {
    options = options || {};
    var author = options.author || 'suikou';
    var now = new Date();
    var out = [];
    out.push('<?xml version="1.0" encoding="UTF-8"?>');
    out.push('<rss version="2.0"');
    out.push('  xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/"');
    out.push('  xmlns:content="http://purl.org/rss/1.0/modules/content/"');
    out.push('  xmlns:wfw="http://wellformedweb.org/CommentAPI/"');
    out.push('  xmlns:dc="http://purl.org/dc/elements/1.1/"');
    out.push('  xmlns:wp="http://wordpress.org/export/1.2/">');
    out.push('<channel>');
    out.push('  <title>' + cdata(options.siteTitle || '推敲') + '</title>');
    out.push('  <link>https://note.com/</link>');
    out.push('  <description>' + cdata('推敲 (suikou) から書き出した原稿') + '</description>');
    out.push('  <pubDate>' + rfc822(now) + '</pubDate>');
    out.push('  <language>ja</language>');
    out.push('  <wp:wxr_version>1.2</wp:wxr_version>');
    out.push('  <wp:base_site_url>https://note.com/</wp:base_site_url>');
    out.push('  <wp:base_blog_url>https://note.com/</wp:base_blog_url>');
    out.push('  <wp:author>');
    out.push('    <wp:author_id>1</wp:author_id>');
    out.push('    <wp:author_login>' + cdata(author) + '</wp:author_login>');
    out.push('    <wp:author_display_name>' + cdata(author) + '</wp:author_display_name>');
    out.push('  </wp:author>');

    articles.forEach(function (a, index) {
      var d = a.date instanceof Date ? a.date : new Date();
      out.push('  <item>');
      out.push('    <title>' + cdata(a.title || '無題') + '</title>');
      out.push('    <link>https://note.com/</link>');
      out.push('    <pubDate>' + rfc822(d) + '</pubDate>');
      out.push('    <dc:creator>' + cdata(author) + '</dc:creator>');
      out.push('    <guid isPermaLink="false">suikou-' + (index + 1) + '</guid>');
      out.push('    <description></description>');
      out.push('    <content:encoded>' + cdata(a.html || '') + '</content:encoded>');
      out.push('    <excerpt:encoded>' + cdata('') + '</excerpt:encoded>');
      out.push('    <wp:post_id>' + (index + 1) + '</wp:post_id>');
      out.push('    <wp:post_date>' + cdata(sqlDate(d)) + '</wp:post_date>');
      out.push('    <wp:post_date_gmt>' + cdata(sqlDate(d)) + '</wp:post_date_gmt>');
      out.push('    <wp:comment_status>' + cdata('closed') + '</wp:comment_status>');
      out.push('    <wp:ping_status>' + cdata('closed') + '</wp:ping_status>');
      out.push('    <wp:post_name>' + cdata('suikou-' + (index + 1)) + '</wp:post_name>');
      out.push('    <wp:status>' + cdata('draft') + '</wp:status>');
      out.push('    <wp:post_parent>0</wp:post_parent>');
      out.push('    <wp:menu_order>0</wp:menu_order>');
      out.push('    <wp:post_type>' + cdata('post') + '</wp:post_type>');
      out.push('    <wp:post_password></wp:post_password>');
      out.push('    <wp:is_sticky>0</wp:is_sticky>');
      (a.tags || []).forEach(function (tag) {
        out.push('    <category domain="post_tag" nicename="' +
          escapeHtml(encodeURIComponent(tag)) + '">' + cdata(tag) + '</category>');
      });
      out.push('  </item>');
    });

    out.push('</channel>');
    out.push('</rss>');
    return out.join('\n');
  };

  /** MT形式（MovableType）のテキストを作る。note のインポートはこちらにも対応する。 */
  N.toMt = function (articles, options) {
    options = options || {};
    var author = options.author || 'suikou';
    var out = [];
    articles.forEach(function (a) {
      var d = a.date instanceof Date ? a.date : new Date();
      out.push('AUTHOR: ' + author);
      out.push('TITLE: ' + (a.title || '無題'));
      out.push('STATUS: Draft');
      out.push('ALLOW COMMENTS: 0');
      out.push('CONVERT BREAKS: 0');
      out.push('DATE: ' + two(d.getMonth() + 1) + '/' + two(d.getDate()) + '/' + d.getFullYear() +
        ' ' + two(d.getHours()) + ':' + two(d.getMinutes()) + ':' + two(d.getSeconds()));
      (a.tags || []).forEach(function (tag) { out.push('CATEGORY: ' + tag); });
      out.push('-----');
      out.push('BODY:');
      out.push(a.html || '');
      out.push('-----');
      out.push('--------');
    });
    return out.join('\n');
  };

  /** note のエクスポート（WXR）を読み込んで記事の一覧にする。 */
  N.parseWxr = function (xml) {
    var doc = new DOMParser().parseFromString(xml, 'text/xml');
    if (doc.getElementsByTagName('parsererror').length) {
      throw new Error('XML として読み取れませんでした。');
    }
    var items = doc.getElementsByTagName('item');
    var out = [];
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      function pick(names) {
        for (var k = 0; k < names.length; k++) {
          var nodes = item.getElementsByTagName(names[k]);
          if (nodes.length && nodes[0].textContent) return nodes[0].textContent;
        }
        return '';
      }
      var type = pick(['wp:post_type', 'post_type']);
      if (type && type !== 'post') continue;
      var html = pick(['content:encoded', 'encoded']);
      var tags = [];
      var cats = item.getElementsByTagName('category');
      for (var c = 0; c < cats.length; c++) {
        if (cats[c].getAttribute('domain') === 'post_tag') tags.push(cats[c].textContent);
      }
      out.push({
        title: pick(['title']).trim(),
        date: pick(['wp:post_date', 'post_date', 'pubDate']).trim(),
        status: pick(['wp:status', 'status']).trim(),
        tags: tags,
        html: html,
        text: N.fromHtml(html)
      });
    }
    return out;
  };

  /** MT形式のテキストを読み込む。 */
  N.parseMt = function (text) {
    var entries = String(text).split(/^-{8,}\s*$/m);
    var out = [];
    entries.forEach(function (chunk) {
      if (!chunk.trim()) return;
      var parts = chunk.split(/^-{5}\s*$/m);
      var head = parts[0] || '';
      var body = '';
      for (var i = 1; i < parts.length; i++) {
        var m = /^\s*BODY:\s*([\s\S]*)$/.exec(parts[i]);
        if (m) body = m[1];
      }
      var title = (/^TITLE:\s*(.*)$/m.exec(head) || [])[1] || '無題';
      var date = (/^DATE:\s*(.*)$/m.exec(head) || [])[1] || '';
      var tags = [];
      var re = /^CATEGORY:\s*(.*)$/gm;
      var mt;
      while ((mt = re.exec(head)) !== null) tags.push(mt[1].trim());
      out.push({
        title: title.trim(),
        date: date.trim(),
        status: ((/^STATUS:\s*(.*)$/m.exec(head) || [])[1] || '').trim(),
        tags: tags,
        html: body,
        text: /<[a-z][\s\S]*>/i.test(body) ? N.fromHtml(body) : body.trim()
      });
    });
    return out;
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
