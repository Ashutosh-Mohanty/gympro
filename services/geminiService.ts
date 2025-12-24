
import { GoogleGenAI } from "@google/genai";

// Safe API key retrieval to prevent "process is not defined" crash
const getApiKey = () => {
  try {
    return (typeof process !== 'undefined' && process.env?.API_KEY) || '';
  } catch {
    return '';
  }
};

const ai = new GoogleGenAI({ apiKey: getApiKey() });

export const generateWhatsAppMessage = async (memberName: string, expiryDate: string, type: 'REMINDER' | 'WELCOME' | 'OFFER') => {
  const key = getApiKey();
  if (!key) return "Error: API Key missing in environment.";
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Act as a professional and friendly gym manager.
      Write a short, engaging WhatsApp message for a member named "${memberName}".
      
      Context:
      ${type === 'REMINDER' ? `Their membership expires on ${new Date(expiryDate).toLocaleDateString()}. Remind them to renew.` : ''}
      ${type === 'WELCOME' ? `They just joined! Welcome them to the gym family.` : ''}
      ${type === 'OFFER' ? `Offer them a 10% discount if they renew within 24 hours.` : ''}
      
      Requirements:
      - Include emojis.
      - Keep it under 50 words.
      - Don't include subject lines or quotes.`,
    });

    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Hey! Just a reminder about your gym membership. See you soon! 💪";
  }
};

export const getAIWorkoutTip = async (duration: number) => {
  const key = getApiKey();
  if (!key) return "Stay consistent and drink water!";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Give me one single, powerful, and scientific workout tip for someone who has been working out for ${duration} days. Keep it short (max 1 sentence).`,
    });
    return response.text;
  } catch (error) {
    return "Consistency is key to progress.";
  }
};
