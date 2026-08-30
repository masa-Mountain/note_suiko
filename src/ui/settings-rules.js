/* 推敲 (suikou) — 設定タブのルール一覧（有効・深刻度・しきい値） */
(function (global) {
  'use strict';

  var S = global.Suikou;
  var C = S.config;
  var UI = S.ui;

  var SEVERITIES = ['error', 'warn', 'info', 'hint'];

  /**
   * ルールごとのしきい値の入力欄。
   * @param {Object} rule ルール定義
   * @param {Object} res 解決済みの設定（有効・深刻度・しきい値）
   * @param {Object} over このルールの上書き設定（この場で書き換える）
   * @returns {HTMLElement} 入力欄の並び
   */
  function _params(rule, res, over) {
    return UI.h('div', { class: 'params' }, rule.params.map(function (def) {
      /**
       * @param {Event} ev 変更イベント
       * @returns {void}
       */
      function onchange(ev) {
        over.params = over.params || {};
        over.params[def.key] = def.type === 'bool'
          ? ev.target.checked
          : parseFloat(ev.target.value);
        UI.saveConfig();
        UI.runAnalyze();
      }
      if (def.type === 'bool') {
        return UI.h('label', {}, [
          UI.h('input', {
            type: 'checkbox', checked: res.params[def.key] ? 'checked' : null, onchange: onchange
          }),
          document.createTextNode(def.label)
        ]);
      }
      return UI.h('label', {}, [
        document.createTextNode(def.label),
        UI.h('input', {
          type: 'number', value: res.params[def.key],
          min: def.min, max: def.max, step: def.step, onchange: onchange
        })
      ]);
    }));
  }

  /**
   * ルール1件の行。
   * @param {Object} cfg 設定
   * @param {Object} rule ルール定義
   * @returns {HTMLElement} 行の要素
   */
  function _ruleItem(cfg, rule) {
    var res = C.resolveRule(cfg, rule);
    var over = cfg.rules[rule.id] || (cfg.rules[rule.id] = {});
    var hit = UI.state.result && UI.state.result.ruleStats[rule.id];
    var item = UI.h('div', { class: 'rule-item' + (res.enabled ? '' : ' disabled') }, [
      UI.h('div', { class: 'line1' }, [
        UI.h('input', {
          type: 'checkbox', checked: res.enabled ? 'checked' : null,
          onchange: function (ev) {
            over.enabled = ev.target.checked;
            UI.saveConfig();
            UI.runAnalyze();
            UI.renderSettings();
          }
        }),
        UI.h('span', { class: 'name', text: rule.name + (hit ? '（' + hit + '件）' : '') }),
        UI.h('select', {
          onchange: function (ev) {
            over.severity = ev.target.value;
            UI.saveConfig();
            UI.runAnalyze();
          }
        }, SEVERITIES.map(function (sev) {
          return UI.h('option', {
            value: sev, selected: res.severity === sev ? 'selected' : null,
            text: UI.severityLabel(sev)
          });
        })),
        UI.h('span', { class: 'id', text: rule.id })
      ]),
      UI.h('div', { class: 'desc', text: rule.description })
    ]);
    if (rule.params.length) item.appendChild(_params(rule, res, over));
    return item;
  }

  /**
   * ルール一覧を分類ごとに描く。
   * @param {HTMLElement} host 追加先
   * @param {Object} cfg 設定
   * @returns {void}
   */
  UI.renderRuleList = function (host, cfg) {
    host.appendChild(UI.h('h3', { class: 'section', text: 'ルール（' + S.rules.length + '）' }));
    Object.keys(S.CATEGORIES)
      .sort(function (a, b) { return S.CATEGORIES[a].order - S.CATEGORIES[b].order; })
      .forEach(function (cat) {
        var rules = S.rules.filter(function (r) { return r.category === cat; });
        if (!rules.length) return;
        var group = UI.h('div', { class: 'rule-group' }, [
          UI.h('div', {
            style: 'font-size:12px;margin:12px 0 4px;color:' + S.CATEGORIES[cat].color,
            text: S.CATEGORIES[cat].label
          })
        ]);
        rules.forEach(function (rule) { group.appendChild(_ruleItem(cfg, rule)); });
        host.appendChild(group);
      });
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
