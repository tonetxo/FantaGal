import { GoogleGenAI, Type } from "@google/genai";
import { PlanetaryCondition } from "../types";

export async function fetchTitanCondition(prompt: string, apiKey: string): Promise<PlanetaryCondition> {
  if (!apiKey) {
    throw new Error("Falta a clave API");
  }

  const ai = new GoogleGenAI({ apiKey });
  try {
    console.log("Enviando prompt a Gemini con modelo gemini-3-flash-preview...");
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analiza a atmosfera de Titán para a seguinte solicitude: "${prompt}". 
      Devolve un informe meteorolóxico que dite como se comportarían as tubaxes de resonancia física. 
      A descrición debe estar en galego e ser poética.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            stormLevel: { type: Type.NUMBER, description: "Escala 0-1" },
            temperature: { type: Type.NUMBER, description: "Escala 0-1 (baixo é máis frío)" },
            methaneDensity: { type: Type.NUMBER, description: "Escala 0-1" },
            description: { type: Type.STRING, description: "Unha descrición poética do estado sonoro en galego." },
            gearConfig: {
                type: Type.OBJECT,
                properties: {
                    numGears: { type: Type.NUMBER, description: "Número de engranaxes (3-8)" },
                    arrangement: { type: Type.STRING, enum: ["linear", "cluster", "chaotic"], description: "Disposición xeométrica" }
                }
            }
          },
          required: ["stormLevel", "temperature", "methaneDensity", "description", "gearConfig"],
        },
      },
    });
    console.log("Resposta recibida:", response.text);
    return JSON.parse(response.text);
  } catch (e: any) {
    console.error("Erro detallado de Gemini:", e);
    console.error("Mensaxe de erro:", e.message);
    if (e.response) {
       console.error("Status:", e.response.status);
       console.error("Data:", await e.response.text());
    }
    return {
      stormLevel: 0.5,
      temperature: 0.2,
      methaneDensity: 0.8,
      description: "Erro ao interpretar a resposta de Titán. A atmosfera é inestable.",
      gearConfig: { numGears: 5, arrangement: "cluster" }
    };
  }
}