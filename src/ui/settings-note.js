/* 推敲 (suikou) — 設定タブの note の節と、片付けた指摘の節 */
(function (global) {
  'use strict';

  var S = global.Suikou;
  var UI = S.ui;

  /**
   * note の設定を描く。
   * @param {HTMLElement} host 追加先
   * @param {Object} cfg 設定
   * @returns {void}
   */
  UI.renderNoteSettings = function (host, cfg) {
    var row = UI.settingRow;
    host.appendChild(UI.h('h3', { class: 'section', text: 'note の設定' }));
    host.appendChild(row([
      UI.h('input', {
        type: 'checkbox', checked: cfg.note.paidArticle ? 'checked' : null,
        onchange: function (ev) { cfg.note.paidArticle = ev.target.checked; UI.commitSettings(true); }
      }),
      UI.h('span', { text: '有料記事として書く' })
    ]));
    if (cfg.note.paidArticle) {
      host.appendChild(row([
        UI.h('span', { text: '有料ラインの目印' }),
        UI.h('input', {
          type: 'text', value: cfg.note.paidMarker,
          onchange: function (ev) { cfg.note.paidMarker = ev.target.value; UI.commitSettings(false); }
        }),
        UI.h('span', { class: 'hint', text: 'この文字列を本文に置いた位置を、無料部分の終わりとして扱います。' })
      ]));
    }
    host.appendChild(row([
      UI.h('span', { text: '読書速度（文字/分）' }),
      UI.h('input', {
        type: 'number', value: cfg.note.cps, min: 200, max: 1200, step: 50,
        onchange: function (ev) {
          cfg.note.cps = parseInt(ev.target.value, 10) || 500;
          UI.commitSettings(false);
        }
      })
    ]));
    host.appendChild(row([
      UI.h('span', { text: 'note への渡し方' }),
      UI.h('select', {
        onchange: function (ev) { cfg.note.transfer = ev.target.value; UI.commitSettings(false); }
      }, [
        UI.h('option', {
          value: 'rich', selected: cfg.note.transfer === 'rich' ? 'selected' : null,
          text: 'HTML / WXR（記法が生きる）'
        }),
        UI.h('option', {
          value: 'plain', selected: cfg.note.transfer === 'plain' ? 'selected' : null,
          text: '文字だけ貼る'
        })
      ]),
      UI.h('span', {
        class: 'hint',
        text: '「文字だけ貼る」にすると、# や ** が本文に残る前提で指摘します。既定の HTML/WXR では記法が note のブロックに変換されるので、その指摘は出しません。'
      })
    ]));
    host.appendChild(row([
      UI.h('span', { text: '書き出しに使う著者名' }),
      UI.h('input', {
        type: 'text', value: cfg.note.author, placeholder: 'suikou',
        onchange: function (ev) { cfg.note.author = ev.target.value; UI.saveConfig(); }
      }),
      UI.h('span', {
        class: 'hint',
        text: 'WXR / MT 形式のファイルに入る名前です。note のインポートでは自分の記事として扱われます。'
      })
    ]));
  };

  /**
   * 片付けた指摘の件数と、まとめて戻すボタンを描く。
   * @param {HTMLElement} host 追加先
   * @returns {void}
   */
  UI.renderMarkSettings = function (host) {
    var nResolved = Object.keys(UI.state.resolved).length;
    var nSuppressed = Object.keys(UI.state.suppressed).length;
    var nArchive = UI.state.issueArchive.length;
    host.appendChild(UI.h('h3', { class: 'section', text: '片付けた指摘' }));
    host.appendChild(UI.h('div', {
      class: 'kv',
      text: '対応済み ' + nResolved + ' 件 / 今後も無視 ' + nSuppressed + ' 件 / 履歴 ' + nArchive + ' 件。' +
        '「対応済み」は同じ語と前後の文脈が一致する指摘を隠します。' +
        '履歴は対応済み・直して消えた指摘をあとから見るための記録です。'
    }));
    host.appendChild(UI.settingRow([
      UI.h('button', {
        onclick: function () { UI.clearMarks('resolved'); }, text: '対応済みをすべて戻す'
      }),
      UI.h('button', {
        onclick: function () { UI.clearMarks('suppressed'); }, text: '無視リストを空にする'
      }),
      UI.h('button', {
        onclick: function () {
          if (!nArchive || confirm('指摘の履歴をすべて消します。')) UI.clearArchive();
        },
        text: '履歴を空にする'
      })
    ]));
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
