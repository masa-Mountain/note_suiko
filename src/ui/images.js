/* 推敲 (suikou) — 手元の画像を本文に入れる
 *
 * ファイル選択・貼り付け・ドロップから data URL にして記法へ置く。
 * GIF / SVG はそのまま、それ以外は長辺を抑えて JPEG にする（保存領域のため）。
 * note へ渡すときは http(s) の画像だけが残るので、手元の画像は note 側で貼り直す。
 */
(function (global) {
  'use strict';

  var S = global.Suikou;
  var UI = S.ui;

  var MAX_EDGE = 1600;
  var JPEG_QUALITY = 0.82;

  /**
   * @param {File} file 調べるファイル
   * @returns {boolean} 画像として扱うか
   */
  function _isImage(file) {
    if (!file) return false;
    if (/^image\//.test(file.type)) return true;
    return /\.(png|jpe?g|gif|webp|svg)$/i.test(file.name || '');
  }

  /**
   * @param {string} name ファイル名
   * @returns {string} 拡張子を除いたキャプション
   */
  function _caption(name) {
    return String(name || '画像').replace(/\.[^.]+$/, '');
  }

  /**
   * キャンバスで長辺を抑え、data URL にする。
   * @param {HTMLImageElement} img 読み込んだ画像
   * @param {string} type 元の MIME
   * @param {function(string): void} done data URL を受け取る
   * @returns {void}
   */
  function _resize(img, type, done) {
    var w = img.naturalWidth || img.width;
    var h = img.naturalHeight || img.height;
    var scale = Math.min(1, MAX_EDGE / Math.max(w, h, 1));
    var canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    var ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    var mime = (type === 'image/png' && scale === 1) ? 'image/png' : 'image/jpeg';
    done(canvas.toDataURL(mime, JPEG_QUALITY));
  }

  /**
   * ファイルを data URL にする。
   * @param {File} file 画像ファイル
   * @param {function(string): void} done data URL を受け取る
   * @returns {void}
   */
  function _toDataUrl(file, done) {
    if (/^image\/(gif|svg\+xml)$/i.test(file.type)) {
      var reader = new FileReader();
      reader.onload = function () { done(String(reader.result || '')); };
      reader.readAsDataURL(file);
      return;
    }
    var obj = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(obj);
      try {
        _resize(img, file.type, done);
      } catch (e) {
        done('');
      }
    };
    img.onerror = function () {
      URL.revokeObjectURL(obj);
      var reader = new FileReader();
      reader.onload = function () { done(String(reader.result || '')); };
      reader.readAsDataURL(file);
    };
    img.src = obj;
  }

  /**
   * 画像1枚を本文の記法として入れる。
   * @param {File} file 画像ファイル
   * @param {function(): void} [done] 入れ終わったあと
   * @returns {void}
   */
  UI.insertImageFile = function (file, done) {
    if (!_isImage(file)) {
      if (done) done();
      return;
    }
    _toDataUrl(file, function (url) {
      if (url) UI.insertBlock('![' + _caption(file.name) + '](' + url + ')');
      if (done) done();
    });
  };

  /**
   * 複数の画像を、選んだ順に本文へ入れる。
   * @param {Array<File>|FileList} files 画像ファイル
   * @returns {void}
   */
  UI.insertImageFiles = function (files) {
    var list = [];
    var i;
    for (i = 0; i < files.length; i++) {
      if (_isImage(files[i])) list.push(files[i]);
    }
    i = 0;
    /**
     * @returns {void}
     */
    function next() {
      if (i >= list.length) return;
      UI.insertImageFile(list[i++], next);
    }
    next();
  };

  /**
   * エクスプローラーを開いて画像を選ぶ。
   * @returns {void}
   */
  UI.pickImages = function () {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = function () {
      if (input.files && input.files.length) UI.insertImageFiles(input.files);
    };
    input.click();
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
