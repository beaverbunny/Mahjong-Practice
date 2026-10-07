import React from 'react';
import {
  Tile,
  Meld,
  RoundResult,
  GameStats,
  DiscardRecommendation,
  TenpaiWait,
  DifficultyLevel,
  TurnActionLog,
  DiscardDangerRecord,
} from './types/mahjong';
import { publicView, readDanger, DangerRead } from './analysis/danger';
import { getTileNameByType } from './utils/mahjongTiles';
import {
  analyzeShanten,
  generateDiscardRecommendations,
  calculateTenpaiWaits,
  analyzeTurnBlunder,
} from './utils/strategyEngine';
import {
  TableState,
  HANDS_PER_MATCH,
  FALSE_WIN_PENALTY_EACH,
  dealHand,
  getTurnOptions,
  getClaimOptions,
  playersWithClaimOptions,
  resolveClaims,
  declareSelfDraw,
  declareKong,
  discard,
  ClaimDecision,
  KongCandidate,
} from './engine/table';
import { decideTurn, decideClaim } from './ai/brain';
import { Persona, samplePersonas, STYLE_LABELS, getBotPlayerName } from './ai/personas';
import { soundManager, getTileSpokenName } from './utils/audio';
import { GameBoard } from './components/GameBoard';
import { StrategyPanel } from './components/StrategyPanel';
import { RoundResultModal } from './components/RoundResultModal';
import { GameReviewModal } from './components/GameReviewModal';
import { RulesReferenceModal } from './components/RulesReferenceModal';
import { StatisticsModal } from './components/StatisticsModal';
import { PracticeDrillsModal } from './components/PracticeDrillsModal';
import { DifficultyModal } from './components/DifficultyModal';
import {
  Volume2,
  VolumeX,
  BookOpen,
  BarChart3,
  GraduationCap,
  Sparkles,
  RotateCcw,
  Trophy,
  Bot,
  FileSearch,
  ShieldCheck,
  X,
  Share2,
  Eye,
  Award,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Minimize2,
  Maximize2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { FULL_VERSION_STRING, APP_VERSION } from './version';

export { APP_VERSION };

const STORAGE_KEY_STATS = 'mahjong_practice_career_stats_v1';
// Keep the replay history to the most recent hands so browser storage (about 5 MB) never fills up.
// Career totals are counters and are unaffected.
const MAX_HISTORY_HANDS = 80;
const DIFFICULTIES: DifficultyLevel[] = ['tournament', 'beginner', 'intermediate', 'master'];

type GangOption = { type: 'ming_gang' | 'an_gang' | 'bu_gang'; tiles: Tile[]; meld?: Meld };

// Simple visible threat flag (2+ exposed melds), for the fallback tile labeler
const visibleThreats = (t: TableState, viewer: number) =>
  t.players.map((p, i) => i !== viewer && p.melds.length >= 2);

const visibleTilesFor = (t: TableState, viewer: number): Tile[] => [
  ...t.players.flatMap((p) => [...p.discards, ...p.melds.flatMap((m) => m.tiles)]),
  ...t.players[viewer].hand,
];

export default function App() {
  // Table state: every rule lives in the engine (src/engine/table.ts)
  const [table, setTable] = React.useState<TableState | null>(null);
  const [isGameOver16, setIsGameOver16] = React.useState(false);
  const [selectedTile, setSelectedTile] = React.useState<Tile | null>(null);
  // Own-turn Hu/Kong buttons the human dismissed with Pass (until the table changes)
  const [dismissedTurnFor, setDismissedTurnFor] = React.useState<TableState | null>(null);

  // Modals & Panels
  const [isStrategyPanelOpen, setIsStrategyPanelOpen] = React.useState(true);
  const [activeRoundResult, setActiveRoundResult] = React.useState<RoundResult | null>(null);
  const [reviewRoundResult, setReviewRoundResult] = React.useState<RoundResult | null>(null);
  const [showRoundResultModal, setShowRoundResultModal] = React.useState(true);
  const [isInspectingFinalBoard, setIsInspectingFinalBoard] = React.useState(false);
  const [isInspectionBarCollapsed, setIsInspectionBarCollapsed] = React.useState(false);
  const [inspectionDockPosition, setInspectionDockPosition] = React.useState<'top' | 'bottom'>('top');
  const [showRulesModal, setShowRulesModal] = React.useState(false);
  const [showStatsModal, setShowStatsModal] = React.useState(false);
  const [showPracticeModal, setShowPracticeModal] = React.useState(false);
  const [showDifficultyModal, setShowDifficultyModal] = React.useState(false);
  const [showRestartConfirmModal, setShowRestartConfirmModal] = React.useState(false);
  const [soundEnabled, setSoundEnabled] = React.useState(true);

  // AI field: 'tournament' mimics a real qualifying field
  const [difficulty, setDifficulty] = React.useState<DifficultyLevel>(() => {
    try {
      const saved = localStorage.getItem('mahjong_ai_difficulty_v2');
      if (saved && (DIFFICULTIES as string[]).includes(saved)) return saved as DifficultyLevel;
    } catch {}
    return 'tournament';
  });
  // Personas for seats 1-3, sampled per match (resampled at the next hand if the field changes)
  const personasRef = React.useRef<{ difficulty: DifficultyLevel; personas: Persona[] }>({
    difficulty,
    personas: samplePersonas(difficulty),
  });
  const personaFor = (seat: number) => personasRef.current.personas[seat - 1];

  // Strict mode: Hu is offered for any complete hand shape, and a 0-fan declaration is a false win
  const [strictHu, setStrictHu] = React.useState<boolean>(() => {
    try {
      return localStorage.getItem('mahjong_strict_hu') === '1';
    } catch {
      return false;
    }
  });
  const toggleStrictHu = () => {
    const next = !strictHu;
    setStrictHu(next);
    try {
      localStorage.setItem('mahjong_strict_hu', next ? '1' : '0');
    } catch {}
  };

  const handleSelectDifficulty = (newDiff: DifficultyLevel) => {
    setDifficulty(newDiff);
    personasRef.current = { difficulty: newDiff, personas: samplePersonas(newDiff) };
    try {
      localStorage.setItem('mahjong_ai_difficulty_v2', newDiff);
    } catch {}
  };

  // Historical statistics
  const [careerStats, setCareerStats] = React.useState<GameStats>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_STATS);
      if (saved) {
        const stats: GameStats = JSON.parse(saved);
        const fixedRounds = (stats.historicalRounds ?? []).map((r, idx) => ({
          ...r,
          id: r.id || `round_legacy_${idx}_${r.roundIndex}_${r.actionLogs?.length ?? 0}`,
          timestamp: r.timestamp || Date.now() - (stats.historicalRounds.length - idx) * 60000,
        }));
        return { ...stats, historicalRounds: fixedRounds.slice(-MAX_HISTORY_HANDS) };
      }
    } catch {
      // fallback
    }
    return emptyStats();
  });

  const updateStats = (updater: (prev: GameStats) => GameStats) => {
    setCareerStats((prev) => {
      const next = updater(prev);
      try {
        localStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleDeleteHistoricalRound = (target: RoundResult | number) => {
    updateStats((prev) => {
      let targetIdx = -1;
      if (typeof target === 'number') {
        targetIdx = target;
      } else {
        targetIdx = prev.historicalRounds.indexOf(target);
        if (targetIdx === -1) {
          targetIdx = prev.historicalRounds.findIndex(
            (r) =>
              r === target ||
              (r.roundIndex === target.roundIndex &&
                r.prevailingWind === target.prevailingWind &&
                r.actionLogs.length === target.actionLogs.length &&
                r.totalFan === target.totalFan)
          );
        }
      }
      if (targetIdx === -1) return prev;
      return {
        ...prev,
        historicalRounds: prev.historicalRounds.filter((_, idx) => idx !== targetIdx),
      };
    });

    if (reviewRoundResult) {
      const match =
        typeof target === 'number'
          ? careerStats.historicalRounds[target] === reviewRoundResult
          : reviewRoundResult === target;
      if (match) {
        setReviewRoundResult(null);
      }
    }
  };

  const handleClearAllHistoricalRounds = () => {
    updateStats((prev) => ({
      ...prev,
      historicalRounds: [],
    }));
    setReviewRoundResult(null);
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundManager.enabled = next;
  };

  // Visual action announcement banner (碰！吃！杠！胡！)
  const [actionBanner, setActionBanner] = React.useState<{ text: string; playerIdx: number } | null>(null);
  const showActionBanner = (text: string, playerIdx: number) => {
    setActionBanner({ text, playerIdx });
    setTimeout(() => {
      setActionBanner((prev) => (prev?.text === text ? null : prev));
    }, 1200);
  };

  // ---------------------------------------------------------------------------
  // Match flow
  // ---------------------------------------------------------------------------

  const startHand = (handIndex: number, scores: number[]) => {
    if (personasRef.current.difficulty !== difficulty) {
      personasRef.current = { difficulty, personas: samplePersonas(difficulty) };
    }
    setSelectedTile(null);
    setActiveRoundResult(null);
    setShowRoundResultModal(true);
    setIsInspectingFinalBoard(false);
    setActionBanner(null);
    const p1 = personaFor(1);
    const p2 = personaFor(2);
    const p3 = personaFor(3);
    const names = [
      '您 (玩家)',
      getBotPlayerName(1, p1.style, p1.skill, difficulty),
      getBotPlayerName(2, p2.style, p2.skill, difficulty),
      getBotPlayerName(3, p3.style, p3.skill, difficulty),
    ];
    setTable(dealHand(handIndex, scores, Math.random, names));
  };

  // Identifies the current 16-hand match in the saved hand history
  const [matchId, setMatchId] = React.useState(() => Date.now().toString(36));

  const startNew16RoundMatch = () => {
    personasRef.current = { difficulty, personas: samplePersonas(difficulty) };
    setMatchId(Date.now().toString(36));
    setIsGameOver16(false);
    setReviewRoundResult(null);
    setShowRoundResultModal(true);
    setIsInspectingFinalBoard(false);
    startHand(0, [0, 0, 0, 0]);
  };

  React.useEffect(() => {
    startNew16RoundMatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Development-only hook so browser tests can set up exact table positions
  React.useEffect(() => {
    if (import.meta.env.DEV) (window as any).__mahjongTest = { table, setTable };
  }, [table]);

  // Pre-evaluate bot claims on the pending discard to enforce authentic Mahjong claim priorities:
  // 1. Hu > Peng / Chi: if any bot claims Hu, player's Chi/Peng is overridden (no need for player to decide).
  // 2. Peng > Chi: if any bot claims Peng or Kong, player's Chi is overridden (no need for player to decide).
  const botClaimDecisions = React.useMemo(() => {
    if (!table || table.phase !== 'claim') return null;
    const decisions: Record<number, ClaimDecision> = {};
    for (const q of [1, 2, 3]) {
      const opts = getClaimOptions(table, q);
      if (opts) {
        decisions[q] = decideClaim(table, q, opts, personaFor(q));
      }
    }
    return decisions;
  }, [table]);

  const anyBotHu = React.useMemo(() => {
    if (!botClaimDecisions) return false;
    return Object.values(botClaimDecisions).some((d) => d.type === 'hu');
  }, [botClaimDecisions]);

  const anyBotPengOrKong = React.useMemo(() => {
    if (!botClaimDecisions) return false;
    return Object.values(botClaimDecisions).some((d) => d.type === 'pung' || d.type === 'kong');
  }, [botClaimDecisions]);

  // Resolve a pending claim with the human's decision (if they had options) and the bots'
  const resolveWith = (t: TableState, humanDecision?: ClaimDecision): TableState => {
    const decisions: (ClaimDecision | undefined)[] = [];
    for (const q of playersWithClaimOptions(t)) {
      if (q === 0) {
        decisions[0] = humanDecision ?? { type: 'pass' };
      } else {
        decisions[q] = (t === table && botClaimDecisions?.[q])
          ? botClaimDecisions[q]
          : decideClaim(t, q, getClaimOptions(t, q)!, personaFor(q));
      }
    }
    return resolveClaims(t, decisions);
  };

  const runBotTurn = (t: TableState): TableState => {
    const p = t.active;
    const d = decideTurn(t, p, personaFor(p));
    if (d.type === 'tsumo') return declareSelfDraw(t, p);
    if (d.type === 'kong') return declareKong(t, p, d.candidate);
    return discard(t, p, d.tileId);
  };

  // What the human may do on the pending claim (null = nothing, so bots resolve it)
  const humanClaim = React.useMemo(() => {
    if (!table || table.phase !== 'claim') return null;
    const o = getClaimOptions(table, 0);
    if (!o) return null;
    const canHu = strictHu ? o.shapeComplete : !!o.win;

    // 规则 1：胡优先于碰/吃
    // 其他三家中的某一家如果胡牌的话，玩家如果吃/碰同一张牌，不需要玩家先决定吃或碰。
    // 如果玩家不能胡牌，则直接不弹窗，由胡牌方优先结算；
    // 如果玩家也能胡牌，则玩家仅保留胡牌选项，无需选择吃/碰。
    if (anyBotHu) {
      if (!canHu) return null;
      return {
        ...o,
        canHu: true,
        pung: null,
        kong: null,
        chi: [],
      };
    }

    // 规则 2：碰优先于吃
    // 其他三家任何一家要碰（或杠）的时候，吃牌无效，不需要玩家先决定自己要不要吃这张牌。
    let chi = o.chi;
    if (anyBotPengOrKong) {
      chi = [];
    }

    if (!canHu && !o.pung && !o.kong && chi.length === 0) return null;
    return { ...o, canHu, chi };
  }, [table, strictHu, anyBotHu, anyBotPengOrKong]);

  // What the human may do on their own turn
  const humanTurn = React.useMemo(() => {
    if (!table) return null;
    const o = getTurnOptions(table, 0);
    if (!o) return null;
    const dismissed = dismissedTurnFor === table;
    return {
      ...o,
      canHu: !dismissed && (strictHu ? o.shapeComplete : !!o.win),
      kongs: dismissed ? [] : o.kongs,
    };
  }, [table, strictHu, dismissedTurnFor]);

  // Danger read for the human's tiles, from what the human can see (shown only with the strategy panel open)
  const dangerRead: DangerRead | null = React.useMemo(() => {
    if (!table || table.phase === 'ended') return null;
    return readDanger(publicView(table, 0), table.players[0].hand.map((t) => t.type));
  }, [table]);

  // Discards that were the tile just drawn (摸切)
  const drawnDiscardIds = React.useMemo(
    () => new Set((table?.log ?? []).filter((e) => e.action === 'discard' && e.fromDraw && e.tile).map((e) => e.tile!.id)),
    [table?.log]
  );

  // Drive bots and claim resolution with realistic pacing (thinking pauses)
  React.useEffect(() => {
    if (!table || activeRoundResult) return;
    if (table.phase === 'turn' && table.active !== 0) {
      // Natural thinking delay: 1700ms - 2300ms
      const delay = 1700 + Math.floor(Math.random() * 600);
      const timer = setTimeout(() => setTable((prev) => (prev === table ? runBotTurn(prev) : prev)), delay);
      return () => clearTimeout(timer);
    }
    if (table.phase === 'claim' && !humanClaim) {
      // Pause on discard claims: 1200ms to read the discard, +500ms when a bot threw from hand (手切)
      const last = table.log[table.log.length - 1];
      const fromHand = last?.action === 'discard' && last.playerIndex !== 0 && !last.fromDraw;
      const timer = setTimeout(() => setTable((prev) => (prev === table ? resolveWith(prev) : prev)), fromHand ? 1700 : 1200);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, activeRoundResult, humanClaim]);

  // Sounds and banners for new actions
  const seenLogRef = React.useRef<{ hand: number; count: number }>({ hand: -1, count: 0 });
  React.useEffect(() => {
    if (!table) return;
    if (seenLogRef.current.hand !== table.handIndex) seenLogRef.current = { hand: table.handIndex, count: 0 };
    const fresh = table.log.slice(seenLogRef.current.count);
    seenLogRef.current.count = table.log.length;
    for (const e of fresh) announce(e);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);

  const announce = (e: TurnActionLog) => {
    const who = e.playerIndex === 0 ? '' : `${e.playerName} `;
    if (e.action === 'discard') {
      soundManager.playTileDiscard();
      if (e.tile) {
        soundManager.speak(getTileSpokenName(e.tile));
      }
    } else if (e.action === 'chi') {
      soundManager.playMeld();
      showActionBanner(`${who}吃！`, e.playerIndex);
      soundManager.speak('吃');
    } else if (e.action === 'peng') {
      soundManager.playMeld();
      showActionBanner(`${who}碰！`, e.playerIndex);
      soundManager.speak('碰');
    } else if (e.action === 'gang') {
      soundManager.playKong();
      showActionBanner(`${who}杠！`, e.playerIndex);
      soundManager.speak('杠');
    } else if (e.action === 'hu') {
      if (e.aiComment?.includes('诈胡')) {
        showActionBanner(`${who}诈胡！罚 ${FALSE_WIN_PENALTY_EACH * 3} 点`, e.playerIndex);
        soundManager.speak('诈胡');
      } else {
        soundManager.playHu();
        const isSelfDraw = e.aiComment?.includes('自摸');
        showActionBanner(`${who}${e.aiComment ?? '和牌！'}`, e.playerIndex);
        soundManager.speak(isSelfDraw ? '自摸' : '胡了');
      }
    }
  };

  // Hand finished: record the result once
  const recordedHandRef = React.useRef<TableState | null>(null);
  React.useEffect(() => {
    if (!table || table.phase !== 'ended' || !table.result || recordedHandRef.current === table) return;
    recordedHandRef.current = table;
    const r = table.result;
    const roundId = `round_${Date.now()}_${Math.random().toString(36).slice(2, 9)}_${table.handIndex}`;
    const result: RoundResult = {
      id: roundId,
      timestamp: Date.now(),
      roundIndex: table.handIndex,
      prevailingWind: table.prevailingWind,
      roundInWind: (table.handIndex % 4) + 1,
      dealerIndex: table.dealer,
      winnerIndex: r.winner,
      winningTile: r.winningTile,
      isSelfDraw: r.isSelfDraw,
      discarderIndex: r.payer,
      fanDetails: r.fanDetails,
      totalFan: r.totalFan,
      pointsDelta: r.pointsDelta,
      actionLogs: table.log,
      handSnapshots: table.players.map((p) => ({ hand: [...p.hand], melds: [...p.melds] })),
      matchId,
    };
    setActiveRoundResult(result);
    setShowRoundResultModal(true);
    setIsInspectingFinalBoard(false);
    setSelectedTile(null);

    updateStats((prev) => {
      const isHumanWin = r.winner === 0;
      const fanCounts = { ...prev.fansAchievedCounts };
      if (isHumanWin) r.fanDetails.forEach((f) => (fanCounts[f.code] = (fanCounts[f.code] || 0) + 1));
      return {
        ...prev,
        totalRounds: prev.totalRounds + 1,
        humanWins: prev.humanWins + (isHumanWin ? 1 : 0),
        humanSelfDraws: prev.humanSelfDraws + (isHumanWin && r.isSelfDraw ? 1 : 0),
        humanDealIns: prev.humanDealIns + (r.payer === 0 ? 1 : 0),
        humanTenpaiCount: prev.humanTenpaiCount + (table.players[0].isTenpai ? 1 : 0),
        highestFan: isHumanWin ? Math.max(prev.highestFan, r.totalFan) : prev.highestFan,
        totalPointsEarned: prev.totalPointsEarned + (isHumanWin ? r.pointsDelta[0] : 0),
        fansAchievedCounts: fanCounts,
        historicalRounds: [...prev.historicalRounds, result].slice(-MAX_HISTORY_HANDS),
      };
    });
  }, [table]);

  const handleNextRound = () => {
    if (!table) return;
    setActiveRoundResult(null);
    setShowRoundResultModal(true);
    setIsInspectingFinalBoard(false);
    if (table.handIndex >= HANDS_PER_MATCH - 1) {
      setIsGameOver16(true);
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });
      updateStats((prev) => ({ ...prev, totalGames: prev.totalGames + 1 }));
    } else {
      startHand(table.handIndex + 1, table.players.map((p) => p.score));
    }
  };

  // ---------------------------------------------------------------------------
  // Human actions (all validated by the engine)
  // ---------------------------------------------------------------------------

  const handleHumanConfirmDiscard = (tile: Tile) => {
    if (!table || !humanTurn) return;
    const pl = table.players[0];
    const read = readDanger(publicView(table, 0), pl.hand.map((t) => t.type));
    const recs = generateDiscardRecommendations(
      pl.hand,
      pl.melds,
      visibleTilesFor(table, 0),
      table.prevailingWind,
      pl.seatWind,
      table.players.map((p) => p.discards),
      visibleThreats(table, 0),
      read.tiles
    );
    // What the danger read said at this moment, for the post-hand review
    const r3 = (x: number) => Math.round(x * 1000) / 1000;
    const chosen = read.tiles[tile.type];
    const safest = Object.values(read.tiles).reduce((a, b) => (b.pct < a.pct ? b : a));
    const danger: DiscardDangerRecord = {
      pct: r3(chosen.pct),
      level: chosen.level,
      expectedLoss: r3(chosen.expectedLoss),
      reasons: chosen.reasons,
      bySeat: chosen.bySeat.map((b) => ({ seat: b.seat, pct: r3(b.pct), fan: r3(b.fan) })),
      safest: { type: safest.type, displayName: getTileNameByType(safest.type), pct: r3(safest.pct) },
      opponents: read.opponents.map((o) => ({ seat: o.seat, pReady: r3(o.pReady), fan: r3(o.fan), reasons: o.reasons })),
      hintsOn: isStrategyPanelOpen,
    };
    const blunder = analyzeTurnBlunder(tile, recs);
    const visible = visibleTilesFor(table, 0);
    const before = analyzeShanten(pl.hand, pl.melds, table.prevailingWind, pl.seatWind, visible);
    const afterInfo = analyzeShanten(
      pl.hand.filter((t) => t.id !== tile.id),
      pl.melds,
      table.prevailingWind,
      pl.seatWind,
      visible
    );
    const shantenBefore = before.display;
    const shantenAfter = afterInfo.display;
    setSelectedTile(null);
    setTable(
      discard(table, 0, tile.id, {
        shantenBefore,
        shantenAfter,
        isBlunder: blunder.isBlunder,
        blunderSeverity: blunder.severity,
        blunderType: blunder.type,
        blunderTypeName: blunder.typeName,
        blunderReason: blunder.reason,
        recommendedDiscard: blunder.bestChoice,
        bestRec: blunder.bestRec,
        chosenRec: blunder.chosenRec,
        danger,
        aiComment:
          afterInfo.noFanRoute
            ? `已无番种路线，只能自摸（${shantenAfter === 0 ? '听牌' : `${shantenAfter}向听`}）`
            : shantenAfter === 0
            ? '成功进入有番听牌！'
            : blunder.isBlunder
            ? undefined
            : `打出【${tile.displayName}】，保持${shantenAfter}向听`,
      })
    );
  };

  const handleHumanHu = () => {
    if (!table) return;
    if (humanTurn?.canHu) setTable(declareSelfDraw(table, 0));
    else if (humanClaim?.canHu) setTable(resolveWith(table, { type: 'hu' }));
  };

  const handleHumanPeng = () => {
    if (table && humanClaim?.pung) setTable(resolveWith(table, { type: 'pung' }));
  };

  const handleHumanChi = (tiles: Tile[]) => {
    if (table && humanClaim?.chi.length) setTable(resolveWith(table, { type: 'chi', tiles }));
  };

  const handleHumanGang = (candidate: GangOption) => {
    if (!table) return;
    if (humanClaim?.kong) {
      setTable(resolveWith(table, { type: 'kong' }));
      return;
    }
    const k = humanTurn?.kongs.find(
      (c) => c.type === candidate.type && c.tiles[0].type === candidate.tiles[0].type
    );
    if (k) setTable(declareKong(table, 0, k as KongCandidate));
  };

  const handleHumanPass = () => {
    if (!table) return;
    if (humanClaim) setTable(resolveWith(table, { type: 'pass' }));
    else if (humanTurn) setDismissedTurnFor(table);
  };

  // ---------------------------------------------------------------------------
  // Derived view data
  // ---------------------------------------------------------------------------

  const players = table?.players ?? [];
  const human = players[0];
  const prevailingWind = table?.prevailingWind ?? 'E';
  const currentRoundIndex = table?.handIndex ?? 0;
  const dealerIndex = table?.dealer ?? 0;
  const allVisibleTiles = table ? visibleTilesFor(table, 0) : [];
  const humanShantenInfo = human
    ? analyzeShanten(human.hand, human.melds, prevailingWind, human.seatWind, allVisibleTiles)
    : { display: 8, shape: 8, noFanRoute: false };
  const humanShanten = humanShantenInfo.display;

  const tenpaiWaits: TenpaiWait[] =
    table && human && human.hand.length % 3 === 1 && humanShantenInfo.shape === 0
      ? calculateTenpaiWaits(human.hand, human.melds, allVisibleTiles, prevailingWind, human.seatWind)
      : [];

  const discardRecommendations: DiscardRecommendation[] =
    table && human && humanTurn
      ? generateDiscardRecommendations(
          human.hand,
          human.melds,
          allVisibleTiles,
          prevailingWind,
          human.seatWind,
          players.map((p) => p.discards),
          visibleThreats(table, 0),
          dangerRead?.tiles
        )
      : [];

  const gangCandidates: GangOption[] = humanClaim?.kong
    ? [{ type: 'ming_gang', tiles: [...humanClaim.kong, table!.claim!.tile] }]
    : humanTurn?.kongs ?? [];

  const lastDiscardedTile =
    table?.phase === 'claim' && table.claim ? { tile: table.claim.tile, fromPlayer: table.claim.from } : null;

  // Final ranking (rules D.4): score, then total fan won, then wins, then fewer deal-ins
  const matchRounds = careerStats.historicalRounds.filter((r) => r.matchId === matchId);
  const matchTally = (seat: number) => {
    const won = matchRounds.filter((r) => r.winnerIndex === seat);
    return {
      fan: won.reduce((sum, r) => sum + r.totalFan, 0),
      wins: won.length,
      dealIns: matchRounds.filter((r) => r.winnerIndex !== null && r.discarderIndex === seat).length,
    };
  };
  const compareStanding = (a: number, b: number) => {
    const ta = matchTally(a);
    const tb = matchTally(b);
    return (
      players[b].score - players[a].score ||
      tb.fan - ta.fan ||
      tb.wins - ta.wins ||
      ta.dealIns - tb.dealIns
    );
  };

  const styleLabel = (seat: number) => {
    const p = personaFor(seat);
    const tier = p.skill >= 0.8 ? '高手' : p.skill >= 0.55 ? '中等' : '一般';
    return `${STYLE_LABELS[p.style]} · ${tier}`;
  };

  const handleShareApp = async () => {
    const shareUrl = 'https://tinyurl.com/mahjong-pro-arena';
    const shareTitle = '雀圣研习社 - TVB 麻将比赛实战与策略复盘';
    const shareText = '邀你加入雀圣研习社，体验16局大局赛制与深度牌效复盘！';

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      showActionBanner('已复制分享链接：https://tinyurl.com/mahjong-pro-arena (可发给微信好友/社媒)', 0);
    } catch {
      showActionBanner('分享短链：https://tinyurl.com/mahjong-pro-arena', 0);
    }
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col font-sans selection:bg-amber-500 selection:text-stone-950">
      {/* ================= ZONE 1, 2, 3: TOP BAR CONTRACT ================= */}
      <header className="h-14 border-b border-stone-800 bg-stone-950/90 backdrop-blur px-4 sm:px-6 flex items-center justify-between z-40 shrink-0">
        {/* Zone 1: Single Wordmark */}
        <div className="flex items-center gap-2">
          <span className="text-base font-serif font-black tracking-wider text-amber-400">
            雀圣研习社
          </span>
          <span className="text-[11px] text-stone-500 hidden sm:inline">
            · TVB 广东麻将比赛规则 · 16 局实战研习
          </span>
        </div>

        {/* Zone 2: Navigation Links (Text Links with Hover Underlines) */}
        <nav className="flex items-center gap-2.5 sm:gap-5 text-xs font-medium text-stone-400">
          <button
            onClick={() => {
              if (careerStats.historicalRounds.length === 0) {
                showActionBanner('暂无已完局记录，完成一局后可随时复盘', 0);
              } else {
                setReviewRoundResult(careerStats.historicalRounds[careerStats.historicalRounds.length - 1]);
              }
            }}
            className="flex hover:text-amber-300 transition-colors items-center gap-1 cursor-pointer font-semibold text-stone-300 hover:underline"
            title="随时回溯复盘已完成的对局"
          >
            <FileSearch className="w-3.5 h-3.5 text-amber-400" />
            <span>实战复盘</span>
            {careerStats.historicalRounds.length > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] bg-amber-950 text-amber-300 rounded-full border border-amber-600/50 font-mono">
                {careerStats.historicalRounds.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowRulesModal(true)}
            className="hover:text-amber-300 transition-colors flex items-center gap-1 cursor-pointer font-semibold text-stone-300 hover:underline"
            title="查看麻将规则手册"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span>规则</span>
          </button>
          <button
            onClick={() => setShowPracticeModal(true)}
            className="hidden sm:flex hover:text-amber-300 transition-colors items-center gap-1 cursor-pointer"
          >
            <GraduationCap className="w-3.5 h-3.5 text-amber-400" />
            <span>何切牌效</span>
          </button>
          <button
            onClick={() => setShowStatsModal(true)}
            className="hidden md:flex hover:text-amber-300 transition-colors items-center gap-1 cursor-pointer"
          >
            <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
            <span>生涯战绩</span>
          </button>
        </nav>

        {/* Zone 3: Primary Actions */}
        <div className="flex items-center gap-2">
          {/* Difficulty Setting Button */}
          <button
            onClick={() => setShowDifficultyModal(true)}
            className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-300 hover:text-amber-400 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
            title="查看或调整 AI 难度"
          >
            <Bot className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden xs:inline">
              {difficulty === 'tournament'
                ? 'AI: 比赛实战'
                : difficulty === 'beginner'
                ? 'AI: 入门'
                : difficulty === 'intermediate'
                ? 'AI: 进阶'
                : 'AI: 宗师'}
            </span>
          </button>

          {/* Strict Hu: no legality hint, false wins are penalized */}
          <button
            onClick={toggleStrictHu}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors ${
              strictHu
                ? 'bg-rose-950/60 border-rose-700 text-rose-200'
                : 'bg-stone-900 border-stone-800 text-stone-300 hover:bg-stone-800'
            }`}
            title={
              strictHu
                ? '严格和牌：只要牌型完整就可按和，是否有番需自行判断；无番诈胡罚每家 50 点且本局不得再和'
                : '提示和牌：只有合法（至少 1 番）时才显示和牌按钮'
            }
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">{strictHu ? '严格和牌' : '提示和牌'}</span>
          </button>

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            className="p-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-stone-200 text-xs transition-colors cursor-pointer"
            title={soundEnabled ? '音效开启' : '音效静音'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Share App Button */}
          <button
            onClick={handleShareApp}
            className="p-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-amber-400 text-xs transition-colors cursor-pointer"
            title="分享专属短链给微信好友或社媒 (https://tinyurl.com/mahjong-pro-arena)"
          >
            <Share2 className="w-4 h-4" />
          </button>

          {/* Strategy Panel Toggle */}
          <button
            onClick={() => setIsStrategyPanelOpen(!isStrategyPanelOpen)}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
              isStrategyPanelOpen
                ? 'bg-amber-600 text-stone-950 font-bold'
                : 'bg-stone-900 text-amber-400 hover:bg-stone-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">策略助手</span>
          </button>

          {/* Restart 16-round match */}
          <button
            onClick={() => setShowRestartConfirmModal(true)}
            className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-300 hover:text-amber-300 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
            title="重新开始整场 16 局比赛"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span>重开大局</span>
          </button>
        </div>
      </header>

      {/* ================= MAIN MAH JONG PLAY AREA ================= */}
      <main className="flex-1 relative p-2 sm:p-4 overflow-hidden flex flex-col justify-center max-w-7xl mx-auto w-full">
        {players.length === 4 && (
          <GameBoard
            players={players}
            activePlayerIndex={table!.active}
            prevailingWind={prevailingWind}
            currentRoundNumber={currentRoundIndex + 1}
            dealerIndex={dealerIndex}
            wallRemaining={table!.wall.length}
            selectedTile={selectedTile}
            onSelectTile={setSelectedTile}
            onConfirmDiscard={handleHumanConfirmDiscard}
            canChi={!!humanClaim && humanClaim.chi.length > 0}
            chiCombinations={humanClaim?.chi ?? []}
            canPeng={!!humanClaim?.pung}
            canGang={gangCandidates.length > 0}
            gangCandidates={gangCandidates}
            canHu={!!(humanClaim?.canHu || humanTurn?.canHu)}
            isSelfDraw={!!humanTurn?.canHu}
            onChi={handleHumanChi}
            onPeng={handleHumanPeng}
            onGang={handleHumanGang}
            onHu={handleHumanHu}
            onPass={handleHumanPass}
            discardRecommendations={discardRecommendations}
            lastDiscardedTile={lastDiscardedTile}
            showHints={isStrategyPanelOpen}
            actionBanner={actionBanner}
            drawnDiscardIds={drawnDiscardIds}
            revealAllHands={table!.phase === 'ended' || !!activeRoundResult || isInspectingFinalBoard}
            roundResult={activeRoundResult}
          />
        )}

        {/* Live Strategy Panel Sidebar / Drawer */}
        {human && (
          <StrategyPanel
            hand={human.hand}
            melds={human.melds}
            currentShanten={humanShanten}
            shapeShanten={humanShantenInfo.shape}
            noFanRoute={humanShantenInfo.noFanRoute}
            tenpaiWaits={tenpaiWaits}
            discardRecommendations={discardRecommendations}
            players={players}
            activePlayerIndex={table!.active}
            prevailingWind={prevailingWind}
            humanSeatWind={human.seatWind}
            dangerRead={dangerRead}
            onTileSelect={(t) => setSelectedTile(t)}
            isOpen={isStrategyPanelOpen}
            onToggle={() => setIsStrategyPanelOpen(!isStrategyPanelOpen)}
          />
        )}
      </main>

      {/* ================= BOTTOM FOOTER WITH CURRENT APP VERSION ================= */}
      <footer className="py-1 px-4 text-center shrink-0 z-10 select-none bg-stone-950/90 border-t border-stone-850">
        <div className="flex items-center justify-center gap-2 text-[10px] sm:text-[11px] font-mono text-stone-400 flex-wrap">
          <span>雀圣研习社</span>
          <span className="text-stone-700 hidden sm:inline">|</span>
          <span className="hidden sm:inline">TVB 广东麻将比赛实战研习</span>
          <span className="text-stone-700">|</span>
          <span className="text-stone-300">
            Current App Version: <span className="text-amber-400 font-semibold font-mono">{FULL_VERSION_STRING}</span>
          </span>
        </div>
      </footer>

      {/* Floating Inspection Bar when user returned to table board to view all revealed hands and discards */}
      {activeRoundResult && !showRoundResultModal && (
        isInspectionBarCollapsed ? (
          <div
            className={`fixed ${
              inspectionDockPosition === 'top' ? 'top-16' : 'bottom-3'
            } right-4 sm:right-8 z-50 animate-in fade-in zoom-in-95 duration-200`}
          >
            <button
              onClick={() => setIsInspectionBarCollapsed(false)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-stone-900/95 hover:bg-stone-850 text-amber-400 border border-amber-500/80 shadow-2xl backdrop-blur-md text-xs font-bold cursor-pointer transition-all hover:scale-105 ring-2 ring-black/40"
              title="展开终局牌桌控制栏"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <Eye className="w-3.5 h-3.5" />
              <span>终局牌桌 · 展开控制栏</span>
              <Maximize2 className="w-3 h-3 text-stone-400" />
            </button>
          </div>
        ) : (
          <div
            className={`fixed ${
              inspectionDockPosition === 'top' ? 'top-16' : 'bottom-3'
            } left-1/2 -translate-x-1/2 z-50 max-w-[96vw] bg-stone-900/95 backdrop-blur-md border border-amber-500/80 rounded-2xl shadow-2xl px-3 sm:px-4 py-2 flex items-center gap-2 sm:gap-3 flex-wrap justify-center text-xs animate-in ${
              inspectionDockPosition === 'top' ? 'slide-in-from-top' : 'slide-in-from-bottom'
            } duration-200 ring-2 ring-black/60`}
          >
            <div className="flex items-center gap-2 shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-bold text-stone-100 flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-amber-400" />
                <span>终局牌桌 · 全员亮明手牌</span>
              </span>
              <span className="text-[11px] text-stone-400 hidden xl:inline">
                (各家手牌及牌河已明示，点击任意手牌可高亮对局同色牌)
              </span>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-wrap">
              <button
                onClick={() => {
                  setShowRoundResultModal(true);
                  setIsInspectingFinalBoard(false);
                }}
                className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow cursor-pointer active:scale-95 ring-1 ring-amber-300/40"
                title="重新打开本局得分及番种详细结算面板"
              >
                <Award className="w-3.5 h-3.5" />
                <span>查看结算面板</span>
              </button>

              <button
                onClick={() => {
                  setReviewRoundResult(activeRoundResult);
                }}
                className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer border border-stone-700/80"
                title="逐巡回溯单步牌谱与恶手诊断"
              >
                <FileSearch className="w-3.5 h-3.5 text-amber-400" />
                <span>实战复盘</span>
              </button>

              {currentRoundIndex >= 15 ? (
                <button
                  onClick={() => {
                    handleNextRound();
                  }}
                  className="px-3 sm:px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow cursor-pointer active:scale-95"
                >
                  <Trophy className="w-3.5 h-3.5" />
                  <span>进入最终结算</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    setIsInspectingFinalBoard(false);
                    handleNextRound();
                  }}
                  className="px-3 sm:px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow cursor-pointer active:scale-95"
                >
                  <span>进入下一局</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                onClick={() => setShowRestartConfirmModal(true)}
                className="px-2.5 py-1.5 rounded-xl bg-stone-800/80 hover:bg-stone-700 text-stone-300 text-xs flex items-center gap-1 transition-colors cursor-pointer border border-stone-700/80"
                title="重新开始整场 16 局比赛"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">重开大局</span>
              </button>

              {/* Toggle Dock Position: Top or Bottom */}
              <button
                onClick={() => setInspectionDockPosition(inspectionDockPosition === 'top' ? 'bottom' : 'top')}
                className="p-1.5 rounded-xl bg-stone-800/70 hover:bg-stone-700 text-stone-400 hover:text-stone-200 text-xs transition-colors cursor-pointer border border-stone-700/60"
                title={inspectionDockPosition === 'top' ? '移至屏幕底部' : '移至屏幕顶部（避免遮挡手牌）'}
              >
                {inspectionDockPosition === 'top' ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronUp className="w-3.5 h-3.5" />
                )}
              </button>

              {/* Minimize button */}
              <button
                onClick={() => setIsInspectionBarCollapsed(true)}
                className="p-1.5 rounded-xl bg-stone-800/70 hover:bg-stone-700 text-stone-400 hover:text-stone-200 text-xs transition-colors cursor-pointer border border-stone-700/60"
                title="收起控制栏，全屏纯净看牌"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )
      )}

      {/* ================= MODALS ================= */}
      {/* 1. Round Result Settlement Modal */}
      {activeRoundResult && showRoundResultModal && (
        <RoundResultModal
          result={activeRoundResult}
          players={players}
          currentRoundNumber={currentRoundIndex + 1}
          onNextRound={handleNextRound}
          onOpenReview={() => {
            setReviewRoundResult(activeRoundResult);
          }}
          onOpenStats={() => setShowStatsModal(true)}
          onRestartMatch={() => setShowRestartConfirmModal(true)}
          onInspectBoard={() => {
            setShowRoundResultModal(false);
            setIsInspectingFinalBoard(true);
          }}
        />
      )}

      {/* 2. Game Review & Play-by-Play Replay Modal */}
      {reviewRoundResult && (
        <GameReviewModal
          roundResult={reviewRoundResult}
          roundNumber={reviewRoundResult.roundIndex + 1}
          allRounds={careerStats.historicalRounds}
          onSelectRound={(r: RoundResult) => {
            setReviewRoundResult(r);
          }}
          onDeleteRound={handleDeleteHistoricalRound}
          onClose={() => {
            setReviewRoundResult(null);
          }}
        />
      )}

      {/* 3. Rules Reference (Appendix I & III) Modal */}
      {showRulesModal && <RulesReferenceModal onClose={() => setShowRulesModal(false)} />}

      {/* 4. Statistics Modal */}
      {showStatsModal && (
        <StatisticsModal
          stats={careerStats}
          currentPlayers={players}
          currentRoundIndex={currentRoundIndex}
          historicalRounds={careerStats.historicalRounds}
          currentMatchId={matchId}
          onClose={() => setShowStatsModal(false)}
          onOpenReviewRound={(round) => {
            setShowStatsModal(false);
            setReviewRoundResult(round);
          }}
          onDeleteRound={handleDeleteHistoricalRound}
          onClearAllRounds={handleClearAllHistoricalRounds}
          onResetStats={() => {
            const empty: GameStats = {
              totalGames: 0,
              totalRounds: 0,
              humanWins: 0,
              humanSelfDraws: 0,
              humanDealIns: 0,
              humanTenpaiCount: 0,
              highestFan: 0,
              highestFanNames: [],
              totalPointsEarned: 0,
              fansAchievedCounts: {},
              historicalRounds: [],
            };
            setCareerStats(empty);
            localStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(empty));
          }}
        />
      )}

      {/* 5. Practice Drills Modal */}
      {showPracticeModal && <PracticeDrillsModal onClose={() => setShowPracticeModal(false)} />}

      {/* 6. AI Difficulty Configuration Modal */}
      {showDifficultyModal && (
        <DifficultyModal
          currentDifficulty={difficulty}
          onSelectDifficulty={handleSelectDifficulty}
          onClose={() => setShowDifficultyModal(false)}
        />
      )}

      {/* 7. Final 16-Round Match Championship Ceremony Modal */}
      {isGameOver16 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-md animate-in zoom-in-95 overflow-y-auto">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-stone-900 border border-amber-500/60 rounded-2xl shadow-2xl p-5 sm:p-6 text-center space-y-5 relative my-auto">
            <button
              onClick={() => setIsGameOver16(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white transition-colors cursor-pointer"
              title="关闭结算面板"
            >
              <X className="w-4 h-4" />
            </button>

            <Trophy className="w-16 h-16 text-amber-400 mx-auto animate-bounce" />
            <div>
              <h2 className="text-2xl font-bold font-serif text-amber-300">
                16 局完整雀局大满贯结算！
              </h2>
              <p className="text-xs text-stone-400 mt-1">
                历经东、南、西、北 4 个风圈共 16 局决战，最终战绩排行榜出炉
              </p>
            </div>

            {/* Standings Ranking */}
            <div className="space-y-2">
              {[...players]
                .sort((a, b) => compareStanding(players.indexOf(a), players.indexOf(b)))
                .map((p, rank) => (
                  <div
                    key={p.id}
                    className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                      rank === 0
                        ? 'bg-amber-950/40 border-amber-500 text-amber-200'
                        : 'bg-stone-950/60 border-stone-800 text-stone-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-serif font-black text-sm text-amber-400">
                        第 {rank + 1} 名
                      </span>
                      <span className="font-bold text-stone-100">{p.name}</span>
                      {!p.isHuman && (
                        <span className="text-[10px] text-stone-400">
                          {styleLabel(players.indexOf(p))}
                        </span>
                      )}
                    </div>
                    <span className="font-mono font-bold text-amber-400 text-base">
                      {p.score > 0 ? `+${p.score}` : p.score} 点
                    </span>
                  </div>
                ))}
            </div>

            <p className="text-[10px] text-stone-500">
              同分依次比较：总番数 → 和牌次数 → 放铳次数（少者胜）
            </p>

            <div className="flex items-center justify-center gap-2.5 pt-2 flex-wrap">
              <button
                onClick={() => {
                  const lastRound = careerStats.historicalRounds[careerStats.historicalRounds.length - 1];
                  if (lastRound && !activeRoundResult) {
                    setActiveRoundResult(lastRound);
                  }
                  setIsGameOver16(false);
                  setShowRoundResultModal(false);
                  setIsInspectingFinalBoard(true);
                }}
                className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-stone-700/80"
                title="回到牌桌查看第16局胡牌后所有玩家亮明手牌及弃牌河"
              >
                <Eye className="w-3.5 h-3.5 text-amber-400" />
                <span>返回牌桌查看</span>
              </button>
              <button
                onClick={() => setShowStatsModal(true)}
                className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-stone-700/80"
              >
                <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
                <span>查看生涯总战绩</span>
              </button>
              {careerStats.historicalRounds.length > 0 && (
                <button
                  onClick={() => {
                    setReviewRoundResult(careerStats.historicalRounds[careerStats.historicalRounds.length - 1]);
                  }}
                  className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-stone-700/80"
                  title="回溯复盘第16局牌谱与恶手诊断"
                >
                  <FileSearch className="w-3.5 h-3.5 text-amber-400" />
                  <span>复盘终局牌谱</span>
                </button>
              )}
              <button
                onClick={startNew16RoundMatch}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 text-xs font-bold shadow-lg transition-transform active:scale-95 cursor-pointer ml-auto"
              >
                再开一整雀 (16局)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Restart 16-round match confirmation modal */}
      {showRestartConfirmModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-stone-900 border border-stone-700/90 rounded-2xl shadow-2xl p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-500/15 border border-amber-500/40 flex items-center justify-center mx-auto text-amber-400">
              <RotateCcw className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold font-serif text-amber-300">
                重新开始 16 局完整雀局？
              </h3>
              <p className="text-xs text-stone-400 mt-1.5 leading-relaxed">
                将重置进度回到第 1 局（东风圈·东局），全桌 4 家分数清零重新开始。当前进行中的牌局进度将被重置。
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setShowRestartConfirmModal(false)}
                className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-medium cursor-pointer transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => {
                  setShowRestartConfirmModal(false);
                  startNew16RoundMatch();
                  showActionBanner('全新 16 局已开启', 0);
                }}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 font-bold text-xs shadow-lg transition-transform active:scale-95 cursor-pointer"
              >
                确认重开大局
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function emptyStats(): GameStats {
  return {
    totalGames: 0,
    totalRounds: 0,
    humanWins: 0,
    humanSelfDraws: 0,
    humanDealIns: 0,
    humanTenpaiCount: 0,
    highestFan: 0,
    highestFanNames: [],
    totalPointsEarned: 0,
    fansAchievedCounts: {},
    historicalRounds: [],
  };
}
