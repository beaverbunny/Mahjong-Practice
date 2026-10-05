import React from 'react';
import { RoundResult, TurnActionLog, Tile, TileType, Wind } from '../types/mahjong';
import { sortTiles } from '../utils/mahjongTiles';
import { evaluateWin } from '../utils/rulesEngine';
import { createHypotheticalTile } from '../utils/strategyEngine';
import { isWinningShape } from '../engine/table';
import { ALL_TILE_TYPES } from '../engine/shanten';
import { seatLabel, LEVELS } from '../analysis/danger';
import { MahjongTile } from './MahjongTile';
import { ShieldAlert } from 'lucide-react';

interface DangerReviewProps {
  result: RoundResult;
  playerNames: string[];
  seatWinds: Wind[];
}

const pctText = (p: number) => (p < 0.1 ? `${(100 * p).toFixed(1)}%` : `${Math.round(100 * p)}%`);
// An opponent counts as a clear threat from this readiness on
const THREAT_READY = 0.35;

// Tiles a player could win on from a discard with this final hand (the hand is over, so this is shown)
function actualWaits(hand: Tile[], melds: RoundResult['handSnapshots'][number]['melds'], prevailingWind: Wind, seatWind: Wind): TileType[] {
  if (hand.length + melds.length * 3 !== 13) return [];
  return ALL_TILE_TYPES.filter((type) => {
    const hypo = createHypotheticalTile(type);
    if (!isWinningShape([...hand, hypo], melds)) return false;
    return evaluateWin(hand, melds, hypo, { isSelfDraw: false, prevailingWind, seatWind }).isWin;
  });
}

