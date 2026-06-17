import re

with open('src/types.ts', 'r', encoding='utf-8') as f:
    content = f.read()

old_interface = """export interface BoardCardResult {
  deck: 'happiness' | 'opportunity' | 'news';
  cardId: string;
  title: string;
  description: string;
  subtitle?: string;
  assetSymbol?: string;
  effectLines?: string[];
}"""

new_interface = """export interface BoardCardResult {
  deck: 'happiness' | 'opportunity' | 'news';
  cardId: string;
  title: string;
  description: string;
  subtitle?: string;
  assetSymbol?: string;
  effectLines?: string[];
  familyMilestoneStatus?: any;
}"""

content = content.replace(old_interface, new_interface)

with open('src/types.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("Patched types.ts")
