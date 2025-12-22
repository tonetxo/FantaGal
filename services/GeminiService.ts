
import { GoogleGenAI, Type } from "@google/genai";
import { PlanetaryCondition } from "../types";

export async function fetchTitanCondition(prompt: string): Promise<PlanetaryCondition> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze Titan's atmosphere for the prompt: "${prompt}". 
    Return a weather report that dictates how physical resonance pipes would behave.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          stormLevel: { type: Type.NUMBER, description: "Scale 0-1" },
          temperature: { type: Type.NUMBER, description: "Scale 0-1 (low is colder)" },
          methaneDensity: { type: Type.NUMBER, description: "Scale 0-1" },
          description: { type: Type.STRING, description: "A poetic description of the sonic state." },
        },
        required: ["stormLevel", "temperature", "methaneDensity", "description"],
      },
    },
  });

  try {
    return JSON.parse(response.text);
  } catch (e) {
    return {
      stormLevel: 0.5,
      temperature: 0.2,
      methaneDensity: 0.8,
      description: "A thick orange haze settles over the methane basins."
    };
  }
}
