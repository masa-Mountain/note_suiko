/* 推敲 (suikou) — タイトル案の保存。本文と校正結果は触らない。 */
(function (global) {
  'use strict';

  var UI = global.Suikou.ui;

  UI.TITLE_AXES = [
    { key: 'accuracy', label: '内容が正確に伝わる', short: '正確' },
    { key: 'interest', label: '読者が興味を持てる', short: '興味' },
    { key: 'concrete', label: '具体的なイメージが浮かぶ', short: '具体' },
    { key: 'original', label: '自分らしい独自性がある', short: '独自' },
    { key: 'fit', label: '未読の人にも、何の話か伝わる', short: '入口' }
  ];

  /**
   * 5項目がすべて 3 の点数。
   * @returns {Object<string, number>} 点数
   */
  function _scores() {
    var out = {};
    UI.TITLE_AXES.forEach(function (axis) { out[axis.key] = 3; });
    return out;
  }

  /**
   * 理由欄の空。
   * @returns {Object<string, string>} 理由
   */
  function _notes() {
    var out = {};
    UI.TITLE_AXES.forEach(function (axis) { out[axis.key] = ''; });
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
    UI.TITLE_AXES.forEach(function (axis) {
      var value = raw.scores && Number(raw.scores[axis.key]);
      if (value >= 1 && value <= 5) scores[axis.key] = Math.round(value);
      if (raw.notes && typeof raw.notes[axis.key] === 'string') notes[axis.key] = raw.notes[axis.key];
    });
    return { id: raw.id, text: String(raw.text || ''), entrance: String(raw.entrance || ''), scores: scores, notes: notes };
  }

  /**
   * 自己評価の合計。
   * @param {Object} item 案
   * @returns {number} 5〜25
   */
  UI.titleTotal = function (item) {
    var total = 0;
    UI.TITLE_AXES.forEach(function (axis) { total += item.scores[axis.key]; });
    return total;
  };

  /**
   * 自分の合計点につける呼び名。文言の採点ではない。
   * @param {number} total 合計
   * @returns {string} 呼び名
   */
  UI.titleBand = function (total) {
    if (total >= 21) return '有力候補';
    if (total >= 15) return '改善の余地あり';
    return '再考してみる';
  };

  /**
   * 保存してある案を読む。
   * @returns {void}
   */
  UI.loadTitles = function () {
    var raw = [];
    try {
      var data = JSON.parse(localStorage.getItem(UI.STORE.titles) || 'null');
      if (Array.isArray(data)) raw = data;
    } catch (e) { raw = []; }
    UI.state.titles = raw.map(_normalize).filter(function (item) { return !!item; });
  };

  /**
   * 案を保存する。
   * @returns {void}
   */
  UI.saveTitles = function () {
    try {
      localStorage.setItem(UI.STORE.titles, JSON.stringify(UI.state.titles));
    } catch (e) { /* 端末の保存領域が一杯のときは画面上の案だけ残す */ }
  };

  /**
   * 案を足す。
   * @param {string} text 初期の文言
   * @returns {Object} 足した案
   */
  UI.addTitle = function (text) {
    var item = {
      id: 't' + Date.now().toString(36) + Math.floor(Math.random() * 36).toString(36),
      text: text || '',
      entrance: '',
      scores: _scores(),
      notes: _notes()
    };
    UI.state.titles.push(item);
    UI.state.titleId = item.id;
    UI.saveTitles();
    return item;
  };

  /**
   * 案を消す。
   * @param {string} id 案の id
   * @returns {void}
   */
  UI.removeTitle = function (id) {
    UI.state.titles = UI.state.titles.filter(function (item) { return item.id !== id; });
    if (UI.state.titleId === id) {
      UI.state.titleId = UI.state.titles.length ? UI.state.titles[UI.state.titles.length - 1].id : null;
    }
    UI.saveTitles();
  };

  /**
   * 選んだ文言をタイトル欄へ入れる。本文は変えない。
   * @param {Object} item 案
   * @returns {void}
   */
  UI.adoptTitle = function (item) {
    if (!item || !UI.el.title) return;
    UI.el.title.value = item.text || '';
    UI.saveDraft();
    UI.scheduleAnalyze();
  };

  /**
   * 表示順。点数順でも採用はしない。
   * @returns {Object[]} 案
   */
  UI.sortedTitles = function () {
    var list = UI.state.titles.slice();
    if (UI.state.titleSort !== 'score') return list;
    return list.sort(function (a, b) { return UI.titleTotal(b) - UI.titleTotal(a); });
  };

  UI.loadTitles();
})(typeof globalThis !== 'undefined' ? globalThis : this);
