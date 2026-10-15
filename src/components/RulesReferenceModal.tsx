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
              麻將規則手冊 · 標準番種與計分
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
                指定胡牌種類 (附錄二)
              </button>
              <button
                onClick={() => setActiveTab('appendix1')}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  activeTab === 'appendix1'
                    ? 'bg-amber-600 text-stone-950 font-bold'
                    : 'text-stone-300 hover:text-white'
                }`}
              >
                番數得失分表 (附錄一)
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
                <span className="font-bold">附錄二規則説明：</span>
                本遊戲嚴格遵照官方【指定胡牌種類表】計算番數，未列於表內的胡牌種類一概不予承認。包括 1 番胡牌種類 (A1-A8)、3-7 番 (B1-B5) 及 8-10 番 (X1-X4)。單盤總番數上限為 10 番。
              </div>

              <div className="overflow-x-auto rounded-xl border border-stone-800">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-stone-950/80 border-b border-stone-800 text-stone-400 font-medium">
                      <th className="py-2.5 px-3 w-16">編號</th>
                      <th className="py-2.5 px-4 w-44">胡牌種類 (Winning Hand)</th>
                      <th className="py-2.5 px-4">定義 (Description)</th>
                      <th className="py-2.5 px-3 w-20 text-right">番數 (Fan)</th>
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
                <span className="font-bold">附錄一【番數得失分表】：</span>
                胡牌（他家出銃）：胡牌方得 [番數 × 10] 點，由出銃方單獨支付，其餘兩家不加不扣。
                自摸胡牌：自摸方得 [番數 × 15] 點，其他每方各付 [番數 × 5] 點。
              </div>

              <div className="overflow-x-auto rounded-xl border border-stone-800">
                <table className="w-full text-center border-collapse">
                  <thead>
                    <tr className="bg-stone-950/80 border-b border-stone-800 text-stone-400">
                      <th rowSpan={2} className="py-3 px-4 border-r border-stone-800 font-bold">
                        番數 (Fan)
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
                      <th className="py-2 px-3 border-r border-stone-800">出銃方</th>
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
              <span>賽制：四圈即十六盤</span>
            </div>
            <p className="text-stone-400 text-[11px] leading-relaxed">
              比賽按東、南、西、北 4 個風圈進行，每圈 4 盤，共 16 盤。無論胡牌或流局，每盤結束後都輪莊，莊家不連莊。圈風與門風相同時，可同時計入圈風刻與門風刻各 1 番。16 盤結束後彙總最終總分。
            </p>
          </div>

          {/* Play procedure enforced by the game */}
          <div className="p-3.5 bg-stone-950/60 rounded-xl border border-stone-800 space-y-1.5">
            <div className="font-bold text-stone-200">行牌規則（本練習嚴格執行）</div>
            <ul className="text-stone-400 text-[11px] leading-relaxed list-disc pl-4 space-y-1">
              <li>最少 1 番起胡：未列於【指定胡牌種類表】的胡牌種類一概不予承認。無番牌只能自摸（自摸本身 1 番）。</li>
              <li>搶牌優先次序：胡牌 &gt; 槓 / 碰 &gt; 吃。多人同時可胡時，由打牌者下家起按順序最先者胡牌。只有下家可以吃。</li>
              <li>吃、碰後必須打出一張牌，當輪不能自摸或開槓。</li>
              <li>牌牆摸完後的最後一張打出牌只能用來胡牌（計海底撈月），不能吃、碰、槓。</li>
              <li>開槓需從牌尾補牌，牌牆已空時不能開槓。補牌自摸計槓上自摸。</li>
              <li>搶槓：對手加槓（碰後補槓）時，可以胡那張牌，由加槓者單獨支付。</li>
              <li>嚴格胡牌模式下，無番或牌型不完整而報胡即為詐胡：罰付每家 50 點，本盤不得再胡牌。</li>
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
