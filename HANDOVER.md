# 推敲 (suikou) — クラウド開発引き継ぎ

作成日: 2026-11-03  
用途: GitHub 上のクラウド環境／新チャットで開発を続けるための資料  
公開サイト: https://masa-mountain.github.io/note_suiko/  
想定リポジトリ: `masa-mountain/note_suiko`（PC からは GitHub の Upload files で更新している）

---

## 0. 新チャットの最初に貼る文（短縮版）

以下をそのまま新クラウドチャットの最初のメッセージに使える。詳細はこのファイル全体。

```text
【プロジェクト】推敲 (suikou) — note 執筆支援。依存ライブラリなしの古典スクリプト。原稿は端末外に出さない（任意の AI 補助を除く）。

【リポジトリ／公開】
- GitHub Pages: https://masa-mountain.github.io/note_suiko/
- リポジトリ想定: masa-mountain/note_suiko
- ローカル作業フォルダ: C:\Users\kurok\suikou（PC に git / Node は入っていない。更新は GitHub の Upload files で上書き）

【構成】
- Web アプリ: index.html + src/core/* + src/ui/* + styles.css（file:// または serve.ps1）
- Chrome 拡張「推敲 for note」: manifest.json（現在 0.2.11）+ ext/*。note 執筆画面用。note-stats-ext は触らない
- 自己テスト: test.html（直近 129/129 通過）

【直近まで完了した主な機能】
1. note 往復の行間空白修正、対応済み履歴、類語ボタン、目次 [目次] 取り込み
2. note 執筆画面用 Chrome 拡張（指摘パネル・ドラッグ移動・しまうと「推敲／開く」1行）
3. 表記ゆれの複数箇所を1カードに束ねる／2箇所目以降の選択修正
4. 見出し・引用を # / > 付きで抽出し、構造ルールが効くようにする
5. タイトル評価（生成AIなし）: Web「タイトル」タブ + 拡張の「指摘／タイトル」切替
6. 「未読の入口」欄・5項目目を未読視点に変更・連番は事実表示のみ（拡張 0.2.11）

【守ること】
- 日本語。Plan→Act→Reflect。実装前は計画提示→ユーザーが「GO」してから変更（明確なバグ修正は例外あり）
- 生成AIでタイトルを自動生成・自動採点しない。外部API不要の機能は通信しない
- 本文の無断書き換えをしない。指摘は提案まで
- ファイルは〜100行目安、型ヒント（JSDoc）、ファイル内専用は _ 接頭辞
- YAGNI / KISS / DRY（3箇所目で共通化検討）
- 拡張の CSS/JS 変更後は chrome://extensions で再読込＋執筆画面を開き直す必要がある

【未着手・次にやってもよい候補】（優先はユーザー指示待ち）
- GitHub Pages へ最新一式の再アップロード（タイトル評価・未読の入口などが Pages に未反映なら）
- README / README.html の自己テスト件数・拡張版の更新
- タイトル辞書の拡張は「地図」「遺す」を悪語扱いしない方針を維持
- アカウント方向性（フォロー理由）はタイトル機能の外。別要件なら明示してから

詳細はリポジトリ内 HANDOVER.md を読んでから作業してください。
```

---

## 1. プロダクト概要

| 項目 | 内容 |
| --- | --- |
| 名前 | 推敲 (suikou) |
| 作者文脈 | note エッセイスト masa山（note.com/massa_masa） |
| 目的 | 校閲・編集者視点の指摘。答えを出さず、指摘と視点だけ返す |
| 技術 | 依存ゼロ。classic script → `globalThis.Suikou` / 拡張は `SuikouExt` |
| 公開 | GitHub Pages。原稿は Pages に上がらない（端末の localStorage） |
| 拡張 | 別途ローカル unpacked。Pages 必須ではない |

### やらないこと（合意済み）

- AI なしでは、任意の変換ミス・助詞抜け・文のねじれまで取れない → 辞書と規則が現実的ライン
- タイトルの自動生成・自動採点・クリック率予測はしない
- note-stats-ext（スキ率・クリック率）は現状維持。統合しない（推敲は別拡張）
- 下書きのスキ率予測はしない

---

## 2. リポジトリ構成

```
suikou/
  index.html          Web 本体
  test.html           自己テスト
  styles.css
  serve.ps1           ローカル静的サーバ（既定 8787、競合時 9000）
  manifest.json       拡張 MV3（version 0.2.11）
  .nojekyll
  README.md / README.html
  HANDOVER.md         本資料
  src/core/           解析・辞書・ルール・タイトル事実
  src/ui/             Web UI
  ext/                note 用拡張（watch / background / panel / title-*）
```

