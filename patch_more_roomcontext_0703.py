import re

with open('src/context/RoomContext.tsx', 'r') as f:
    content = f.read()

funcs_to_wrap = [
    r"    const revealBoardCard = async \(eventId: string, cardId: string\) => \{",
    r"    const submitFamilyMilestoneJoinResponse = async \(payload: \{",
    r"    const submitSharedCardPromptResponse = async \(payload: \{"
]

replacements = [
    r"    const revealBoardCard = async (eventId: string, cardId: string) => executeWithLock(async () => {",
    r"    const submitFamilyMilestoneJoinResponse = async (payload: {",
    r"    const submitSharedCardPromptResponse = async (payload: {"
]

# We need to correctly wrap submitFamilyMilestoneJoinResponse and submitSharedCardPromptResponse
# Let's just use regex to replace their definitions and the closing brace

# revealBoardCard
content = re.sub(
    r"    const revealBoardCard = async \(eventId: string, cardId: string\) => \{",
    "    const revealBoardCard = async (eventId: string, cardId: string) => executeWithLock(async () => {",
    content
)
# revealBoardCard ends before advanceBoardEventQueue:
#         }));
#     };
# 
#     const advanceBoardEventQueue
content = re.sub(
    r"        \}\)\)\);\n    \};\n\n    const advanceBoardEventQueue",
    "        }));\n    });\n\n    const advanceBoardEventQueue",
    content
)

# submitFamilyMilestoneJoinResponse
content = re.sub(
    r"    const submitFamilyMilestoneJoinResponse = async \(payload: \{(.*?)\} \)=> \{",
    r"    const submitFamilyMilestoneJoinResponse = async (payload: {\1}) => executeWithLock(async () => {",
    content,
    flags=re.DOTALL
)
# submitFamilyMilestoneJoinResponse ends before clearPendingFamilyMilestoneJoinAction:
#         await safeAsync(updateDoc(roomRef, updates));
#     };
# 
#     const clearPendingFamilyMilestoneJoinAction
content = re.sub(
    r"        await safeAsync\(updateDoc\(roomRef, updates\)\);\n    \};\n\n    const clearPendingFamilyMilestoneJoinAction",
    "        await safeAsync(updateDoc(roomRef, updates));\n    });\n\n    const clearPendingFamilyMilestoneJoinAction",
    content
)

# submitSharedCardPromptResponse
content = re.sub(
    r"    const submitSharedCardPromptResponse = async \(payload: \{(.*?)\}\) => \{",
    r"    const submitSharedCardPromptResponse = async (payload: {\1}) => executeWithLock(async () => {",
    content,
    flags=re.DOTALL
)
# submitSharedCardPromptResponse ends before clearSharedCardPrompt:
#             'boardState.updatedAt': Date.now()
#         }));
#     };
# 
#     const clearSharedCardPrompt
content = re.sub(
    r"            'boardState\.updatedAt': Date\.now\(\)\n        \}\)\)\);\n    \};\n\n    const clearSharedCardPrompt",
    "            'boardState.updatedAt': Date.now()\n        }));\n    });\n\n    const clearSharedCardPrompt",
    content
)

with open('src/context/RoomContext.tsx', 'w') as f:
    f.write(content)

print("Patch applied for executeWithLock")
