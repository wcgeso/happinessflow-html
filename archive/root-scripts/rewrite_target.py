import re

with open('src/components/banking/TargetAndDreamModals.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("`w-full max-w-md bg-slate-900 border border-${colorClass}-500/30 rounded-3xl shadow-2xl overflow-hidden`",
                          "`w-full max-w-md bg-slate-900 border ${isEnterprise ? 'border-indigo-500/30' : 'border-fuchsia-500/30'} rounded-3xl shadow-2xl overflow-hidden`")

content = content.replace("`flex flex-col items-center justify-center p-8 bg-gradient-to-br from-${colorClass}-900/40 to-slate-900 border-b border-slate-800 relative`",
                          "`flex flex-col items-center justify-center p-8 ${isEnterprise ? 'bg-gradient-to-br from-indigo-900/40 to-slate-900' : 'bg-gradient-to-br from-fuchsia-900/40 to-slate-900'} border-b border-slate-800 relative`")

content = content.replace("`w-20 h-20 rounded-full bg-${colorClass}-500/20 flex items-center justify-center border-2 border-${colorClass}-500/50 mb-4 shadow-[0_0_30px_rgba(var(--${colorClass}-500),0.3)]`",
                          "`w-20 h-20 rounded-full ${isEnterprise ? 'bg-indigo-500/20 border-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.3)]' : 'bg-fuchsia-500/20 border-fuchsia-500/50 shadow-[0_0_30px_rgba(217,70,239,0.3)]'} flex items-center justify-center border-2 mb-4`")

content = content.replace("`text-${colorClass}-400`", "isEnterprise ? 'text-indigo-400' : 'text-fuchsia-400'")

content = content.replace("`text-sm font-bold mt-2 text-${colorClass}-400 px-4 py-1 rounded-full bg-${colorClass}-950/50 border border-${colorClass}-500/30`",
                          "`text-sm font-bold mt-2 ${isEnterprise ? 'text-indigo-400 bg-indigo-950/50 border-indigo-500/30' : 'text-fuchsia-400 bg-fuchsia-950/50 border-fuchsia-500/30'} px-4 py-1 rounded-full border`")

content = content.replace("`bg-${colorClass}-600 text-white hover:bg-${colorClass}-500 hover:shadow-[0_0_20px_rgba(var(--${colorClass}-500),0.4)]`",
                          "isEnterprise ? 'bg-indigo-600 text-white hover:bg-indigo-500 hover:shadow-[0_0_20px_rgba(99,102,241,0.4)]' : 'bg-fuchsia-600 text-white hover:bg-fuchsia-500 hover:shadow-[0_0_20px_rgba(217,70,239,0.4)]'")

with open('src/components/banking/TargetAndDreamModals.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("TargetAndDreamModals patched")
