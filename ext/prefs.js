/* 執筆画面で覚えるプリセット・レーティング・文体 */
(function (global) {
  'use strict';

  var S = global.Suikou;
  var E = (global.SuikouExt = global.SuikouExt || {});

  var RATINGS = [
    { value: 'strict', label: '全年齢（厳格）' },
    { value: 'all-ages', label: '全年齢' },
    { value: 'r18', label: 'R-18（成人向け）' }
  ];
  var STYLES = [
    { value: 'auto', label: '自動判定' },
    { value: 'desu', label: '敬体で統一' },
    { value: 'dearu', label: '常体で統一' }
  ];

  /**
   * 保存値から解析用の設定を作る。
   * @param {{presetId: string, rating: string, style: string}} prefs 保存値
   * @returns {Object} 設定
   */
  E.configFromPrefs = function (prefs) {
    var cfg = S.config.defaults();
    S.config.applyPreset(cfg, prefs.presetId || 'essay-general');
    if (prefs.rating) cfg.rating = prefs.rating;
    if (prefs.style) cfg.style = prefs.style;
    return cfg;
  };

  /**
   * 保存してある選択を読む。
   * @param {function(Object): void} done 読めたあと
   * @returns {void}
   */
  E.readPrefs = function (done) {
    chrome.storage.local.get({ presetId: 'essay-general', rating: 'all-ages', style: 'auto' }, function (prefs) {
      done(prefs);
    });
  };

  /**
   * @param {HTMLSelectElement} select 選択欄
   * @param {Array<{value: string, label: string}>} options 項目
   * @param {string} value 初期値
   * @returns {void}
   */
  function _fill(select, options, value) {
    options.forEach(function (o) {
      var opt = document.createElement('option');
      opt.value = o.value;
      opt.textContent = o.label;
      select.appendChild(opt);
    });
    select.value = value;
  }

  /**
   * パネル内に3つの選択欄を置く。
   * @param {function(Object): void} onChange 変更時
   * @param {Object} prefs 初期値
   * @returns {void}
   */
  E.mountPrefs = function (onChange, prefs) {
    var host = document.getElementById('suikou-note-prefs');
    if (!host || host.childNodes.length) return;
    var preset = document.createElement('select');
    var rating = document.createElement('select');
    var style = document.createElement('select');
    preset.title = 'プリセット';
    rating.title = 'レーティング';
    style.title = '文体';
    _fill(preset, S.config.presets.map(function (p) { return { value: p.id, label: p.label }; }), prefs.presetId);
    _fill(rating, RATINGS, prefs.rating);
    _fill(style, STYLES, prefs.style);

    /**
     * @returns {void}
     */
    function _emit() {
      var next = { presetId: preset.value, rating: rating.value, style: style.value };
      chrome.storage.local.set(next);
      onChange(next);
    }

    preset.addEventListener('change', function () {
      var p = S.config.presetById(preset.value);
      rating.value = p.rating;
      style.value = p.style;
      _emit();
    });
    rating.addEventListener('change', _emit);
    style.addEventListener('change', _emit);
    host.appendChild(preset);
    host.appendChild(rating);
    host.appendChild(style);
  };
})(globalThis);
