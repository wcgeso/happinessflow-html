import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Terminal, X, Home, UserCheck, Play,
  Monitor, Layout, Trophy, RotateCcw,
  Clock, Zap, ShieldAlert, ExternalLink, Activity,
  Award
} from 'lucide-react';
import { cn } from '../../utils/gameUtils';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../services/firebase';

interface DeveloperPortalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: any) => void;
  currentView: string;
  version: string;
}

export const DeveloperPortal: React.FC<DeveloperPortalProps> = ({
  isOpen, onClose, onNavigate, currentView, version
}) => {

  // 場景跳轉配置
  const scenes = [
    { id: 'lobby', label: '首頁大廳', icon: Home, color: 'bg-blue-500' },
    { id: 'selection', label: '職業選擇', icon: UserCheck, color: 'bg-purple-500' },
    { id: 'game', label: '玩家遊戲畫面', icon: Play, color: 'bg-emerald-500' },
    { id: 'coach_monitor', label: '執行師監控', icon: Monitor, color: 'bg-amber-500' },
    { id: 'room_waiting', label: '房間畫面', icon: Layout, color: 'bg-indigo-500' },
    { id: 'score', label: '結算畫面', icon: Trophy, color: 'bg-rose-500' },
    { id: 'achievements', label: '我的成就', icon: Award, color: 'bg-pink-500' },
  ];

  // 快捷鍵 F1~F7
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      const keyMap: Record<string, string> = {
        'F1': 'lobby',
        'F2': 'selection',
        'F3': 'game',
        'F4': 'coach_monitor',
        'F5': 'room_waiting',
        'F6': 'score',
        'F7': 'achievements',
      };
      if (keyMap[e.key]) {
        e.preventDefault();
        onNavigate(keyMap[e.key]);
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onNavigate, onClose]);

  const handleResetData = () => {
    if (window.confirm('確定要清除所有本地數據並重新載入嗎？這將會登出當前帳號。')) {
      localStorage.clear();
      window.location.reload();
    }
  };




  const handleDisableDevMode = () => {
    if (window.confirm('確定要關閉開發者模式嗎？按鈕將會隱藏。')) {
      localStorage.removeItem('hf_dev_mode');
      onClose();
      window.location.reload();
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-6"
          >
            <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="p-8 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center border border-indigo-500/30">
                    <Terminal className="text-indigo-400" size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white">開發者傳送門</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="px-2 py-0.5 bg-slate-800 rounded text-[10px] font-mono text-slate-400">v{version}</span>
                      <span className="px-2 py-0.5 bg-indigo-500/10 rounded text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Dev Mode Active</span>
                    </div>
                  </div>
                </div>
                <button onClick={onClose} className="p-3 hover:bg-slate-800 rounded-2xl transition-colors text-slate-400 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar">
                {/* Scene Navigation */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <Zap size={14} className="text-amber-500" /> 場景快速跳轉
                    </h3>
                    <span className="text-[10px] text-slate-600 font-bold">快捷鍵 F1 ~ F7</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {scenes.map((scene, idx) => (
                      <button
                        key={scene.id}
                        onClick={() => {
                          onNavigate(scene.id);
                          onClose();
                        }}
                        className={cn(
                          "group relative p-6 rounded-3xl border transition-all text-left overflow-hidden",
                          currentView === scene.id
                            ? "bg-indigo-500/10 border-indigo-500/50"
                            : "bg-slate-800/50 border-slate-700/50 hover:border-slate-500 hover:bg-slate-800"
                        )}
                      >
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110", scene.color + " bg-opacity-20")}>
                          <scene.icon className={cn("text-white", scene.color.replace('bg-', 'text-'))} size={20} />
                        </div>
                        <div className="font-black text-white">{scene.label}</div>
                        <div className="text-[10px] text-slate-500 font-mono mt-1">F{idx + 1} | {scene.id}</div>
                        {currentView === scene.id && (
                          <div className="absolute top-4 right-4 w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* External & Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <ExternalLink size={14} className="text-blue-500" /> 外部連結
                    </h3>
                    <a
                      href="https://console.firebase.google.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-6 bg-blue-500/5 border border-blue-500/20 rounded-3xl hover:bg-blue-500/10 transition-all group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                          <Activity className="text-blue-400" size={20} />
                        </div>
                        <div className="text-left">
                          <div className="font-black text-white">Firebase 控制台</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">查看即時資料庫與紀錄</div>
                        </div>
                      </div>
                      <ExternalLink size={16} className="text-slate-600 group-hover:text-blue-400 transition-colors" />
                    </a>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <ShieldAlert size={14} className="text-rose-500" /> 進階開發工具
                    </h3>
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={handleResetData}
                        className="w-full flex items-center justify-between p-6 bg-rose-500/5 border border-rose-500/20 rounded-3xl hover:bg-rose-500/10 transition-all group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-rose-500/20 rounded-xl flex items-center justify-center">
                            <RotateCcw className="text-rose-500" size={20} />
                          </div>
                          <div className="text-left">
                            <div className="font-black text-white">重置玩家本地數據</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">清除 localStorage 並重新載入</div>
                          </div>
                        </div>
                      </button>



                      <button
                        onClick={handleDisableDevMode}
                        className="w-full flex items-center justify-between p-6 bg-slate-800/50 border border-slate-700/50 rounded-3xl hover:bg-slate-700 transition-all group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-slate-700 rounded-xl flex items-center justify-center">
                            <X className="text-slate-400" size={20} />
                          </div>
                          <div className="text-left">
                            <div className="font-black text-white">關閉開發者模式</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">隱藏開發者按鈕</div>
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>

                {/* System Info */}
                <div className="p-6 bg-slate-800/30 border border-slate-700/50 rounded-3xl flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-700/50 rounded-xl flex items-center justify-center">
                      <Clock className="text-slate-400" size={20} />
                    </div>
                    <div className="text-left">
                      <div className="font-black text-white text-sm">Session 資訊</div>
                      <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                        Current View: {currentView} | Last Build: {new Date().toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 bg-slate-950/50 border-t border-slate-800 text-center">
                <p className="text-[10px] text-slate-600 font-bold uppercase tracking-[0.2em]">
                  Internal Developer Portal • Happiness Flow System
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>


    </>
  );
};
