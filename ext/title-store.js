/* 執筆画面のタイトル案。記事（URL）ごとに覚え、本文は触らない */
(function (global) {
  'use strict';

  var E = (global.SuikouExt = global.SuikouExt || {});
  var KEY = 'suikouNoteTitles';

  E.TITLE_AXES = [
    { key: 'accuracy', label: '内容が正確に伝わる', short: '正確' },
    { key: 'interest', label: '読者が興味を持てる', short: '興味' },
    { key: 'concrete', label: '具体的なイメージが浮かぶ', short: '具体' },
    { key: 'original', label: '自分らしい独自性がある', short: '独自' },
    { key: 'fit', label: '未読の人にも、何の話か伝わる', short: '入口' }
  ];
  E.noteTitles = [];
  E.noteTitleId = null;
  E.noteTitleSort = 'added';

  /**
   * 5項目がすべて 3 の点数。
   * @returns {Object<string, number>} 点数
   */
  function _scores() {
    var out = {};
    E.TITLE_AXES.forEach(function (axis) { out[axis.key] = 3; });
    return out;
  }

  /**
   * 理由欄の空。
   * @returns {Object<string, string>} 理由
   */
  function _notes() {
    var out = {};
    E.TITLE_AXES.forEach(function (axis) { out[axis.key] = ''; });
    return out;
  }

  /**
   * 保存データを案の形に揃える。
   * @param {Object} raw 読んだ値
   * @returns {Object|null} 案
   */
  function _normalize(raw) {
    if (!raw || typeof raw.id !== 'string') return null;
    var scores = _scores();
    var notes = _notes();
    E.TITLE_AXES.forEach(function (axis) {
      var value = raw.scores && Number(raw.scores[axis.key]);
      if (value >= 1 && value <= 5) scores[axis.key] = Math.round(value);
      if (raw.notes && typeof raw.notes[axis.key] === 'string') notes[axis.key] = raw.notes[axis.key];
    });
    return { id: raw.id, text: String(raw.text || ''), entrance: String(raw.entrance || ''), scores: scores, notes: notes };
  }

  /**
   * 自己評価の合計。
   * @param {Object} item 案
   * @returns {number} 合計
   */
  E.titleTotal = function (item) {
    var total = 0;
    E.TITLE_AXES.forEach(function (axis) { total += item.scores[axis.key]; });
    return total;
  };

  /**
   * 自分の合計点につける呼び名。文言の採点ではない。
   * @param {number} total 合計
   * @returns {string} 呼び名
   */
  E.titleBand = function (total) {
    if (total >= 21) return '有力候補';
    if (total >= 15) return '改善の余地あり';
    return '再考してみる';
  };

  /**
   * この記事の案を読む。
   * @param {function(): void} done 読めたあと
   * @returns {void}
   */
  E.loadNoteTitles = function (done) {
    var page = location.pathname;
    chrome.storage.local.get({ suikouNoteTitles: {} }, function (data) {
      var all = data.suikouNoteTitles || {};
      var raw = all[page];
      E.noteTitles = (Array.isArray(raw) ? raw : []).map(_normalize).filter(function (item) { return !!item; });
      E.noteTitlePage = page;
      if (done) done();
    });
  };

  /**
   * この記事の案を保存する。
   * @returns {void}
   */
  E.saveNoteTitles = function () {
    var page = E.noteTitlePage || location.pathname;
    chrome.storage.local.get({ suikouNoteTitles: {} }, function (data) {
      var all = data.suikouNoteTitles || {};
      all[page] = E.noteTitles;
      var next = {};
      next[KEY] = all;
      chrome.storage.local.set(next);
    });
  };

  /**
   * 案を足す。
   * @param {string} text 初期の文言
   * @returns {Object} 足した案
   */
  E.addNoteTitle = function (text) {
    var item = {
      id: 't' + Date.now().toString(36) + Math.floor(Math.random() * 36).toString(36),
      text: text || '',
      entrance: '',
      scores: _scores(),
      notes: _notes()
    };
    E.noteTitles.push(item);
    E.noteTitleId = item.id;
    E.saveNoteTitles();
    return item;
  };

  /**
   * 案を消す。
   * @param {string} id 案の id
   * @returns {void}
   */
  E.removeNoteTitle = function (id) {
    E.noteTitles = E.noteTitles.filter(function (item) { return item.id !== id; });
    if (E.noteTitleId === id) {
      E.noteTitleId = E.noteTitles.length ? E.noteTitles[E.noteTitles.length - 1].id : null;
    }
    E.saveNoteTitles();
  };

  /**
   * 表示順。点数順でも採用はしない。
   * @returns {Object[]} 案
   */
  E.sortedNoteTitles = function () {
    var list = E.noteTitles.slice();
    if (E.noteTitleSort !== 'score') return list;
    return list.sort(function (a, b) { return E.titleTotal(b) - E.titleTotal(a); });
  };
})(globalThis);
