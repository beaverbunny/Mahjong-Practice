# Master difficulty: play-style study

How the four Master-level bot styles (速攻 speed, 大牌 big-hand, 稳健 steady, 防守 defensive) perform against each other under the TVB rules.

- **Run:** 2026-10-05, on engine commit `f89965b` (after PR #6).
- **Size:** 7,200 simulated matches, 115,200 hands.
- **Reproduce:** see [How to re-run](#how-to-re-run). Re-run after any change to `src/ai/` or `src/engine/`, since the numbers depend on the bot logic.

## Summary

**Ranking (strongest first): 稳健 steady ≈ 速攻 speed > 防守 defensive > 大牌 big-hand.**

- **稳健 steady** never lost in any line-up. It wins almost as often as speed, but its wins are worth more and it deals in less.
- **速攻 speed** wins the most hands with the cheapest wins. It beats the slow styles clearly and is about even with steady head-to-head.
- **防守 defensive** deals in the least, but folding costs it about half a win per match, which outweighs the savings.
- **大牌 big-hand** is clearly weakest. It gives up about 0.7–0.9 wins per match to steady and speed for only about 0.1–0.2 extra fan per win, and it deals in the most. TVB points are linear (a 3-fan hand pays exactly three 1-fan hands), so chasing value this hard doesn't pay.

The gaps are a few points per match. A single 16-hand match swings by about ±75 points from luck, so these differences show up over many matches, not in any one.

## Method

- **Bots:** every seat is a Master bot (skill 0.8–1.0) of the stated style. Each match draws a fresh bot of that style from Master's normal parameter ranges (`src/ai/personas.ts`), so results cover the whole style rather than one parameter set.
- **Same deals:** every line-up plays the same shuffled walls (the deal depends only on the match number), so differences between line-ups come from the players.
- **Seats rotate** every match, since seat order matters for chi and dealing.
- **Scores** are average points per 16-hand match, with a ±95% margin of error. A gap smaller than the margins is effectively a tie. In tables with two players of a style, the two seats are averaged per match.
- **Counts per match** (wins, deal-ins, calls) are per 16 hands. Fan per win is the average fan of that style's wins.

## Results

### 1. One of each style (1,200 matches; 10.2% of hands drawn)

| Rank | Style | Points/match | Wins | Deal-ins | Fan per win | Self-draw share | Calls |
|---|---|---|---|---|---|---|---|
| 1 | 稳健 steady | **+10.5** ±4.1 | 3.86 | 2.32 | 1.93 | 34.4% | 23.6 |
| 2 | 速攻 speed | +3.8 ±4.1 | **4.04** | 2.45 | 1.79 | 35.2% | **31.9** |
| 3 | 防守 defensive | −4.9 ±3.7 | 3.36 | **2.26** | 1.85 | 32.5% | 20.9 |
| 4 | 大牌 big-hand | **−9.4** ±3.9 | 3.12 | 2.51 | **2.02** | 32.1% | 23.8 |

**Who pays whom** (discard wins per match; row = payer, column = winner):

| Payer ↓ / Winner → | 速攻 | 大牌 | 稳健 | 防守 | Total |
|---|---|---|---|---|---|
| 速攻 speed | – | 0.73 | 0.88 | 0.85 | 2.45 |
| 大牌 big-hand | **0.92** | – | 0.83 | 0.75 | 2.51 |
| 稳健 steady | 0.89 | 0.76 | – | 0.67 | 2.32 |
| 防守 defensive | 0.80 | **0.64** | 0.82 | – | 2.26 |

### 2. Two against two (600 matches each; half with partners seated together, half alternating)

| Line-up | Result (first style's points/match) | Draws | Verdict |
|---|---|---|---|
| 2 稳健 vs 2 速攻 | 稳健 +1.7 ±3.0 | 6.7% | about even |
| 2 稳健 vs 2 大牌 | 稳健 +8.9 ±3.4 | 11.7% | **稳健** |
| 2 稳健 vs 2 防守 | 稳健 +3.0 ±3.0 | 12.3% | 稳健, slightly |
| 2 速攻 vs 2 大牌 | 速攻 +8.6 ±3.3 | 7.9% | **速攻** |
| 2 速攻 vs 2 防守 | 速攻 +3.5 ±3.2 | 8.8% | 速攻, slightly |
| 2 大牌 vs 2 防守 | 大牌 −3.5 ±3.5 | 14.3% | 防守, slightly |

Seating partners together or alternating made no reliable difference (all splits within their margins).

### 3. One against three (400 matches each)

| Line-up | Lone player's points/match |
|---|---|
| 1 稳健 vs 3 大牌 | **+14.2** ±7.1 |
| 1 稳健 vs 3 速攻 | +6.0 ±6.6 |
| 1 稳健 vs 3 防守 | +3.8 ±6.7 |
| 1 速攻 vs 3 稳健 | +2.9 ±6.5 |
| 1 防守 vs 3 稳健 | +4.1 ±6.7 |
| 1 大牌 vs 3 稳健 | **−7.2** ±6.6 |

## Interactions

- **Table pace depends on who's playing.** Speed players make hands finish: 2 稳健 + 2 速攻 drew only 6.7% of hands, while 2 大牌 + 2 防守 drew 14.3%.
- **Deal-ins are spread fairly evenly** (about 0.65–0.9 per match from each style to each other). The biggest flow is big-hand paying speed. Defensive pays big-hand the least.
- **Calls:** speed calls about 2 times per hand, the others about 1.3–1.5.

## Practice notes

- A Master table currently draws its styles about 33% steady, 25% speed, 25% big-hand, 17% defensive (`FIELDS.master` in `src/ai/personas.ts`). The toughest tables are mostly steady and speed.
- Big-hand opponents are the most exploitable: they deal in the most. Watch their melds for flush and value-tile threats.
- Against steady and speed, small edges decide matches: deal-in avoidance and taking value when the hand offers it.

## Caveats

- These are this app's bot versions of each style. The study shows which strategy works best under these rules and this bot model, not measured behaviour of real human players.
- Earlier tuning showed all reasonable heuristic settings land within a few points of each other against a Master table, so style differences are real but modest.

## How to re-run

Takes about 8 minutes on 4 cores. Run from the repo root:

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
