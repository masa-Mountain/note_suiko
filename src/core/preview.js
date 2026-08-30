/* 推敲 (suikou) — note風プレビュー
 *
 * 推敲記法を、note の記事ページに近い見え方で描く。
 * 画像は URL が生きていれば表示し、そうでなければ枠だけを置く。
 * 埋め込みは実際に読み込まず、カードの位置だけを示す（通信しないため）。
 */
(function (global) {
  'use strict';

  var S = global.Suikou;
  var N = S.noteio;
  var P = (S.preview = {});

  function el(tag, cls) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }

  function inline(text) {
    var span = el('span');
    span.innerHTML = N.escapeHtml(text)
      .replace(/｜([^《]{1,20})《([^》]{1,30})》/g, '<ruby>$1<rt>$2</rt></ruby>')
      .replace(/\*\*([^*]{1,200})\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]{1,120})\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
    return span;
  }

  /**
   * 指摘の範囲と重なるブロックに印を付ける。
   * @param {HTMLElement} node 描いた要素
   * @param {{start: number, end: number}} block 本文上の範囲
   * @param {{start: number, end: number}|null} selected 選択中の指摘
   * @returns {HTMLElement} 同じ要素
   */
  function _mark(node, block, selected) {
    node.setAttribute('data-start', String(block.start));
    node.setAttribute('data-end', String(block.end));
    if (selected && selected.end > selected.start &&
      block.end > selected.start && block.start < selected.end) {
      node.classList.add('np-hit');
    }
    return node;
  }

  /** 記法テキストを描画して container に流し込む。 */
  P.render = function (container, text, title, options) {
    options = options || {};
    var selected = options.selected || null;
    container.textContent = '';
    var frame = el('div', options.mobile ? 'np-mobile' : '');
    container.appendChild(frame);

    if (title) {
      var h1 = el('div', 'np-title');
      h1.textContent = title;
      frame.appendChild(h1);
    }

    var blocks = N.parseBlocks(text);
    var headings = blocks.filter(function (b) { return b.type === 'heading'; });

    blocks.forEach(function (b) {
      switch (b.type) {
        case 'heading': {
          var h = el(b.level <= 1 ? 'h2' : 'h3');
          h.appendChild(inline(b.text));
          frame.appendChild(_mark(h, b, selected));
          break;
        }
        case 'p': {
          var p = el('p');
          p.appendChild(inline(b.text));
          frame.appendChild(_mark(p, b, selected));
          break;
        }
        case 'quote': {
          var bq = el('blockquote');
          b.lines.forEach(function (l) {
            var q = el('p');
            q.appendChild(inline(l));
            bq.appendChild(q);
          });
          frame.appendChild(_mark(bq, b, selected));
          break;
        }
        case 'ul':
        case 'ol': {
          var list = el(b.type === 'ul' ? 'ul' : 'ol');
          b.items.forEach(function (l) {
            var li = el('li');
            li.appendChild(inline(l));
            list.appendChild(li);
          });
          frame.appendChild(_mark(list, b, selected));
          break;
        }
        case 'hr':
          frame.appendChild(_mark(el('hr'), b, selected));
          break;
        case 'code': {
          var pre = el('pre');
          pre.textContent = b.text;
          frame.appendChild(_mark(pre, b, selected));
          break;
        }
        case 'image': {
          if (/^https?:\/\//.test(b.src) || /^data:/.test(b.src)) {
            var fig = el('figure');
            var img = el('img');
            img.src = b.src;
            img.alt = b.caption || '';
            img.loading = 'lazy';
            fig.appendChild(img);
            if (b.caption) {
              var cap = el('figcaption');
              cap.textContent = b.caption;
              fig.appendChild(cap);
            }
            frame.appendChild(_mark(fig, b, selected));
          } else {
            var ph = el('div', 'np-placeholder');
            ph.textContent = '画像' + (b.caption ? '：' + b.caption : '（note で差し替えてください）');
            frame.appendChild(_mark(ph, b, selected));
          }
          break;
        }
        case 'embed': {
          var em = el('div', 'np-embed');
          em.textContent = b.url;
          frame.appendChild(_mark(em, b, selected));
          break;
        }
        case 'toc': {
          var toc = el('div', 'np-toc');
          var lbl = el('b');
          lbl.textContent = '目次';
          toc.appendChild(lbl);
          if (headings.length) {
            var ol = el('ol');
            headings.forEach(function (h2) {
              var li = el('li', h2.level > 1 ? 'lv2' : '');
              li.textContent = h2.text;
              ol.appendChild(li);
            });
            toc.appendChild(ol);
          } else {
            var none = el('div');
            none.textContent = '見出しがまだありません。';
            none.style.fontSize = '12px';
            none.style.color = 'var(--fg-3)';
            toc.appendChild(none);
          }
          frame.appendChild(_mark(toc, b, selected));
          break;
        }
        case 'paywall': {
          var pw = el('div', 'np-paywall');
          pw.textContent = 'ここから先は有料エリア';
          frame.appendChild(_mark(pw, b, selected));
          break;
        }
        default:
          break;
      }
    });

    if (!blocks.filter(function (b) { return b.type !== 'blank'; }).length) {
      var empty = el('div', 'np-placeholder');
      empty.textContent = '本文を書くと、note に載せたときの見え方をここに出します。';
      frame.appendChild(empty);
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
