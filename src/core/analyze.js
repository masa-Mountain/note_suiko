/* 推敲 (suikou) — 解析の統括 */
(function (global) {
  'use strict';

  var S = global.Suikou;
  var T = S.text;
  var C = S.config;
  var U = S.util;

  function protectedRanges(text, dictionary, display, note) {
    var ranges = [];
    for (var i = 0; i < dictionary.ignore.length; i++) {
      (function (word) {
        U.scan(text, new RegExp(U.escapeRegExp(word), 'g'), function (m, idx) {
          ranges.push([idx, idx + m[0].length]);
        });
      })(dictionary.ignore[i]);
    }

    /* 記法そのもの（目次・有料ライン・画像指定）は文章ではないので校正の対象外にする */
    U.scan(text, /^[ \u3000]*(?:\[目次\]|!\[[^\]]*\]\([^)]*\))[ \u3000]*$/gm, function (m, idx) {
      ranges.push([idx, idx + m[0].length]);
    });
    if (note && note.paidMarker) {
      U.scan(text, new RegExp(U.escapeRegExp(note.paidMarker), 'g'), function (m, idx) {
        ranges.push([idx, idx + m[0].length]);
      });
    }
    if (display.skipQuotes) {
      U.scan(text, /```[\s\S]*?```/g, function (m, idx) {
        ranges.push([idx, idx + m[0].length]);
      });
      U.scan(text, /^[ \u3000]*>.*$/gm, function (m, idx) {
        ranges.push([idx, idx + m[0].length]);
      });
      U.scan(text, /`[^`\n]+`/g, function (m, idx) {
        ranges.push([idx, idx + m[0].length]);
      });
    }
    ranges.sort(function (a, b) { return a[0] - b[0]; });
    return ranges;
  }

  function inProtected(ranges, start, end) {
    for (var i = 0; i < ranges.length; i++) {
      if (ranges[i][0] > end) break;
      if (U.overlaps(start, end, ranges[i][0], ranges[i][1])) return true;
    }
    return false;
  }

  /* 指摘の同一性を表す指紋。
   *
   * 位置は編集でずれるので使わない。ルールと当たった語、その前後4文字で作る。
   * こうしておくと、別の場所を直しても「対応済み」の印が外れない。 */
  function fingerprint(it) {
    if (it.context) {
      return it.ruleId + '|' + it.context.hit +
        '|' + it.context.before.slice(-4) + '|' + it.context.after.slice(0, 4);
    }
    return it.ruleId + '|' + it.message;
  }

  /* 「この語では今後も指摘しない」のためのキー。前後の文脈は含めない。 */
  function suppressKey(it) {
    return it.ruleId + '|' + (it.context ? it.context.hit : it.message);
  }

  S.fingerprint = fingerprint;
  S.suppressKey = suppressKey;

  /**
   * 解析を実行する。
   * input = { text, title, hashtags: string[], config, resolved, suppressed }
   */
  S.analyze = function (input) {
    var t0 = (global.performance && global.performance.now) ? global.performance.now() : Date.now();
    var text = input.text || '';
    var config = input.config;
    var dictionary = C.parseDictionary(config.dictionary);
    var paragraphs = T.splitParagraphs(text);

    var ctx = {
      text: text,
      title: input.title || '',
      hashtags: input.hashtags || [],
      sentences: T.splitSentences(text),
      paragraphs: paragraphs,
      headings: T.extractHeadings(paragraphs),
      config: config,
      dictionary: dictionary
    };

    var protect = protectedRanges(text, dictionary, config.display, config.note);
    var issues = [];
    var ruleStats = {};
    var seq = 0;

    for (var i = 0; i < S.rules.length; i++) {
      var rule = S.rules[i];
      var resolved = C.resolveRule(config, rule);
      if (!resolved.enabled) continue;

      var collected = 0;
      var collector = (function (rule, resolved) {
        return function (raw) {
          var start = U.clamp(raw.start | 0, 0, text.length);
          var end = U.clamp(raw.end == null ? start : raw.end | 0, start, text.length);
          if (end > start && inProtected(protect, start, end)) return;
          collected++;
          issues.push({
            id: rule.id + ':' + (seq++),
            ruleId: rule.id,
            ruleName: rule.name,
            category: rule.category,
            severity: raw.severity || resolved.severity,
            start: start,
            end: end,
            message: raw.message,
            advice: raw.advice || '',
            suggestions: raw.suggestions || null,
            meta: raw.meta || null,
            context: end > start ? U.context(text, start, end) : null
          });
        };
      })(rule, resolved);

      try {
        rule.run(ctx, collector, resolved.params);
      } catch (e) {
        issues.push({
          id: rule.id + ':error',
          ruleId: rule.id,
          ruleName: rule.name,
          category: rule.category,
          severity: 'info',
          start: 0, end: 0,
          message: 'ルール「' + rule.name + '」の実行中にエラーが発生しました。',
          advice: String(e && e.message ? e.message : e),
          suggestions: null, meta: null, context: null
        });
      }
      ruleStats[rule.id] = collected;
    }

    /* 同一範囲の重複を落とす（深刻度の高いほうを残す） */
    var seen = Object.create(null);
    var deduped = [];
    var sevWeight = { error: 3, warn: 2, info: 1, hint: 0 };
    issues.sort(function (a, b) {
      return (sevWeight[b.severity] || 0) - (sevWeight[a.severity] || 0);
    });
    for (var k = 0; k < issues.length; k++) {
      var it = issues[k];
      var key = it.ruleId + '|' + it.start + '|' + it.end;
      var catKey = it.category + '|' + it.start + '|' + it.end + '|' + it.message;
      if (seen[key] || seen[catKey]) continue;
      seen[key] = 1;
      seen[catKey] = 1;
      deduped.push(it);
    }

    deduped.sort(function (a, b) {
      if (a.start !== b.start) return a.start - b.start;
      return (sevWeight[b.severity] || 0) - (sevWeight[a.severity] || 0);
    });

    var truncated = false;
    if (deduped.length > config.display.maxIssues) {
      deduped = deduped.slice(0, config.display.maxIssues);
      truncated = true;
    }

    /* 片付けた指摘に印を付ける（消すのは UI 側の役目） */
    var resolvedMap = input.resolved || {};
    var suppressedMap = input.suppressed || {};
    var dismissedCount = 0;
    for (var d = 0; d < deduped.length; d++) {
      var item = deduped[d];
      item.fingerprint = fingerprint(item);
      item.suppressKey = suppressKey(item);
      if (suppressedMap[item.suppressKey]) item.dismissed = 'suppressed';
      else if (resolvedMap[item.fingerprint]) item.dismissed = 'resolved';
      else item.dismissed = null;
      if (item.dismissed) dismissedCount++;
    }

    var metrics = S.metrics.compute(text, ctx.title, config);
    var audience = null;
    try {
      audience = S.audience.analyze(text, metrics, ctx.hashtags);
    } catch (e) {
      audience = null;
    }

    var byCategory = {};
    var bySeverity = { error: 0, warn: 0, info: 0, hint: 0 };
    for (var m = 0; m < deduped.length; m++) {
      if (deduped[m].dismissed) continue;
      var c = deduped[m].category;
      byCategory[c] = (byCategory[c] || 0) + 1;
      bySeverity[deduped[m].severity] = (bySeverity[deduped[m].severity] || 0) + 1;
    }
    var activeCount = deduped.length - dismissedCount;

    var t1 = (global.performance && global.performance.now) ? global.performance.now() : Date.now();

    return {
      issues: deduped,
      truncated: truncated,
      byCategory: byCategory,
      bySeverity: bySeverity,
      activeCount: activeCount,
      dismissedCount: dismissedCount,
      density: metrics.body ? U.round((activeCount / metrics.body) * 1000, 1) : 0,
      metrics: metrics,
      audience: audience,
      headings: ctx.headings.map(function (h) {
        return { level: h.level, title: h.title, start: h.span.start, markdown: h.markdown };
      }),
      ruleStats: ruleStats,
      elapsed: U.round(t1 - t0, 1)
    };
  };

  /* =========================================================
   * レポート出力（Markdown）
   * ========================================================= */
  S.buildReport = function (result, input) {
    var lines = [];
    var m = result.metrics;
    lines.push('# 推敲レポート');
    lines.push('');
    lines.push('- 生成: ' + new Date().toLocaleString('ja-JP'));
    lines.push('- プリセット: ' + C.presetById(input.config.presetId).label);
    lines.push('- レーティング: ' + ({ strict: '全年齢（厳格）', 'all-ages': '全年齢', r18: 'R-18' }[input.config.rating]));
    if (input.title) lines.push('- タイトル: ' + input.title);
    lines.push('');
    lines.push('## 計量');
    lines.push('');
    lines.push('| 項目 | 値 |');
    lines.push('| --- | --- |');
    lines.push('| 本文文字数 | ' + m.body + ' |');
    lines.push('| 原稿用紙換算 | ' + m.sheets + ' 枚 |');
    lines.push('| 文数 / 段落数 | ' + m.sentences + ' / ' + m.paragraphs + ' |');
    lines.push('| 平均文長 / 最長文 | ' + m.avgSentence + ' / ' + m.maxSentence + ' 字 |');
    lines.push('| 漢字 / ひらがな / カタカナ | ' + m.kanjiRatio + '% / ' + m.kanaRatio + '% / ' + m.katakanaRatio + '% |');
    lines.push('| 異なり語比 (TTR) | ' + m.ttr + '% |');
    lines.push('| 読みやすさ | ' + m.ease + ' (' + m.easeLabel + ' / ' + m.easeReader + ') |');
    lines.push('| 読了時間 | 約 ' + m.readingMinutes + ' 分 |');
    lines.push('| 文体 | 敬体 ' + m.style.polite + ' / 常体 ' + m.style.plain + ' / 体言止め ' + m.style.taigen + ' |');
    lines.push('');

    if (result.audience) {
      lines.push('## 読者像');
      lines.push('');
      lines.push(result.audience.summary);
      lines.push('');
      lines.push('- 想定年齢帯: ' + result.audience.ageBands.join('、'));
      lines.push('- ジャンル推定: ' + result.audience.genres.slice(0, 3).map(function (g) {
        return g.label + '(' + g.percent + ')';
      }).join(' / '));
      lines.push('- トーン: ' + result.audience.polarityLabel);
      result.audience.axes.forEach(function (a) {
        lines.push('- ' + a.label + ': ' + a.value);
      });
      if (result.audience.mismatches.length) {
        lines.push('');
        lines.push('### 噛み合っていない点');
        lines.push('');
        result.audience.mismatches.forEach(function (x) { lines.push('- ' + x); });
      }
      lines.push('');
      lines.push('- タグ候補: ' + result.audience.tagSuggestions.join(' '));
      lines.push('');
    }

    var live = result.issues.filter(function (i) { return !i.dismissed; });
    lines.push('## 指摘（' + live.length + ' 件' +
      (result.dismissedCount ? ' / 片付け済み ' + result.dismissedCount + ' 件は省略' : '') + '）');
    lines.push('');
    var order = Object.keys(S.CATEGORIES).sort(function (a, b) {
      return S.CATEGORIES[a].order - S.CATEGORIES[b].order;
    });
    order.forEach(function (cat) {
      var list = live.filter(function (i) { return i.category === cat; });
      if (!list.length) return;
      lines.push('### ' + S.CATEGORIES[cat].label + '（' + list.length + '）');
      lines.push('');
      list.forEach(function (i) {
        var loc = i.context ? i.context.before + '【' + i.context.hit + '】' + i.context.after : '(全体)';
        lines.push('- **' + S.SEVERITIES[i.severity].label + '** ' + i.message);
        lines.push('  - 位置: ' + i.start + ' / ' + loc);
        if (i.advice) lines.push('  - 視点: ' + i.advice);
        if (i.suggestions && i.suggestions.length) lines.push('  - 候補: ' + i.suggestions.join(' / '));
      });
      lines.push('');
    });
    return lines.join('\n');
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
