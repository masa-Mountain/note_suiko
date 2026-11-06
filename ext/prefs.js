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
    cfg.craftStrict = !!prefs.craftStrict;
    cfg.craftUnlocked = !!prefs.craftUnlocked || !!prefs.craftStrict;
    return cfg;
  };

  /**
   * 保存してある選択を読む。
   * @param {function(Object): void} done 読めたあと
   * @returns {void}
   */
  E.readPrefs = function (done) {
    chrome.storage.local.get({
      presetId: 'essay-general', rating: 'all-ages', style: 'auto',
      craftStrict: false, craftUnlocked: false
    }, function (prefs) {
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
    var state = {
      presetId: prefs.presetId,
      rating: prefs.rating,
      style: prefs.style,
      craftStrict: !!prefs.craftStrict,
      craftUnlocked: !!prefs.craftUnlocked || !!prefs.craftStrict
    };
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
      state.presetId = preset.value;
      state.rating = rating.value;
      state.style = style.value;
      chrome.storage.local.set(state);
      onChange(state);
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

    if (state.craftUnlocked) {
      var label = document.createElement('label');
      label.className = 'suikou-craft';
      var box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = state.craftStrict;
      box.addEventListener('change', function () {
        state.craftStrict = !!box.checked;
        _emit();
      });
      label.appendChild(box);
      label.appendChild(document.createTextNode(' 追加チェック'));
      host.appendChild(label);
    }

    var foot = document.querySelector('#suikou-note-panel .suikou-foot');
    if (foot && !foot.getAttribute('data-craft-tap')) {
      var taps = 0;
      var timer = null;
      foot.setAttribute('data-craft-tap', '1');
      foot.addEventListener('click', function (ev) {
        if (ev.target.tagName === 'A') return;
        taps += 1;
        if (timer) clearTimeout(timer);
        timer = setTimeout(function () { taps = 0; }, 1600);
        if (taps < 5 || state.craftUnlocked) return;
        state.craftUnlocked = true;
        chrome.storage.local.set(state);
        host.textContent = '';
        E.mountPrefs(onChange, state);
      });
    }
  };
})(globalThis);
