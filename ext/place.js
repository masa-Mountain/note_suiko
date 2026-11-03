/* パネルの位置をドラッグで動かし、ブラウザに覚える */
(function (global) {
  'use strict';

  var E = (global.SuikouExt = global.SuikouExt || {});
  var KEY = 'suikouNotePlace';

  /**
   * 画面内に収まる位置へ置く。
   * @param {HTMLElement} el パネル
   * @param {number} left 左
   * @param {number} top 上
   * @returns {{left: number, top: number}} 置いた位置
   */
  function _move(el, left, top) {
    var maxX = Math.max(8, window.innerWidth - el.offsetWidth - 8);
    var maxY = Math.max(8, window.innerHeight - el.offsetHeight - 8);
    var x = Math.min(Math.max(8, left), maxX);
    var y = Math.min(Math.max(8, top), maxY);
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.right = 'auto';
    el.style.bottom = 'auto';
    return { left: Math.round(x), top: Math.round(y) };
  }

  /**
   * 保存してある位置を戻す。
   * @param {HTMLElement} el パネル
   * @returns {void}
   */
  E.loadPlace = function (el) {
    chrome.storage.local.get(KEY, function (data) {
      var place = data[KEY];
      if (el.dataset.placed === '1' || !place) return;
      _move(el, place.left, place.top);
    });
  };

  /**
   * 見出し行のドラッグを付ける。
   * @param {HTMLElement} el パネル
   * @returns {void}
   */
  E.bindPlace = function (el) {
    var head = el.querySelector('header');
    var drag = null;
    head.addEventListener('mousedown', function (ev) {
      if (ev.button !== 0) return;
      var onButton = ev.target.closest && ev.target.closest('button');
      if (onButton && !el.classList.contains('is-collapsed')) return;
      var box = el.getBoundingClientRect();
      drag = { x: ev.clientX, y: ev.clientY, left: box.left, top: box.top, moved: false };
    });
    document.addEventListener('mousemove', function (ev) {
      if (!drag) return;
      var dx = ev.clientX - drag.x;
      var dy = ev.clientY - drag.y;
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
      drag.moved = true;
      el.dataset.placed = '1';
      _move(el, drag.left + dx, drag.top + dy);
    });
    document.addEventListener('mouseup', function () {
      if (!drag || !drag.moved) {
        drag = null;
        return;
      }
      var box = el.getBoundingClientRect();
      var save = {};
      save[KEY] = { left: Math.round(box.left), top: Math.round(box.top) };
      chrome.storage.local.set(save);
      E.placeMoved = true;
      setTimeout(function () { E.placeMoved = false; }, 0);
      drag = null;
    });
  };
})(globalThis);
