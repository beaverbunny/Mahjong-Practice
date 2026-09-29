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
  const options: {
    id: DifficultyLevel;
    title: string;
    subTitle: string;
    desc: string;
    features: string[];
    tag: string;
  }[] = [
    {
      id: 'beginner',
      title: '入门研习 (Casual / 初级)',
      subTitle: '轻松和牌 · 适合新手熟悉国标和牌番种与基础规则',
      desc: 'AI 对手出牌牌效偏向宽松，不严格追求极限进张，很少副露鸣牌（吃碰杠频率低），不擅长防守危险牌，非常适合初学者练习和牌。',
      features: ['牌效进张率 ~50%', '极少防守点炮', '副露频率极低 (~25%)'],
      tag: '新手首选',
    },
    {
      id: 'intermediate',
      title: '进阶实战 (Standard / 中级 · 推荐)',
      subTitle: '逼真手感 · 模拟现实牌桌雀友的常规水平',
      desc: 'AI 具备扎实的牌效推算与向听优化，懂得利用字牌与序数两面搭子加速成牌；对手听牌时会进行适度防守，吃碰判断合理。',
      features: ['牌效进张率 ~85%', '适度防守现物', '副露频率自然 (~60%)'],
      tag: '当前默认',
    },
    {
      id: 'master',
      title: '雀圣宗师 (Master / 高级)',
      subTitle: '竞技天花板 · 极限牌效与深层现物/筋牌防守',
      desc: 'AI 严格执行全局最高牌效与最大进张面切牌，深度结合对手弃牌河进行现物、筋牌（Suji）、绝张字牌防守，极难出冲放铳，进攻速度迅猛。',
      features: ['牌效进张率 100%', '严密现物与筋牌防守', '敏锐进攻副露 (~85%)'],
      tag: '高难挑战',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-stone-900 border border-stone-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-stone-200">
        {/* Header */}
        <div className="px-6 py-4 bg-stone-950/80 border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Bot className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-base font-bold font-serif text-stone-100">
                AI 对手难度配置
              </h2>
              <div className="text-xs text-stone-400">
                当前难度：
                <span className="text-amber-400 font-semibold ml-1">
                  {currentDifficulty === 'beginner'
                    ? '入门研习 (初级)'
                    : currentDifficulty === 'intermediate'
                    ? '进阶实战 (中级)'
                    : '雀圣宗师 (高级)'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Options Body */}
        <div className="p-6 space-y-3.5 text-xs text-stone-300">
          {options.map((opt) => {
            const isSelected = currentDifficulty === opt.id;
            return (
              <div
                key={opt.id}
                onClick={() => onSelectDifficulty(opt.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col gap-2 ${
                  isSelected
                    ? 'bg-amber-950/30 border-amber-500 shadow-md ring-1 ring-amber-500/50'
                    : 'bg-stone-950/40 border-stone-800 hover:bg-stone-800/40'
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

                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-amber-500 text-stone-950 flex items-center justify-center font-bold">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  )}
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

        {/* Footer */}
        <div className="px-6 py-3.5 bg-stone-950/80 border-t border-stone-800 flex items-center justify-between text-xs">
          <span className="text-stone-400">切换后即时生效，可在对局中随时调整。</span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold cursor-pointer transition-colors"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
};
