# Master difficulty: play-style study

How the four Master-level bot styles (速攻 speed, 大牌 big-hand, 稳健 steady, 防守 defensive) perform against each other under the TVB rules.

- **Run:** 2026-10-05, after the bots learned fan-aware hand building (commit `0f601b4`). The first run (before it, on `f89965b`) is summarized under [Changes since the first run](#changes-since-the-first-run).
- **Size:** 7,200 simulated matches, 115,200 hands.
- **Reproduce:** see [How to re-run](#how-to-re-run). Re-run after any change to `src/ai/` or `src/engine/`, since the numbers depend on the bot logic.

## Terms

- **Hand (局):** one deal, played until someone wins or the wall runs out.
- **Match (一整场):** 16 hands, the tournament format: East, South, West and North rounds of 4 hands each, dealer passing every hand, everyone starting at 0.
- **Points per match:** a player's **final score after all 16 hands**. Every result below is a 16-hand total.

## Summary

**Ranking (strongest first): 稳健 steady ≈ 速攻 speed > 防守 defensive ≈ 大牌 big-hand.**

- **稳健 steady** beats big-hand clearly and defensive narrowly, and is about even with speed (each wins one of the two head-to-head line-ups by a few points).
- **速攻 speed** wins the most hands with the cheapest wins. It beats both slow styles.
- **防守 defensive** deals in the least, but folding costs it wins. It is about even with big-hand.
- **大牌 big-hand** still trails steady and speed by 6–8 points per match head-to-head, but much less than before (see below): it no longer wastes hands on shapes that can only win by self-draw.

The gaps are a few points per match. A single 16-hand match swings by about ±90 points from luck, so these differences show up over many matches, not in any one.

## Method

- **Bots:** every seat is a Master bot (skill 0.8–1.0) of the stated style. Each match draws a fresh bot of that style from Master's normal parameter ranges (`src/ai/personas.ts`), so results cover the whole style rather than one parameter set.
- **Same deals:** every line-up plays the same shuffled walls (the deal depends only on the match number), so differences between line-ups come from the players.
- **Seats rotate** every match, since seat order matters for chi and dealing.
- **Scores** are average points per 16-hand match, with a ±95% margin of error. A gap smaller than the margins is effectively a tie. In tables with two players of a style, the two seats are averaged per match.
- **Counts per match** (wins, deal-ins, calls) are per 16 hands. Fan per win is the average fan of that style's wins.

## Results

### 1. One of each style (1,200 matches; 10.8% of hands drawn)

**Final results after 16 hands:**

| Style | Avg final score | Median | 1st | 2nd | 3rd | 4th | Ended positive | Reached +50 | −50 or worse | Middle 80% of scores |
|---|---|---|---|---|---|---|---|---|---|---|
| 速攻 speed | **+5.1** | 0 | **27.2%** | 26.6% | 23.3% | 22.9% | **49.2%** | **26.8%** | 23.8% | −85 to +100 |
| 稳健 steady | +2.0 | 0 | 26.2% | 25.7% | 23.1% | 25.1% | 45.7% | 24.8% | 24.3% | −90 to +95 |
| 大牌 big-hand | −1.9 | −10 | 26.0% | 21.2% | 24.0% | 28.7% | 42.8% | 24.2% | **28.2%** | −95 to +100 |
| 防守 defensive | −5.2 | −10 | 20.6% | 26.5% | 29.6% | 23.3% | 42.4% | 19.0% | 25.5% | −85 to +75 |

An even field would finish 1st 25% of the time. Every table's four final scores sum to zero.

**Per-match play statistics:**

| Rank | Style | Points/match | Wins | Deal-ins | Fan per win | Self-draw share | Calls |
|---|---|---|---|---|---|---|---|
| 1 | 速攻 speed | **+5.1** ±4.1 | **4.07** | 2.57 | 1.83 | 28.2% | **31.8** |
| 2 | 稳健 steady | +2.0 ±4.1 | 3.63 | 2.62 | 1.95 | 28.9% | 23.3 |
| 3 | 大牌 big-hand | −1.9 ±4.3 | 3.25 | 2.67 | **2.09** | 29.0% | 23.5 |
| 4 | 防守 defensive | −5.2 ±3.7 | 3.33 | **2.37** | 1.88 | 27.4% | 20.8 |

**Who pays whom** (discard wins per match; row = payer, column = winner):

| Payer ↓ / Winner → | 速攻 | 大牌 | 稳健 | 防守 | Total |
|---|---|---|---|---|---|
| 速攻 speed | – | 0.80 | 0.91 | 0.86 | 2.57 |
| 大牌 big-hand | **1.03** | – | 0.88 | 0.77 | 2.67 |
| 稳健 steady | 1.02 | 0.81 | – | 0.79 | 2.62 |
| 防守 defensive | 0.87 | **0.70** | 0.79 | – | 2.37 |

### 2. Two against two (600 matches each; half with partners seated together, half alternating)

| Line-up | Result (first style's points/match) | Draws | Verdict |
|---|---|---|---|
| 2 稳健 vs 2 速攻 | 稳健 +2.9 ±3.1 | 7.5% | about even (稳健 slightly) |
| 2 稳健 vs 2 大牌 | 稳健 +8.1 ±3.3 | 11.6% | **稳健** |
| 2 稳健 vs 2 防守 | 稳健 +3.9 ±3.3 | 12.4% | 稳健 |
| 2 速攻 vs 2 大牌 | 速攻 +6.4 ±3.2 | 8.9% | **速攻** |
| 2 速攻 vs 2 防守 | 速攻 +3.8 ±3.1 | 9.6% | 速攻 |
| 2 大牌 vs 2 防守 | 大牌 −3.5 ±3.2 | 14.4% | 防守, slightly |

Seating partners together or alternating made no reliable difference, except big-hand vs defensive (big-hand −7.6 ±4.5 alternating, +0.6 ±4.6 together).

### 3. One against three (400 matches each)

| Line-up | Lone player's points/match |
|---|---|
| 1 稳健 vs 3 大牌 | **+14.0** ±8.0 |
| 1 稳健 vs 3 速攻 | −3.2 ±6.2 |
| 1 稳健 vs 3 防守 | +6.2 ±6.8 |
| 1 速攻 vs 3 稳健 | +6.5 ±6.7 |
| 1 防守 vs 3 稳健 | −5.5 ±6.8 |
| 1 大牌 vs 3 稳健 | **−8.1** ±6.6 |

## Interactions

- **Table pace depends on who's playing.** Speed players make hands finish: 2 稳健 + 2 速攻 drew only 7.5% of hands, while 2 大牌 + 2 防守 drew 14.4%.
- **Deal-ins are spread fairly evenly** (about 0.7–1.0 per match from each style to each other). The biggest flows are big-hand and steady paying speed. Defensive pays big-hand the least.
- **Calls:** speed calls about 2 times per hand, the others about 1.3–1.5.

## How the bots build their hands

Under the 1-fan minimum, a finished shape with no fan (for example chows plus a pung of a plain tile) can only win by self-draw. The bots aim for hands that can win on a discard: Common Hand (all chows, any pair), a value triplet (dragons, seat or prevailing wind), flushes or all pungs. They accept a self-draw-only shape only when it's clearly better, usually late in the hand.

Where Master wins' fan comes from (200 matches, all styles similar): Common Hand about 56%, value pung about 22%, all pungs about 11%, half flush about 7%, full flush about 1.5%. Self-draw is part of about 28% of wins, but the only fan in under 1%.

## Changes since the first run

The first run of this study (on `f89965b`) used bots that counted plain shape distance. They often got ready on hands that could only win by self-draw, mostly after ponging a plain tile while holding chows. Fan-aware hand building changed that:

| | First run | Now |
|---|---|---|
| Ready but self-draw only | 16.6% of the times a bot was ready | 0.6% |
| Wins whose only fan is self-draw | 6.0% | 0.8% |
| One new bot vs three old ones, same deals (2,400 matches) | | about +4 points per match |

It also changed the standings. The old ranking was 稳健 steady ≈ 速攻 speed > 防守 defensive > 大牌 big-hand, with big-hand at −9.4 points per match in the one-of-each line-up. Big-hand gained the most (now −1.9), since its slow hands had been the most likely to end up with no fan.

## Practice notes

- A Master table currently draws its styles about 33% steady, 25% speed, 25% big-hand, 17% defensive (`FIELDS.master` in `src/ai/personas.ts`). The toughest tables are mostly steady and speed.
- Speed opponents are the ones to beat for wins: they take about 4 per match. Big-hand and steady pay them the most.
- Against steady and speed, small edges decide matches: deal-in avoidance and taking value when the hand offers it.

## Caveats

- These are this app's bot versions of each style. The study shows which strategy works best under these rules and this bot model, not measured behaviour of real human players.
- Earlier tuning showed all reasonable heuristic settings land within a few points of each other against a Master table, so style differences are real but modest.

## How to re-run

Takes about 15 minutes on 4 cores. Run from the repo root:

```bash
mkdir -p style-study-runs
{
  for st in 0 300 600 900; do echo "SVBD 300 $st"; done
  for p in BS BV BD SV SD VD; do a=${p:0:1}; b=${p:1:1}; echo "$a$b$a$b 300 0"; echo "$a$a$b$b 300 300"; done
  for x in S V D; do echo "B$x$x$x 400 0"; echo "${x}BBB 400 0"; done
} | xargs -P 4 -L 1 sh -c 'bun scripts/style-study.ts "$0" "$1" "$2" > style-study-runs/$0_$2.json'
python3 scripts/style-study-report.py style-study-runs
```

Line-up letters: S speed, V big-hand (value), B steady (balanced), D defensive. The report expects all line-ups above to be present. `style-study-runs/` is git-ignored.
