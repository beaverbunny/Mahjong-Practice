# Key decisions

This file records the decisions that shape 雀圣研习社 and the reasons behind them. Read it before changing rules, bots, layout, wording or the build. When a decision changes, update its entry and note the date and PR. Reversals stay listed, because they record what was tried and why it was dropped.

PR numbers refer to `beaverbunny/Mahjong-Practice`. Last updated 2026-10-21.

## 1. Ground rules

These apply to every change.

- **Purpose: practice for the TVB Mahjong Brain Fitness Championship.** The rules are Hong Kong style, play is 16 hands, and a win needs at least 1 fan. The owner uses the app to prepare for the real qualifier. In the owner's words: "you must make sure the game and player actions are all legal and correct, or else this practice app is useless."
- **The official rules are the source of truth.** Use [TVB's Chinese rules page](https://freezone.tvbanywhere.com/tc/news/3925/competition-rules), which takes precedence over the English version ("應以中文版本為準"). The [English rules PDF](https://tvbaw-na.s3.us-west-1.amazonaws.com/TVBI-MahjongChamp-GameRules-ENG-v20260908.docx.pdf) is secondary. Where a rule is ambiguous, the owner rules on it, and the ruling is recorded below.
- **Google AI Studio is the primary development and deployment flow, so leave it undisturbed.**
  - The UI is largely built in AI Studio. Its commits (`feat:`, `chore:`, `style:`) land directly on `main`, so sync with `main` before starting work.
  - AI Studio deploys from its own workspace to Cloud Run, not through GitHub.
  - Never change `package.json`, `bun.lock`, `vite.config.ts` or the build setup, and never add dependencies.
  - AI Studio sets the version number in `package.json`. The footer shows it plus a build timestamp (`src/version.ts`, injected by Vite).
  - `metadata.json` is AI Studio's project file; leave it alone. Its description still uses older wording.
- **Supported screens: desktop and iPad landscape only.** Desktop is the priority and must never break. Portrait is not supported, so it isn't checked. Phones are covered in §9.
- **Bots see only what a real player at the table can see.** This is the integrity of the practice. Tests enforce it (§3).
- **Tests live in `scripts/` and run with Bun, outside the app build.** They run in CI on GitHub (§8).

## 2. Rules and scoring

**Points (附录一).**
- On a discard win, the winner gets 10 × fan and the player who dealt in (出铳) pays all of it.
- On a self-draw, the winner gets 15 × fan, and each of the other three pays 5 × fan.
- Fan is capped at 10. *(#1)*

**A hand worth 0 fan is not a win.** The rules recognise only hands on the official list (附录二). 自摸 is itself 1 fan, so any complete hand can still win by self-draw. A mixed hand with no fan cannot win on a discard. *(#1)*

**平胡 (A1) accepts an honour pair.** The owner ruled on this; the English wording is ambiguous. *(#1)*

**Kongs.**
- A kong counts as 3 tiles in the 14-tile check.
- Winning on the kong replacement tile scores 杠上自摸 (A6).
- An added kong can be robbed (抢杠). The player who declared the kong pays.
- No kong can be declared once the wall is empty. *(#1, #3)*

**Claim priority.**
- A win goes to the first claimant in turn order after the discarder.
- 杠 and 碰 beat 吃, and only the next seat may 吃.
- A player may pass on a win and still 碰 or 吃. *(#3)*

**After calling 吃 or 碰, the caller must discard.** They cannot declare a self-draw win or a kong that turn. *(#2, #3)*

**The last discard can only be claimed to win, and that win scores 海底捞月 (A5).** *(#1, #3)*

**The dealer passes every hand, so a match is always 16 盘.** This was the owner's choice. *(#3)*

**No twelve-tile liability (包自摸).** This was the owner's choice. *(#3)*

**Strict Hu (严格胡牌) is an option; hint mode (提示胡牌) is the default.**
- In hint mode, the 胡 button only appears for a legal win of at least 1 fan.
- In strict mode, any complete shape can be declared. A 0-fan declaration is a false win (诈胡): the declarer loses 150 (`FALSE_WIN_PENALTY`), the other players gain nothing, and the declarer can't win again that hand.
- So scores no longer sum to zero after a false win. The engine's consistency check verifies that win payments sum to zero, and that a penalty never pays anyone.
- The owner set this rule on 10-15. Until then the penalty paid 50 to each opponent, a figure taken from the owner's qualifier playbook. *(#3, 10-15)*

**There is no furiten (振听).** An opponent can win on a tile they discarded themselves, so a tile they threw is never "absolutely safe". *(#2)*

**Final standings break ties per rule D.4:** total fan won, then number of wins, then fewer deal-ins, counted over the match. *(#10)*

**Seven pairs doesn't count;** it isn't on the official list. *(tests)*

## 3. Engine, bots and fairness

**One pure rules engine.** `src/engine/table.ts` is used by the app, the bots, the simulator and the tests. Rule logic belongs there, not in UI components. *(#3)*

**Fan-aware shanten (`src/engine/fanShanten.ts`).**
- It measures the distance to a hand that is guaranteed at least 1 fan on a discard. The routes are:
  - Common Hand (all sequences plus any pair);
  - a value triplet (dragon, seat wind or prevailing wind);
  - Half or Full Flush;
  - All Triplets;
  - Thirteen Orphans.
- Self-Draw and Under the Sea are never assumed, because they aren't guaranteed.
- The strategy guide (#4) and the bots (#9) both use it.

**What bots can see.**
- They see their own hand, every discard (who threw it, in what order, and whether it was the tile just drawn), exposed melds, seat winds and the number of tiles left in the wall.
- They never see other hands, the wall's contents or order, or internal tenpai flags.
- `scripts/fairness.test.ts` swaps every hidden tile and requires identical bot decisions. Never weaken this test. *(#2, #6)*

**Bots read danger with the same model as the hints, 摸切/手切 included.** In #8 the owner kept these reads for the human only, because they liked how the bots played. On 10-21 the owner found Master too easy and chose to give the bots the same reads (see the strength upgrade below). Both are visible information, so a bot still never knows more than a sharp human could. *(#8, reversed 10-21)*

**How bots decide.** A bot weighs expected hand value against `caution × danger`, shaped by a persona of style plus skill. Skill adds decision noise and scales how much defence counts. (Until 10-21 it also gated flush-reading in the bots' own rough danger read, which the shared model replaced.) *(#3)*

**Bots build hands that can win on a discard.** In the owner's words: "real players do not rely on the self-draw as their only fan … they aim for pinfu unless they have a value triplet potential." Results over 200 Master matches:
- Ready on a self-draw-only hand: 16.6% → 0.6%.
- One new bot against three old ones on identical deals: about +4 points per match. *(#9)*

**Bots value unready hands by how often they really win, and read danger with the hints' model (10-21).** The owner found Master too easy and chose both fixes, for every level ("All levels").
- **Win chances.** Bots used to guess the chance of finishing a hand from its distance to ready. Mid-hand they guessed 40% from one tile away when the real figure was about 15%, since someone else usually wins first. So they broke cheap ready hands to chase bigger ones and passed on calls that would make them ready. They now use `src/ai/winChance.ts`: how often hands that far from ready, at that many turns left, really went on to win. Their estimate for ready hands was already accurate and is unchanged.
- **Danger.** Bots now judge each discard by the expected points lost from the danger model behind the hints (§4) instead of their own rough read from melds and discard count. The rough read overrated opponents 2–3×.
- **Result.** One new bot against three earlier ones on identical deals scores +23.3 ± 1.7 points per match over 400 matches; the win chances give about two thirds of that. A player as strong as the earlier bots loses 18.2 ± 1.5 more per match at a table of new bots. The fairness test still passes, and a decision takes about 1 ms.
- **Field.** A Master table now wins 15.1 of 16 hands (was 14.3), with draws in 5.6% of hands (was 10.7%). When a hand ends, 33% of the non-winners are ready (was 20%). Tournament: 15.1 wins per 16 hands, 30% by self-draw, 1.98 fan per win (60 matches each).

**Difficulties are style weights plus a skill range** (`FIELDS` in `src/ai/personas.ts`):

| Level | Styles (weight) | Skill |
|---|---|---|
| 入门 beginner | casual 5, speed 2, balanced 1 | 0.15–0.45 |
| 进阶 intermediate | casual 2, speed 3, balanced 3, value 2, defensive 1 | 0.40–0.75 |
| 比赛实战 tournament (default) | casual 3, speed 3, balanced 2.5, value 1.5, defensive 1 | 0.35–0.95 |
| 宗师 master | speed 3, balanced 5, value 3, defensive 1 | 0.80–1.00 |

- **Tournament** imitates the real qualifier field. It was calibrated to the playbook's statistics: about 15.5 wins per 16 hands, about 28% of wins by self-draw, about 2 fan per win. Since the 10-21 upgrade it plays at 15.1 wins, 30% self-draw and 1.98 fan per win.
- **Master** is the toughest table. The owner practises on Master ("I only care about master difficulty from this point on").
- **Master weights were changed in #14** (they were 3 / 4 / 3 / 2). The owner then asked to drop defensive bots entirely, and reverted that; defensive stays at weight 1.
- To change who sits at Master, change these weights, not the hand logic.
- **Bot names show seat, style and rank during play** (e.g. 下家 · 速攻型 (大师)). The owner chose this over hiding styles until the match ends, and the difficulty screen says so (名牌显示对手风格). *(10-15)*

**Bot behaviour is pinned by a fingerprint test** in `scripts/danger.test.ts`. Any intended bot change must:
- re-fit the danger model (`docs/danger-model.md`). The bots use it, so a re-fit changes them too. Re-fitting it on the upgraded bots cost no strength (+22.7 against +23.2 without the re-fit, ±2.4);
- update the fingerprint after the re-fit;
- re-run the style study (`docs/master-style-study.md`).

Don't regenerate the win-chance table (`src/ai/winChance.ts`) on bots that already use it; that made them weaker (see the ideas table). Replace it only after a rules change, and test the new bots head-to-head first.

**Bot ideas tried and rejected.** Measured on identical deals; don't retry them without a new idea.

| Idea | Result | Date |
|---|---|---|
| Look-ahead (Monte Carlo) bot as an "Expert" level | −31 points/match against Master. Removed; the branch commit was deleted. | 10-03 |
| Value every fast hand at a 1-fan minimum | Steady +1.2 ± 3.5 (no gain), speed worse. Big-hand bots stopped playing big hands, which wipes out field variety. | 10-05 |
| Give lone value honours some value | No gain at 0.05 and 0.1; −6.8 at 0.25 | 10-06 |
| Remove the cap of 18 on useful tiles | −4.1 and −5.0 | 10-07 |
| Spread the difficulty levels further apart | Offered; owner chose "keep things as is" | 10-03 |
| Fold less: accurate opponent reads, half caution, or both | No gain at Master: −1.9 ± 1.6, −1.4 ± 1.5 and −2.2 ± 1.7 per match. Tournament: −0.0 ± 1.4 and +0.4 ± 1.3. No defence at all costs −8.8 ± 1.7. Owner chose to leave bots as they are. | 10-21 |
| Noise-free play (skill 1, never careless) | −0.4 ± 1.7: no gain | 10-21 |
| Weight the shared danger model more or less (0.75–2×, with measured win chances) | +20.1 to +22.5: no gain over 1× | 10-21 |
| Re-measure the win-chance table on the bots that use it | +14.9 ± 2.3, against +22.7 ± 2.4 for the table measured on the earlier bots. It gave hands two or more tiles from ready a little late-hand value, so bots stopped giving them up. Scaling the earlier table 0.6–1.25× made no difference. | 10-21 |

**Bots fold more than they need to, by choice (10-21).** The owner noticed many bots unready when a hand ends and suspected over-folding. What 400-match paired tests and 60-match field studies found:
- Mostly the hand just ends early. Hands end after about 12 turns, and about 80% of non-winners aren't ready, most of them one tile away. With defence switched off the figure is about the same (17% ready, against 20%).
- The bots overrate opponents. `readOpponent` in `src/ai/brain.ts` guesses an opponent can win on a discard 2–3× more often than they really can (with 3 melds: 62–92% guessed, 34–56% real). So danger is about 2.4× too high.
- At Master, a bot plays a safe tile that sets its hand back in 17% (speed) to 44% (defensive) of hands. Draws are 10.7% of hands, against the playbook's about 3%.
- With accurate reads, folds fall by about 40% and draws to 7.2%, at no measurable change in strength. The owner preferred the current behaviour.
- Bots play for their own expected points, never for table rank. That matches the qualifier: rule B.2.a(ii) ranks players on cumulative points across all tables. A qualifier field may still push harder than the bots, because advancing needs a score near the top, not a good average.
- Later the same day the strength upgrade (above) replaced the rough read with the hints' model. Bots still fold in about the same share of hands (14% speed to 44% defensive at Master), but now against real threats: more of them are ready when a hand ends (33%, was 20%) and draws halved.

## 4. Strategy panel (策略助手) and danger model

**One switch controls all hints.**
- With the panel open, hints are on: tile tags (安/中/危 with %), discard recommendations and opponent reads.
- With the panel closed, there are no hints.
- The panel opens on load, and the choice isn't remembered. The owner chose to keep it this way. *(#8)*
- The badges on your tiles don't get a separate switch. *(confirmed 10-15)*
- While hints are on, every tile in hand carries its 安/中/危 badge, and the recommended tile also carries 荐. *(confirmed 10-15)*
- During the bots' turns, the default 进张与效率 tab shows a wait message; the player switches to 局势与防守 for the opponent reads. *(confirmed 10-15)*

**The panel floats over the table and may cover 下家.** Docking it beside the table was tried in #15 and shelved: "it's okay for the strategy overlay to cover the next player."

**The danger model (`src/analysis/danger.ts`) drives the hints, and since 10-21 the bots' danger read too.**
- It uses visible information only, including 摸切/手切.
- It was fitted on simulated Master games, with AUC 0.883 for ranking dangerous tiles (re-fitted 10-21 on the upgraded bots).
- Tags: 安 under 3%, 中 3–8%, 危 8% and up.
- It shows one number: danger. Judging the reward is left to the player ("the reward is usually very easy for me to calculate").
- Re-fit it after any bot change; the bots use it, so update their fingerprint after the re-fit. *(#8, #9, 10-21)*

**The post-hand 放铳风险复盘 always appears, whether hints were on or off.**
- It notes for each discard whether hints were on.
- It only measures danger. Whether a push was worth it is the player's call.
- The old "dangerous discard" blunder flag was removed. *(#8)*

**The move review in 实战复盘 judges efficiency only.** Breaking a hand to fold is marked 离听牌倒退 (严重失误) even when folding was right; defence is judged in 放铳风险复盘, not here. *(confirmed 10-15)*

**Discard ranking tie-break order** (`generateDiscardRecommendations`, panel only; bots don't use it):
1. Fewest steps to a hand with fan.
2. Most useful tiles toward a fan.
3. Most useful draws in total, including draws that improve the shape with no fan yet.
4. Safety level (安 before 中 before 危).
5. Throw the tile worth less fan as a triplet (dragon 1; seat wind and prevailing wind 1 each).
6. Lowest exact deal-in %.

These came from the owner's East/West and 四萬/南 examples. *(#11, #13)*

**Other panel decisions.**
- Draws that improve the shape but don't add a fan read "可改善牌型，但暂未带番", not "仅能自摸", because they aren't a dead end. *(#11)*
- Risk tags show on every copy of a tile in hand: recommendations are one per tile kind, and lookups go by kind. *(#11, #12)*
- **Rejected:** a "保留十三幺路线" note on discards. It was built, then the owner dropped it. *(10-07)*

## 5. Table and page layout

**The table scales to fit (`TableFit`).**
- It is laid out at a logical size of at least 940×680 and scaled uniformly, up to 1.35×, with its aspect ratio kept between 1.1 and 1.75.
- Late-game rivers can never push the player's hand off the table, and big screens get bigger tiles. *(#15)*

**The first screen is the header plus the table; the version footer sits below the fold.**
- Scrolling down 26 px reveals the footer.
- The owner decided this twice: a 10-07 commit that kept the footer on screen was reverted ("the scrolling was intended"), and #23 restored the intent.
- The page scrollbar is hidden, the page background is dark for overscroll, and a reload always opens at the top. *(#23)*

**Hand and table.**
- The hand and melds are centred on the table, with seat badges beside the hands. *(#15)*
- Action buttons (吃/碰/杠/胡/过/出牌) sit centred above the hand, over the player's own river: "keep the old way, it's okay for the overlay to cover my river." The idle "请点击选择手牌" hint was removed. *(#15)*
- Select a tile with a tap or click; tap it again to discard.
- 上家 and 下家's hidden hands are drawn as their tiles look from your seat, side-on, with the ivory face edge and the green back. Each tile is 22 px along the column with 3 px gaps (it was 16 px). A dealer's 14 tiles fit at every supported size with about 100 px to spare; 26 px would also fit but was not chosen. *(10-17)*
- 上家 and 下家's melds use the discard tile size, which also matches their revealed hands at the end of a hand. A kong with a sideways tile is 130 px wide in the 144 px side column and stays at least 31 px from the table edge; at the larger size it ran into the edge. *(10-17)*

**Rivers.**
- Each river shows its full 6×4 area as a soft dashed outline, labelled "对家弃牌区" etc. until its first discard. The layout keeps its shape all hand.
- There is no discard-count chip ("that info is not useful").
- Discards thrown straight from the draw are shown faded. *(#8, #15, #17)*

**Claim banner.**
- One gold line: seat plus call, e.g. "下家 · 碰！". It doesn't show the play style or the player's name.
- The player's own calls show just "碰！".
- Long messages use the small style and wrap. *(#15)*

**Header.**
- Gold 雀圣研习社 at 20 px, with a grey subtitle at 12 px in `#908985`: "TVB 香港麻将比赛规则 · 一番起胡".
- The subtitle is important and must stay visible. It sits beside the title from 1280 px (xl) and stacks under it below that.
- Below 1024 px the buttons show icons only. *(#15, #16, #21)*

**Result window.**
- The fan list has a fixed code column. The name, Chinese and English in one style, has its description underneath in smaller grey text. The "+N 番" count never wraps.
- The header shows only the fan total. The per-fan rate label ("自摸(+15每番)") was dropped, because the score cards already show each player's change. *(#22)*

**After a hand, the 查看牌桌 control bar (终局牌桌) docks at the top by default.** It may cover part of 对家's revealed hand; the player can move it to the bottom or collapse it. *(confirmed 10-15)*

**The review replay steps with the ← and → keys,** as well as the slider and buttons. The keys are ignored while the slider or round picker has focus (they handle arrows themselves) and when a modifier key is held. *(10-15)*

**The felt texture overlay was removed.** It only loaded in the AI Studio preview, never in the deployed app. *(#10)*

## 6. Pacing

The owner found the bots too fast, which made the game feel single-player. What matters is the time a discard stays readable before the next one lands. The owner chose to tune the waits rather than add drills or new flows.

| Delay | Value |
|---|---|
| Bot thinking before it discards | 1.7–2.3 s |
| Extra thinking right after a bot's own 吃/碰/杠 | +1.5 s |
| Reading pause after each discard | 1.2 s |
| Extra pause when a bot discarded from its hand (手切) | +0.5 s |

That gives about 3.2 s to read a normal bot discard and about 3.7 s for one thrown from hand. The timers live only in `src/App.tsx`; the simulator and tests have none. *(#14, #17)*

## 7. Language, terminology and voice

**Displayed text is in simplified Chinese.** Hong Kong traditional characters were tried in #18 and reverted in #20 because they rendered poorly and were hard to read. Two exceptions:
- Tile faces, tile names and the compass keep the traditional 萬/條/東/發 they always had.
- General UI words use mainland wording: 信息, 链接, 屏幕, 窗口, 概率, 实时, 社媒.

**Terms follow the official TVB Chinese rules where they're clear** *(#18, #20)*:
- 胡 / 胡牌 / 报胡, never 和 or 糊;
- 出铳, never 放铳, 点炮 or 荣和;
- 眼 for the pair, 盘 for a hand (16 盘);
- 附录一 番数得失分表 and 附录二 指定胡牌种类表;
- the official hand names: 杠上自摸, 中发白其中一刻 / 第二刻, 对对胡, 十三幺.

**Where the official rules don't decide, the owner picked** *(#18)*:
- 听牌 ("差 N 张听牌"), not 叫胡;
- 弃牌区 for the river;
- 出牌练习 and 进张;
- 失误 and 次优;
- 轮 (one 轮 = 4 discards);
- 吃 and 条 kept as they are.

**No Japanese riichi vocabulary on screen.** Replaced terms include 向听, 何切, 副露, 鸣牌, 役牌 (→ 番子), 现物, 筋, 壁, 振听, 弃和, 国士无双, 满贯, 牌姿 and 雀士. 摸切/手切 show as 摸到就打 / 从手牌打出. Code comments may still use the Japanese terms. *(#18)*

**Naming.**
- The rule set is "TVB 麻将比赛", never 国标, which is a different rule set. *(#10)*
- "一番起胡" in the subtitle is an accurate summary of the 1-fan minimum, not a quote from the rules. *(#21)*

**Voice (Web Speech API).**
- **普, the default, must behave exactly as the original code:** `lang` zh-CN plus the first Chinese voice on the device. A change in #19 broke this on some Chrome setups. `scripts/voice.test.ts` now pins it against Mac, Windows and Google-only voice lists. *(#20)*
- **粤 is purely additive.** It uses the device's zh-HK/yue voice if there is one; otherwise it speaks exactly like 普. The choice is saved. *(#19, #20)*
- **Spoken tile names are simplified.** Bamboo is X条 in 普 and X索 in 粤, but only when a Cantonese voice is actually speaking; 幺鸡 stays 幺鸡 in both. Voice never changes displayed text. *(#21)*
- **Bot calls name the seat** ("上家碰", "下家胡了"); the player's own calls say just the call. *(#17)*

## 8. Platform, storage, tests and workflow

**No server and no database.** Everything is in the browser's `localStorage`:

| Key | Holds |
|---|---|
| `mahjong_practice_career_stats_v1` | Career counters plus saved hands with move logs |
| `mahjong_ai_difficulty_v2` | Chosen difficulty |
| `mahjong_strict_hu` | Strict Hu on or off |
| `mahjong_voice_lang_v1` | 普 or 粤 |

- The match in progress is held in memory only, so a reload starts a new match. This is intended. *(confirmed 10-15)*
- Saved hand history is capped at the last 80 hands (`MAX_HISTORY_HANDS`). Each hand is about 52 KB against a browser limit of about 5 MB. Career counters are unaffected by the cap. *(#8)*

**Tests stay outside AI Studio.**
- `tsconfig.json` excludes `scripts/`, and the tests use Bun's built-in runner, so they add no dependencies.
- The CI workflow `.github/workflows/test.yml` runs `bun test scripts/` and `bun run lint` (`tsc --noEmit`) on pushes to `main` and on pull requests.
- CI only marks commits; it never blocks AI Studio.
- The install isn't frozen, because AI Studio edits `package.json` without updating `bun.lock`. *(#5)*

**What the tests guard (70 tests).** Never skip or weaken a test to get green.

| Suite | Guards |
|---|---|
| `scoring.test.ts` | Every official fan value and the points table, the exclusions and the 10-fan cap |
| `engine.test.ts` | Claim order, last discard, kongs and robbing, the false-win penalty, where the winning tile ends up |
| `guide.test.ts` | Fan-aware shanten against brute force, wait labels, ranking tie-breaks, one recommendation per tile kind |
| `fairness.test.ts` | Bots ignore hidden information |
| `danger.test.ts` | The danger model ignores hidden information and stays calibrated; the bot fingerprint |
| `simulation.test.ts` | Full 16-hand bot matches with zero rule violations |
| `voice.test.ts` | 普 is unchanged; 粤 is additive; 条/索/幺鸡 |

**Studies with re-run steps:** `docs/master-style-study.md` (style strength at Master) and `docs/danger-model.md` (fit and accuracy).

**Workflow.**
- Sync with `main` first, work on a branch, open a PR, and merge with a regular merge commit once CI is green.
- Claude settings, such as permission rules, stay out of the repo. They belong to the owner's own environment.
- There is no `CLAUDE.md`, so this log is not auto-loaded. Read it on purpose before making changes. *(10-15)*

## 9. Not supported, deferred and open

**Phones (landscape).** Investigated on 10-15 and dropped.
- The game runs, but the table scales to about 35% of its desktop size. Hand tiles end up 14–20 px wide and the claim buttons about 13 px tall.
- Making it usable would take 1–2 days; making it good, with a dedicated phone layout, would take 1–2 weeks.
- If revisited, gate every phone change behind `(pointer: coarse) and (max-height: 500px)` so desktop and iPad are untouched.

**Portrait** is not supported.

**Still open:** a "theoretically efficient" Expert bot. The first attempt failed (§3). The next options are a gated search on top of Master (a few hours of simulator time to validate) or a self-play learned policy (days of work). Ship one only if it clearly beats Master.

The other open items were settled on 10-15 and are recorded in their sections above.

**Hosting and sharing.**
- The app is published at `https://mahjong-by-rita.ai.studio`. The share button and the page's `og:url` point there; they previously pointed to a tinyurl short link. *(10-15)*
- It is a static site, so any static host could serve it. Rehosting was considered and not pursued.
