import { GoogleGenAI } from "@google/genai";
import { GameState, FinancialSummary } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getFinancialAdvice = async (
  gameState: GameState, 
  summary: FinancialSummary
): Promise<string> => {
  try {
    const prompt = `
      你是一位「現金流 (Cashflow)」財商桌遊的專業財務顧問。
      請分析玩家當前的財務狀況，並提供策略建議，幫助他們跳出「老鼠賽跑」(被動收入 > 總支出)。
      請使用繁體中文回答。

      當前狀態:
      - 職業: ${gameState.profession?.title}
      - 手頭現金: $${gameState.cash}
      - 總月收入: $${summary.totalIncome}
      - 被動收入: $${summary.passiveIncome}
      - 總支出: $${summary.totalExpenses}
      - 月現金流: $${summary.monthlyCashflow}
      - 小孩數量: ${gameState.children}
      
      資產列表: ${JSON.stringify(gameState.assets.map(a => ({ name: a.name, type: a.type, cashflow: a.cashflow })))}
      負債列表: ${JSON.stringify(gameState.liabilities.map(l => ({ name: l.name, debt: l.totalOwed, cost: l.monthlyPayment })))}

      請提供一個簡潔（100字以內）、條列式的策略計畫。
      重點關注投資報酬率 (ROI)、債務減少（如果有效率的話）或資產收購。
      語氣要具備鼓勵性且符合數學邏輯。
    `;

    // Fix: Using gemini-3-flash-preview for basic text task as per guidelines
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    // Fix: The response feature a text property, not a method. Access it directly.
    return response.text || "持續有效率地投資以增加你的被動收入！";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "金融市場目前波動較大 (API 錯誤)。請專注於增加被動收入。";
  }
};