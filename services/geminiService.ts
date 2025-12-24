import { GoogleGenAI } from "@google/genai";

// Initialize Gemini
// Note: In a real production app, ensure API_KEY is handled securely via backend proxy.
// For this demo, we assume process.env.API_KEY is available or injected.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const generateWhatsAppMessage = async (memberName: string, expiryDate: string, type: 'REMINDER' | 'WELCOME' | 'OFFER') => {
  if (!process.env.API_KEY) return "Error: API Key missing.";
  
  try {
    const prompt = `
      Act as a professional and friendly gym manager.
      Write a short, engaging WhatsApp message for a member named "${memberName}".
      
      Context:
      ${type === 'REMINDER' ? `Their membership expires on ${new Date(expiryDate).toLocaleDateString()}. Remind them to renew.` : ''}
      ${type === 'WELCOME' ? `They just joined! Welcome them to the gym family.` : ''}
      ${type === 'OFFER' ? `Offer them a 10% discount if they renew within 24 hours.` : ''}
      
      Requirements:
      - Include emojis.
      - Keep it under 50 words.
      - Don't include subject lines or quotes.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Hey! Just a reminder about your gym membership. See you soon! 💪";
  }
};

export const getAIWorkoutTip = async (duration: number) => {
  if (!process.env.API_KEY) return "Stay consistent and drink water!";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Give me one single, powerful, and scientific workout tip for someone who has been working out for ${duration} days. Keep it short (max 1 sentence).`,
    });
    return response.text;
  } catch (error) {
    return "Consistency is key to progress.";
  }
};
