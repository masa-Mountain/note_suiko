/* 推敲 (suikou) — 選択語の言い換え候補と類語辞典へのリンク */
(function (global) {
  'use strict';

  var S = global.Suikou;
  var C = S.config;
  var UI = S.ui;

  /**
   * エディタで選ばれている語（なければ空）。
   * @returns {string} 語
   */
  function _selectedWord() {
    var ed = UI.el.editor;
    var a = ed.selectionStart;
    var b = ed.selectionEnd;
    if (b > a) return ed.value.slice(a, b).trim();
    return '';
  }

  /**
   * 候補を並べた行を作る。
   * @param {string[]} list 候補
   * @returns {HTMLElement} 行
   */
  function _suggRow(list) {
    return UI.h('div', { class: 'sugg' }, list.map(function (sg) {
      return UI.h('span', {
        title: 'クリックでコピー',
        onclick: function () { UI.copyText(sg); },
        text: sg
      });
    }));
  }

  /**
   * 内蔵辞書とユーザー辞書から候補を集める。
   * @param {string} word 調べる語
   * @returns {{word: string, builtIn: string[], custom: string[], weblio: string}} 候補
   */
  UI.lookupSynonyms = function (word) {
    word = String(word || '').trim();
    var dict = C.parseDictionary(UI.state.config.dictionary);
    var builtIn = (S.dict.synonyms && S.dict.synonyms[word]) ? S.dict.synonyms[word].slice() : [];
    var custom = dict.synonyms[word] ? dict.synonyms[word].slice() : [];
    return {
      word: word,
      builtIn: builtIn,
      custom: custom,
      weblio: 'https://thesaurus.weblio.jp/content/' + encodeURIComponent(word || '類語')
    };
  };

  /**
   * 類語ダイアログを開く。
   * @returns {void}
   */
  UI.showThesaurus = function () {
    var word = _selectedWord();
    if (!word) {
      word = window.prompt('言い換えを調べる語', '') || '';
      word = word.trim();
    }
    if (!word) return;
    var info = UI.lookupSynonyms(word);
    var body = [
      UI.h('p', { text: '「' + info.word + '」の言い換え候補です。候補はクリックでコピーできます。' })
    ];
    if (info.builtIn.length) {
      body.push(UI.h('p', { text: '内蔵辞書' }));
      body.push(_suggRow(info.builtIn));
    }
    if (info.custom.length) {
      body.push(UI.h('p', { text: 'ユーザー辞書' }));
      body.push(_suggRow(info.custom));
    }
    if (!info.builtIn.length && !info.custom.length) {
      body.push(UI.h('p', { text: '内蔵辞書に候補はありません。下のリンクから類語辞典を開いてください。' }));
    }
    body.push(UI.h('p', {}, [
      document.createTextNode('Weblio 類語辞典: '),
      UI.h('a', { href: info.weblio, target: '_blank', rel: 'noopener', text: info.word || '開く' })
    ]));
    UI.dialog('類語・言い換え', body);
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