### Web のタブ

指摘 / 診断 / 読者像 / **タイトル** / 設定

### 拡張の注入順（抜粋）

`ext/background.js` の `FILES` に core → `dict-title.js` / `title-analyze.js` → extract → … → `title-store.js` / `title-panel.js` → panel → engine。  
ブラウザ版の `src/ui/title-*.js` は `Suikou.ui` 依存のため拡張には注入しない。

---

## 3. データ保存キー

### Web（localStorage）

| キー | 用途 |
| --- | --- |
| `suikou.draft.v1` | タイトル・本文・タグ |
| `suikou.config.v1` | 設定 |
| `suikou.marks.v1` | 対応済み / 今後も無視 |
| `suikou.archive.v1` | 指摘履歴 |
| `suikou.titles.v1` | タイトル案（原稿と別。「消す」でも案は残す） |

### 拡張（chrome.storage.local）

| キー | 用途 |
| --- | --- |
| `suikouNoteMarks` | 対応済み（`location.pathname` ごと） |
| `suikouNotePlace` | パネル位置 `{left,top}` |
| `suikouNoteTitles` | タイトル案（pathname ごと） |
| プリセット等 | presetId / rating / style |

Web のタイトル案と note 拡張のタイトル案は**同期しない**（別オリジン）。

---

## 4. 開発ルール（ユーザー規則・このプロジェクト特有）

1. **日本語**でやり取り・コメント・UI 文言。
2. **Plan → Act → Reflect**。新機能は計画提示 → ユーザーの **GO** 後に実装。明確なバグは直接直すことがある。
3. 変更は要求範囲に限定。無関係リファクタ禁止。
4. ファイルはおおよそ **100 行**。JSDoc の引数・返り値。ファイル内専用関数は `_` 接頭辞。
5. **YAGNI / KISS**。共通化は 3 箇所目から検討。
6. 生成AIっぽい過剰 UI（ネオン、過剰グラデ等）を避ける。
7. **コミットはユーザー依頼時のみ**。この PC では `git` / `gh` / Node が使えないことが多い。
8. GitHub 更新手順: フォルダ**中身**を Upload files で上書き。旧フォルダを作らない。同名上書きでよい。

### 拡張の反映手順（毎回）

1. `chrome://extensions` で「推敲 for note」を再読み込み  
2. note の執筆画面を閉じてもう一度開く（CSS は inject 時に入る）

---

## 5. 機能の現状（会話で実装・合意したもの）

### 5.1 Web 校正コア

- ルール群: 誤字、表記ゆれ、表現、語彙、構造、レーティング、敬体混在、特定リスクなど（ルール総数テスト時 71）
- 対応済み fingerprint、suppress、「消す」で対応済みもクリア
- 指摘履歴（対応済み・編集で消えたもの）
- note HTML 往復: `toNoteHtml` は改行で結合しない。TOC は `[目次]`。ペーストバックで note の TOC ブロックは再現できない
- 類語: ツールバーから辞書＋ Weblio
- 狭い画面（≤720px）: 執筆／指摘ペイン切替
- 任意 AI 補助あり（`src/core/ai.js`）が、タイトル評価からは呼ばない

### 5.2 Chrome 拡張

- 対象: note.com / editor.note.com の執筆 URL + `.ProseMirror`
- パネル: 右上寄り、文字数表示を隠さない（top 108px 等）。ドラッグ移動、しまうと「推敲＋開く」
- 解析: debounce 約 2800ms + idle。IME 中はスキップ。`profile:false` で計量・読者像を軽くする
- 指摘グループ: 短い hit → `ruleId|hit`、さもなくば `ruleId|message`。複数箇所は「各箇所を見る」
- 2箇所目以降の選択: サブ行は div + mousedown preventDefault、reveal でエディタ focus
- 見出し/引用: 抽出時に `# `/`## `/`> ` を付け、segments は実テキストのみ
- タイトル評価: パネル「指摘／タイトル」切替。採用は note タイトル欄だけ（React 向け value setter + input）

### 5.3 タイトル評価（生成AIなし）

**分析** `S.titleFacts`（`src/core/title-analyze.js` + `dict-title.js`）

- 文字数、疑問符、感嘆符、数字
- 疑問の言い方／感情／抽象／時間・場所・出来事（辞書ヒット）
- `seriesMark`（`#7` / `第7回` / `第七話` 等）— **事実表示のみ。外すべきとは書かない**
- 良し悪し・クリック率・断定文は返さない

**自己評価** 5 項目 × 1〜5（新規はすべて 3）。合計 25。帯: 21+ 有力候補 / 15–20 改善の余地あり / ≤14 再考してみる  
5項目目ラベル: **「未読の人にも、何の話か伝わる」**（キー `fit` は維持）

