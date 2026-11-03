/* 推敲 (suikou) — タイトルの事実だけを返す。評価文は作らない。 */
(function (global) {
  'use strict';

  var S = global.Suikou;
  var TIME_RE = /[0-9０-９]{1,4}(?:年|ヶ月|か月|月|日|時)/g;
  var PLACE_RE = /[一-龯々]{1,8}(?:駅|市|区|町|村|県|府)/g;
  var SERIES_RE = /[#＃]\s*[0-9０-９]{1,3}|第\s*(?:[0-9０-９]{1,3}|[一二三四五六七八九十百]+)\s*(?:回|話|弾)/;

  /**
   * 前後の空白を外す。
   * @param {string} text タイトル
   * @returns {string} 空白を除いた文字列
   */
  function _trim(text) {
    return String(text || '').replace(/^[\s\u3000]+|[\s\u3000]+$/g, '');
  }

  /**
   * 長い語を優先して、重ならないヒットだけ返す。
   * @param {string} text 対象
   * @param {string[]} words 語
   * @returns {string[]} 見つかった語
   */
  function _hits(text, words) {
    var used = [];
    var found = [];
    words.slice().sort(function (a, b) { return b.length - a.length; }).forEach(function (word) {
      var at = word ? text.indexOf(word) : -1;
      if (at < 0) return;
      var end = at + word.length;
      var covered = used.some(function (span) { return at < span[1] && end > span[0]; });
      if (covered) return;
      used.push([at, end]);
      found.push({ start: at, word: word });
    });
    found.sort(function (a, b) { return a.start - b.start; });
    return found.map(function (hit) { return hit.word; });
  }

  /**
   * 正規表現の一致を、より短い語と重複しないものだけ足す。
   * @param {string} text 対象
   * @param {RegExp} re 正規表現
   * @param {string[]} words すでに見つかった語
   * @returns {string[]} 足したあとの語
   */
  function _addMatches(text, re, words) {
    var extra = [];
    re.lastIndex = 0;
    String(text).replace(re, function (hit) { extra.push(hit); return hit; });
    return _preferLong(words.concat(extra));
  }

  /**
   * ほかの語に含まれる短い語を外す。
   * @param {string[]} words 語
   * @returns {string[]} 長い方だけ
   */
  function _preferLong(words) {
    var uniq = [];
    words.forEach(function (word) {
      if (word && uniq.indexOf(word) < 0) uniq.push(word);
    });
    return uniq.filter(function (word) {
      return !uniq.some(function (other) { return other !== word && other.indexOf(word) >= 0; });
    });
  }

  /**
   * 連番の表記だけを取り出す。
   * @param {string} text タイトル
   * @returns {string} 無ければ空
   */
  function _seriesMark(text) {
    var hit = String(text || '').match(SERIES_RE);
    return hit ? hit[0].replace(/\s+/g, '') : '';
  }

  /**
   * タイトルに含まれる事実。
   * @param {string} text タイトル
   * @returns {{chars: number, questionMark: boolean, exclaimMark: boolean, number: boolean,
   *            questionPhrases: string[], emotionWords: string[], abstractWords: string[],
   *            concreteWords: string[], seriesMark: string}} 事実
   */
  S.titleFacts = function (text) {
    var body = _trim(text);
    var words = (S.dict && S.dict.titleWords) || {};
    var concrete = _hits(body, words.concrete || []);
    concrete = _addMatches(body, TIME_RE, concrete);
    concrete = _addMatches(body, PLACE_RE, concrete);
    return {
      chars: body.length,
      questionMark: /[?？]/.test(body),
      exclaimMark: /[!！]/.test(body),
      number: /[0-9０-９]/.test(body),
      questionPhrases: _hits(body, words.question || []),
      emotionWords: _hits(body, words.emotion || []),
      abstractWords: _hits(body, words.abstract || []),
      concreteWords: concrete,
      seriesMark: _seriesMark(body)
    };
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
