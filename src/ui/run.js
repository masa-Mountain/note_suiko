/* 推敲 (suikou) — 解析の起動と、結果を画面に反映する入口 */
(function (global) {
  'use strict';

  var S = global.Suikou;
  var UI = S.ui;

  /**
   * AI の指摘を解析結果に混ぜる。ルールと違って毎回作り直さないので、
   * 引用文字列から本文中の位置を取り直してから合流させる。
   * @param {Object} result S.analyze の戻り値（この場で書き換える）
   * @param {string} text 現在の本文
   * @returns {void}
   */
  function _mergeAiIssues(result, text) {
    if (!UI.state.aiIssues.length) return;
    var located = S.ai.relocate(UI.state.aiIssues, text);
    var seq = 0;
    located.forEach(function (it) {
      var item = {
        id: 'ai:' + (seq++),
        ruleId: it.ruleId,
        ruleName: it.ruleName,
        category: 'ai',
        severity: it.severity,
        start: it.start,
        end: it.end,
        message: it.message,
        advice: it.advice,
        suggestions: null,
        meta: null,
        quote: it.quote,
        context: it.located && it.end > it.start ? S.util.context(text, it.start, it.end) : null
      };
      item.fingerprint = 'ai|' + it.quote + '|' + it.message;
      item.suppressKey = item.fingerprint;
      item.dismissed = UI.state.suppressed[item.suppressKey] ? 'suppressed'
        : (UI.state.resolved[item.fingerprint] ? 'resolved' : null);
      result.issues.push(item);
      if (item.dismissed) {
        result.dismissedCount++;
      } else {
        result.byCategory.ai = (result.byCategory.ai || 0) + 1;
        result.bySeverity[item.severity] = (result.bySeverity[item.severity] || 0) + 1;
        result.activeCount++;
      }
    });
    result.issues.sort(function (a, b) { return a.start - b.start; });
  }

  /**
   * 入力が止まってから解析する。打っている最中に走らせると重いため。
   * @returns {void}
   */
  UI.scheduleAnalyze = function () {
    if (UI.state.timer) clearTimeout(UI.state.timer);
    UI.state.timer = setTimeout(function () {
      UI.state.timer = null;
      UI.runAnalyze();
      UI.saveDraft();
    }, 350);
  };

  /**
   * 解析して画面全体を描き直す。
   * @returns {void}
   */
  UI.runAnalyze = function () {
    var input = UI.currentInput();
    UI.state.result = S.analyze(input);
    _mergeAiIssues(UI.state.result, input.text);
    UI.state.revealed = {};
    UI.renderCounters();
    UI.renderHighlights();
    UI.renderTabs();
    UI.renderActive();
    UI.renderStatus();
    if (UI.state.view === 'preview') UI.renderPreview();
  };

  /**
   * ヘッダの計量表示を描く。
   * @returns {void}
   */
  UI.renderCounters = function () {
    var h = UI.h;
    var r = UI.state.result;
    UI.clear(UI.el.counters);
    if (!r) return;
    var m = r.metrics;
    [
      h('span', {}, ['本文 ', h('b', { text: String(m.body) }), ' 字']),
      h('span', {}, ['約 ', h('b', { text: String(m.readingMinutes) }), ' 分']),
      h('span', {}, ['原稿用紙 ', h('b', { text: String(m.sheets) }), ' 枚']),
      h('span', { class: 'sev-error' }, ['要修正 ', h('b', { text: String(r.bySeverity.error || 0) })]),
      h('span', { class: 'sev-warn' }, ['検討 ', h('b', { text: String(r.bySeverity.warn || 0) })]),
      h('span', {}, ['指摘密度 ', h('b', { text: String(r.density) }), ' /千字'])
    ].forEach(function (p) { UI.el.counters.appendChild(p); });
  };

  /**
   * エディタ下部の状態表示を描く。
   * @returns {void}
   */
  UI.renderStatus = function () {
    var r = UI.state.result;
    UI.clear(UI.el.status);
    if (!r) return;
    var m = r.metrics;
    var bits = [
      '文 ' + m.sentences + ' / 段落 ' + m.paragraphs,
      '平均文長 ' + m.avgSentence + ' 字（最長 ' + m.maxSentence + '）',
      '漢字 ' + m.kanjiRatio + '%',
      '読みやすさ ' + m.ease + '（' + m.easeLabel + '）',
      '解析 ' + r.elapsed + ' ms'
    ];
    if (r.dismissedCount) bits.push('片付け済み ' + r.dismissedCount);
    if (r.truncated) bits.push('※指摘は上限で打ち切り');
    if (UI.state.aiState) bits.push('AI: ' + UI.state.aiState);
    bits.forEach(function (b) { UI.el.status.appendChild(UI.h('span', { text: b })); });
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
