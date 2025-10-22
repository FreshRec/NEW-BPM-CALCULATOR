import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';

interface BpmCalculatorProps {
  bpm: number;
  setBpm: (newBpm: number) => void;
}

const BpmCalculator: React.FC<BpmCalculatorProps> = ({ bpm, setBpm }) => {
  const [taps, setTaps] = useState<number[]>([]);
  const [displayBpm, setDisplayBpm] = useState<string>(bpm.toFixed(1));

  const [isListeningMic, setIsListeningMic] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [inputLevel, setInputLevel] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const beatDetectionStateRef = useRef({
    beatTimestamps: [] as number[],
    lastPeakTime: 0,
    peakThreshold: 0.1,
  });
  
  useEffect(() => {
    setDisplayBpm(bpm.toFixed(1));
  }, [bpm]);

  const handleTap = useCallback(() => {
    const now = Date.now();
    const newTaps = [...taps, now].slice(-10);
    setTaps(newTaps);

    if (newTaps.length > 1) {
      const intervals = [];
      for (let i = 1; i < newTaps.length; i++) {
        intervals.push(newTaps[i] - newTaps[i - 1]);
      }
      const averageInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      if (averageInterval > 0) {
        const calculatedBpm = 60000 / averageInterval;
        setBpm(calculatedBpm);
      }
    }
  }, [taps, setBpm]);

  const handleBpmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDisplayBpm(value);
    const newBpm = parseFloat(value);
    if (!isNaN(newBpm) && newBpm >= 1 && newBpm <= 500) {
      setBpm(newBpm);
    }
  };

  const handleBpmBlur = () => {
    const newBpm = parseFloat(displayBpm);
    if (displayBpm === '' || isNaN(newBpm)) {
      setDisplayBpm(bpm.toFixed(1));
    } else {
      if (newBpm < 1) setBpm(1);
      else if (newBpm > 500) setBpm(500);
      else setBpm(newBpm);
    }
  };

  const noteDurations = useMemo(() => {
    if (bpm <= 0) return [];
    const quarterNoteDuration = 60000 / bpm;
    return [
      { label: '1', duration: quarterNoteDuration * 4 },
      { label: '1/2', duration: quarterNoteDuration * 2 },
      { label: '1/4', duration: quarterNoteDuration },
      { label: '1/8', duration: quarterNoteDuration / 2 },
      { label: '1/16', duration: quarterNoteDuration / 4 },
      { label: '1/32', duration: quarterNoteDuration / 8 },
      { label: '1/64', duration: quarterNoteDuration / 16 },
      { label: '1/128', duration: quarterNoteDuration / 32 },
      { label: '1/256', duration: quarterNoteDuration / 64 },
      { label: '1/512', duration: quarterNoteDuration / 128 },
      { label: '1/8 dot', duration: (quarterNoteDuration / 2) * 1.5 },
      { label: '1/8t', duration: (quarterNoteDuration * 2) / 3 / 2 },
    ];
  }, [bpm]);

    const processMicInput = useCallback(() => {
        if (!analyserRef.current) {
            if(animationFrameRef.current) animationFrameRef.current = requestAnimationFrame(processMicInput);
            return;
        }

        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteTimeDomainData(dataArray);

        let sumSquares = 0.0;
        for (const amplitude of dataArray) {
            const normalized = amplitude / 128.0 - 1.0;
            sumSquares += normalized * normalized;
        }
        const rms = Math.sqrt(sumSquares / bufferLength);
        setInputLevel(Math.min(1, rms * 5));

        const now = performance.now();
        const state = beatDetectionStateRef.current;
        
        if (rms > state.peakThreshold && now - state.lastPeakTime > 200) { 
            state.lastPeakTime = now;
            state.beatTimestamps.push(now);
            state.beatTimestamps = state.beatTimestamps.slice(-20);

            if (state.beatTimestamps.length > 5) {
                const intervals = [];
                for (let i = 1; i < state.beatTimestamps.length; i++) {
                    intervals.push(state.beatTimestamps[i] - state.beatTimestamps[i - 1]);
                }
                intervals.sort((a, b) => a - b);
                const medianInterval = intervals[Math.floor(intervals.length / 2)];

                if (medianInterval > 0) {
                    const calculatedBpm = 60000 / medianInterval;
                    if (calculatedBpm >= 40 && calculatedBpm <= 250) {
                        const newBpm = (bpm * 0.5) + (calculatedBpm * 0.5);
                        setBpm(newBpm);
                    }
                }
            }
        }
        
        state.peakThreshold = Math.max(0.08, rms * 1.5);

        animationFrameRef.current = requestAnimationFrame(processMicInput);
    }, [bpm, setBpm]);

    const stopMicListener = useCallback(() => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (sourceRef.current) {
            sourceRef.current.disconnect();
            sourceRef.current = null;
        }
        if (audioContextRef.current && audioContextRef.current.state === 'running') {
            audioContextRef.current.suspend();
        }
        setIsListeningMic(false);
        setInputLevel(0);
    }, []);

    const startMicListener = async () => {
        try {
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            if (audioContextRef.current.state === 'suspended') {
              await audioContextRef.current.resume();
            }

            streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            sourceRef.current = audioContextRef.current.createMediaStreamSource(streamRef.current);
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 2048;
            sourceRef.current.connect(analyserRef.current);
            
            setIsListeningMic(true);
            setMicError(null);
            beatDetectionStateRef.current.beatTimestamps = [];
            animationFrameRef.current = requestAnimationFrame(processMicInput);

        } catch (err) {
            console.error("Mic access error:", err);
            setMicError("Не удалось получить доступ к микрофону. Проверьте разрешения.");
            stopMicListener();
        }
    };

    const toggleMicListener = () => {
        if (isListeningMic) {
            stopMicListener();
        } else {
            startMicListener();
        }
    };

    useEffect(() => {
        return () => stopMicListener();
    }, [stopMicListener]);

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="w-full text-center p-4 bg-slate-800/50 rounded-2xl border border-slate-700">
        <label htmlFor="bpm-input" className="block text-sm font-semibold text-cyan-400 mb-2 tracking-widest">
          ТЕМП
        </label>
        <input
          id="bpm-input"
          type="text"
          inputMode="decimal"
          value={displayBpm}
          onChange={handleBpmChange}
          onBlur={handleBpmBlur}
          className="w-full text-center text-7xl font-black text-slate-50 bg-transparent focus:outline-none"
          style={{ fontFamily: 'monospace' }}
        />
      </div>

      <button
        onClick={handleTap}
        className="w-48 h-48 text-2xl font-bold text-white bg-cyan-500 rounded-full shadow-lg active:bg-cyan-600 focus:outline-none transition-all duration-150 transform active:scale-95 glowing-shadow-cyan flex items-center justify-center"
      >
        TAP
      </button>

      <div className="w-full border-t border-slate-800 pt-8 flex flex-col items-center gap-6">
          <h3 className="text-lg font-semibold text-slate-300">Определение по микрофону</h3>
          <div className="flex items-center gap-6 w-full max-w-xs">
            <div className="relative w-10 h-32 bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                <div className="absolute bottom-0 left-0 right-0 bg-cyan-400" style={{ height: `${inputLevel * 100}%` }}></div>
            </div>
            <button
              onClick={toggleMicListener}
              className={`flex-1 py-4 text-xl font-bold text-white rounded-lg shadow-lg focus:outline-none transition-all duration-200 transform active:scale-95 ${isListeningMic ? 'bg-red-500 hover:bg-red-600 glowing-shadow-red' : 'bg-slate-700 hover:bg-slate-600'}`}
            >
                {isListeningMic ? 'СТОП' : 'НАЧАТЬ'}
            </button>
          </div>
          {micError && <p className="text-red-400 text-sm text-center -mt-2">{micError}</p>}
      </div>

      <div className="w-full border-t border-slate-800 pt-8">
        <h3 className="text-lg font-semibold text-center mb-4">Длительности нот (мс)</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {noteDurations.map(({ label, duration }) => (
            <div key={label} className="p-3 bg-slate-800/50 backdrop-blur-sm border border-slate-700/80 rounded-lg text-center">
              <div className="font-bold text-cyan-400">{label}</div>
              <div className="text-lg font-semibold">{duration.toFixed(2)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BpmCalculator;