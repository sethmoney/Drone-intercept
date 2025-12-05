import { GoogleGenAI, Type, Modality } from "@google/genai";
import { MissionParams, SimStatus } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Mission Generation ---
export const generateMission = async (): Promise<MissionParams> => {
  const model = "gemini-2.5-flash";
  
  const response = await ai.models.generateContent({
    model,
    contents: "Generate a drone interception mission. Enemy should be far away (20-40m range), interceptor close to origin. Soldier is at origin.",
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          missionName: { type: Type.STRING },
          enemyPos: {
            type: Type.OBJECT,
            properties: {
              x: { type: Type.NUMBER },
              y: { type: Type.NUMBER },
              z: { type: Type.NUMBER },
            },
            required: ["x", "y", "z"]
          },
          interceptorPos: {
            type: Type.OBJECT,
            properties: {
              x: { type: Type.NUMBER },
              y: { type: Type.NUMBER },
              z: { type: Type.NUMBER },
            },
            required: ["x", "y", "z"]
          },
          briefing: { type: Type.STRING },
        },
        required: ["missionName", "enemyPos", "interceptorPos", "briefing"]
      }
    }
  });

  if (response.text) {
    return JSON.parse(response.text) as MissionParams;
  }
  throw new Error("Failed to generate mission data");
};

// --- Debrief Generation ---
export const generateDebrief = async (
  status: SimStatus,
  duration: number,
  closestDist: number,
  missionName: string
): Promise<string> => {
  const model = "gemini-2.5-flash";
  const prompt = `
    Mission: ${missionName}
    Outcome: ${status}
    Duration: ${duration.toFixed(1)}s
    Closest Approach: ${closestDist.toFixed(2)}m
    
    You are a tactical drill sergeant. Write a 2-sentence debrief. 
    If success, commend the speed. If failure (Soldier KIA), be harsh about the slow reaction time.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
  });

  return response.text || "Communication Error. Debrief unavailable.";
};

// --- Text to Speech ---
export const playTTS = async (text: string): Promise<void> => {
  try {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Kore' },
                },
            },
        },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) return;

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    
    // Decode base64 to buffer
    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    // Helper to decode PCM data manually since it's raw PCM from Gemini
    const audioBuffer = await decodeAudioData(bytes, audioContext, 24000, 1);
    
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    source.start();

  } catch (error) {
    console.error("TTS Error:", error);
  }
};

// PCM Decoding Helper
async function decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
  ): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  }
