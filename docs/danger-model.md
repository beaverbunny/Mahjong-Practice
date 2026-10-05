# Deal-in danger model (for the human player)

The strategy panel's tile tags (安/中/危 with a %), its opponent reads and the post-hand **放铳风险复盘** review all come from one model: `src/analysis/danger.ts`. The bots don't use it; their play is unchanged.

## What it looks at

Only what a player at the real table can see (`publicView`):

- each opponent's discards **in order**, and whether each was the tile just drawn (摸切) or came from the hand (手切);
- their calls (chi, pung, kong) and the tiles they claimed;
- every visible tile (rivers, melds, your own hand) and the tiles left in the wall.

A test (`scripts/danger.test.ts`) redraws every hidden tile (opponents' hands and the wall) at hundreds of points in real games and checks that the read never changes.

## What it estimates

Per opponent:

- **Ready (听牌 %):** the chance they can win on a discard right now. Signals: number of calls, how many tiles they've discarded, recent from-hand discards (still building) vs a run of drawn-and-discarded tiles (waiting), middle tiles from the hand late, a sudden from-hand discard after drawn discards, value-tile pungs (their hand already has fan).
- **Which tiles they wait on:** tile type (honor, terminal, 2/8, 3/7, 4–6), copies still unseen, genbutsu, **tiles that went past since their hand last changed** (they didn't win on it), suji, walls, flush reads from melds and discards, all-pung hands, closeness to their latest from-hand discard, early discards near the tile.
- **Cost (≈ 番):** the likely fan if you deal in, from their melds (value pungs, flush, all pungs). A discard win costs 10 points per fan.

A tile's danger is the chance it wins for at least one opponent. Tags: **安** under 3%, **中** 3–8%, **危** 8% and up.

## How it was fitted and checked

The weights in `src/analysis/dangerModel.ts` were fitted on 300 simulated Master matches (bots playing normally; re-fitted after the bots learned fan-aware hand building), where the hidden hands are known, then checked on 100 different matches:

| Check | Result |
|---|---|
| Ranking dangerous tiles (AUC; 0.5 = coin flip) | **0.871** (the old tile-only labels: 0.585) |
| Ranking ready opponents (AUC) | 0.845 |
| Tiles tagged 安 | 79% of tiles; 0.5% dealt in |
| Tiles tagged 中 | 16% of tiles; 5% dealt in |
| Tiles tagged 危 | 5% of tiles; 12% dealt in |

The percentages are calibrated: tiles rated about 4% dealt in about 3.8% of the time, and opponents read as about 15% ready were ready about 15% of the time.

What the fit found, for these bots:

- **A tile that went past an opponent since their hand last changed is by far the safest tile.** Bots always take a legal win; humans almost always do too.
- Genbutsu is next. These rules have no furiten, so it's safe-ish, not guaranteed.
- Suji helps a little; half-suji and the off-suit of a flush read barely matter here.
- 3–7 tiles with most copies unseen are the riskiest. A live value honor (yours or theirs, dragons) is about as risky as a live terminal; a live plain wind is safer than either.
- Tiles next to an opponent's latest from-hand discard, and suits they've almost stopped discarding, are riskier.

## Caveats

- It is fitted to this app's bots. Real opponents may differ (bluffing, reading you back), though the core signals are the standard ones.
- It measures danger only. Whether a risky discard is worth it depends on your own hand, which is your call.

## How to re-run

Re-fit after changing the features in `danger.ts`, the bots or the rules:

```bash
bun scripts/danger-calibrate.ts 300 0 --write   # fit on 300 matches, rewrite dangerModel.ts (~2 min)
bun scripts/danger-calibrate.ts 0 100           # check on 100 other matches
bun test scripts/                               # the accuracy test must still pass
```
