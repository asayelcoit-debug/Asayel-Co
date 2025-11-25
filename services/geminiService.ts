import { GoogleGenAI } from "@google/genai";

// Safely access process.env to prevent crashes in browser environments (like GitHub Pages)
const apiKey = (typeof process !== 'undefined' && process.env && process.env.API_KEY) ? process.env.API_KEY : '';
const ai = new GoogleGenAI({ apiKey });

/**
 * Checks if an inventory quantity is illogical using Gemini.
 */
export const checkInventoryAnomaly = async (
  itemName: string,
  unit: string,
  quantity: number
): Promise<{ isSuspicious: boolean; message?: string }> => {
  
  // If no API key, fallback to basic logic to allow app demo to work without crashing
  if (!apiKey) {
    console.warn("Gemini API Key missing. Using fallback logic.");
    return { isSuspicious: false };
  }

  try {
    const prompt = `
      I am a supervisor at a medium-sized catering site doing weekly inventory.
      Item: "${itemName}"
      Unit: "${unit}"
      Entered Quantity: ${quantity}

      Is this quantity highly suspicious, physically impossible, or clearly a typo (e.g. entering 5000 kg of salt for one week)?
      Answer strictly in JSON format:
      {
        "isSuspicious": boolean,
        "reason": "short explanation in Arabic if suspicious, else null"
      }
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text;
    if (!text) return { isSuspicious: false };

    const result = JSON.parse(text);
    return {
      isSuspicious: result.isSuspicious,
      message: result.reason
    };

  } catch (error) {
    console.error("Gemini validation failed:", error);
    // Fail safe: don't block the user
    return { isSuspicious: false };
  }
};