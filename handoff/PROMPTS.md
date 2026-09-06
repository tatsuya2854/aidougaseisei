# Runway / Google Flow 引き継ぎキット

3Dで作った各カットの**開始フレーム・終了フレーム**を書き出してあります。
これを image-to-video に食わせて、動きと空気感だけ生成AIに足す使い方を想定しています。

開始フレームが完全にオンモデル（顔＝原画のピクセル）なので、テキストから作るより
横目・衣装・世界観が崩れにくくなります。字幕とカット間のフラッシュは焼き込んでいません。

```
handoff/plates/01_landing_start.png   ... 08_hero_end.png   1080x1920 PNG（全16枚）
handoff/09_product_cut.mp4            商品カット 4.60s（生成にかけない・そのまま連結する）
handoff/captions_overlay.mov          日本語字幕だけの透過レイヤー（QuickTime RLE / alpha付き）
handoff/assemble.sh                   生成クリップ＋商品カット＋字幕＋BGMを24秒に組み直す
```

---

## 0. 全カット共通で先頭に付ける文（マスタープロンプト）

```
3D toy figure render, soft vinyl / matte plastic surfaces, Pop Mart collectible aesthetic.
Pastel dusk palette: lavender, soft peach, warm orange. Soft diffused lighting, lifted shadows,
low contrast, shallow depth of field with creamy bokeh. Cute chibi character wearing an orange
cat-hood halloween costume: stitched cat ears, small bats across the brow, a black floppy tip with
a candy corn, sleeveless orange top with a black jack-o'-lantern face, black-and-white striped
sleeves, black shorts with a white cobweb print, white sneakers.
The face MUST stay exactly as in the input frame: closed crescent (squinting) eyes, thick black
brows, wide open smile with a pink tongue, round pink blush. Never open the eyes.
```

**ネガティブ**（入力欄がある場合）:
```
open eyes, realistic eyes, pupils, irises, changed facial expression, extra fingers, text, letters,
watermark, morphing face, distorted logo, human skin texture, photorealistic, harsh shadows,
high contrast, motion blur on the face
```

---

## 1. カットごとのプロンプトと尺

各クリップは指定の尺に**トリムして使う**前提です（Runwayは5s/10s、Veoは8s固定出力なので必ず余ります）。

| # | プレート | 必要尺 | プロンプト（マスターの後に続ける） |
|---|---|---|---|
| 1 | `01_landing_*` | **2.70s** | `The character has just landed on the cobbled street and bounces lightly in place, pom-poms jiggling. Candy pieces drift slowly past the lens. Camera pushes in very slowly. Gentle secondary motion only.` |
| 2 | `02_run_*` | **2.70s** | `The character runs cheerfully toward the camera down the cobbled street, under an arch of glowing pumpkins. Slight up-and-down bounce, arms swinging. Camera dollies back slowly to hold the framing.` |
| 3 | `03_bigpumpkin_*` | **2.40s** | `The character bobs happily beside a large glowing pumpkin, candle flames flickering in the foreground. Very slow camera drift to the right. Warm light flickers softly on the costume.` |
| 4 | `04_doorstep_*` | **2.40s** | `The character leans in and tilts its head, curiously looking down at the pump bottle sitting on the doorstep. Candies rock gently. Camera creeps forward slightly.` |
| 5 | `05_pump_*` | **2.20s** | `Close-up. The character slowly reaches a striped-sleeve arm toward the bottle's pump. The bottle glows faintly. Camera holds nearly still, breathing very slightly.` |
| 6 | `06_archjump_*` | **2.40s** | `The character jumps joyfully under the pumpkin arch, pom-poms flying up, candies bouncing on the ground. Slight low-angle camera rise.` |
| 7 | `07_bustup_*` | **2.00s** | `Bust-up. The character bobs and giggles, bats gliding across the sky far behind, bokeh candy drifting. Camera almost static with a tiny handheld float.` |
| 8 | `08_hero_*` | **2.60s** | `Hero shot. The character stands on top of a giant pumpkin and proudly raises the bottle higher. Candies float upward around it, sky glows warmer. Camera arcs slowly around to centre the character.` |
| 9 | — | **4.60s** | **生成しない。** `09_product_cut.mp4` をそのまま連結する（パッケージの文字とイラストを守るため） |

> カット9は絶対に生成AIに通さないこと。「ほぐほぐクリーム / ChenMe」のラベル文字は
> 一度通すと確実に溶けます。ここだけは実画像のハメ込みのまま。

---

## 2. サービス別の設定

### Runway（Gen-4 / Gen-4 Turbo, image-to-video）
- **Start frame** に `*_start.png`、**End frame** に `*_end.png` を両方入れる（First/Last Frame）。
  これを使うと動きが暴れず、僕が作った3Dの動きにかなり近い結果になる。
- Aspect ratio: **9:16** / Duration: 5s / Camera motion: **Low** or Off
- **Seed を固定**して回す。カット間で絵柄がブレるのを抑えられる。
- 顔が動いたら、プロンプトの `Never open the eyes.` を先頭付近に移すと効きやすい。

### Google Flow（Veo）
- **Frames to Video**（開始＋終了フレーム指定）を使う。テキストのみは使わない。
- 出力 8s / 9:16 / 「Ingredients」に開始フレームを入れておくと一貫性が上がる。
- Veoは音も生成するので、**音声はミュートで書き出す**（BGMは `audio/score.wav` を使う）。

---

## 3. 組み直し

生成したクリップを `handoff/clips/` に `01.mp4` 〜 `08.mp4` の名前で置いて：

```bash
./handoff/assemble.sh
# -> out/chenme_halloween_promo_ai.mp4  （24.00s / 1080x1920 / 30fps / BGM付き）
```

各クリップを頭から必要尺だけ切り出し、商品カットを連結し、
字幕レイヤー（`captions_overlay.mov`）を重ねて、`audio/score.wav` を乗せます。
生成クリップには字幕が入らないので、字幕は後乗せで統一しています。
3D版へフォールバックしたカットは字幕が二重に乗りますが、完全に同じ位置・同じ絵なので見た目は変わりません。
BGMは1小節1.92秒（125BPM）でカット点にチャイムを置いてあるので、尺を変えると音がズレます。
**尺は表の値のまま**にしてください。

---

## 4. 先に知っておいた方がいいこと

生成AIを通すと、たぶんこの辺が崩れます。許容できるか先に決めておくといいです。

| 崩れやすいもの | 対策 |
|---|---|
| 顔（横目が開く・表情が変わる） | First/Last Frame両指定＋ネガティブ。それでもダメなら生成をやめてそのカットは3Dのまま使う |
| 袖のボーダー（ちらつく・本数が変わる） | Camera motion を Low に。動きを小さくするほど安定する |
| 額のコウモリ、耳のステッチ、キャンディコーン | 細かすぎて溶ける。寄りのカット（5・7）ほど顕著 |
| パッケージの文字 | **カット9を生成しない**ことで回避済み |

カットごとに「生成版」と「3D版」を並べて、良かった方だけ採用する運用がいちばん失敗しません。
`assemble.sh` は `handoff/clips/0X.mp4` が無いカットを自動で3D版にフォールバックします。
