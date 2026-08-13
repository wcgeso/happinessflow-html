import React, { useMemo } from 'react';
import { Heart, Trophy, WalletCards } from 'lucide-react';
import { motion } from 'framer-motion';
import type { GameState } from '../../types';
import { buildLifeRecap, type SettlementPlayer } from '../../utils/settlement';
import { formatMoney } from '../../utils/gameUtils';

interface SettlementViewProps {
  players: SettlementPlayer[];
  privateState?: GameState | null;
  showPrivateRecap?: boolean;
  compact?: boolean;
}

export const SettlementView: React.FC<SettlementViewProps> = ({
  players,
  privateState,
  showPrivateRecap = true,
  compact = false,
}) => {
  const recap = useMemo(() => showPrivateRecap ? buildLifeRecap(privateState) : null, [privateState, showPrivateRecap]);
  const podium = players.slice(0, 3);

  return (
    <section className={`shrink-0 ${compact ? 'p-4' : 'w-full max-w-3xl p-4 sm:p-6'} space-y-4`} aria-label="遊戲結算">
      <div className="rounded-3xl border border-[#d8c29a] bg-[#fffaf2] p-5 text-[#293a38] shadow-[0_18px_42px_-28px_rgba(16,47,56,0.75)]">
        <div className="flex items-center gap-3">
          <Trophy className="text-[#b9783d]" size={compact ? 24 : 30} />
          <div>
            <h2 className="text-xl font-black text-[#293a38] sm:text-2xl">幸福排名</h2>
            <p className="text-xs text-[#8a7867]">同分共享名次，排名依幸福點排序</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {podium.map(player => (
            <motion.div
              key={player.uid}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: (player.rank - 1) * 0.08 }}
              className={`rounded-2xl border p-4 ${player.isWinner ? 'border-[#d8a85c] bg-[#f8e8c8]' : 'border-[#ead7b8] bg-[#fffdf8]'}`}
            >
              <div className="text-xs font-black text-[#8a7867]">第 {player.rank} 名</div>
              <div className="mt-1 truncate text-lg font-black text-[#293a38]">{player.name}</div>
              <div className="mt-3 flex items-center gap-2 text-[#c94f78]">
                <Heart size={16} fill="currentColor" />
                <span className="text-2xl font-black">{player.happiness}</span>
              </div>
              {player.isWinner && <div className="mt-2 text-xs font-black text-[#a9643a]">幸福冠軍</div>}
            </motion.div>
          ))}
        </div>

        {players.length > 3 && (
          <div className="mt-3 divide-y divide-[#ead7b8] rounded-2xl border border-[#ead7b8] bg-[#f4e6d0]/70 px-4">
            {players.slice(3).map(player => (
              <div key={player.uid} className="flex items-center justify-between py-3 text-sm">
                <span className="font-bold text-[#5f5145]">第 {player.rank} 名　{player.name}</span>
                <span className="font-black text-[#c94f78]">{player.happiness} 幸福</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {recap && (
        <div className="rounded-3xl border border-[#d8c29a] bg-[#fffaf2] p-5 text-[#293a38] shadow-[0_18px_42px_-28px_rgba(16,47,56,0.55)]">
          <div className="flex items-center gap-3">
            <WalletCards className="text-[#2e8876]" size={22} />
            <div>
              <h3 className="text-lg font-black text-[#293a38]">你的人生回顧</h3>
              <p className="text-xs text-[#8a7867]">只顯示自己的財務資料</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[#ead7b8] bg-[#f4e6d0]/70 p-3"><div className="text-xs text-[#8a7867]">職業</div><div className="mt-1 font-black text-[#293a38]">{recap.profession}</div></div>
            <div className="rounded-2xl border border-[#b9d9d0] bg-[#e5f1eb] p-3"><div className="text-xs text-[#6b8078]">最後現金</div><div className="mt-1 font-black text-[#2e8876]">{formatMoney(recap.cash)}</div></div>
            <div className="rounded-2xl border border-[#f2c3d5] bg-[#fff0f5] p-3"><div className="text-xs text-[#a65a75]">幸福點</div><div className="mt-1 font-black text-[#c94f78]">{recap.happiness}</div></div>
          </div>
          <div className="mt-4 space-y-2 text-sm text-[#5f5145]">
            {recap.firstPositive && <p>第一筆收入：<strong className="text-[#293a38]">{recap.firstPositive}</strong></p>}
            {recap.firstAsset && <p>第一筆資產行動：<strong className="text-[#293a38]">{recap.firstAsset}</strong></p>}
            {recap.milestones.length > 0 && <p>完成的重要歷程：<strong className="text-[#293a38]">{recap.milestones.join('、')}</strong></p>}
          </div>
        </div>
      )}
    </section>
  );
};
