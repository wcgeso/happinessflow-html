import re

with open('src/views/game/GameView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

import_target = "import { TargetDreamSelectorModal } from '../../components/banking/TargetDreamSelectorModal';\n"
if "TargetDreamSelectorModal" not in content:
    content = content.replace("import { TransactionForm }", import_target + "import { TransactionForm }")

state_old = "const [showTransactionModal, setShowTransactionModal] = useState(false);"
state_new = "const [showTransactionModal, setShowTransactionModal] = useState(false);\n    const [showTargetDreamModal, setShowTargetDreamModal] = useState(false);"
if "showTargetDreamModal" not in content:
    content = content.replace(state_old, state_new)

actions_old = "                onShowMedical={() => setShowMedicalClaimModal(true)}"
actions_new = "                onShowMedical={() => setShowMedicalClaimModal(true)}\n                onShowTargetDream={() => setShowTargetDreamModal(true)}"
if "onShowTargetDream" not in content:
    content = content.replace(actions_old, actions_new)

render_target = """            {showTargetDreamModal && (
                <TargetDreamSelectorModal
                    enterprise={gameState.selectedEnterprise}
                    dream={gameState.selectedDream}
                    cash={gameState.cash}
                    onTransaction={handleTransaction}
                    onClose={() => setShowTargetDreamModal(false)}
                />
            )}
"""
if "TargetDreamSelectorModal" in content and "enterprise={gameState.selectedEnterprise}" not in content:
    content = content.replace("            <TutorialModal", render_target + "\n            <TutorialModal")

with open('src/views/game/GameView.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("GameView.tsx patched for TargetDreamSelectorModal")
