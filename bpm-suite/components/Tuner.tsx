import React, { useState, useRef, useEffect, useCallback } from 'react';
import { TUNING_PRESETS, NOTE_NAMES } from '../constants';

const A4_FREQ = 440;

const getNoteDetails = (freq: number) => {
  if (freq <= 0) return null;
  const noteNum = 12 * (Math.log(freq / A4_FREQ) / Math.log(2));
  const roundedNoteNum = Math.round(noteNum);
  const targetFreq = A4_FREQ * Math.pow(2, roundedNoteNum / 12);
  const cents = 1200 * (Math.log(freq / targetFreq) / Math.log(2));
  const noteIndex = (roundedNoteNum % 12 + 12) % 12;
  const noteName = NOTE_NAMES[noteIndex];
  const octave = 4 + Math.floor((roundedNoteNum + 9) / 12);
  return { name: noteName, octave, frequency: freq, targetFrequency: targetFreq, cents: isNaN(cents) ? 0 : cents };
};

const Tuner: React.FC = () => {
  const [isListening, setIsListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string>('chromatic');
  const [detectedNote, setDetectedNote] = useState<{ name: string; octave: number; frequency: number; targetFrequency: number; cents: number; } | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const processMicInput = useCallback(() => {
    if (!analyserRef.current || !audioContextRef.current) {
        animationFrameRef.current = requestAnimationFrame(processMicInput);
        return;
    }

    const bufferLength = analyserRef.current.fftSize;
    const buffer = new Float32Array(bufferLength);
    analyserRef.current.getFloatTimeDomainData(buffer);
    
    let rms = 0;
    for (const amplitude of buffer) rms += amplitude * amplitude;
    rms = Math.sqrt(rms / bufferLength);

    if (rms < 0.01) {
        animationFrameRef.current = requestAnimationFrame(processMicInput);
        return;
    }

    let bestCorrelation = 0, bestLag = -1;
    const sampleRate = audioContextRef.current.sampleRate;
    const minSamples = Math.floor(sampleRate / 1500);
    const maxSamples = Math.floor(sampleRate / 70);

    for (let lag = minSamples; lag < maxSamples; lag++) {
        let correlation = 0;
        for (let i = 0; i < bufferLength - lag; i++) correlation += buffer[i] * buffer[i + lag];
        if (correlation > bestCorrelation) {
            bestCorrelation = correlation;
            bestLag = lag;
        }
    }

    if (bestLag !== -1) {
        const fundamentalFreq = sampleRate / bestLag;
        setDetectedNote(getNoteDetails(fundamentalFreq));
    }

    animationFrameRef.current = requestAnimationFrame(processMicInput);
  }, []);

  const stopMicListener = useCallback(() => {
    if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
    }
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (sourceRef.current) sourceRef.current.disconnect();
    sourceRef.current = null;
    if (audioContextRef.current && audioContextRef.current.state === 'running') audioContextRef.current.suspend();
    setIsListening(false);
  }, []);

  const startMicListener = async () => {
    try {
        if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();

        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        sourceRef.current = audioContextRef.current.createMediaStreamSource(streamRef.current);
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 8192;
        sourceRef.current.connect(analyserRef.current);
        
        setIsListening(true);
        setMicError(null);
        animationFrameRef.current = requestAnimationFrame(processMicInput);
    } catch (err) {
        setMicError("Не удалось получить доступ к микрофону. Проверьте разрешения.");
        stopMicListener();
    }
  };

  const toggleMicListener = () => isListening ? stopMicListener() : startMicListener();

  useEffect(() => () => stopMicListener(), [stopMicListener]);

  const currentTuning = TUNING_PRESETS[selectedPreset];
  const isInstrumentMode = selectedPreset !== 'chromatic';
  
  const closestTargetNote = isInstrumentMode && detectedNote && currentTuning.notes.length > 0
    ? currentTuning.notes.reduce((p, c) => (Math.abs(c.frequency - detectedNote.frequency) < Math.abs(p.frequency - detectedNote.frequency) ? c : p))
    : null;
    
  const centsForDisplay = (isInstrumentMode && closestTargetNote && detectedNote) 
      ? 1200 * (Math.log(detectedNote.frequency / closestTargetNote.frequency) / Math.log(2))
      : (detectedNote ? detectedNote.cents : 0);
      
  const isInTuneForDisplay = detectedNote && Math.abs(centsForDisplay) < 5;

  const notesToRenderForInstrument = 
      (selectedPreset === 'guitar' || selectedPreset === 'violin' || selectedPreset === 'bass') 
      ? [...currentTuning.notes].reverse() 
      : currentTuning.notes;
      
  const needleRotation = `rotate(${Math.max(-45, Math.min(45, centsForDisplay * 0.9))}deg)`;

  return (
    <div className="flex flex-col items-center gap-8 p-4 bg-slate-800/50 border border-slate-700 rounded-2xl">
        <button onClick={toggleMicListener} className={`w-full max-w-xs py-3 text-xl font-bold text-white rounded-lg shadow-lg focus:outline-none transition-all duration-200 transform active:scale-95 ${ isListening ? 'bg-red-500 hover:bg-red-600 glowing-shadow-red' : 'bg-slate-700 hover:bg-slate-600' }`}>
            {isListening ? 'ОСТАНОВИТЬ' : 'НАЧАТЬ'}
        </button>
        {micError && <p className="text-red-400 text-sm text-center -mt-6">{micError}</p>}

        <div className="w-full flex flex-col items-center gap-6">
            <div className="w-full max-w-xs">
                <select value={selectedPreset} onChange={e => setSelectedPreset(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 focus:ring-cyan-500 focus:border-cyan-500">
                    <option value="chromatic">{TUNING_PRESETS['chromatic'].name}</option>
                    <option value="guitar">{TUNING_PRESETS['guitar'].name}</option>
                    <option value="bass">{TUNING_PRESETS['bass'].name}</option>
                    <option value="violin">{TUNING_PRESETS['violin'].name}</option>
                    <option value="ukulele">{TUNING_PRESETS['ukulele'].name}</option>
                </select>
            </div>
            
            <div className="relative w-full max-w-xs h-48 flex flex-col items-center justify-between bg-slate-900 rounded-2xl p-4 overflow-hidden border border-slate-700">
              <div className="absolute top-0 left-0 right-0 h-2/3" style={{ background: 'radial-gradient(circle at 50% 100%, transparent, rgba(34, 211, 238, 0.1))' }}></div>
              <div className="w-full h-24 absolute top-1/2 left-0 -translate-y-1/2">
                <div className="w-[200%] h-[200%] absolute left-1/2 -translate-x-1/2 rounded-full border-t-2" style={{ borderColor: isInTuneForDisplay ? '#4ade80' : '#22d3ee', transition: 'border-color 300ms', transform: 'translateY(-50%)' }}></div>
                <div className={`absolute left-1/2 top-0 h-20 w-1 origin-bottom transition-transform duration-200`} style={{ transform: `${needleRotation} translateY(5px)` }}>
                  <div className={`w-full h-full rounded-full ${isInTuneForDisplay ? 'bg-green-400 glowing-shadow-green' : 'bg-cyan-400 glowing-shadow-cyan'}`}></div>
                </div>
                <div className="absolute top-0 left-1/2 h-full w-[1px] -translate-x-1/2 bg-slate-50/50"></div>
              </div>

              {isListening && detectedNote ? (
                  <div className="relative z-10 text-center">
                      <div className={`text-6xl font-black transition-colors ${isInTuneForDisplay ? 'text-green-400' : 'text-slate-50'}`}>
                          {isInstrumentMode && closestTargetNote ? closestTargetNote.name : detectedNote.name}
                          <span className="text-3xl font-bold text-slate-400">{isInstrumentMode && closestTargetNote ? closestTargetNote.octave : detectedNote.octave}</span>
                      </div>
                      <div className="text-sm text-slate-400">{centsForDisplay.toFixed(1)} центов</div>
                  </div>
              ) : (
                  <div className="relative z-10 text-slate-500 text-center self-center">{isListening ? 'Ожидание сигнала...' : 'Нажмите "НАЧАТЬ"'}</div>
              )}
              <div className="relative z-10 text-xs text-slate-500 w-full flex justify-between px-2">
                <span>-50</span><span>+50</span>
              </div>
            </div>
            
            {selectedPreset === 'chromatic' ? (
                <div className="w-full max-w-sm">
                    <div className="relative h-24 w-full flex select-none">
                        {['C', 'D', 'E', 'F', 'G', 'A', 'B'].map((n) => ( <div key={n} className={`relative flex-1 border-x border-b border-slate-600 bg-slate-50 rounded-b-md transition-colors ${detectedNote?.name === n ? 'bg-cyan-400' : ''}`}></div> ))}
                        <div className={`absolute top-0 h-14 w-[9%] left-[10.5%] border border-slate-500 rounded-b-md transition-colors z-10 ${detectedNote?.name === 'C#' ? 'bg-cyan-400' : 'bg-slate-800'}`}></div>
                        <div className={`absolute top-0 h-14 w-[9%] left-[25.2%] border border-slate-500 rounded-b-md transition-colors z-10 ${detectedNote?.name === 'D#' ? 'bg-cyan-400' : 'bg-slate-800'}`}></div>
                        <div className={`absolute top-0 h-14 w-[9%] left-[53.5%] border border-slate-500 rounded-b-md transition-colors z-10 ${detectedNote?.name === 'F#' ? 'bg-cyan-400' : 'bg-slate-800'}`}></div>
                        <div className={`absolute top-0 h-14 w-[9%] left-[68.2%] border border-slate-500 rounded-b-md transition-colors z-10 ${detectedNote?.name === 'G#' ? 'bg-cyan-400' : 'bg-slate-800'}`}></div>
                        <div className={`absolute top-0 h-14 w-[9%] left-[82.9%] border border-slate-500 rounded-b-md transition-colors z-10 ${detectedNote?.name === 'A#' ? 'bg-cyan-400' : 'bg-slate-800'}`}></div>
                    </div>
                </div>
            ) : (
                <div className="w-full max-w-md">
                    <div className="flex justify-center gap-2 flex-wrap">
                        {notesToRenderForInstrument.map((note) => {
                            const isClose = detectedNote && closestTargetNote && note.name === closestTargetNote.name && note.octave === closestTargetNote.octave;
                            const centsFromTarget = isClose && detectedNote ? 1200 * (Math.log(detectedNote.frequency / note.frequency) / Math.log(2)) : 100;
                            const isTuned = isClose && Math.abs(centsFromTarget) < 5;
                            return (
                                <div key={`${note.name}${note.octave}`} className={`w-14 h-14 flex items-center justify-center rounded-full font-bold text-lg transition-all duration-200
                                    ${ isTuned ? 'bg-green-500 text-white glowing-shadow-green' : isClose ? 'bg-amber-400 text-slate-900 glowing-shadow-amber' : 'bg-slate-700 text-slate-300' }`}>
                                  {note.name}<span className="text-xs ml-0.5 pt-2">{note.octave}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

export default Tuner;