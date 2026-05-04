import React from 'react';
import { Input } from '../ui/ui';
import { Asset } from '../../types';

interface InsuranceFormProps {
    insType: 'medical' | 'house' | 'aircraft';
    setInsType: (v: any) => void;
    insMedicalQty: string; setInsMedicalQty: (v: string) => void;
    uninsuredHouses: Asset[];
    insSelectedHouses: string[]; setInsSelectedHouses: (v: string[]) => void;
    hasAircraftAsset: boolean;
    insAircraftSelected: boolean; setInsAircraftSelected: (v: boolean) => void;
    showInsAircraftError: boolean; setShowInsAircraftError: (v: boolean) => void;
    setErrorMessage: (v: string | null) => void;
    medicalInsuranceCount?: number;
}

export const InsuranceForm: React.FC<InsuranceFormProps> = ({
    insType, setInsType, insMedicalQty, setInsMedicalQty, uninsuredHouses,
    insSelectedHouses, setInsSelectedHouses, hasAircraftAsset,
    insAircraftSelected, setInsAircraftSelected, showInsAircraftError, setShowInsAircraftError,
    setErrorMessage, medicalInsuranceCount = 0
}) => {
    const hasMedical = medicalInsuranceCount >= 1;
    return (
        <div className="space-y-4">
            <div className="flex bg-slate-900 p-1 rounded-lg">
                <button onClick={() => { setInsType('medical'); setErrorMessage(null); }} className={`flex-1 py-1 text-[10px] font-bold rounded ${insType === 'medical' ? 'bg-slate-600 text-white' : 'text-slate-400'}`}>
                    醫療險{hasMedical && ' ✓'}
                </button>
                <button onClick={() => { setInsType('house'); setErrorMessage(null); setShowInsAircraftError(false); }} className={`flex-1 py-1 text-[10px] font-bold rounded ${insType === 'house' ? 'bg-slate-600 text-white' : 'text-slate-400'}`}>房屋險</button>
                <button onClick={() => { setInsType('aircraft'); setErrorMessage(null); if (hasAircraftAsset) { setInsAircraftSelected(true); } }} className={`flex-1 py-1 text-[10px] font-bold rounded ${insType === 'aircraft' ? 'bg-slate-600 text-white' : 'text-slate-400'}`}>飛行器險</button>
            </div>

            {insType === 'medical' && (
                <div>
                    {hasMedical ? (
                        <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-black text-sm shrink-0">✓</div>
                            <div>
                                <div className="text-sm font-black text-emerald-400">已持有醫療保險</div>
                                <div className="text-[10px] text-slate-500 mt-0.5">每位玩家限購一張，已達上限</div>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div className="p-3 rounded-lg border border-slate-700 bg-slate-900 flex items-center justify-between">
                                <div className="text-sm font-bold text-white">醫療保險</div>
                                <div className="text-sm font-black text-white">1 張</div>
                            </div>
                            <div className="mt-1 space-y-0.5">
                                <div className="text-[10px] text-rose-400 font-bold">預計花費: 2,000 H</div>
                                <div className="text-[10px] text-rose-400 font-bold">預計每月支出增加: 2,000 H</div>
                            </div>
                        </div>
                    )}
                </div>
            )}
             {insType === 'house' && (
                 <div className="space-y-2">
                     <div className="max-h-40 overflow-y-auto pr-1 space-y-2">
                         {uninsuredHouses.length > 0 ? uninsuredHouses.map(h => (
                             <div key={h.id} className="flex items-center gap-2 bg-slate-900 p-2 rounded border border-slate-700" onClick={() => setInsSelectedHouses(insSelectedHouses.includes(h.id) ? insSelectedHouses.filter(i => i !== h.id) : [...insSelectedHouses, h.id])}>
                                 <input type="checkbox" checked={insSelectedHouses.includes(h.id)} readOnly className="accent-emerald-500" /><span className="text-sm text-slate-200">{h.name}</span>
                             </div>
                         )) : <p className="text-center text-slate-500 text-xs py-4 italic">目前無房屋可投保</p>}
                     </div>
                     {insSelectedHouses.length > 0 && (
                          <div className="mt-1 space-y-0.5 px-1">
                              <div className="text-[10px] text-rose-400 font-bold">預計花費: {(insSelectedHouses.length * 2000).toLocaleString()} H</div>
                              <div className="text-[10px] text-rose-400 font-bold">預計每月支出增加: {(insSelectedHouses.length * 2000).toLocaleString()} H</div>
                          </div>
                      )}
                 </div>
             )}
             {insType === 'aircraft' && (
                 <div className="space-y-2">
                     <div className={`p-3 rounded-lg border flex items-center gap-3 transition-all ${!hasAircraftAsset ? 'opacity-50 grayscale bg-slate-800 border-slate-700 cursor-not-allowed' : 'bg-slate-900 border-emerald-500/50 cursor-pointer'}`} onClick={() => { if (hasAircraftAsset) setInsAircraftSelected(!insAircraftSelected); }}>
                         <input type="checkbox" checked={insAircraftSelected} disabled={!hasAircraftAsset} readOnly className="accent-emerald-500 w-5 h-5 pointer-events-none" />
                         <div className="flex-1"><div className="text-sm font-bold text-white">飛行器事故險</div><div className="text-[10px] text-slate-400">{!hasAircraftAsset ? '需先持有飛行器' : '全方位飛行保障'}</div></div>
                     </div>
                     {insAircraftSelected && (
                          <div className="mt-1 space-y-0.5 px-1">
                              <div className="text-[10px] text-rose-400 font-bold">預計花費: 2,000 H</div>
                              <div className="text-[10px] text-rose-400 font-bold">預計每月支出增加: 2,000 H</div>
                          </div>
                      )}
                 </div>
             )}
            <div className="bg-emerald-900/20 p-3 rounded-lg border border-emerald-800/30 flex justify-between items-center text-xs text-emerald-300"><span>每張保費</span><span className="font-bold">2,000 H</span></div>
        </div>
    );
};