export const DangerReview: React.FC<DangerReviewProps> = ({ result, playerNames, seatWinds }) => {
  // The human's discards with the danger read taken at that moment
  const discards = result.actionLogs
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e.playerIndex === 0 && e.action === 'discard' && e.danger && e.tile) as {
    e: TurnActionLog & { danger: NonNullable<TurnActionLog['danger']>; tile: Tile };
    i: number;
  }[];
  if (discards.length === 0) return null;

  // Which discard (if any) dealt in: the human's last discard when they paid for a discard win
  const lastIdx = discards[discards.length - 1].i;
  const dealtIn = result.discarderIndex === 0 && !result.isSelfDraw && result.winningTile
    ? discards.find(({ e, i }) => i === lastIdx && e.tile.type === result.winningTile!.type)
    : undefined;

  const risky = discards.filter(({ e }) => e.danger.pct >= LEVELS.medium || e === dealtIn?.e);
  // Chance of dealing in at least once over the hand, at the risk each discard carried
  const dealInChance = 1 - discards.reduce((a, { e }) => a * (1 - e.danger.pct), 1);
  const expectedLoss = discards.reduce((a, { e }) => a + e.danger.expectedLoss, 0);
  const hintsUsed = discards.filter(({ e }) => e.danger.hintsOn).length;

  // When the table first turned dangerous (as read at the human's turns)
  let turned: { n: number; seat: number; pReady: number; reasons: string[] } | null = null;
  discards.forEach(({ e }, n) => {
    if (turned) return;
    const top = [...e.danger.opponents].sort((a, b) => b.pReady - a.pReady)[0];
    if (top && top.pReady >= THREAT_READY) turned = { n: n + 1, seat: top.seat, pReady: top.pReady, reasons: top.reasons };
  });
  const turnedAt = turned as { n: number; seat: number; pReady: number; reasons: string[] } | null;

  const lastRead = discards[discards.length - 1].e.danger.opponents;

  return (
    <div className="p-3.5 bg-stone-950/70 rounded-xl border border-stone-800 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold text-stone-100 text-xs flex items-center gap-1.5">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          <span>放铳风险复盘</span>
        </div>
        <span className="text-[10px] text-stone-500">只用当时您能看到的信息</span>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2 rounded-lg bg-stone-900/70 border border-stone-800">
          <div className="text-[10px] text-stone-400">风险牌</div>
          <div className="font-mono font-bold text-sm text-amber-300">
            {discards.filter(({ e }) => e.danger.level === 'danger').length}
            <span className="text-stone-500 font-normal"> 危 / </span>
            {discards.filter(({ e }) => e.danger.level === 'medium').length}
            <span className="text-stone-500 font-normal"> 中</span>
          </div>
          <div className="text-[9px] text-stone-500">共打 {discards.length} 张</div>
        </div>
        <div className="p-2 rounded-lg bg-stone-900/70 border border-stone-800">
          <div className="text-[10px] text-stone-400">累计放铳概率</div>
          <div className="font-mono font-bold text-sm text-amber-300">{pctText(dealInChance)}</div>
          <div className="text-[9px] text-stone-500">期望失分 {expectedLoss.toFixed(1)} 点</div>
        </div>
        <div
          className={`p-2 rounded-lg border ${dealtIn ? 'bg-rose-950/40 border-rose-800' : 'bg-stone-900/70 border-stone-800'}`}
        >
          <div className="text-[10px] text-stone-400">结果</div>
          <div className={`font-bold text-sm ${dealtIn ? 'text-rose-300' : 'text-emerald-300'}`}>
            {dealtIn ? '放铳' : '未放铳'}
          </div>
          <div className="text-[9px] text-stone-500">
            {hintsUsed === 0 ? '全程未开提示' : hintsUsed === discards.length ? '全程开着提示' : `${hintsUsed} 张时开着提示`}
          </div>
        </div>
      </div>

      {/* When it turned dangerous */}
      <div className="text-[11px] leading-relaxed text-stone-300">
        {turnedAt ? (
          <>
            <span className="font-semibold text-amber-300">牌局转危：</span>
            您第 {turnedAt.n} 次出牌时，{seatLabel(0, turnedAt.seat)}听牌可能已到 {pctText(turnedAt.pReady)}
            {turnedAt.reasons.length > 0 && <span className="text-stone-400">（{turnedAt.reasons.join('，')}）</span>}
            。从这里起要开始数安全牌。
          </>
        ) : (
          <span className="text-stone-400">您出牌时没有对手明显听牌（都低于 {Math.round(THREAT_READY * 100)}%）。</span>
        )}
      </div>

      {/* Risky discards */}
      {risky.length > 0 ? (
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-stone-200">
            风险出牌（放铳率 ≥ {Math.round(LEVELS.medium * 100)}%）：
          </div>
          {risky.map(({ e, i }) => {
            const d = e.danger;
            const n = discards.findIndex((x) => x.i === i) + 1;
            const top = [...d.bySeat].sort((a, b) => b.pct - a.pct)[0];
            const isDealIn = e === dealtIn?.e;
            const saferBy = d.pct - d.safest.pct;
            return (
              <div
                key={i}
                className={`p-2 rounded-lg border flex gap-2 ${
                  isDealIn ? 'bg-rose-950/40 border-rose-700' : 'bg-stone-900/60 border-stone-800'
                }`}
              >
                <MahjongTile tile={e.tile} size="xs" safetyLevel={d.level} />
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                    <span className="text-stone-400">第 {n} 张</span>
                    <span className="font-semibold text-stone-100">{e.tile.displayName}</span>
                    <span
                      className={`font-mono font-bold ${d.level === 'danger' ? 'text-rose-300' : 'text-amber-300'}`}
                    >
                      {pctText(d.pct)}
                    </span>
                    {top && (
                      <span className="text-stone-400">
                        主要危险：{seatLabel(0, top.seat)}（若放铳 ≈{top.fan.toFixed(1)} 番，{Math.round(top.fan * 10)} 点）
                      </span>
                    )}
                    {isDealIn ? (
                      <span className="px-1 rounded bg-rose-800 text-rose-100 text-[10px] font-bold">放铳</span>
                    ) : (
                      <span className="px-1 rounded bg-stone-800 text-stone-400 text-[10px]">安全通过</span>
                    )}
                    {!d.hintsOn && <span className="px-1 rounded bg-stone-800 text-stone-400 text-[10px]">未开提示</span>}
                  </div>
                  {d.reasons.length > 0 && <div className="text-[10px] text-stone-400">{d.reasons.join('；')}</div>}
                  <div className="text-[10px] text-stone-500">
                    {saferBy > 0.005 && d.safest.type !== e.tile.type
                      ? `当时最安全：${d.safest.displayName}（${pctText(d.safest.pct)}）`
                      : '当时没有明显更安全的牌'}
                  </div>
                </div>
              </div>
            );
          })}
          {dealtIn && (
            <p className="text-[11px] leading-relaxed text-stone-300">
              {dealtIn.e.danger.pct < LEVELS.medium
                ? `这次放铳的牌当时风险只有 ${pctText(dealtIn.e.danger.pct)}，属于运气不好，不是读牌失误。`
                : dealtIn.e.danger.pct - dealtIn.e.danger.safest.pct > 0.02
                ? `这张牌当时风险 ${pctText(dealtIn.e.danger.pct)}，而${dealtIn.e.danger.safest.displayName}只有 ${pctText(dealtIn.e.danger.safest.pct)}。如果手牌不值得冒这个险，应当换打安全牌。`
                : `这张牌当时风险 ${pctText(dealtIn.e.danger.pct)}，但手里也没有明显更安全的牌。`}
            </p>
          )}
          <p className="text-[10px] text-stone-500 leading-relaxed">
            危险牌不一定是错：手牌够大、离和牌够近时推进是对的。这里只量风险，值不值得由您判断。
          </p>
        </div>
      ) : (
        <div className="text-[11px] text-emerald-300/90">本局没有打出放铳率 ≥ {Math.round(LEVELS.medium * 100)}% 的牌。</div>
      )}

      {/* Read vs reality */}
      <div className="space-y-1.5">
        <div className="text-[11px] font-semibold text-stone-200">读牌 vs 实际（您最后一次出牌时的判断 / 局终手牌）：</div>
        {lastRead.map((op) => {
          const snap = result.handSnapshots[op.seat];
          if (!snap) return null;
          const isWinner = result.winnerIndex === op.seat;
          const waits = isWinner ? [] : actualWaits(snap.hand, snap.melds, result.prevailingWind, seatWinds[op.seat]);
          return (
            <div key={op.seat} className="p-2 rounded-lg bg-stone-900/60 border border-stone-800 space-y-1">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="font-semibold text-stone-200">
                  {seatLabel(0, op.seat)} <span className="text-stone-500 font-normal">{playerNames[op.seat]}</span>
                </span>
                <span className="text-stone-400">
                  判断：听牌 {pctText(op.pReady)} · ≈{op.fan.toFixed(1)} 番
                  <span className="mx-1 text-stone-600">|</span>
                  实际：
                  {isWinner ? (
                    <span className="text-amber-300 font-semibold">和牌 {result.totalFan} 番</span>
                  ) : waits.length > 0 ? (
                    <span className="text-rose-300 font-semibold">听 {waits.length} 种</span>
                  ) : (
                    <span className="text-emerald-300">未听（或无番不能食糊）</span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {snap.melds.map((m) => (
                  <div key={m.id} className="flex gap-px p-px rounded bg-stone-800/80">
                    {m.tiles.map((t) => (
                      <MahjongTile key={t.id} tile={t} size="xs" />
                    ))}
                  </div>
                ))}
                <div className="flex gap-px">
                  {sortTiles(snap.hand).map((t) => (
                    <MahjongTile key={t.id} tile={t} size="xs" />
                  ))}
                </div>
                {waits.length > 0 && (
                  <div className="flex items-center gap-px ml-1 p-px rounded bg-rose-950/60 border border-rose-800">
                    <span className="text-[9px] text-rose-200 px-1">等</span>
                    {waits.map((w) => (
                      <MahjongTile key={w} tile={{ type: w }} size="xs" />
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
