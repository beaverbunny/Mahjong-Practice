import React from 'react';
import {
  PlayerState,
  Tile,
  Meld,
  Wind,
  RoundResult,
  TurnActionLog,
  GameStats,
  DiscardRecommendation,
  TenpaiWait,
  DifficultyLevel,
} from './types/mahjong';
import { createFullDeck, shuffleDeck, sortTiles } from './utils/mahjongTiles';
import {
  evaluateWin,
  calculatePointsDelta,
  canPeng,
  canMingGang,
  getChiCombinations,
  getAnGangCandidates,
  getBuGangCandidates,
} from './utils/rulesEngine';
import {
  calculateShanten,
  generateDiscardRecommendations,
  calculateTenpaiWaits,
  analyzeTurnBlunder,
  BlunderAnalysisResult,
} from './utils/strategyEngine';
import {
  evaluateBotCallResponse,
  chooseBotDiscard,
  checkBotConcealedKong,
} from './utils/aiBot';
import { soundManager } from './utils/audio';
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
} from 'lucide-react';
import confetti from 'canvas-confetti';

const STORAGE_KEY_STATS = 'mahjong_practice_career_stats_v1';

export default function App() {
  // Game match progression: 16 rounds (4 winds * 4)
  const [currentRoundIndex, setCurrentRoundIndex] = React.useState(0); // 0 to 15
  const [isGameOver16, setIsGameOver16] = React.useState(false);

  // Table state
  const [wall, setWall] = React.useState<Tile[]>([]);
  const [players, setPlayers] = React.useState<PlayerState[]>([]);
  const [activePlayerIndex, setActivePlayerIndex] = React.useState(0);
  const [selectedTile, setSelectedTile] = React.useState<Tile | null>(null);
  const [lastDiscardedTile, setLastDiscardedTile] = React.useState<{
    tile: Tile;
    fromPlayer: number;
  } | null>(null);

  // Turn logs for current round replay
  const [currentActionLogs, setCurrentActionLogs] = React.useState<TurnActionLog[]>([]);
  const [turnCounter, setTurnCounter] = React.useState(1);

  // User interactive call prompt (when an opponent discards a tile human can Chi/Peng/Gang/Hu)
  const [userCanChi, setUserCanChi] = React.useState(false);
  const [userChiCombinations, setUserChiCombinations] = React.useState<Tile[][]>([]);
  const [userCanPeng, setUserCanPeng] = React.useState(false);
  const [userCanGang, setUserCanGang] = React.useState(false);
  const [userGangCandidates, setUserGangCandidates] = React.useState<
    { type: 'ming_gang' | 'an_gang' | 'bu_gang'; tiles: Tile[]; meld?: Meld }[]
  >([]);
  const [userCanHu, setUserCanHu] = React.useState(false);
  const [isSelfDrawHu, setIsSelfDrawHu] = React.useState(false);
  const [isUnderTheSea, setIsUnderTheSea] = React.useState(false);
  // Seat whose latest tile is a Kong replacement draw (for A6 Self-Draw on Kong)
  const [kongDrawPlayer, setKongDrawPlayer] = React.useState<number | null>(null);
  // Seat that just called Chi/Peng and must discard (no self-draw win or Kong this turn)
  const [calledMeldPlayer, setCalledMeldPlayer] = React.useState<number | null>(null);

  // Modals & Panels
  const [isStrategyPanelOpen, setIsStrategyPanelOpen] = React.useState(true);
  const [activeRoundResult, setActiveRoundResult] = React.useState<RoundResult | null>(null);
  const [reviewRoundResult, setReviewRoundResult] = React.useState<RoundResult | null>(null);
  const [showRulesModal, setShowRulesModal] = React.useState(false);
  const [showStatsModal, setShowStatsModal] = React.useState(false);
  const [showPracticeModal, setShowPracticeModal] = React.useState(false);
  const [showDifficultyModal, setShowDifficultyModal] = React.useState(false);
  const [showRestartConfirmModal, setShowRestartConfirmModal] = React.useState(false);
  const [soundEnabled, setSoundEnabled] = React.useState(true);

  // AI Difficulty Level: 'beginner' | 'intermediate' | 'master'
  const [difficulty, setDifficulty] = React.useState<DifficultyLevel>(() => {
    try {
      const saved = localStorage.getItem('mahjong_ai_difficulty');
      if (saved === 'beginner' || saved === 'intermediate' || saved === 'master') {
        return saved;
      }
    } catch {}
    return 'intermediate';
  });

  const handleSelectDifficulty = (newDiff: DifficultyLevel) => {
    setDifficulty(newDiff);
    try {
      localStorage.setItem('mahjong_ai_difficulty', newDiff);
    } catch {}
  };

  // Historical statistics
  const [careerStats, setCareerStats] = React.useState<GameStats>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_STATS);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
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
  });

  // Calculate current prevailing wind & dealer
  const prevailingWind: Wind = ['E', 'S', 'W', 'N'][Math.floor(currentRoundIndex / 4)] as Wind;
  const dealerIndex = currentRoundIndex % 4;

  // Sound toggle
  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundManager.enabled = next;
  };

  // Save stats to localStorage
  const updateStats = (updater: (prev: GameStats) => GameStats) => {
    setCareerStats((prev) => {
      const next = updater(prev);
      try {
        localStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Initialize a fresh 16-round match
  const startNew16RoundMatch = () => {
    setCurrentRoundIndex(0);
    setIsGameOver16(false);
    setActiveRoundResult(null);
    setReviewRoundResult(null);
    setUserCanHu(false);
    setIsSelfDrawHu(false);
    setUserCanChi(false);
    setUserChiCombinations([]);
    setUserCanPeng(false);
    setUserCanGang(false);
    setUserGangCandidates([]);
    setSelectedTile(null);
    setLastDiscardedTile(null);
    setActionBanner(null);
    initRound(0, [0, 0, 0, 0]);
  };

  // Initialize a single round
  const initRound = (roundIdx: number, existingScores?: number[]) => {
    const deck = shuffleDeck(createFullDeck());
    const roundPrevailingWind: Wind = ['E', 'S', 'W', 'N'][Math.floor(roundIdx / 4)] as Wind;
    const roundDealer = roundIdx % 4;

    // Calculate seat winds for players [0=User, 1=Bot1, 2=Bot2, 3=Bot3]
    const windCycle: Wind[] = ['E', 'S', 'W', 'N'];
    const seatWinds: Wind[] = [];
    for (let i = 0; i < 4; i++) {
      const shift = (i - roundDealer + 4) % 4;
      seatWinds.push(windCycle[shift]);
    }

    // Deal 13 cards each + 1 to dealer
    const newPlayers: PlayerState[] = [
      {
        id: 'player_0',
        name: '您 (玩家)',
        isHuman: true,
        seatWind: seatWinds[0],
        hand: [],
        melds: [],
        discards: [],
        score: existingScores ? existingScores[0] : 0,
        startingScore: 0,
        isTenpai: false,
        tenpaiWaits: [],
      },
      {
        id: 'player_1',
        name: '下家 · 雀痴',
        isHuman: false,
        seatWind: seatWinds[1],
        hand: [],
        melds: [],
        discards: [],
        score: existingScores ? existingScores[1] : 0,
        startingScore: 0,
        isTenpai: false,
        tenpaiWaits: [],
      },
      {
        id: 'player_2',
        name: '对家 · 雀皇',
        isHuman: false,
        seatWind: seatWinds[2],
        hand: [],
        melds: [],
        discards: [],
        score: existingScores ? existingScores[2] : 0,
        startingScore: 0,
        isTenpai: false,
        tenpaiWaits: [],
      },
      {
        id: 'player_3',
        name: '上家 · 雀仙',
        isHuman: false,
        seatWind: seatWinds[3],
        hand: [],
        melds: [],
        discards: [],
        score: existingScores ? existingScores[3] : 0,
        startingScore: 0,
        isTenpai: false,
        tenpaiWaits: [],
      },
    ];

    let deckPtr = 0;
    for (let p = 0; p < 4; p++) {
      const cardCount = p === roundDealer ? 14 : 13;
      newPlayers[p].hand = sortTiles(deck.slice(deckPtr, deckPtr + cardCount));
      deckPtr += cardCount;
    }

    const remainingWall = deck.slice(deckPtr);
    setWall(remainingWall);
    setPlayers(newPlayers);
    setActivePlayerIndex(roundDealer);
    setSelectedTile(null);
    setLastDiscardedTile(null);
    setCurrentActionLogs([]);
    setTurnCounter(1);
    setActiveRoundResult(null);

    // CRITICAL: Always reset all interactive call states at round initialization
    setUserCanHu(false);
    setIsSelfDrawHu(false);
    setUserCanChi(false);
    setUserChiCombinations([]);
    setUserCanPeng(false);
    setUserCanGang(false);
    setUserGangCandidates([]);
    setIsUnderTheSea(false);
    setKongDrawPlayer(null);
    setCalledMeldPlayer(null);
    setActionBanner(null);

    // Initial check for dealer if human
    if (roundDealer === 0) {
      checkHumanTurnOptions(newPlayers[0], remainingWall.length, roundPrevailingWind);
    }
  };

  // Mount on start
  React.useEffect(() => {
    initRound(0);
  }, []);

  // Check self-draw Hu, An-gang, Bu-gang for human player
  const checkHumanTurnOptions = (
    humanPlayer: PlayerState,
    currentWallLength: number,
    roundWind?: Wind,
    isKongDraw = false
  ) => {
    if (humanPlayer.hand.length % 3 !== 2) {
      setUserCanHu(false);
      setIsSelfDrawHu(false);
      setUserCanGang(false);
      setUserGangCandidates([]);
      return;
    }

    const drawnTile = humanPlayer.hand[humanPlayer.hand.length - 1];
    const isSea = currentWallLength === 0;
    setIsUnderTheSea(isSea);

    // 1. Check Self-Draw Hu (Appendix III: A2)
    const effectivePrevailingWind = roundWind || prevailingWind;
    const winEval = evaluateWin(humanPlayer.hand, humanPlayer.melds, drawnTile, {
      isSelfDraw: true,
      prevailingWind: effectivePrevailingWind,
      seatWind: humanPlayer.seatWind,
      isUnderTheSea: isSea,
      isSelfDrawOnKong: isKongDraw,
    });

    if (winEval.isWin && winEval.totalFan >= 1) {
      setUserCanHu(true);
      setIsSelfDrawHu(true);
    } else {
      setUserCanHu(false);
      setIsSelfDrawHu(false);
    }

    // 2. Check An-Gang & Bu-Gang
    const anGang = getAnGangCandidates(humanPlayer.hand).map((tiles) => ({
      type: 'an_gang' as const,
      tiles,
    }));
    const buGang = getBuGangCandidates(humanPlayer.hand, humanPlayer.melds).map((item) => ({
      type: 'bu_gang' as const,
      tiles: [item.tile],
      meld: item.meld,
    }));

    const gangs = [...anGang, ...buGang];
    if (gangs.length > 0) {
      setUserCanGang(true);
      setUserGangCandidates(gangs);
    } else {
      setUserCanGang(false);
      setUserGangCandidates([]);
    }
  };

  // Visual action announcement banner (碰！吃！杠！胡！)
  const [actionBanner, setActionBanner] = React.useState<{ text: string; playerIdx: number } | null>(null);

  const showActionBanner = (text: string, playerIdx: number) => {
    setActionBanner({ text, playerIdx });
    setTimeout(() => {
      setActionBanner((prev) => (prev?.text === text ? null : prev));
    }, 1200);
  };

  // Bot Turn Automation Effect
  React.useEffect(() => {
    if (players.length === 0 || activeRoundResult !== null) return;

    // Do NOT trigger bot turn if waiting for human action (Hu, Peng, Gang, Chi)
    if (userCanHu || userCanPeng || userCanGang || userCanChi) return;

    // Do NOT trigger bot turn if a discard is currently pending resolution
    if (lastDiscardedTile !== null) return;

    const activePlayer = players[activePlayerIndex];
    if (!activePlayer || activePlayer.isHuman) return;

    // A bot can ONLY discard if it has drawn or called (hand.length % 3 === 2)
    if (activePlayer.hand.length % 3 !== 2) return;

    // AI Bot takes action after realistic thinking delay (400ms - 600ms)
    const timer = setTimeout(() => {
      handleBotTurn(activePlayerIndex);
    }, 450);

    return () => clearTimeout(timer);
  }, [
    activePlayerIndex,
    players,
    activeRoundResult,
    userCanHu,
    userCanPeng,
    userCanGang,
    userCanChi,
    lastDiscardedTile,
  ]);

  // Execute Bot Turn
  const handleBotTurn = (botIdx: number) => {
    const bot = players[botIdx];
    if (!bot || bot.hand.length === 0) return;

    // After calling Chi/Peng the bot must discard: its last tile wasn't drawn,
    // so it can't declare a self-draw win or a Kong this turn.
    const justCalledMeld = calledMeldPlayer === botIdx;

    if (!justCalledMeld) {
      // 1. Check Bot Self-draw Hu
      const drawnTile = bot.hand[bot.hand.length - 1];
      const isSea = wall.length === 0;

      const winEval = evaluateWin(bot.hand, bot.melds, drawnTile, {
        isSelfDraw: true,
        prevailingWind,
        seatWind: bot.seatWind,
        isUnderTheSea: isSea,
        isSelfDrawOnKong: kongDrawPlayer === botIdx,
      });

      if (winEval.isWin && winEval.totalFan >= 1) {
        soundManager.playHu();
        handleRoundFinish(botIdx, null, drawnTile, true, winEval.fanDetails, winEval.totalFan);
        return;
      }

      // 2. Check Bot Concealed / Added Kong
      const kongAction = checkBotConcealedKong(bot.hand, bot.melds);
      if (kongAction && wall.length > 0) {
        soundManager.playKong();
        executeBotKong(botIdx, kongAction);
        return;
      }
    }

    // 3. Bot Discard, using only information this bot can see
    const allVisible = getVisibleTilesFor(botIdx);
    const opponentDiscards = players.map((p) => p.discards);
    // Hidden hands are unknown to the bot, so it treats an opponent with 2+ exposed melds as a threat
    const opponentTenpais = players.map((p, idx) => idx !== botIdx && p.melds.length >= 2);

    const tileToDiscard = chooseBotDiscard(
      bot.hand,
      bot.melds,
      allVisible,
      prevailingWind,
      bot.seatWind,
      opponentDiscards,
      opponentTenpais,
      difficulty
    );

    executeDiscard(botIdx, tileToDiscard);
  };

  // Bot Kong execution
  const executeBotKong = (
    botIdx: number,
    kong: { type: 'an_gang' | 'bu_gang'; tiles: Tile[]; meld?: Meld }
  ) => {
    const bot = players[botIdx];
    let newHand = [...bot.hand];
    let newMelds = [...bot.melds];

    if (kong.type === 'an_gang') {
      const tileType = kong.tiles[0].type;
      newHand = newHand.filter((t) => t.type !== tileType);
      newMelds.push({
        id: `meld_bot_angang_${Date.now()}`,
        type: 'an_gang',
        tiles: kong.tiles,
      });
    } else if (kong.type === 'bu_gang' && kong.meld) {
      newHand = newHand.filter((t) => t.id !== kong.tiles[0].id);
      newMelds = newMelds.map((m) =>
        m.id === kong.meld?.id ? { ...m, type: 'bu_gang' as const, tiles: [...m.tiles, kong.tiles[0]] } : m
      );
    }

    // Draw replacement tile from wall
    const drawn = wall[0];
    const newWall = wall.slice(1);
    newHand.push(drawn);

    setWall(newWall);
    setKongDrawPlayer(botIdx);
    setPlayers((prev) =>
      prev.map((p, idx) => (idx === botIdx ? { ...p, hand: newHand, melds: newMelds } : p))
    );
  };

  // Discard a tile (by Human or Bot)
  const executeDiscard = (playerIdx: number, tile: Tile) => {
    soundManager.playTileDiscard();
    const player = players[playerIdx];
    const newHand = player.hand.filter((t) => t.id !== tile.id);
    const newDiscards = [...player.discards, tile];
    setKongDrawPlayer(null);
    setCalledMeldPlayer(null);

    // Check shanten & tenpai after discard
    const newShanten = calculateShanten(newHand, player.melds);
    const isNowTenpai = newShanten === 0;

    // Record action log with AI blunder analysis
    let blunderInfo: BlunderAnalysisResult = { isBlunder: false };
    if (player.isHuman) {
      const recs = generateDiscardRecommendations(
        player.hand,
        player.melds,
        getAllVisibleTiles(),
        prevailingWind,
        player.seatWind,
        players.map((p) => p.discards),
        players.map((p) => p.isTenpai)
      );
      blunderInfo = analyzeTurnBlunder(tile, recs);
    }

    const actionLog: TurnActionLog = {
      turnNumber: turnCounter,
      playerIndex: playerIdx,
      playerName: player.name,
      action: 'discard',
      tile,
      shantenBefore: calculateShanten(player.hand, player.melds),
      shantenAfter: newShanten,
      isBlunder: blunderInfo.isBlunder,
      blunderSeverity: blunderInfo.severity,
      blunderType: blunderInfo.type,
      blunderTypeName: blunderInfo.typeName,
      blunderReason: blunderInfo.reason,
      recommendedDiscard: blunderInfo.bestChoice,
      bestRec: blunderInfo.bestRec,
      chosenRec: blunderInfo.chosenRec,
      aiComment: isNowTenpai
        ? '成功进入听牌！随时准备荣和或自摸'
        : blunderInfo.isBlunder
        ? undefined
        : `打出【${tile.displayName}】牌效发挥稳健，保持${newShanten === 0 ? '听牌' : newShanten + '向听'}`,
    };

    setCurrentActionLogs((prev) => [...prev, actionLog]);
    setTurnCounter((prev) => prev + 1);

    // Update player hand & discards
    setPlayers((prev) =>
      prev.map((p, idx) =>
        idx === playerIdx
          ? {
              ...p,
              hand: sortTiles(newHand),
              discards: newDiscards,
              isTenpai: isNowTenpai,
            }
          : p
      )
    );

    setSelectedTile(null);
    setLastDiscardedTile({ tile, fromPlayer: playerIdx });

    // Check response from other 3 players
    checkCallResponses(tile, playerIdx);
  };

  // Check if other players can Chi, Peng, Ming Gang, or Hu on the discarded tile
  const checkCallResponses = (discardedTile: Tile, discarderIdx: number) => {
    const isSea = wall.length === 0;

    // 1. Check if ANY player can Hu on this discard (Appendix III Win)
    // Priority: Hu > Gang/Peng > Chi
    for (let i = 0; i < 4; i++) {
      if (i === discarderIdx) continue;
      const other = players[i];
      const winEval = evaluateWin(other.hand, other.melds, discardedTile, {
        isSelfDraw: false,
        prevailingWind,
        seatWind: other.seatWind,
        isUnderTheSea: isSea,
      });

      if (winEval.isWin && winEval.totalFan >= 1) {
        if (other.isHuman) {
          // Human can Hu!
          setUserCanHu(true);
          setIsSelfDrawHu(false);
          setIsUnderTheSea(isSea);
          // Wait for human decision
          return;
        } else {
          // Bot Hu!
          soundManager.playHu();
          handleRoundFinish(
            i,
            discarderIdx,
            discardedTile,
            false,
            winEval.fanDetails,
            winEval.totalFan
          );
          return;
        }
      }
    }

    // 2. Check Human options for Chi, Peng, Gang if human did not discard
    if (discarderIdx !== 0) {
      const human = players[0];
      const canPengThis = canPeng(human.hand, discardedTile);
      const canGangThis = canMingGang(human.hand, discardedTile);
      // Chi only from player on left (seat 3 is left of seat 0)
      const isFromLeft = (discarderIdx + 1) % 4 === 0;
      const chiCombs = isFromLeft ? getChiCombinations(human.hand, discardedTile) : [];

      if (canPengThis || canGangThis || chiCombs.length > 0) {
        setUserCanPeng(canPengThis);
        setUserCanGang(canGangThis);
        if (canGangThis) {
          setUserGangCandidates([
            {
              type: 'ming_gang',
              tiles: [
                ...human.hand.filter((t) => t.type === discardedTile.type).slice(0, 3),
                discardedTile,
              ],
            },
          ]);
        }
        setUserCanChi(chiCombs.length > 0);
        setUserChiCombinations(chiCombs);
        return; // wait for human input in UI!
      }
    }

    // 3. Check Bots options for Peng / Gang / Chi
    for (let i = 0; i < 4; i++) {
      if (i === discarderIdx || i === 0) continue;
      const bot = players[i];
      const decision = evaluateBotCallResponse(
        i,
        bot.hand,
        bot.melds,
        discardedTile,
        discarderIdx,
        prevailingWind,
        bot.seatWind,
        difficulty
      );

      if (decision.action === 'gang' && decision.tiles) {
        soundManager.playKong();
        executeBotMeldCall(i, 'ming_gang', decision.tiles, discardedTile, discarderIdx);
        return;
      }
      if (decision.action === 'peng' && decision.tiles) {
        soundManager.playMeld();
        executeBotMeldCall(i, 'peng', decision.tiles, discardedTile, discarderIdx);
        return;
      }
      if (decision.action === 'chi' && decision.tiles) {
        soundManager.playMeld();
        executeBotMeldCall(i, 'chi', decision.tiles, discardedTile, discarderIdx);
        return;
      }
    }

    // No one calls -> next player's normal draw turn
    proceedToNextPlayerDraw((discarderIdx + 1) % 4);
  };

  // Bot Meld execution
  const executeBotMeldCall = (
    botIdx: number,
    meldType: 'chi' | 'peng' | 'ming_gang',
    tiles: Tile[],
    calledTile: Tile,
    fromPlayer: number
  ) => {
    const bot = players[botIdx];
    const tilesToRemove = tiles.filter((t) => t.id !== calledTile.id);
    const removeIds = new Set(tilesToRemove.map((t) => t.id));
    const newHand = bot.hand.filter((t) => !removeIds.has(t.id));

    const newMeld: Meld = {
      id: `meld_${botIdx}_${Date.now()}`,
      type: meldType,
      tiles: sortTiles(tiles),
      fromPlayerIndex: fromPlayer,
      calledTile,
    };

    setPlayers((prev) =>
      prev.map((p, idx) => {
        if (idx === botIdx) {
          return { ...p, hand: sortTiles(newHand), melds: [...p.melds, newMeld] };
        }
        if (idx === fromPlayer) {
          return {
            ...p,
            discards: p.discards.filter((d) => d.id !== calledTile.id),
          };
        }
        return p;
      })
    );

    // Record action log
    const actionLog: TurnActionLog = {
      turnNumber: turnCounter,
      playerIndex: botIdx,
      playerName: players[botIdx].name,
      action: meldType === 'chi' ? 'chi' : meldType === 'peng' ? 'peng' : 'gang',
      tile: calledTile,
      meld: newMeld,
      aiComment: `${players[botIdx].name}${meldType === 'chi' ? '吃牌' : meldType === 'peng' ? '碰牌' : '开杠'}`,
    };
    setCurrentActionLogs((prev) => [...prev, actionLog]);

    showActionBanner(
      `${players[botIdx].name} ${meldType === 'ming_gang' ? '杠！' : meldType === 'peng' ? '碰！' : '吃！'}`,
      botIdx
    );

    setActivePlayerIndex(botIdx);
    setLastDiscardedTile(null);

    if (meldType !== 'ming_gang') {
      setCalledMeldPlayer(botIdx);
    } else {
      // Draw kong replacement
      if (wall.length > 0) {
        const drawn = wall[0];
        setWall((w) => w.slice(1));
        setKongDrawPlayer(botIdx);
        setPlayers((prev) =>
          prev.map((p, idx) => (idx === botIdx ? { ...p, hand: [...p.hand, drawn] } : p))
        );
      }
    }
  };

  // Proceed to next player drawing from wall
  const proceedToNextPlayerDraw = (nextPlayerIdx: number) => {
    // Check if wall is depleted -> Exhaustive Draw (流局 / 荒庄)
    if (wall.length === 0) {
      handleRoundFinish(null, null, null, false, [], 0);
      return;
    }

    const drawnTile = wall[0];
    const newWall = wall.slice(1);
    setWall(newWall);
    setActivePlayerIndex(nextPlayerIdx);
    setLastDiscardedTile(null);

    setPlayers((prev) =>
      prev.map((p, idx) => {
        if (idx === nextPlayerIdx) {
          const newHand = [...p.hand, drawnTile];
          return { ...p, hand: newHand };
        }
        return p;
      })
    );

    // If next player is human, analyze actions
    if (nextPlayerIdx === 0) {
      const updatedHuman = {
        ...players[0],
        hand: [...players[0].hand, drawnTile],
      };
      checkHumanTurnOptions(updatedHuman, newWall.length);
    }
  };

  // Handle Human Discard Confirmation
  const handleHumanConfirmDiscard = (tile: Tile) => {
    setUserCanHu(false);
    setUserCanGang(false);
    setUserCanPeng(false);
    setUserCanChi(false);
    executeDiscard(0, tile);
  };

  // Handle Human Pass (过)
  const handleHumanPass = () => {
    setUserCanHu(false);
    setUserCanGang(false);
    setUserCanPeng(false);
    setUserCanChi(false);

    if (lastDiscardedTile) {
      const tile = lastDiscardedTile.tile;
      const discarderIdx = lastDiscardedTile.fromPlayer;

      // Check if any bot wants to call Peng / Gang / Chi on this tile
      let botCalled = false;

      for (let i = 1; i < 4; i++) {
        if (i === discarderIdx) continue;
        const bot = players[i];
        const decision = evaluateBotCallResponse(
          i,
          bot.hand,
          bot.melds,
          tile,
          discarderIdx,
          prevailingWind,
          bot.seatWind,
          difficulty
        );

        if (decision.action === 'gang' && decision.tiles) {
          soundManager.playKong();
          executeBotMeldCall(i, 'ming_gang', decision.tiles, tile, discarderIdx);
          botCalled = true;
          break;
        }
        if (decision.action === 'peng' && decision.tiles) {
          soundManager.playMeld();
          executeBotMeldCall(i, 'peng', decision.tiles, tile, discarderIdx);
          botCalled = true;
          break;
        }
        if (decision.action === 'chi' && decision.tiles) {
          soundManager.playMeld();
          executeBotMeldCall(i, 'chi', decision.tiles, tile, discarderIdx);
          botCalled = true;
          break;
        }
      }

      if (!botCalled) {
        proceedToNextPlayerDraw((discarderIdx + 1) % 4);
      }
    }
  };

  // Handle Human Chi
  const handleHumanChi = (selectedTiles: Tile[]) => {
    if (!lastDiscardedTile) return;
    const calledTile = lastDiscardedTile.tile;
    const discarderPlayer = lastDiscardedTile.fromPlayer;

    soundManager.playMeld();
    showActionBanner('吃！', 0);

    const tilesToRemove = selectedTiles.filter((t) => t.id !== calledTile.id);
    const removeIds = new Set(tilesToRemove.map((t) => t.id));
    const newHand = players[0].hand.filter((t) => !removeIds.has(t.id));

    const newMeld: Meld = {
      id: `meld_human_${Date.now()}`,
      type: 'chi',
      tiles: sortTiles(selectedTiles),
      fromPlayerIndex: discarderPlayer,
      calledTile,
    };

    setPlayers((prev) =>
      prev.map((p, idx) => {
        if (idx === 0) {
          return { ...p, hand: sortTiles(newHand), melds: [...p.melds, newMeld] };
        }
        if (idx === discarderPlayer) {
          return {
            ...p,
            discards: p.discards.filter((d) => d.id !== calledTile.id),
          };
        }
        return p;
      })
    );

    // Record action log
    const actionLog: TurnActionLog = {
      turnNumber: turnCounter,
      playerIndex: 0,
      playerName: players[0].name,
      action: 'chi',
      tile: calledTile,
      meld: newMeld,
      aiComment: `吃牌形成顺子【${selectedTiles.map((t) => t.displayName).join(' ')}】`,
    };
    setCurrentActionLogs((prev) => [...prev, actionLog]);

    setUserCanChi(false);
    setUserCanPeng(false);
    setUserCanGang(false);
    setUserCanHu(false);
    setActivePlayerIndex(0);
    setLastDiscardedTile(null);
    setSelectedTile(null);
  };

  // Handle Human Peng
  const handleHumanPeng = () => {
    if (!lastDiscardedTile) return;
    const calledTile = lastDiscardedTile.tile;
    const discarderPlayer = lastDiscardedTile.fromPlayer;

    const matches = players[0].hand.filter((t) => t.type === calledTile.type).slice(0, 2);
    if (matches.length < 2) return;

    soundManager.playMeld();
    showActionBanner('碰！', 0);

    const removeIds = new Set(matches.map((t) => t.id));
    const newHand = players[0].hand.filter((t) => !removeIds.has(t.id));

    const newMeld: Meld = {
      id: `meld_human_${Date.now()}`,
      type: 'peng',
      tiles: [...matches, calledTile],
      fromPlayerIndex: discarderPlayer,
      calledTile,
    };

    setPlayers((prev) =>
      prev.map((p, idx) => {
        if (idx === 0) {
          return { ...p, hand: sortTiles(newHand), melds: [...p.melds, newMeld] };
        }
        if (idx === discarderPlayer) {
          return {
            ...p,
            discards: p.discards.filter((d) => d.id !== calledTile.id),
          };
        }
        return p;
      })
    );

    // Record action log
    const actionLog: TurnActionLog = {
      turnNumber: turnCounter,
      playerIndex: 0,
      playerName: players[0].name,
      action: 'peng',
      tile: calledTile,
      meld: newMeld,
      aiComment: `碰牌形成刻子【${calledTile.displayName}】`,
    };
    setCurrentActionLogs((prev) => [...prev, actionLog]);

    setUserCanChi(false);
    setUserCanPeng(false);
    setUserCanGang(false);
    setUserCanHu(false);
    setActivePlayerIndex(0);
    setLastDiscardedTile(null);
    setSelectedTile(null);
  };

  // Handle Human Gang
  const handleHumanGang = (candidate: {
    type: 'ming_gang' | 'an_gang' | 'bu_gang';
    tiles: Tile[];
    meld?: Meld;
  }) => {
    soundManager.playKong();
    let newHand = [...players[0].hand];
    let newMelds = [...players[0].melds];
    let discarderPlayer: number | null = null;
    let calledTile: Tile | null = null;

    if (candidate.type === 'ming_gang' && lastDiscardedTile) {
      calledTile = lastDiscardedTile.tile;
      discarderPlayer = lastDiscardedTile.fromPlayer;
      const match = newHand.filter((t) => t.type === calledTile!.type).slice(0, 3);
      const removeIds = new Set(match.map((t) => t.id));
      newHand = newHand.filter((t) => !removeIds.has(t.id));
      newMelds.push({
        id: `meld_human_gang_${Date.now()}`,
        type: 'ming_gang',
        tiles: [...match, calledTile!],
        fromPlayerIndex: discarderPlayer,
      });
    } else if (candidate.type === 'an_gang') {
      const type = candidate.tiles[0].type;
      newHand = newHand.filter((t) => t.type !== type);
      newMelds.push({
        id: `meld_human_angang_${Date.now()}`,
        type: 'an_gang',
        tiles: candidate.tiles,
      });
    } else if (candidate.type === 'bu_gang' && candidate.meld) {
      newHand = newHand.filter((t) => t.id !== candidate.tiles[0].id);
      newMelds = newMelds.map((m) =>
        m.id === candidate.meld?.id
          ? { ...m, type: 'bu_gang' as const, tiles: [...m.tiles, candidate.tiles[0]] }
          : m
      );
    }

    // Draw Kong replacement
    let newWallLength = wall.length;
    if (wall.length > 0) {
      const drawn = wall[0];
      const newWall = wall.slice(1);
      newHand.push(drawn);
      setWall(newWall);
      newWallLength = newWall.length;
      setKongDrawPlayer(0);
    }

    setPlayers((prev) =>
      prev.map((p, idx) => {
        if (idx === 0) {
          return { ...p, hand: newHand, melds: newMelds };
        }
        if (discarderPlayer !== null && idx === discarderPlayer && calledTile) {
          return {
            ...p,
            discards: p.discards.filter((d) => d.id !== calledTile!.id),
          };
        }
        return p;
      })
    );

    // Record action log
    const actionLog: TurnActionLog = {
      turnNumber: turnCounter,
      playerIndex: 0,
      playerName: players[0].name,
      action: 'gang',
      tile: candidate.tiles[0],
      aiComment: `开杠【${candidate.tiles[0].displayName}】`,
    };
    setCurrentActionLogs((prev) => [...prev, actionLog]);

    showActionBanner('杠！', 0);

    setUserCanGang(false);
    setUserCanPeng(false);
    setUserCanChi(false);
    setUserCanHu(false);
    setActivePlayerIndex(0);
    setLastDiscardedTile(null);
    setSelectedTile(null);

    // Check Self-Draw on Kong (A6) and further Kongs with the replacement tile
    checkHumanTurnOptions({ ...players[0], hand: newHand, melds: newMelds }, newWallLength, undefined, true);
  };

  // Handle Human Hu
  const handleHumanHu = () => {
    if (!userCanHu) return;
    setUserCanHu(false);

    const winningTile = isSelfDrawHu
      ? players[0].hand[players[0].hand.length - 1]
      : lastDiscardedTile?.tile;

    if (!winningTile) {
      setIsSelfDrawHu(false);
      return;
    }

    const winEval = evaluateWin(players[0].hand, players[0].melds, winningTile, {
      isSelfDraw: isSelfDrawHu,
      prevailingWind,
      seatWind: players[0].seatWind,
      isUnderTheSea,
      isSelfDrawOnKong: isSelfDrawHu && kongDrawPlayer === 0,
    });

    // Guard: Hand MUST be evaluated as a legitimate win with >= 1 Fan!
    if (!winEval.isWin || winEval.totalFan < 1) {
      setIsSelfDrawHu(false);
      return;
    }

    soundManager.playHu();
    showActionBanner(isSelfDrawHu ? '自摸！' : '胡牌！', 0);

    setUserCanHu(false);
    setIsSelfDrawHu(false);
    setUserCanChi(false);
    setUserCanPeng(false);
    setUserCanGang(false);

    handleRoundFinish(
      0,
      isSelfDrawHu ? null : lastDiscardedTile?.fromPlayer || null,
      winningTile,
      isSelfDrawHu,
      winEval.fanDetails,
      winEval.totalFan
    );
  };

  // Round Finished: Calculate Points Delta and Save History
  const handleRoundFinish = (
    winnerIdx: number | null,
    discarderIdx: number | null,
    winningTile: Tile | null,
    isSelfDraw: boolean,
    fanDetails: any[],
    totalFan: number
  ) => {
    // Immediately clear all prompt states to prevent carrying over to the next round
    setUserCanHu(false);
    setIsSelfDrawHu(false);
    setUserCanChi(false);
    setUserChiCombinations([]);
    setUserCanPeng(false);
    setUserCanGang(false);
    setUserGangCandidates([]);
    setSelectedTile(null);
    setLastDiscardedTile(null);

    const pointsDelta =
      winnerIdx !== null
        ? calculatePointsDelta(totalFan, isSelfDraw, winnerIdx, discarderIdx)
        : [0, 0, 0, 0];

    // Update player scores
    const updatedPlayers = players.map((p, idx) => ({
      ...p,
      score: p.score + pointsDelta[idx],
    }));
    setPlayers(updatedPlayers);

    // Create RoundResult record
    const result: RoundResult = {
      roundIndex: currentRoundIndex,
      prevailingWind,
      roundInWind: (currentRoundIndex % 4) + 1,
      dealerIndex,
      winnerIndex: winnerIdx,
      winningTile,
      isSelfDraw,
      discarderIndex: discarderIdx,
      fanDetails,
      totalFan,
      pointsDelta,
      actionLogs: currentActionLogs,
      handSnapshots: players.map((p) => ({
        hand: [...p.hand],
        melds: [...p.melds],
      })),
    };

    setActiveRoundResult(result);

    // Update career stats
    updateStats((prev) => {
      const isHumanWin = winnerIdx === 0;
      const isHumanDealIn = discarderIdx === 0;

      const fanCounts = { ...prev.fansAchievedCounts };
      if (isHumanWin) {
        fanDetails.forEach((f) => {
          fanCounts[f.code] = (fanCounts[f.code] || 0) + 1;
        });
      }

      return {
        ...prev,
        totalRounds: prev.totalRounds + 1,
        humanWins: prev.humanWins + (isHumanWin ? 1 : 0),
        humanSelfDraws: prev.humanSelfDraws + (isHumanWin && isSelfDraw ? 1 : 0),
        humanDealIns: prev.humanDealIns + (isHumanDealIn ? 1 : 0),
        humanTenpaiCount: prev.humanTenpaiCount + (players[0].isTenpai ? 1 : 0),
        highestFan: isHumanWin ? Math.max(prev.highestFan, totalFan) : prev.highestFan,
        totalPointsEarned: prev.totalPointsEarned + (isHumanWin ? pointsDelta[0] : 0),
        fansAchievedCounts: fanCounts,
        historicalRounds: [...prev.historicalRounds, result],
      };
    });
  };

  // Next round trigger
  const handleNextRound = () => {
    setActiveRoundResult(null);
    setUserCanHu(false);
    setIsSelfDrawHu(false);
    setUserCanChi(false);
    setUserChiCombinations([]);
    setUserCanPeng(false);
    setUserCanGang(false);
    setUserGangCandidates([]);
    setLastDiscardedTile(null);
    setSelectedTile(null);

    if (currentRoundIndex >= 15) {
      // 16 rounds completed! Final championship game over!
      setIsGameOver16(true);
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });
      updateStats((prev) => ({ ...prev, totalGames: prev.totalGames + 1 }));
    } else {
      const nextIdx = currentRoundIndex + 1;
      setCurrentRoundIndex(nextIdx);
      initRound(nextIdx, players.map((p) => p.score));
    }
  };

  // Collect all visible tiles for shanten and safety calculations
  // Tiles a given seat can see: every discard and exposed meld, plus its own hand
  const getVisibleTilesFor = (playerIdx: number): Tile[] => {
    const visible: Tile[] = [];
    players.forEach((p) => {
      p.discards.forEach((d) => visible.push(d));
      p.melds.forEach((m) => m.tiles.forEach((t) => visible.push(t)));
    });
    if (players[playerIdx]) {
      players[playerIdx].hand.forEach((h) => visible.push(h));
    }
    return visible;
  };

  // Tiles visible to the human player
  const getAllVisibleTiles = (): Tile[] => getVisibleTilesFor(0);

  // Live strategy calculations for Human player
  const human = players[0];
  const allVisibleTiles = getAllVisibleTiles();
  const humanShanten = human ? calculateShanten(human.hand, human.melds) : 8;

  const tenpaiWaits: TenpaiWait[] =
    human && human.hand.length % 3 === 1 && humanShanten === 0
      ? calculateTenpaiWaits(
          human.hand,
          human.melds,
          allVisibleTiles,
          prevailingWind,
          human.seatWind
        )
      : [];

  const discardRecommendations: DiscardRecommendation[] =
    human && human.hand.length % 3 === 2
      ? generateDiscardRecommendations(
          human.hand,
          human.melds,
          allVisibleTiles,
          prevailingWind,
          human.seatWind,
          players.map((p) => p.discards),
          players.map((p) => p.isTenpai)
        )
      : [];

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
            · 国标麻将 16 局标准大局与牌效研习
          </span>
        </div>

        {/* Zone 2: Navigation Links (Text Links with Hover Underlines) */}
        <nav className="flex items-center gap-2.5 sm:gap-5 text-xs font-medium text-stone-400">
          <button
            onClick={() => {
              if (careerStats.historicalRounds.length === 0) {
                showActionBanner('暂无已完局记录，完成一局后可随时复盘', 0);
              } else {
                setReviewRoundResult(
                  careerStats.historicalRounds[careerStats.historicalRounds.length - 1]
                );
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
              {difficulty === 'beginner'
                ? 'AI: 入门'
                : difficulty === 'intermediate'
                ? 'AI: 进阶'
                : 'AI: 宗师'}
            </span>
          </button>

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            className="p-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-stone-200 text-xs transition-colors cursor-pointer"
            title={soundEnabled ? '音效开启' : '音效静音'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
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
            activePlayerIndex={activePlayerIndex}
            prevailingWind={prevailingWind}
            currentRoundNumber={currentRoundIndex + 1}
            dealerIndex={dealerIndex}
            wallRemaining={wall.length}
            selectedTile={selectedTile}
            onSelectTile={setSelectedTile}
            onConfirmDiscard={handleHumanConfirmDiscard}
            canChi={userCanChi}
            chiCombinations={userChiCombinations}
            canPeng={userCanPeng}
            canGang={userCanGang}
            gangCandidates={userGangCandidates}
            canHu={userCanHu}
            isSelfDraw={isSelfDrawHu}
            onChi={handleHumanChi}
            onPeng={handleHumanPeng}
            onGang={handleHumanGang}
            onHu={handleHumanHu}
            onPass={handleHumanPass}
            discardRecommendations={discardRecommendations}
            lastDiscardedTile={lastDiscardedTile}
            showHints={isStrategyPanelOpen}
            actionBanner={actionBanner}
          />
        )}

        {/* Live Strategy Panel Sidebar / Drawer */}
        {human && (
          <StrategyPanel
            hand={human.hand}
            melds={human.melds}
            currentShanten={humanShanten}
            tenpaiWaits={tenpaiWaits}
            discardRecommendations={discardRecommendations}
            players={players}
            activePlayerIndex={activePlayerIndex}
            prevailingWind={prevailingWind}
            humanSeatWind={human.seatWind}
            onTileSelect={(t) => setSelectedTile(t)}
            isOpen={isStrategyPanelOpen}
            onToggle={() => setIsStrategyPanelOpen(!isStrategyPanelOpen)}
          />
        )}
      </main>

      {/* ================= MODALS ================= */}
      {/* 1. Round Result Settlement Modal */}
      {activeRoundResult && (
        <RoundResultModal
          result={activeRoundResult}
          players={players}
          currentRoundNumber={currentRoundIndex + 1}
          onNextRound={handleNextRound}
          onOpenReview={() => setReviewRoundResult(activeRoundResult)}
          onRestartMatch={() => setShowRestartConfirmModal(true)}
        />
      )}

      {/* 2. Game Review & Play-by-Play Replay Modal */}
      {reviewRoundResult && (
        <GameReviewModal
          roundResult={reviewRoundResult}
          roundNumber={reviewRoundResult.roundIndex + 1}
          allRounds={careerStats.historicalRounds}
          onSelectRound={(r) => setReviewRoundResult(r)}
          onClose={() => setReviewRoundResult(null)}
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
          onClose={() => setShowStatsModal(false)}
          onOpenReviewRound={(round) => {
            setShowStatsModal(false);
            setReviewRoundResult(round);
          }}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in zoom-in-95">
          <div className="w-full max-w-lg bg-stone-900 border border-amber-500/60 rounded-2xl shadow-2xl p-6 text-center space-y-5">
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
                .sort((a, b) => b.score - a.score)
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
                    </div>
                    <span className="font-mono font-bold text-amber-400 text-base">
                      {p.score > 0 ? `+${p.score}` : p.score} 点
                    </span>
                  </div>
                ))}
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setShowStatsModal(true)}
                className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold cursor-pointer"
              >
                查看生涯总战绩
              </button>
              <button
                onClick={startNew16RoundMatch}
                className="px-6 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 text-xs font-bold shadow-lg transition-transform active:scale-95 cursor-pointer"
              >
                再开一整雀 (16局)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Restart 16-round match confirmation modal */}
      {showRestartConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
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
