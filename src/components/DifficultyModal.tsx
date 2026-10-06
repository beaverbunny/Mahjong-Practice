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
      title: '比赛实战 (Tournament Field · 推荐)',
      subTitle: '模拟 TVB 外围赛真实对手 · 每位对手风格与水平各不相同',
      desc: '每场随机分配三位对手：速攻型、大牌型、稳健型、防守型或随性型，水平从一般到高手不等。按真实比赛数据校准（每 16 局约 14-15 次和牌，平均每和约 2 番），让你在接近比赛的牌桌上练习。',
      features: ['风格随机 · 场场不同', '依明牌判断危险', '整场结束后揭晓对手风格'],
      tag: '推荐',
    },
    {
      id: 'beginner',
      title: '入门研习 (Beginner / 初级)',
      subTitle: '轻松上手 · 对手多为随性型玩家',
      desc: '对手多为随性型：见牌就吃碰、很少防守、判断误差较大。适合熟悉 TVB 番种与计分规则。',
      features: ['吃碰频繁', '几乎不防守', '判断误差大'],
      tag: '新手',
    },
    {
      id: 'intermediate',
      title: '进阶实战 (Intermediate / 中级)',
      subTitle: '常规牌友水平 · 各种风格混合',
      desc: '对手风格混合，牌效扎实但偶有失误，会在明显危险时适度防守。',
      features: ['风格混合', '适度防守', '偶有失误'],
      tag: '进阶',
    },
    {
      id: 'master',
      title: '雀圣宗师 (Master / 高级)',
      subTitle: '高手牌桌 · 精准牌效与读牌防守',
      desc: '对手均为高水平：精确计算进张与番数，积极做大牌，按对手副露推算危险度防守，几乎没有失误。',
      features: ['精确牌效', '积极做番', '读牌防守'],
      tag: '高难挑战',
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
                AI 对手难度配置
              </h2>
              <div className="text-xs text-stone-400">
                当前所选：
                <span className="text-amber-400 font-semibold ml-1">
                  {selectedDifficulty === 'tournament'
                    ? '比赛实战 (推荐)'
                    : selectedDifficulty === 'beginner'
                    ? '入门研习 (初级)'
                    : selectedDifficulty === 'intermediate'
                    ? '进阶实战 (中级)'
                    : '雀圣宗师 (高级)'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white transition-colors cursor-pointer"
            title="关闭窗口"
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
            切换后从下一局生效，对手风格会重新抽取。
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
              确定
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
