export type VoiceMode = "clone" | "design";

export interface Speaker {
  id: string;
  name: string;
  mode: VoiceMode;
  language: string;
  instruct: string;
  refAudio?: string; // base64
  refText?: string;
  defaultSpeed: number;
  color: string;
}

export interface Segment {
  id: string;
  speakerId: string;
  text: string;
  language: string;
  speed: number;
  pauseAfterMs: number;
  status: "idle" | "generating" | "success" | "error";
  audioUrl?: string;
  error?: string;
}

export interface Project {
  id: string;
  title: string;
  speakers: Speaker[];
  segments: Segment[];
  createdAt: number;
  updatedAt: number;
}
