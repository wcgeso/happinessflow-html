import re

with open('src/components/game/GameActions.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

import_lucide = "import { ShieldPlus, CirclePlus, Coins, Dices"
if "Target" not in import_lucide:
    content = content.replace("import { ShieldPlus, CirclePlus, Coins, Dices } from 'lucide-react';", "import { ShieldPlus, CirclePlus, Coins, Dices, Target } from 'lucide-react';")

props_old = "    onShowSettlement: () => void;"
props_new = "    onShowSettlement: () => void;\n    onShowTargetDream: () => void;"
if props_new not in content:
    content = content.replace(props_old, props_new)

destructure_old = "    onShowSettlement,\n    isBoardTurn = false,"
destructure_new = "    onShowSettlement,\n    onShowTargetDream,\n    isBoardTurn = false,"
if destructure_new not in content:
    content = content.replace(destructure_old, destructure_new)

button_old = "            {/* 交易輸入 */}"
button_new = """            {/* 目標與夢想 */}
            <button
                onClick={onShowTargetDream}
                disabled={disabled}
                className={`group relative flex flex-col items-center gap-2 ${disabled ? 'opacity-40 cursor-not-allowed filter grayscale-[0.5]' : ''}`}
                title={disabled ? "遊戲已結算" : "購買目標與夢想"}
            >
                <div className="w-12 h-12 bg-gradient-to-br from-fuchsia-400 to-fuchsia-600 text-white rounded-full shadow-[0_8px_20px_-6px_rgba(217,70,239,0.5)] flex items-center justify-center transition-all duration-300 group-enabled:hover:scale-110 group-enabled:hover:-translate-y-1 group-active:scale-95 border-2 border-white/20">
                    <Target size={24} strokeWidth={2.5} />
                </div>
                <span className="text-[10px] font-black text-fuchsia-400 uppercase tracking-wider transition-all group-enabled:group-hover:text-fuchsia-300">目標夢想</span>
            </button>

            {/* 交易輸入 */}"""
if "目標夢想" not in content:
    content = content.replace(button_old, button_new)

with open('src/components/game/GameActions.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("GameActions updated")
