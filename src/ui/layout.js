/* 推敲 (suikou) — 狭い画面のペイン切り替えと、キーボード分の高さ */
(function (global) {
  'use strict';

  var UI = global.Suikou.ui;

  /** この幅以下だけ執筆／指摘を切り替え。PC の二分割は触らない。 */
  var NARROW = 720;

  /**
   * 狭い画面かどうか。
   * @returns {boolean} 狭いとき true
   */
  UI.isNarrow = function () {
    return !!(window.matchMedia && window.matchMedia('(max-width: ' + NARROW + 'px)').matches);
  };

  /**
   * 狭い画面で見せる側を決める。広い画面ではクラスだけ揃えて、CSS は無視する。
   * @param {'write'|'review'} pane 執筆か指摘か
   * @returns {void}
   */
  UI.setMobilePane = function (pane) {
    UI.state.mobilePane = pane === 'review' ? 'review' : 'write';
    document.body.classList.toggle('pane-review', UI.state.mobilePane === 'review');
    document.body.classList.toggle('pane-write', UI.state.mobilePane === 'write');
    UI.syncMobileNav();
  };

  /**
   * 下の切り替えボタンと件数を今の状態に合わせる。
   * @returns {void}
   */
  UI.syncMobileNav = function () {
    var nav = UI.$('mobile-nav');
    if (!nav) return;
    Array.prototype.forEach.call(nav.querySelectorAll('[data-pane]'), function (b) {
      b.className = b.getAttribute('data-pane') === UI.state.mobilePane ? 'active' : '';
    });
    var n = UI.$('mobile-issue-count');
    if (n) {
      var c = UI.state.result ? UI.state.result.activeCount : 0;
      n.textContent = c ? String(c) : '';
    }
  };

  /**
   * 画面キーボードで潰れないよう、今見えている高さを CSS 変数に入れる。
   * @returns {void}
   */
  UI.fitViewport = function () {
    var vp = window.visualViewport;
    var h = vp ? vp.height : window.innerHeight;
    document.documentElement.style.setProperty('--app-h', Math.round(h) + 'px');
  };

  /**
   * メニュー開閉と、執筆／指摘の切り替えを結線する。
   * @returns {void}
   */
  UI.bindLayout = function () {
    UI.fitViewport();
    window.addEventListener('resize', UI.fitViewport);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', UI.fitViewport);
    }
    var more = UI.$('btn-more');
    if (more) {
      more.addEventListener('click', function (ev) {
        ev.stopPropagation();
        document.body.classList.toggle('more-open');
      });
    }
    var nav = UI.$('mobile-nav');
    if (nav) {
      nav.addEventListener('click', function (ev) {
        var t = ev.target;
        var pane = t.getAttribute && t.getAttribute('data-pane');
        if (!pane && t.parentNode) pane = t.parentNode.getAttribute && t.parentNode.getAttribute('data-pane');
        if (pane) UI.setMobilePane(pane);
      });
    }
    UI.setMobilePane(UI.state.mobilePane || 'write');
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
