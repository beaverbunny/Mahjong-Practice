import React from 'react';
import { DESIGNATED_HANDS } from '../utils/rulesEngine';
import { BookOpen, X, Table2, Trophy, HelpCircle } from 'lucide-react';

interface RulesReferenceModalProps {
  onClose: () => void;
}

export const RulesReferenceModal: React.FC<RulesReferenceModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = React.useState<'appendix3' | 'appendix1'>('appendix3');

  // Appendix I points data matching the attached PDF
  const pointsTable = [
    { fan: 1, win: '+10', discard: '-10', selfDraw: '+15', eachOther: '-5' },
    { fan: 2, win: '+20', discard: '-20', selfDraw: '+30', eachOther: '-10' },
    { fan: 3, win: '+30', discard: '-30', selfDraw: '+45', eachOther: '-15' },
    { fan: 4, win: '+40', discard: '-40', selfDraw: '+60', eachOther: '-20' },
    { fan: 5, win: '+50', discard: '-50', selfDraw: '+75', eachOther: '-25' },
    { fan: 6, win: '+60', discard: '-60', selfDraw: '+90', eachOther: '-30' },
    { fan: 7, win: '+70', discard: '-70', selfDraw: '+105', eachOther: '-35' },
    { fan: 8, win: '+80', discard: '-80', selfDraw: '+120', eachOther: '-40' },
    { fan: 9, win: '+90', discard: '-90', selfDraw: '+135', eachOther: '-45' },
    { fan: 10, win: '+100', discard: '-100', selfDraw: '+150', eachOther: '-50' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="w-full max-w-4xl max-h-[calc(100vh-2rem)] sm:max-h-[88vh] bg-stone-900 border border-stone-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-stone-200 my-auto">
        {/* Header */}
        <div className="px-6 py-4 bg-stone-950/80 border-b border-stone-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold font-serif text-stone-100">
              麻将规则手册 · 标准番种与计分
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-stone-800 p-0.5 rounded-lg text-xs">
              <button
                onClick={() => setActiveTab('appendix3')}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  activeTab === 'appendix3'
                    ? 'bg-amber-600 text-stone-950 font-bold'
                    : 'text-stone-300 hover:text-white'
                }`}
              >
                指定胡牌种类 (附录二)
              </button>
              <button
                onClick={() => setActiveTab('appendix1')}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  activeTab === 'appendix1'
                    ? 'bg-amber-600 text-stone-950 font-bold'
                    : 'text-stone-300 hover:text-white'
                }`}
              >
                番数得失分表 (附录一)
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6 text-xs text-stone-300">
          {/* TAB 1: Appendix III Designated Winning Hand List */}
          {activeTab === 'appendix3' && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-950/20 border border-amber-800/40 rounded-xl text-amber-200/90 leading-relaxed">
                <span className="font-bold">附录二规则说明：</span>
                本游戏严格遵照官方【指定胡牌种类表】计算番数，未列于表内的胡牌种类一概不予承认。包括 1 番胡牌种类 (A1-A8)、3-7 番 (B1-B5) 及 8-10 番 (X1-X4)。单盘总番数上限为 10 番。
              </div>

              <div className="overflow-x-auto rounded-xl border border-stone-800">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-stone-950/80 border-b border-stone-800 text-stone-400 font-medium">
                      <th className="py-2.5 px-3 w-16">编号</th>
                      <th className="py-2.5 px-4 w-44">胡牌种类 (Winning Hand)</th>
                      <th className="py-2.5 px-4">定义 (Description)</th>
                      <th className="py-2.5 px-3 w-20 text-right">番数 (Fan)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-800/60 font-sans">
                    {Object.values(DESIGNATED_HANDS).map((item) => (
                      <tr
                        key={item.code}
                        className="hover:bg-stone-800/30 transition-colors"
                      >
                        <td className="py-2.5 px-3 font-mono font-bold text-amber-500">
                          {item.code}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-stone-100">
                          {item.name}
                        </td>
                        <td className="py-2.5 px-4 text-stone-400 leading-relaxed">
                          {item.desc}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-400">
                          {item.fan} 番
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: Appendix I Fan-to-Points Table */}
          {activeTab === 'appendix1' && (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-950/20 border border-emerald-800/40 rounded-xl text-emerald-200/90 leading-relaxed">
                <span className="font-bold">附录一【番数得失分表】：</span>
                胡牌（他家出铳）：胡牌方得 [番数 × 10] 点，由出铳方单独支付，其余两家不加不扣。
                自摸胡牌：自摸方得 [番数 × 15] 点，其他每方各付 [番数 × 5] 点。
              </div>

              <div className="overflow-x-auto rounded-xl border border-stone-800">
                <table className="w-full text-center border-collapse">
                  <thead>
                    <tr className="bg-stone-950/80 border-b border-stone-800 text-stone-400">
                      <th rowSpan={2} className="py-3 px-4 border-r border-stone-800 font-bold">
                        番数 (Fan)
                      </th>
                      <th colSpan={2} className="py-2 px-4 border-r border-stone-800 font-bold text-amber-400">
                        胡牌 (Win on Discard)
                      </th>
                      <th colSpan={2} className="py-2 px-4 font-bold text-emerald-400">
                        自摸胡牌 (Self-Draw Win)
                      </th>
                    </tr>
                    <tr className="bg-stone-950/50 border-b border-stone-800 text-stone-400 text-[11px]">
                      <th className="py-2 px-3">胡牌方</th>
                      <th className="py-2 px-3 border-r border-stone-800">出铳方</th>
                      <th className="py-2 px-3">自摸方</th>
                      <th className="py-2 px-3">其他每方</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-800/60 font-mono">
                    {pointsTable.map((row) => (
                      <tr key={row.fan} className="hover:bg-stone-800/30 transition-colors">
                        <td className="py-2.5 px-4 font-bold border-r border-stone-800 text-stone-200">
                          {row.fan}
                        </td>
                        <td className="py-2.5 px-3 text-emerald-400 font-bold">{row.win}</td>
                        <td className="py-2.5 px-3 border-r border-stone-800 text-rose-400 font-bold">
                          {row.discard}
                        </td>
                        <td className="py-2.5 px-3 text-emerald-400 font-bold">{row.selfDraw}</td>
                        <td className="py-2.5 px-3 text-rose-400 font-bold">{row.eachOther}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 16-Round Structure Notice */}
          <div className="p-3.5 bg-stone-950/60 rounded-xl border border-stone-800 space-y-1.5">
            <div className="font-bold text-stone-200 flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>赛制：四圈即十六盘</span>
            </div>
            <p className="text-stone-400 text-[11px] leading-relaxed">
              比赛按东、南、西、北 4 个风圈进行，每圈 4 盘，共 16 盘。无论胡牌或流局，每盘结束后都轮庄，庄家不连庄。圈风与门风相同时，可同时计入圈风刻与门风刻各 1 番。16 盘结束后汇总最终总分。
            </p>
          </div>

          {/* Play procedure enforced by the game */}
          <div className="p-3.5 bg-stone-950/60 rounded-xl border border-stone-800 space-y-1.5">
            <div className="font-bold text-stone-200">行牌规则（本练习严格执行）</div>
            <ul className="text-stone-400 text-[11px] leading-relaxed list-disc pl-4 space-y-1">
              <li>最少 1 番起胡：未列于【指定胡牌种类表】的胡牌种类一概不予承认。无番牌只能自摸（自摸本身 1 番）。</li>
              <li>抢牌优先次序：胡牌 &gt; 杠 / 碰 &gt; 吃。多人同时可胡时，由打牌者下家起按顺序最先者胡牌。只有下家可以吃。</li>
              <li>吃、碰后必须打出一张牌，当轮不能自摸或开杠。</li>
              <li>牌墙摸完后的最后一张打出牌只能用来胡牌（计海底捞月），不能吃、碰、杠。</li>
              <li>开杠需从牌尾补牌，牌墙已空时不能开杠。补牌自摸计杠上自摸。</li>
              <li>抢杠：对手加杠（碰后补杠）时，可以胡那张牌，由加杠者单独支付。</li>
              <li>严格胡牌模式下，无番或牌型不完整而报胡即为诈胡：罚 150 点（其他玩家不得分），本盘不得再胡牌。</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-stone-950/80 border-t border-stone-800 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold cursor-pointer"
          >
            知道了
          </button>
        </div>
      </div>
    </div>
  );
};
