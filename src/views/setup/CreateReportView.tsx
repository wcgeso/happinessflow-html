import React, { useState } from 'react';
import { Card, Input, Button } from '../../components/ui/ui';
import { FileText, ArrowLeft, ChevronRight } from 'lucide-react';
import { GameSessionMeta } from '../../types';

interface CreateReportViewProps {
    defaultName: string;
    onBack: () => void;
    onComplete: (meta: GameSessionMeta) => void;
}

export const CreateReportView: React.FC<CreateReportViewProps> = ({ defaultName, onBack, onComplete }) => {
    const [reportName, setReportName] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onComplete({
            reportName: reportName || `${new Date().toLocaleDateString()} 的覺察報表`,
            playerName: defaultName || 'Player',
            createdAt: new Date().toISOString()
        });
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative">
            <Button variant="secondary" onClick={onBack} className="absolute top-4 right-4 text-slate-400 hover:text-white pl-4 gap-2">
                <ArrowLeft size={20} /> 返回大廳
            </Button>
            <div className="w-full max-w-lg space-y-6 animate-in fade-in slide-in-from-bottom-8">

                <div className="text-center space-y-2">
                    <div className="w-16 h-16 bg-amber-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-500/30">
                        <FileText size={32} className="text-amber-400" />
                    </div>
                    <h2 className="text-3xl font-black text-white">建立新報表</h2>
                    <p className="text-slate-400">為您的這趟人生旅程命名</p>
                </div>

                <Card className="bg-slate-900 border-slate-700 p-6 shadow-2xl">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-300">報表名稱</label>
                            <Input
                                placeholder="例如：我的第一場遊戲"
                                value={reportName}
                                onChange={(e) => setReportName(e.target.value)}
                                className="bg-slate-950 border-slate-800 h-12"
                            />
                        </div>

                        <Button type="submit" className="w-full py-6 text-lg bg-amber-600 hover:bg-amber-500 font-bold shadow-lg shadow-amber-900/20">
                            下一步：選擇職業 <ChevronRight size={20} className="ml-2" />
                        </Button>
                    </form>
                </Card>
            </div>
        </div>
    );
};
