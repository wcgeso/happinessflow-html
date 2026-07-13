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
      <div className="rounded-3xl border border-amber-400/30 bg-slate-900/90 p-5 shadow-2xl">
        <div className="flex items-center gap-3">
          <Trophy className="text-amber-400" size={compact ? 24 : 30} />
          <div>
            <h2 className="text-xl font-black text-white sm:text-2xl">幸福排名</h2>
            <p className="text-xs text-slate-400">同分共享名次，排名依幸福點排序</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {podium.map(player => (
            <motion.div
              key={player.uid}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: (player.rank - 1) * 0.08 }}
              className={`rounded-2xl border p-4 ${player.isWinner ? 'border-amber-400/60 bg-amber-400/10' : 'border-slate-700 bg-slate-800/70'}`}
            >
              <div className="text-xs font-black text-slate-400">第 {player.rank} 名</div>
              <div className="mt-1 truncate text-lg font-black text-white">{player.name}</div>
              <div className="mt-3 flex items-center gap-2 text-pink-300">
                <Heart size={16} fill="currentColor" />
                <span className="text-2xl font-black">{player.happiness}</span>
              </div>
              {player.isWinner && <div className="mt-2 text-xs font-black text-amber-300">幸福冠軍</div>}
            </motion.div>
          ))}
        </div>

        {players.length > 3 && (
          <div className="mt-3 divide-y divide-slate-800 rounded-2xl border border-slate-800 bg-slate-950/40 px-4">
            {players.slice(3).map(player => (
              <div key={player.uid} className="flex items-center justify-between py-3 text-sm">
                <span className="font-bold text-slate-300">第 {player.rank} 名　{player.name}</span>
                <span className="font-black text-pink-300">{player.happiness} 幸福</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {recap && (
        <div className="rounded-3xl border border-slate-700 bg-slate-900/90 p-5">
          <div className="flex items-center gap-3">
            <WalletCards className="text-emerald-300" size={22} />
            <div>
              <h3 className="text-lg font-black text-white">你的人生回顧</h3>
              <p className="text-xs text-slate-400">只顯示自己的財務資料</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-800/70 p-3"><div className="text-xs text-slate-500">職業</div><div className="mt-1 font-black text-white">{recap.profession}</div></div>
            <div className="rounded-2xl bg-slate-800/70 p-3"><div className="text-xs text-slate-500">最後現金</div><div className="mt-1 font-black text-emerald-300">{formatMoney(recap.cash)}</div></div>
            <div className="rounded-2xl bg-slate-800/70 p-3"><div className="text-xs text-slate-500">幸福點</div><div className="mt-1 font-black text-pink-300">{recap.happiness}</div></div>
          </div>
          <div className="mt-4 space-y-2 text-sm text-slate-300">
            {recap.firstPositive && <p>第一筆收入：<strong className="text-white">{recap.firstPositive}</strong></p>}
            {recap.firstAsset && <p>第一筆資產行動：<strong className="text-white">{recap.firstAsset}</strong></p>}
            {recap.milestones.length > 0 && <p>完成的重要歷程：<strong className="text-white">{recap.milestones.join('、')}</strong></p>}
          </div>
        </div>
      )}
    </section>
  );
};