**未読の入口** `entrance` 文字列。採点前に書くメモ。採用文言は `text`（タイトル案）のみ。説明文:「入口に書いた出来事が、タイトル単体でも分かるか…」

**意図（フィードバック由来）**  
書き手は読み終えた余韻で題を付けがち。機械が「地図は悪い」と判定するのではなく、未読視点の入口を先に書かせる。

---

## 6. 重要ファイル早見表

| 領域 | パス |
| --- | --- |
| 解析入口 | `src/core/analyze.js` |
| note I/O | `src/core/noteio.js` |
| タイトル事実 | `src/core/title-analyze.js`, `dict-title.js` |
| Web タイトル UI | `src/ui/title-store.js`, `title-sheet.js`, `title-compare.js` |
| タブ結線 | `src/ui/view.js` |
| 保存 | `src/ui/store.js`, `state.js` |
| 自己テスト | `src/core/selftest.js` |
| 拡張注入 | `ext/background.js` |
| 拡張パネル | `ext/panel.js`, `panel.css`, `place.js` |
| 拡張タイトル | `ext/title-store.js`, `title-panel.js` |
| 本文抽出 | `ext/extract.js` |
| 解析タイミング | `ext/engine.js` |

---

## 7. 検証のしかた

```powershell
powershell -ExecutionPolicy Bypass -File .\serve.ps1 -Port 9000
# http://127.0.0.1:9000/test.html
# http://127.0.0.1:9000/
```

- 自己テスト: 直近 **129 / 129**、ルール総数 **71**（README の「93」は古い可能性あり → 更新候補）
- タイトル: 「疲れない身体 #7」→ 連番チップ。「私を遺すかたち」→ 連番なし
- 拡張: 再読込後、執筆画面で「タイトル」モード → 入口 → タイトル案 → このタイトルを使う（本文は変わらないこと）

---

## 8. 未解決・次作業の候補

優先度はユーザーの GO 待ち。勝手に広げない。

1. **Pages の最新化** — ローカルにタイトル評価・未読の入口が入っている。Pages 未アップロードなら Upload files で上書き。
2. **README 同期** — 自己テスト件数、拡張版 0.2.11、タイトルタブの説明。
3. **タイトル機能の微調整** — 入口必須化はしない方針。辞書拡張時は「地図」「遺す」を悪語にしない。
4. **拡張 UX** — 必要ならパネル幅・モバイル note は別途要件確認。
5. **アカウント方向性・シリーズ設計** — プロダクト外の執筆戦略。ツール化する場合は仕様を先に確定。
6. **PC の git 環境** — クラウド側に git がある前提で作業する。ローカル PC では git コマンドが使えない状態だった。

---

## 9. 既知の制約・落とし穴

- note の TOC ブロックはコピペ往復で再現できない（`[目次]` プレースホルダ）
- 拡張は ProseMirror 依存。タイトル欄セレクタは placeholder / aria-label の「タイトル」
- パネル再描画の fingerprint 最適化あり。展開トグル時は `panelSign` を空にする実装がある
- 入れ子 button は無効 HTML のため、指摘カードは div + 内部 button
- Windows サンドボックスではシェルに `all` 権限が必要なことがある
- Node 未インストール環境あり。テストはブラウザの `test.html`

---

## 10. 関連チャット文脈（要約）

- 初期: Web 推敲、GitHub Pages 公開、note 往復・履歴・類語
- 中盤: 執筆画面チェック拡張（統計拡張とは別）、レイアウト・debounce・グループ化・見出し
- 後半: タイトル評価（Web→拡張）、未読の入口・連番事実表示
- フィードバック: タイトルは余韻型になりがち → 未読入口を先に書く設計へ

著者記事例（校正に使ったもの）:  
https://note.com/massa_masa/n/ne6f95f388809

---

## 11. クラウド側エージェントへの作業指示テンプレ

```text
HANDOVER.md を読んだうえで作業してください。
今回やりたいこと: （ここに具体的な要望）
制約: 生成AIでタイトル自動採点しない / 本文を勝手に書き換えない / GO 前に計画を出す
完了条件: （テスト・Pages・拡張再読込など）
```

---

## 12. チェックリスト（引き継ぎ後の最初の確認）

- [ ] リポジトリがクラウドにクローンでき、`manifest.json` が 0.2.11 か
- [ ] `test.html` が通るか
- [ ] Web に「タイトル」タブと未読の入口があるか
- [ ] 拡張 FILES に `dict-title.js` / `title-analyze.js` / `title-*.js` があるか
- [ ] ユーザーの次の具体タスクを確認してから実装する
