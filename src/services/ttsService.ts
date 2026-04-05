import { GoogleGenAI, Modality } from "@google/genai";
import { Speaker, Segment } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function generateAudioSegment(
  speaker: Speaker,
  segment: Segment
): Promise<string> {
  try {
    // We use Gemini 2.5 Flash Preview TTS as the engine
    // It supports high-quality speech generation.
    // For "design" mode, we use the instruct field to guide the model.
    // For "clone" mode, we would ideally pass the reference audio, 
    // but Gemini TTS currently uses prebuilt voices. 
    // We'll map "design" instructions to the most appropriate prebuilt voice or use the instruct text.
    
    const prompt = speaker.mode === "design" 
      ? `Say this with a ${speaker.instruct} voice: ${segment.text}`
      : `Say this: ${segment.text}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { 
              // Map some common names or just use a default
              voiceName: mapVoice(speaker.instruct) 
            },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error("No audio data received from API");
    }

    const blob = base64ToBlob(base64Audio, "audio/wav");
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error("TTS Generation Error:", error);
    throw error;
  }
}

function mapVoice(instruct: string): "Puck" | "Charon" | "Kore" | "Fenrir" | "Zephyr" {
  const lower = instruct.toLowerCase();
  if (lower.includes("female") || lower.includes("woman") || lower.includes("girl")) return "Kore";
  if (lower.includes("deep") || lower.includes("old") || lower.includes("man")) return "Charon";
  if (lower.includes("young") || lower.includes("boy")) return "Fenrir";
  if (lower.includes("cheerful") || lower.includes("bright")) return "Zephyr";
  return "Puck"; // Default
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

export async function stitchAudioSegments(audioUrls: string[]): Promise<string> {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  const audioBuffers = await Promise.all(
    audioUrls.map(async (url) => {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      return await audioContext.decodeAudioData(arrayBuffer);
    })
  );

  const totalLength = audioBuffers.reduce((acc, buffer) => acc + buffer.length, 0);
  const stitchedBuffer = audioContext.createBuffer(
    audioBuffers[0].numberOfChannels,
    totalLength,
    audioBuffers[0].sampleRate
  );

  let offset = 0;
  for (const buffer of audioBuffers) {
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      stitchedBuffer.getChannelData(channel).set(buffer.getChannelData(channel), offset);
    }
    offset += buffer.length;
  }

  return bufferToWavUrl(stitchedBuffer);
}

function bufferToWavUrl(buffer: AudioBuffer): string {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferArray = new ArrayBuffer(length);
  const view = new DataView(bufferArray);
  const channels = [];
  let i;
  let sample;
  let offset = 0;
  let pos = 0;

  // write WAVE header
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit (hardcoded)

  setUint32(0x61746164); // "data" - chunk
  setUint32(length - pos - 4); // chunk length

  // write interleaved data
  for (i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  while (pos < length) {
    for (i = 0; i < numOfChan; i++) {
      // interleave channels
      sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
      sample = (sample < 0 ? sample * 0x8000 : sample * 0x7fff) | 0; // scale to 16-bit signed int
      view.setInt16(pos, sample, true); // write 16-bit sample
      pos += 2;
    }
    offset++; // next source sample
  }

  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }

  const blob = new Blob([bufferArray], { type: "audio/wav" });
  return URL.createObjectURL(blob);
}
