import React from 'react';
import { Input } from '../ui/ui';
import { Asset, HappinessItem } from '../../types';

interface EventFormProps {
    eventSubMode: 'pay' | 'inc_exp' | 'dec_exp';
    setEventSubMode: (v: 'pay' | 'inc_exp' | 'dec_exp') => void;
    eventPayType: string;
    setEventPayType: (v: string) => void;
    eventCustomName: string;
    setEventCustomName: (v: string) => void;
    eventAmount: string;
    setEventAmount: (v: string) => void;
    eventExpCategory: 'basicLiving' | 'transportEdu' | 'otherMedicalChild';
    setEventExpCategory: (v: any) => void;
    setErrorMessage: (v: string | null) => void;
    eventTab: 'chance' | 'happiness';
    setEventTab: (v: 'chance' | 'happiness') => void;
    happinessSubMode: 'history' | 'pay' | 'inc_exp';
    setHappinessSubMode: (v: 'history' | 'pay' | 'inc_exp') => void;
    completedHappinessEvents: string[];
    happiness: HappinessItem[];
}

export const EventForm: React.FC<EventFormProps> = ({
    eventSubMode, setEventSubMode,
    eventPayType, setEventPayType,
    eventCustomName, setEventCustomName, eventAmount, setEventAmount,
    eventExpCategory, setEventExpCategory, setErrorMessage,
    eventTab, setEventTab,
    happinessSubMode, setHappinessSubMode,
    completedHappinessEvents,
    happiness
}) => {
    const HAPPINESS_EVENTS = [
        { id: 'date', name: '第一次約會', cost: '3,000', type: 'pay', points: 2 },
        { id: 'propose', name: '難忘的求婚', cost: '5,000', type: 'pay', points: 2 },
        { id: 'wedding', name: '浪漫的婚禮', cost: '100,000', type: 'pay', points: 4 },
        { id: 'child1', name: '擁有第一個孩子', cost: '10,000', type: 'inc_exp', points: 4 },
        { id: 'child2', name: '擁有第二個孩子', cost: '10,000', type: 'inc_exp', points: 4 }
    ];

    return (
        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 space-y-6">
            <div className="flex bg-slate-900 p-1 rounded-lg">
                <button
                    onClick={() => setEventTab('chance')}
                    className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${eventTab === 'chance' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                >
                    機運事件
                </button>
                <button
                    onClick={() => setEventTab('happiness')}
                    className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${eventTab === 'happiness' ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                >
                    幸福事件
                </button>
            </div>

            {eventTab === 'chance' ? (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="flex bg-slate-900 p-1 rounded-lg flex-wrap gap-1">
                        <button onClick={() => { setEventSubMode('pay'); setErrorMessage(null); }} className={`flex-1 py-1 text-[10px] rounded transition-all ${eventSubMode === 'pay' ? 'bg-amber-600 text-white' : 'text-slate-400'}`}>支付現金</button>
                        <button onClick={() => { setEventSubMode('inc_exp'); setErrorMessage(null); }} className={`flex-1 py-1 text-[10px] rounded transition-all ${eventSubMode === 'inc_exp' ? 'bg-amber-600 text-white' : 'text-slate-400'}`}>增加月支出</button>
                        <button onClick={() => { setEventSubMode('dec_exp'); setErrorMessage(null); }} className={`flex-1 py-1 text-[10px] rounded transition-all ${eventSubMode === 'dec_exp' ? 'bg-amber-600 text-white' : 'text-slate-400'}`}>減少月支出</button>
                    </div>

                    {eventSubMode === 'pay' ? (
                        <div className="space-y-4">
                            <div><label className="text-xs text-slate-400 block mb-1">事件類別</label><select className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white" value={eventPayType} onChange={e => setEventPayType(e.target.value)}><option value="medical">醫療費用</option><option value="maintenance">維修保養</option><option value="custom">自定義項目</option></select></div>
                            {eventPayType === 'custom' && (<div><label className="text-xs text-slate-400 block mb-1">項目名稱</label><Input value={eventCustomName} onChange={e => setEventCustomName(e.target.value)} /></div>)}
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">支付金額</label>
                                <Input type="number" placeholder="金額" value={eventAmount} onChange={e => setEventAmount(e.target.value)} />
                                {Number(eventAmount) > 0 && <div className="text-[10px] text-rose-400 font-bold mt-1">預計花費: {Number(eventAmount).toLocaleString()} H</div>}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div><label className="text-xs text-slate-400 block mb-1">支出類別</label><select className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white" value={eventExpCategory} onChange={e => setEventExpCategory(e.target.value as any)}><option value="basicLiving">餐飲、服飾、居住類</option><option value="transportEdu">交通、教育、娛樂類</option><option value="otherMedicalChild">其他、醫療、育兒類</option></select></div>
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">
                                    {eventSubMode === 'inc_exp' ? '每月增加支出' : '每月減少支出'}
                                </label>
                                <Input type="number" value={eventAmount} onChange={e => setEventAmount(e.target.value)} />
                                {Number(eventAmount) > 0 && <div className={`text-[10px] font-bold mt-1 ${eventSubMode === 'inc_exp' ? 'text-rose-400' : 'text-emerald-400'}`}>
                                    預計每月支出{eventSubMode === 'inc_exp' ? '增加' : '減少'}: {Number(eventAmount).toLocaleString()} H
                                </div>}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="flex bg-slate-900 p-1 rounded-lg flex-wrap gap-1">
                        <button 
                            onClick={() => { 
                                setHappinessSubMode('history'); 
                                setErrorMessage(null);
                                setEventCustomName('');
                                setEventAmount('');
                            }} 
                            className={`flex-1 py-1 text-[10px] rounded transition-all ${happinessSubMode === 'history' ? 'bg-rose-600 text-white' : 'text-slate-400'}`}
                        >
                            幸福歷程
                        </button>
                        <button 
                            onClick={() => { 
                                setHappinessSubMode('pay'); 
                                setErrorMessage(null);
                                setEventCustomName('');
                                setEventAmount('');
                            }} 
                            className={`flex-1 py-1 text-[10px] rounded transition-all ${happinessSubMode === 'pay' ? 'bg-rose-600 text-white' : 'text-slate-400'}`}
                        >
                            支付現金
                        </button>
                        <button 
                            onClick={() => { 
                                setHappinessSubMode('inc_exp'); 
                                setErrorMessage(null);
                                setEventCustomName('');
                                setEventAmount('');
                            }} 
                            className={`flex-1 py-1 text-[10px] rounded transition-all ${happinessSubMode === 'inc_exp' ? 'bg-rose-600 text-white' : 'text-slate-400'}`}
                        >
                            增加月支出
                        </button>
                    </div>

                    {happinessSubMode === 'history' ? (
                        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                            {HAPPINESS_EVENTS.map(event => {
                                const isCompleted = completedHappinessEvents.includes(event.id) || 
                                                   (event.id === 'date' && happiness.find(h => h.id === 'h_date')?.checked) ||
                                                   (event.id === 'propose' && happiness.find(h => h.id === 'h_proposal')?.checked) ||
                                                   (event.id === 'wedding' && happiness.find(h => h.id === 'h_wedding')?.checked) ||
                                                   (event.id === 'child1' && happiness.find(h => h.id === 'h_child1')?.checked) ||
                                                   (event.id === 'child2' && happiness.find(h => h.id === 'h_child2')?.checked);
                                return (
                                    <button
                                        key={event.id}
                                        disabled={isCompleted}
                                        onClick={() => {
                                            setEventCustomName(event.name);
                                            setEventAmount(event.cost.replace(/,/g, ''));
                                            if (event.type === 'inc_exp') {
                                                setEventExpCategory('otherMedicalChild');
                                            }
                                        }}
                                        className={`w-full flex items-center justify-between p-2 rounded-lg border transition-all ${
                                            eventCustomName === event.name 
                                                ? 'bg-rose-600/20 border-rose-500 shadow-[0_0_15px_rgba(225,29,72,0.1)]' 
                                                : isCompleted 
                                                    ? 'bg-slate-900/30 border-slate-800 opacity-50 grayscale' 
                                                    : 'bg-slate-900/50 border-slate-700 hover:border-rose-500/50 hover:bg-slate-800'
                                        }`}
                                    >
                                        <div className="flex flex-col items-start flex-1">
                                            <span className={`text-xs font-bold ${eventCustomName === event.name ? 'text-rose-400' : 'text-slate-200'}`}>
                                                {event.name}
                                                {isCompleted && <span className="ml-2 text-[10px] text-emerald-500">(已達成)</span>}
                                            </span>
                                            <span className="text-[10px] text-slate-500">
                                                {event.type === 'pay' ? `花費: ${event.cost} H` : `每月支出增加: ${event.cost} H`}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap ${eventCustomName === event.name ? 'bg-rose-500/20 text-rose-300' : 'bg-slate-800 text-slate-400'}`}>
                                                幸福點數 {event.points} 點
                                            </span>
                                            {eventCustomName === event.name && <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {happinessSubMode === 'inc_exp' && (
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">支出類別</label>
                                    <select 
                                        className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white" 
                                        value={eventExpCategory} 
                                        onChange={e => setEventExpCategory(e.target.value as any)}
                                    >
                                        <option value="basicLiving">餐飲、服飾、居住類</option>
                                        <option value="transportEdu">交通、教育、娛樂類</option>
                                        <option value="otherMedicalChild">其他、醫療、育兒類</option>
                                    </select>
                                </div>
                            )}
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">項目名稱</label>
                                <Input 
                                    placeholder={happinessSubMode === 'pay' ? "例如：豪華晚餐" : "例如：請保姆"} 
                                    value={eventCustomName} 
                                    onChange={e => setEventCustomName(e.target.value)} 
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">
                                    {happinessSubMode === 'pay' ? "支付金額" : "每月增加支出"}
                                </label>
                                <Input 
                                    type="number" 
                                    placeholder="輸入金額" 
                                    value={eventAmount} 
                                    onChange={e => setEventAmount(e.target.value)} 
                                />
                                {Number(eventAmount) > 0 && (
                                    <div className="text-[10px] text-rose-400 font-bold mt-1">
                                        預計{happinessSubMode === 'pay' ? '花費' : '月支出增加'}: {Number(eventAmount).toLocaleString()} H
                                    </div>
                                )}
                            </div>
                            <div className="text-[10px] text-slate-400 bg-slate-900/50 p-2 rounded">
                                * 自定義幸福事件固定增加 2 點幸福指數
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
