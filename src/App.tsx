import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, 
  Trash2, 
  Play, 
  Download, 
  Settings, 
  User, 
  MessageSquare, 
  Volume2, 
  Save, 
  FileJson, 
  RefreshCw,
  ChevronRight,
  Mic,
  Type,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { v4 as uuidv4 } from 'uuid';
import { cn } from './lib/utils';
import { Speaker, Segment, Project, VoiceMode } from './types';
import { generateAudioSegment, stitchAudioSegments } from './services/ttsService';

const COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'
];

export default function App() {
  const [project, setProject] = useState<Project>({
    id: uuidv4(),
    title: "Untitled Project",
    speakers: [
      {
        id: 'default-speaker',
        name: 'Narrator',
        mode: 'design',
        language: 'en',
        instruct: 'Professional male narrator, calm and clear',
        defaultSpeed: 1.0,
        color: COLORS[0]
      }
    ],
    segments: [
      {
        id: uuidv4(),
        speakerId: 'default-speaker',
        text: 'Welcome to the OmniVoice Multi-Speaker Playground.',
        language: 'en',
        speed: 1.0,
        pauseAfterMs: 500,
        status: 'idle'
      }
    ],
    createdAt: Date.now(),
    updatedAt: Date.now()
  });

  const [activeTab, setActiveTab] = useState<'script' | 'speakers'>('script');
  const [isRendering, setIsRendering] = useState(false);
  const [finalAudioUrl, setFinalAudioUrl] = useState<string | null>(null);

  // Speaker Management
  const addSpeaker = () => {
    const newSpeaker: Speaker = {
      id: uuidv4(),
      name: `Speaker ${project.speakers.length + 1}`,
      mode: 'design',
      language: 'en',
      instruct: 'Warm friendly voice',
      defaultSpeed: 1.0,
      color: COLORS[project.speakers.length % COLORS.length]
    };
    setProject(prev => ({
      ...prev,
      speakers: [...prev.speakers, newSpeaker],
      updatedAt: Date.now()
    }));
  };

  const updateSpeaker = (id: string, updates: Partial<Speaker>) => {
    setProject(prev => ({
      ...prev,
      speakers: prev.speakers.map(s => s.id === id ? { ...s, ...updates } : s),
      updatedAt: Date.now()
    }));
  };

  const deleteSpeaker = (id: string) => {
    if (project.speakers.length <= 1) return;
    setProject(prev => ({
      ...prev,
      speakers: prev.speakers.filter(s => s.id !== id),
      segments: prev.segments.map(seg => seg.speakerId === id ? { ...seg, speakerId: prev.speakers[0].id } : seg),
      updatedAt: Date.now()
    }));
  };

  // Segment Management
  const addSegment = (index?: number) => {
    const newSegment: Segment = {
      id: uuidv4(),
      speakerId: project.speakers[0].id,
      text: '',
      language: 'en',
      speed: 1.0,
      pauseAfterMs: 500,
      status: 'idle'
    };
    
    setProject(prev => {
      const newSegments = [...prev.segments];
      if (typeof index === 'number') {
        newSegments.splice(index + 1, 0, newSegment);
      } else {
        newSegments.push(newSegment);
      }
      return {
        ...prev,
        segments: newSegments,
        updatedAt: Date.now()
      };
    });
  };

  const updateSegment = (id: string, updates: Partial<Segment>) => {
    setProject(prev => ({
      ...prev,
      segments: prev.segments.map(s => s.id === id ? { ...s, ...updates } : s),
      updatedAt: Date.now()
    }));
  };

  const deleteSegment = (id: string) => {
    if (project.segments.length <= 1) return;
    setProject(prev => ({
      ...prev,
      segments: prev.segments.filter(s => s.id !== id),
      updatedAt: Date.now()
    }));
  };

  // Inference
  const generateSegment = async (segmentId: string) => {
    const segment = project.segments.find(s => s.id === segmentId);
    if (!segment || !segment.text.trim()) return;

    const speaker = project.speakers.find(s => s.id === segment.speakerId);
    if (!speaker) return;

    updateSegment(segmentId, { status: 'generating', error: undefined });

    try {
      const audioUrl = await generateAudioSegment(speaker, segment);
      updateSegment(segmentId, { status: 'success', audioUrl });
    } catch (error) {
      updateSegment(segmentId, { status: 'error', error: (error as Error).message });
    }
  };

  const renderAll = async () => {
    setIsRendering(true);
    setFinalAudioUrl(null);
    
    try {
      const segmentsToRender = project.segments.filter(s => s.status !== 'success' || !s.audioUrl);
      
      // Sequential generation to avoid rate limits
      for (const segment of segmentsToRender) {
        await generateSegment(segment.id);
      }

      // Re-fetch segments to get updated audioUrls
      const updatedProject = await new Promise<Project>(resolve => {
        setProject(prev => {
          resolve(prev);
          return prev;
        });
      });

      const audioUrls = updatedProject.segments
        .filter(s => s.status === 'success' && s.audioUrl)
        .map(s => s.audioUrl!);

      if (audioUrls.length === 0) throw new Error("No audio segments generated");

      const stitchedUrl = await stitchAudioSegments(audioUrls);
      setFinalAudioUrl(stitchedUrl);
    } catch (error) {
      console.error("Render All Error:", error);
    } finally {
      setIsRendering(false);
    }
  };

  const exportProject = () => {
    const dataStr = JSON.stringify(project, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `${project.title.replace(/\s+/g, '_').toLowerCase()}_project.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-200 font-sans selection:bg-blue-500/30">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Volume2 className="text-white w-6 h-6" />
            </div>
            <div>
              <input 
                value={project.title}
                onChange={(e) => setProject(p => ({ ...p, title: e.target.value }))}
                className="bg-transparent border-none focus:ring-0 font-bold text-lg p-0 w-64 text-slate-100"
              />
              <p className="text-xs text-slate-500 uppercase tracking-widest font-medium">OmniVoice Studio</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={exportProject}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-100 transition-colors"
            >
              <FileJson className="w-4 h-4" />
              Export JSON
            </button>
            <button 
              onClick={renderAll}
              disabled={isRendering}
              className={cn(
                "flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold transition-all shadow-lg",
                isRendering 
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed" 
                  : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20 active:scale-95"
              )}
            >
              {isRendering ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Rendering...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Render Full Track
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-12 gap-8">
        {/* Sidebar Tabs */}
        <div className="col-span-12 lg:col-span-3 space-y-6">
          <nav className="bg-slate-900/50 p-1.5 rounded-2xl border border-slate-800 flex">
            <button 
              onClick={() => setActiveTab('script')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all",
                activeTab === 'script' ? "bg-slate-800 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
              )}
            >
              <MessageSquare className="w-4 h-4" />
              Script
            </button>
            <button 
              onClick={() => setActiveTab('speakers')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all",
                activeTab === 'speakers' ? "bg-slate-800 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
              )}
            >
              <User className="w-4 h-4" />
              Speakers
            </button>
          </nav>

          {/* Speakers List in Sidebar if tab is script */}
          <div className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-semibold text-sm text-slate-400 uppercase tracking-wider">Cast</h3>
              <button onClick={addSpeaker} className="p-1 hover:bg-slate-800 rounded-md transition-colors">
                <Plus className="w-4 h-4 text-blue-400" />
              </button>
            </div>
            <div className="p-2 space-y-1">
              {project.speakers.map(speaker => (
                <div 
                  key={speaker.id}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800/50 transition-colors group"
                >
                  <div 
                    className="w-3 h-3 rounded-full shadow-sm" 
                    style={{ backgroundColor: speaker.color }} 
                  />
                  <span className="flex-1 text-sm font-medium truncate">{speaker.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 rounded text-slate-500 uppercase font-bold">
                    {speaker.mode}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Final Output Card */}
          {finalAudioUrl && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-indigo-600 to-blue-700 p-6 rounded-3xl shadow-xl shadow-blue-900/20"
            >
              <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                Final Render Ready
              </h3>
              <audio src={finalAudioUrl} controls className="w-full mb-4 h-10 filter invert" />
              <a 
                href={finalAudioUrl} 
                download={`${project.title}.wav`}
                className="flex items-center justify-center gap-2 w-full py-3 bg-white text-blue-700 rounded-xl font-bold hover:bg-blue-50 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download WAV
              </a>
            </motion.div>
          )}
        </div>

        {/* Main Content Area */}
        <div className="col-span-12 lg:col-span-9">
          <AnimatePresence mode="wait">
            {activeTab === 'script' ? (
              <motion.div 
                key="script-panel"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                {project.segments.map((segment, index) => (
                  <div 
                    key={segment.id}
                    className="group relative bg-slate-900/40 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-all"
                  >
                    <div className="flex items-start gap-6">
                      {/* Speaker Selector */}
                      <div className="w-40 shrink-0">
                        <select 
                          value={segment.speakerId}
                          onChange={(e) => updateSegment(segment.id, { speakerId: e.target.value })}
                          className="w-full bg-slate-800 border-none rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500/50"
                          style={{ color: project.speakers.find(s => s.id === segment.speakerId)?.color }}
                        >
                          {project.speakers.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                        
                        <div className="mt-4 flex flex-col gap-2">
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase">
                            <Settings className="w-3 h-3" />
                            Settings
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500">Speed</span>
                            <input 
                              type="range" min="0.5" max="2.0" step="0.1"
                              value={segment.speed}
                              onChange={(e) => updateSegment(segment.id, { speed: parseFloat(e.target.value) })}
                              className="flex-1 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Text Editor */}
                      <div className="flex-1 space-y-4">
                        <textarea 
                          value={segment.text}
                          onChange={(e) => updateSegment(segment.id, { text: e.target.value })}
                          placeholder="Enter script text..."
                          className="w-full bg-transparent border-none focus:ring-0 resize-none text-lg leading-relaxed placeholder:text-slate-700 min-h-[80px]"
                        />
                        
                        <div className="flex items-center justify-between pt-4 border-t border-slate-800/50">
                          <div className="flex items-center gap-4">
                            {segment.audioUrl && (
                              <button 
                                onClick={() => new Audio(segment.audioUrl).play()}
                                className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 font-medium"
                              >
                                <Play className="w-4 h-4" />
                                Preview
                              </button>
                            )}
                            {segment.status === 'error' && (
                              <div className="flex items-center gap-2 text-xs text-red-400">
                                <AlertCircle className="w-3 h-3" />
                                {segment.error}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => generateSegment(segment.id)}
                              disabled={segment.status === 'generating'}
                              className={cn(
                                "p-2 rounded-lg transition-all",
                                segment.status === 'generating' ? "bg-slate-800" : "hover:bg-slate-800 text-slate-400 hover:text-blue-400"
                              )}
                            >
                              {segment.status === 'generating' ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <RefreshCw className="w-4 h-4" />
                              )}
                            </button>
                            <button 
                              onClick={() => deleteSegment(segment.id)}
                              className="p-2 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Add Segment Button (Hover) */}
                    <button 
                      onClick={() => addSegment(index)}
                      className="absolute -bottom-3 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all bg-slate-800 hover:bg-blue-600 text-white p-1.5 rounded-full shadow-lg z-10"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                
                <button 
                  onClick={() => addSegment()}
                  className="w-full py-8 border-2 border-dashed border-slate-800 rounded-2xl text-slate-500 hover:text-slate-300 hover:border-slate-700 hover:bg-slate-900/30 transition-all flex flex-col items-center gap-2"
                >
                  <Plus className="w-6 h-6" />
                  <span className="font-medium">Add New Script Segment</span>
                </button>
              </motion.div>
            ) : (
              <motion.div 
                key="speakers-panel"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-6"
              >
                {project.speakers.map(speaker => (
                  <div 
                    key={speaker.id}
                    className="bg-slate-900/40 border border-slate-800 rounded-3xl p-8 space-y-6"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div 
                          className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg"
                          style={{ backgroundColor: speaker.color }}
                        >
                          <User className="w-6 h-6" />
                        </div>
                        <input 
                          value={speaker.name}
                          onChange={(e) => updateSpeaker(speaker.id, { name: e.target.value })}
                          className="bg-transparent border-none focus:ring-0 font-bold text-xl p-0"
                        />
                      </div>
                      <button 
                        onClick={() => deleteSpeaker(speaker.id)}
                        className="p-2 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded-xl transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div className="flex p-1 bg-slate-800 rounded-xl">
                        <button 
                          onClick={() => updateSpeaker(speaker.id, { mode: 'design' })}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all",
                            speaker.mode === 'design' ? "bg-slate-700 text-white" : "text-slate-500"
                          )}
                        >
                          <Type className="w-3 h-3" />
                          VOICE DESIGN
                        </button>
                        <button 
                          onClick={() => updateSpeaker(speaker.id, { mode: 'clone' })}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all",
                            speaker.mode === 'clone' ? "bg-slate-700 text-white" : "text-slate-500"
                          )}
                        >
                          <Mic className="w-3 h-3" />
                          VOICE CLONE
                        </button>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                          {speaker.mode === 'design' ? 'Voice Instructions' : 'Reference Audio'}
                        </label>
                        {speaker.mode === 'design' ? (
                          <textarea 
                            value={speaker.instruct}
                            onChange={(e) => updateSpeaker(speaker.id, { instruct: e.target.value })}
                            placeholder="e.g. Deep gravelly voice, middle-aged man, slightly raspy..."
                            className="w-full bg-slate-800/50 border border-slate-800 rounded-xl p-4 text-sm focus:ring-2 focus:ring-blue-500/50 min-h-[100px]"
                          />
                        ) : (
                          <div className="border-2 border-dashed border-slate-800 rounded-xl p-8 flex flex-col items-center gap-3 text-slate-500 hover:border-slate-700 transition-colors cursor-pointer">
                            <Mic className="w-8 h-8" />
                            <span className="text-xs font-medium">Upload Reference WAV/MP3</span>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Language</label>
                          <select 
                            value={speaker.language}
                            onChange={(e) => updateSpeaker(speaker.id, { language: e.target.value })}
                            className="w-full bg-slate-800 border-none rounded-xl text-sm"
                          >
                            <option value="en">English</option>
                            <option value="es">Spanish</option>
                            <option value="fr">French</option>
                            <option value="de">German</option>
                            <option value="zh">Chinese</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Default Speed</label>
                          <div className="flex items-center gap-3">
                            <input 
                              type="range" min="0.5" max="2.0" step="0.1"
                              value={speaker.defaultSpeed}
                              onChange={(e) => updateSpeaker(speaker.id, { defaultSpeed: parseFloat(e.target.value) })}
                              className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                            <span className="text-xs font-mono text-blue-400">{speaker.defaultSpeed}x</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <button 
                  onClick={addSpeaker}
                  className="border-2 border-dashed border-slate-800 rounded-3xl p-8 flex flex-col items-center justify-center gap-4 text-slate-500 hover:text-slate-300 hover:border-slate-700 hover:bg-slate-900/30 transition-all"
                >
                  <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center">
                    <Plus className="w-6 h-6" />
                  </div>
                  <span className="font-bold">Add New Speaker</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Footer / Status Bar */}
      <footer className="fixed bottom-0 left-0 right-0 bg-slate-900/80 backdrop-blur-md border-t border-slate-800 px-6 py-3 flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest z-50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Engine: Gemini 2.5 Flash TTS
          </div>
          <div>{project.segments.length} Segments</div>
          <div>{project.speakers.length} Speakers</div>
        </div>
        <div className="flex items-center gap-2">
          Last saved: {new Date(project.updatedAt).toLocaleTimeString()}
        </div>
      </footer>
    </div>
  );
}
