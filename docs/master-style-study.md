# Master difficulty: play-style study

How the four Master-level bot styles (速攻 speed, 大牌 big-hand, 稳健 steady, 防守 defensive) perform against each other under the TVB rules.

- **Run:** 2026-10-21, after the bots started planning with measured win chances and reading danger with the hints' model (commit `aaf1529`). Earlier runs are summarized under [Changes since earlier runs](#changes-since-earlier-runs).
- **Size:** 7,200 simulated matches, 115,200 hands.
- **Reproduce:** see [How to re-run](#how-to-re-run). Re-run after any change to `src/ai/` or `src/engine/`, since the numbers depend on the bot logic.

## Terms

- **Hand (局):** one deal, played until someone wins or the wall runs out.
- **Match (一整场):** 16 hands, the tournament format: East, South, West and North rounds of 4 hands each, dealer passing every hand, everyone starting at 0.
- **Points per match:** a player's **final score after all 16 hands**. Every result below is a 16-hand total.

## Summary

**Ranking (strongest first): 稳健 steady ≈ 防守 defensive > 速攻 speed > 大牌 big-hand.**

- **稳健 steady** leads the one-of-each table, beats big-hand, and is about even with speed and with defensive head-to-head.
- **防守 defensive** gained the most from the 10-21 upgrade. Its folds now follow real threats, so it deals in the least (2.2 per match) and still wins about as often as steady. It beats speed and big-hand head-to-head.
- **速攻 speed** still wins the most hands with the cheapest wins and calls the most, but it also deals in the most. It beats big-hand and loses to defensive.
- **大牌 big-hand** trails every other style by about 4–5 points per match head-to-head.

The gaps are a few points per match. A single 16-hand match swings by about ±90 points from luck, so these differences show up over many matches, not in any one.

## Method

- **Bots:** every seat is a Master bot (skill 0.8–1.0) of the stated style. Each match draws a fresh bot of that style from Master's normal parameter ranges (`src/ai/personas.ts`), so results cover the whole style rather than one parameter set.
- **Same deals:** every line-up plays the same shuffled walls (the deal depends only on the match number), so differences between line-ups come from the players.
- **Seats rotate** every match, since seat order matters for chi and dealing.
- **Scores** are average points per 16-hand match, with a ±95% margin of error. A gap smaller than the margins is effectively a tie. In tables with two players of a style, the two seats are averaged per match.
- **Counts per match** (wins, deal-ins, calls) are per 16 hands. Fan per win is the average fan of that style's wins.

## Results

### 1. One of each style (1,200 matches; 6.7% of hands drawn)

**Final results after 16 hands:**

| Style | Avg final score | Median | 1st | 2nd | 3rd | 4th | Ended positive | Reached +50 | −50 or worse | Middle 80% of scores |
|---|---|---|---|---|---|---|---|---|---|---|
| 稳健 steady | **+4.9** | 0 | **26.3%** | 27.0% | 23.5% | 23.3% | **47.7%** | **26.2%** | 24.8% | −85 to +100 |
| 防守 defensive | +1.6 | −5 | 24.9% | 26.4% | 26.9% | 21.8% | 45.9% | 24.9% | 24.8% | −85 to +95 |
| 速攻 speed | −1.5 | −10 | 24.2% | 24.5% | 24.6% | 26.8% | 43.8% | 24.1% | 26.2% | −90 to +100 |
| 大牌 big-hand | −5.0 | −10 | 24.6% | 22.2% | 25.0% | 28.2% | 41.9% | 22.3% | **30.9%** | −90 to +90 |

An even field would finish 1st 25% of the time; tied places are split evenly. Every table's four final scores sum to zero.

**Per-match play statistics:**

| Rank | Style | Points/match | Wins | Deal-ins | Fan per win | Self-draw share | Calls |
|---|---|---|---|---|---|---|---|
| 1 | 稳健 steady | **+4.9** ±4.2 | 3.85 | 2.38 | 1.92 | 34.3% | 24.2 |
| 2 | 防守 defensive | +1.6 ±4.1 | 3.67 | **2.19** | 1.90 | 32.4% | 22.3 |
| 3 | 速攻 speed | −1.5 ±4.3 | **4.02** | 2.73 | 1.83 | 34.9% | **32.6** |
| 4 | 大牌 big-hand | −5.0 ±4.3 | 3.40 | 2.57 | **2.05** | 34.2% | 24.4 |

**Who pays whom** (discard wins per match; row = payer, column = winner):

| Payer ↓ / Winner → | 速攻 | 大牌 | 稳健 | 防守 | Total |
|---|---|---|---|---|---|
| 速攻 speed | – | 0.89 | 0.93 | 0.91 | 2.73 |
| 大牌 big-hand | **0.99** | – | 0.80 | 0.78 | 2.57 |
| 稳健 steady | 0.87 | 0.72 | – | 0.78 | 2.38 |
| 防守 defensive | 0.76 | **0.62** | 0.80 | – | 2.19 |

### 2. Two against two (600 matches each; half with partners seated together, half alternating)

| Line-up | Result (first style's points/match) | Draws | Verdict |
|---|---|---|---|
| 2 稳健 vs 2 速攻 | 稳健 +1.2 ±3.4 | 4.2% | about even |
| 2 稳健 vs 2 大牌 | 稳健 +3.6 ±3.5 | 7.5% | **稳健** |
| 2 稳健 vs 2 防守 | 稳健 +0.2 ±3.4 | 8.4% | even |
| 2 速攻 vs 2 大牌 | 速攻 +4.5 ±3.4 | 4.4% | **速攻** |
| 2 速攻 vs 2 防守 | 速攻 −3.8 ±3.3 | 5.7% | **防守** |
| 2 大牌 vs 2 防守 | 大牌 −4.9 ±3.5 | 9.0% | **防守** |

Seating partners together or alternating made no reliable difference: every split was within its margin of error (about ±5).

### 3. One against three (400 matches each)

| Line-up | Lone player's points/match |
|---|---|
| 1 稳健 vs 3 大牌 | **+19.8** ±7.5 |
| 1 稳健 vs 3 速攻 | +5.2 ±6.7 |
| 1 稳健 vs 3 防守 | −5.0 ±7.3 |
| 1 速攻 vs 3 稳健 | −2.9 ±7.3 |
| 1 防守 vs 3 稳健 | −0.8 ±6.7 |
| 1 大牌 vs 3 稳健 | −5.0 ±7.7 |

## Interactions

- **Table pace depends on who's playing.** Speed players make hands finish: 2 稳健 + 2 速攻 drew only 4.2% of hands, while 2 大牌 + 2 防守 drew 9.0%.
- **Deal-ins are spread fairly evenly** (about 0.6–1.0 per match from each style to each other). The biggest flows are big-hand paying speed and speed paying steady. Defensive pays big-hand the least.
- **Calls:** speed calls about 2 times per hand, the others about 1.4–1.5.

## How the bots build their hands

Under the 1-fan minimum, a finished shape with no fan (for example chows plus a pung of a plain tile) can only win by self-draw. The bots aim for hands that can win on a discard: Common Hand (all chows, any pair), a value triplet (dragons, seat or prevailing wind), flushes or all pungs. They accept a self-draw-only shape only when it's clearly better, usually late in the hand.

Where Master wins' fan comes from (200 matches, 3,026 wins; a win can have several): Common Hand 48%, a dragon pung 26%, a seat-wind pung 9%, a prevailing-wind pung 9%, all pungs 9%, half flush 9%, full flush 1.6%. Self-draw is part of 33% of wins.

## Changes since earlier runs

### 2026-10-21: measured win chances and the shared danger model

The bots now value a hand that isn't ready by how often such hands really win, and judge danger with the model behind the hints (see `docs/decisions.md` §3). One new bot against three bots of the previous run scored +23.3 ± 1.7 points per match on identical deals (400 matches).

| One of each style | 2026-10-05 run | Now |
|---|---|---|
| 稳健 steady | +2.0 | +4.9 |
| 防守 defensive | −5.2 | +1.6 |
| 速攻 speed | +5.1 | −1.5 |
| 大牌 big-hand | −1.9 | −5.0 |
| Hands drawn | 10.8% | 6.7% |

Defensive gained the most: it still deals in the least (2.19 per match) and now wins about as often as steady (3.67 against 3.85). Speed lost its lead; it now deals in the most (2.73 per match).

### 2026-10-05: fan-aware hand building

The first run of this study (on `f89965b`) used bots that counted plain shape distance. They often got ready on hands that could only win by self-draw, mostly after ponging a plain tile while holding chows. Fan-aware hand building changed that:

| | First run | 2026-10-05 run |
|---|---|---|
| Ready but self-draw only | 16.6% of the times a bot was ready | 0.6% |
| Wins whose only fan is self-draw | 6.0% | 0.8% |
| One new bot vs three old ones, same deals (2,400 matches) | | about +4 points per match |

It also changed the standings. The old ranking was 稳健 steady ≈ 速攻 speed > 防守 defensive > 大牌 big-hand, with big-hand at −9.4 points per match in the one-of-each line-up. Big-hand gained the most (to −1.9), since its slow hands had been the most likely to end up with no fan.

## Practice notes

- A Master table draws its styles about 42% steady, 25% speed, 25% big-hand and 8% defensive (`FIELDS.master` in `src/ai/personas.ts`). Most tables are steady and speed, the two styles that win the most.
- Speed opponents still take the most wins, about 4 per match, and big-hand pays them the most. They also deal in the most.
- Defensive opponents rarely deal in, so don't count on them to feed you; beat them on speed.
- Against steady and speed, small edges decide matches: deal-in avoidance and taking value when the hand offers it.

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
