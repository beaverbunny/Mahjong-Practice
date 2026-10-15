import React from 'react';
import { DifficultyLevel } from '../types/mahjong';
import { Bot, Check, Sparkles, Shield, Swords, X } from 'lucide-react';

interface DifficultyModalProps {
  currentDifficulty: DifficultyLevel;
  onSelectDifficulty: (difficulty: DifficultyLevel) => void;
  onClose: () => void;
}

export const DifficultyModal: React.FC<DifficultyModalProps> = ({
  currentDifficulty,
  onSelectDifficulty,
  onClose,
}) => {
  const [selectedDifficulty, setSelectedDifficulty] = React.useState<DifficultyLevel>(currentDifficulty);

  const handleConfirm = () => {
    onSelectDifficulty(selectedDifficulty);
    onClose();
  };

  const options: {
    id: DifficultyLevel;
    title: string;
    subTitle: string;
    desc: string;
    features: string[];
    tag: string;
  }[] = [
    {
      id: 'tournament',
      title: '比賽實戰 (Tournament Field · 推薦)',
      subTitle: '模擬 TVB 外圍賽真實對手 · 每位對手風格與水平各不相同',
      desc: '每場隨機分配三位對手：速攻型、大牌型、穩健型、防守型或隨性型，水平從一般到高手不等。按真實比賽數據校準（每 16 盤約 14-15 次胡牌，平均每次胡牌約 2 番），讓你在接近比賽的牌桌上練習。',
      features: ['風格隨機 · 場場不同', '依明牌判斷危險', '整場結束後揭曉對手風格'],
      tag: '推薦',
    },
    {
      id: 'beginner',
      title: '入門研習 (Beginner / 初級)',
      subTitle: '輕鬆上手 · 對手多為隨性型玩家',
      desc: '對手多為隨性型：見牌就吃碰、很少防守、判斷誤差較大。適合熟悉 TVB 番種與計分規則。',
      features: ['吃碰頻繁', '幾乎不防守', '判斷誤差大'],
      tag: '新手',
    },
    {
      id: 'intermediate',
      title: '進階實戰 (Intermediate / 中級)',
      subTitle: '常規牌友水平 · 各種風格混合',
      desc: '對手風格混合，出牌紮實但偶有失誤，會在明顯危險時適度防守。',
      features: ['風格混合', '適度防守', '偶有失誤'],
      tag: '進階',
    },
    {
      id: 'master',
      title: '雀聖宗師 (Master / 高級)',
      subTitle: '高手牌桌 · 精準出牌與讀牌防守',
      desc: '對手均為高水平：精確計算進張與番數，積極做大牌，按對手吃碰推算危險度防守，幾乎沒有失誤。',
      features: ['精確進張', '積極做番', '讀牌防守'],
      tag: '高難挑戰',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-xl max-h-[calc(100vh-2rem)] sm:max-h-[88vh] bg-stone-900 border border-stone-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-stone-200 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 sm:px-6 py-3.5 sm:py-4 bg-stone-950/90 border-b border-stone-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Bot className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-base font-bold font-serif text-stone-100">
                AI 對手難度配置
              </h2>
              <div className="text-xs text-stone-400">
                當前所選：
                <span className="text-amber-400 font-semibold ml-1">
                  {selectedDifficulty === 'tournament'
                    ? '比賽實戰 (推薦)'
                    : selectedDifficulty === 'beginner'
                    ? '入門研習 (初級)'
                    : selectedDifficulty === 'intermediate'
                    ? '進階實戰 (中級)'
                    : '雀聖宗師 (高級)'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white transition-colors cursor-pointer"
            title="關閉視窗"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Options Body (Scrollable with min-h-0) */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-5 space-y-3 text-xs text-stone-300 overscroll-contain">
          {options.map((opt) => {
            const isSelected = selectedDifficulty === opt.id;
            return (
              <div
                key={opt.id}
                onClick={() => setSelectedDifficulty(opt.id)}
                onDoubleClick={() => {
                  setSelectedDifficulty(opt.id);
                  onSelectDifficulty(opt.id);
                  onClose();
                }}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col gap-2 ${
                  isSelected
                    ? 'bg-amber-950/40 border-amber-500 shadow-md ring-1 ring-amber-500/50'
                    : 'bg-stone-950/40 border-stone-800 hover:bg-stone-800/40 hover:border-stone-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-stone-100">{opt.title}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        isSelected
                          ? 'bg-amber-500 text-stone-950 font-bold'
                          : 'bg-stone-800 text-stone-400'
                      }`}
                    >
                      {opt.tag}
                    </span>
                  </div>

                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center font-bold transition-all ${
                      isSelected
                        ? 'bg-amber-500 text-stone-950 shadow-sm'
                        : 'border border-stone-700 text-transparent'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </div>
                </div>

                <p className="text-stone-400 leading-relaxed text-[11px]">{opt.desc}</p>

                {/* Features Pill tags */}
                <div className="flex flex-wrap gap-2 pt-1 border-t border-stone-800/60">
                  {opt.features.map((feat, fIdx) => (
                    <span
                      key={fIdx}
                      className="text-[10px] text-stone-400 bg-stone-900 px-2 py-0.5 rounded border border-stone-800"
                    >
                      {feat}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer (Fixed at bottom) */}
        <div className="px-5 sm:px-6 py-3.5 bg-stone-950/95 border-t border-stone-800 flex items-center justify-between gap-3 text-xs shrink-0 shadow-lg">
          <span className="text-stone-400 text-[11px] sm:text-xs">
            切換後從下一盤生效，對手風格會重新抽取。
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onClose}
              className="px-3.5 sm:px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-medium cursor-pointer transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              className="px-5 sm:px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold cursor-pointer transition-all shadow-md active:scale-95 ring-1 ring-amber-300/40"
            >
              確定
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
