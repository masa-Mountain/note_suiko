/* 執筆画面にだけ、推敲の規則とパネルを差し込む */
var FILES = [
  'src/core/core.js',
  'src/core/text.js',
  'src/core/dict-language.js',
  'src/core/dict-rating.js',
  'src/core/rules-proofread.js',
  'src/core/rules-consistency.js',
  'src/core/rules-expression.js',
  'src/core/rules-vocabulary.js',
  'src/core/rules-structure.js',
  'src/core/rules-rating.js',
  'src/core/rules-plain-mix.js',
  'src/core/rules-identifiable.js',
  'src/core/metrics.js',
  'src/core/audience.js',
  'src/core/presets.js',
  'src/core/analyze.js',
  'src/core/dict-title.js',
  'src/core/title-analyze.js',
  'ext/extract.js',
  'ext/marks.js',
  'ext/prefs.js',
  'ext/issue-button.js',
  'ext/group.js',
  'ext/place.js',
  'ext/title-store.js',
  'ext/title-panel.js',
  'ext/panel.js',
  'ext/engine.js'
];

var pending = {};

chrome.runtime.onMessage.addListener(function (msg, sender) {
  if (!msg || msg.type !== 'suikou-attach' || !sender.tab) return;
  var id = sender.tab.id;
  if (pending[id]) return;
  pending[id] = true;
  chrome.scripting.executeScript({
    target: { tabId: id },
    func: function () { return !!(globalThis.Suikou && globalThis.Suikou._noteExtReady); }
  }).then(function (res) {
    if (res && res[0] && res[0].result) return null;
    return chrome.scripting.insertCSS({
      target: { tabId: id },
      files: ['ext/panel.css']
    }).then(function () {
      return chrome.scripting.executeScript({ target: { tabId: id }, files: FILES });
    });
  }).catch(function () { /* ページ遷移直後はタブが無いことがある */ }).then(function () {
    pending[id] = false;
  });
});
