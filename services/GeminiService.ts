import { GoogleGenAI, Type } from "@google/genai";
import { PlanetaryCondition } from "../types";

export async function fetchTitanCondition(prompt: string, apiKey: string): Promise<PlanetaryCondition> {
  if (!apiKey) {
    throw new Error("Falta a clave API");
  }

  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{
        role: "user",
        parts: [{
          text: `Analiza a atmosfera de Titán para a seguinte solicitude: "${prompt}". 
          Devolve un informe meteorolóxico que dite como se comportarían as tubaxes de resonancia física e os transmutadores vocais. 
          A descrición debe estar en galego e ser mística, poética e moi breve (máximo 15 palabras) para ser recitada por un oráculo.`
        }]
      }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            stormLevel: { type: Type.NUMBER },
            temperature: { type: Type.NUMBER },
            methaneDensity: { type: Type.NUMBER },
            description: { type: Type.STRING },
            gearConfig: {
                type: Type.OBJECT,
                properties: {
                    numGears: { type: Type.NUMBER },
                    arrangement: { type: Type.STRING, enum: ["linear", "cluster", "chaotic"] }
                }
            }
          },
          required: ["stormLevel", "temperature", "methaneDensity", "description"],
        },
      },
    });
    
    // Asumimos que response.text é unha propiedade como no commit anterior que funcionaba
    const responseText = response.text; 
    console.log("Resposta recibida:", responseText);
    
    if (typeof responseText === 'string') {
        return JSON.parse(responseText);
    } else {
        // Fallback se fose unha función ou obxecto inesperado (por seguridade)
        console.warn("response.text non é string:", responseText);
        // Se fose unha función no novo SDK, tentamos chamala:
        if (typeof (response as any).text === 'function') {
             return JSON.parse((response as any).text());
        }
        return JSON.parse(JSON.stringify(responseText));
    }
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
      description: `Erro: ${e.message}. Verifica a API Key.`,
      gearConfig: { numGears: 5, arrangement: "cluster" }
    };
  }
}