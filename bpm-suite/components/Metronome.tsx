{\rtf1\ansi\ansicpg1251\cocoartf2865
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 import React, \{ useState, useRef, useEffect, useCallback \} from 'react';\
\
interface MetronomeProps \{\
  bpm: number;\
  setBpm: (newBpm: number) => void;\
  isSynced: boolean;\
  setIsSynced: (synced: boolean) => void;\
  setScreenFlash: (isFlashing: boolean) => void;\
\}\
\
const Metronome: React.FC<MetronomeProps> = (\{ bpm, setBpm, isSynced, setIsSynced, setScreenFlash \}) => \{\
  const [isPlaying, setIsPlaying] = useState(false);\
  const [internalBpm, setInternalBpm] = useState(bpm);\
  const [bpmInputValue, setBpmInputValue] = useState(Math.round(bpm).toString());\
  const [timeSignature, setTimeSignature] = useState('4/4');\
  const [volume, setVolume] = useState(0.8);\
  const [mutedBeats, setMutedBeats] = useState<boolean[]>(Array(4).fill(false));\
  const [isScreenFlashEnabled, setIsScreenFlashEnabled] = useState(true);\
  const [isVibrationEnabled, setIsVibrationEnabled] = useState(false);\
  const [activeBeatIndex, setActiveBeatIndex] = useState<number | null>(null);\
\
  const audioContextRef = useRef<AudioContext | null>(null);\
  const schedulerRef = useRef<number | null>(null);\
  const nextNoteTimeRef = useRef<number>(0);\
  const currentBeatRef = useRef<number>(0);\
\
  const schedulerParamsRef = useRef(\{\
    volume,\
    internalBpm,\
    timeSignature,\
    mutedBeats,\
    isScreenFlashEnabled,\
    isVibrationEnabled,\
  \});\
\
  useEffect(() => \{\
    schedulerParamsRef.current = \{\
      volume,\
      internalBpm,\
      timeSignature,\
      mutedBeats,\
      isScreenFlashEnabled,\
      isVibrationEnabled,\
    \};\
  \}, [volume, internalBpm, timeSignature, mutedBeats, isScreenFlashEnabled, isVibrationEnabled]);\
\
  useEffect(() => \{\
    if (isSynced) \{\
      setInternalBpm(bpm);\
    \}\
  \}, [bpm, isSynced]);\
  \
  useEffect(() => \{\
    setBpmInputValue(Math.round(internalBpm).toString());\
  \}, [internalBpm]);\
\
  const handleBpmChange = (newBpm: number) => \{\
    const clampedBpm = Math.max(30, Math.min(300, newBpm));\
    setInternalBpm(clampedBpm);\
    if (isSynced) \{\
      setBpm(clampedBpm);\
    \}\
  \};\
  \
  const handleBpmInputChange = (e: React.ChangeEvent<HTMLInputElement>) => \{\
    setBpmInputValue(e.target.value);\
  \};\
  \
  const handleBpmInputBlur = () => \{\
    const parsedBpm = parseInt(bpmInputValue, 10);\
    handleBpmChange(isNaN(parsedBpm) ? internalBpm : parsedBpm);\
  \};\
\
  const scheduleBeat = useCallback(() => \{\
    if (!audioContextRef.current) return;\
    \
    const \{ internalBpm, timeSignature, volume, mutedBeats, isScreenFlashEnabled, isVibrationEnabled \} = schedulerParamsRef.current;\
    const [numerator] = timeSignature.split('/').map(Number);\
    const isCompound = timeSignature.endsWith('/8') && (numerator === 6 || numerator === 9 || numerator === 12);\
\
    while (nextNoteTimeRef.current < audioContextRef.current.currentTime + 0.1) \{\
      const beatIndexToSchedule = currentBeatRef.current;\
      const timeUntilBeat = (nextNoteTimeRef.current - audioContextRef.current.currentTime) * 1000;\
      \
      setTimeout(() => \{\
        setActiveBeatIndex(beatIndexToSchedule);\
\
        if (navigator.vibrate && isVibrationEnabled && !mutedBeats[beatIndexToSchedule]) \{\
           if (beatIndexToSchedule === 0) \{\
              navigator.vibrate(100); // \uc0\u1057 \u1080 \u1083 \u1100 \u1085 \u1072 \u1103  \u1076 \u1086 \u1083 \u1103 \
           \} else \{\
              navigator.vibrate(50); // \uc0\u1054 \u1089 \u1090 \u1072 \u1083 \u1100 \u1085 \u1099 \u1077  \u1076 \u1086 \u1083 \u1080 \
           \}\
        \}\
      \}, timeUntilBeat);\
\
      if (!mutedBeats[currentBeatRef.current]) \{\
        const osc = audioContextRef.current.createOscillator();\
        const gain = audioContextRef.current.createGain();\
        osc.connect(gain);\
        gain.connect(audioContextRef.current.destination);\
        \
        gain.gain.setValueAtTime(volume, audioContextRef.current.currentTime);\
        \
        let freq;\
        if (currentBeatRef.current === 0) \{\
          freq = 880;\
        \} else if (isCompound && currentBeatRef.current % 3 === 0) \{\
          freq = 660;\
        \} else \{\
          freq = 440;\
        \}\
        osc.frequency.setValueAtTime(freq, audioContextRef.current.currentTime);\
\
        osc.start(nextNoteTimeRef.current);\
        osc.stop(nextNoteTimeRef.current + 0.05);\
      \}\
      \
      if (isScreenFlashEnabled && !mutedBeats[currentBeatRef.current]) \{\
        setTimeout(() => \{\
            setScreenFlash(true);\
            setTimeout(() => setScreenFlash(false), 50);\
        \}, (nextNoteTimeRef.current - audioContextRef.current.currentTime) * 1000);\
      \}\
      \
      let secondsPerClick = 60.0 / internalBpm;\
      if (isCompound) \{\
        secondsPerClick /= 3.0;\
      \} else if (timeSignature.endsWith('/8')) \{\
        secondsPerClick /= 2.0;\
      \}\
\
\
      nextNoteTimeRef.current += secondsPerClick;\
      currentBeatRef.current = (currentBeatRef.current + 1) % numerator;\
    \}\
  \}, [setScreenFlash]);\
\
  useEffect(() => \{\
    if (isPlaying) \{\
      if (!audioContextRef.current) \{\
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();\
      \}\
      if (audioContextRef.current.state === 'suspended') \{\
        audioContextRef.current.resume();\
      \}\
      nextNoteTimeRef.current = audioContextRef.current.currentTime + 0.1;\
      currentBeatRef.current = 0;\
      schedulerRef.current = window.setInterval(scheduleBeat, 25);\
    \} else \{\
      if (schedulerRef.current) \{\
        clearInterval(schedulerRef.current);\
        schedulerRef.current = null;\
      \}\
      if (audioContextRef.current && audioContextRef.current.state === 'running') \{\
        audioContextRef.current.suspend();\
      \}\
      setActiveBeatIndex(null);\
    \}\
\
    return () => \{\
      if (schedulerRef.current) clearInterval(schedulerRef.current);\
    \};\
  \}, [isPlaying, scheduleBeat]);\
\
  useEffect(() => \{\
    return () => \{\
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') \{\
        audioContextRef.current.close();\
      \}\
      setScreenFlash(false);\
    \}\
  \}, [setScreenFlash]);\
\
  const togglePlay = () => setIsPlaying(!isPlaying);\
\
  const handleTimeSignatureChange = (e: React.ChangeEvent<HTMLSelectElement>) => \{\
    const newSignature = e.target.value;\
    const [newNumerator] = newSignature.split('/').map(Number);\
    setTimeSignature(newSignature);\
    setMutedBeats(Array(newNumerator).fill(false));\
  \};\
  \
  const toggleMuteBeat = (index: number) => \{\
    const newMutedBeats = [...mutedBeats];\
    newMutedBeats[index] = !newMutedBeats[index];\
    setMutedBeats(newMutedBeats);\
  \};\
  \
  const timeSignatures = ['2/4', '3/4', '4/4', '3/8', '6/8', '9/8', '12/8'];\
  const [numerator] = timeSignature.split('/').map(Number);\
\
  return (\
    <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-2xl flex flex-col gap-8">\
      <div className="flex justify-center">\
        <button\
          onClick=\{togglePlay\}\
          className=\{`w-36 h-36 rounded-full text-2xl font-bold transition-all duration-200 flex items-center justify-center\
            $\{isPlaying ? 'bg-red-500 text-white glowing-shadow-red' : 'bg-emerald-500 text-white glowing-shadow-green'\}`\}\
        >\
          \{isPlaying ? '\uc0\u1057 \u1058 \u1054 \u1055 ' : '\u1057 \u1058 \u1040 \u1056 \u1058 '\}\
        </button>\
      </div>\
      \
      <div>\
        <label className="block text-sm font-medium text-slate-400 mb-2 text-center">\uc0\u1054 \u1090 \u1082 \u1083 \u1102 \u1095 \u1080 \u1090 \u1100  \u1076 \u1086 \u1083 \u1102 </label>\
        <div className="flex gap-2 justify-center flex-wrap">\
          \{Array.from(\{ length: numerator \}, (_, i) => (\
            <button key=\{i\} onClick=\{() => toggleMuteBeat(i)\} className=\{`w-12 h-12 flex items-center justify-center rounded-full font-bold text-lg transition-all duration-100 \
              $\{ activeBeatIndex === i\
                ? 'bg-cyan-400 text-slate-900 scale-110 glowing-shadow-cyan'\
                : mutedBeats[i] ? 'bg-slate-700 text-slate-500' : 'bg-slate-900/70 border border-slate-700 text-white'\
              \}`\}>\
              \{i + 1\}\
            </button>\
          ))\}\
        </div>\
      </div>\
\
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-6">\
        <div className="sm:col-span-2">\
          <label htmlFor="bpm-slider" className="block text-sm font-medium text-slate-400 mb-2">\uc0\u1058 \u1077 \u1084 \u1087  (BPM)</label>\
          <div className="flex items-center gap-4">\
              <input type="range" id="bpm-slider" min="30" max="300" value=\{internalBpm\} onChange=\{(e) => handleBpmChange(parseInt(e.target.value))\} />\
              <input \
                type="number" \
                value=\{bpmInputValue\} \
                onChange=\{handleBpmInputChange\}\
                onBlur=\{handleBpmInputBlur\}\
                onKeyDown=\{(e) => \{ if (e.key === 'Enter') (e.target as HTMLInputElement).blur() \}\}\
                className="w-24 bg-slate-700 p-2 rounded-md text-center font-semibold text-lg"\
              />\
          </div>\
        </div>\
        <div>\
          <label htmlFor="volume" className="block text-sm font-medium text-slate-400 mb-2">\uc0\u1043 \u1088 \u1086 \u1084 \u1082 \u1086 \u1089 \u1090 \u1100 </label>\
          <input type="range" id="volume" min="0" max="1" step="0.01" value=\{volume\} onChange=\{(e) => setVolume(parseFloat(e.target.value))\} />\
        </div>\
        <div>\
          <label htmlFor="time-signature" className="block text-sm font-medium text-slate-400 mb-2">\uc0\u1056 \u1072 \u1079 \u1084 \u1077 \u1088 </label>\
          <select id="time-signature" value=\{timeSignature\} onChange=\{handleTimeSignatureChange\} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 focus:ring-cyan-500 focus:border-cyan-500">\
            \{timeSignatures.map(sig => <option key=\{sig\} value=\{sig\}>\{sig\}</option>)\}\
          </select>\
        </div>\
      </div>\
      \
      <div className="flex flex-col sm:flex-row gap-4 justify-around items-center border-t border-slate-800 pt-6">\
        <div className="flex items-center gap-3">\
          <label htmlFor="screen-flash" className="text-sm font-medium text-slate-300">\uc0\u1052 \u1086 \u1088 \u1075 \u1072 \u1085 \u1080 \u1077  \u1101 \u1082 \u1088 \u1072 \u1085 \u1072 </label>\
          <button onClick=\{() => setIsScreenFlashEnabled(!isScreenFlashEnabled)\} className=\{`relative w-12 h-7 rounded-full transition-colors duration-200 $\{isScreenFlashEnabled ? 'bg-cyan-500' : 'bg-slate-700'\}`\}>\
            <span className=\{`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform duration-200 $\{isScreenFlashEnabled ? 'translate-x-5' : 'translate-x-0'\}`\}></span>\
          </button>\
        </div>\
        <div className="flex items-center gap-3">\
          <label htmlFor="sync-bpm" className="text-sm font-medium text-slate-300">\uc0\u1057 \u1080 \u1085 \u1093 \u1088 \u1086 \u1085 \u1080 \u1079 \u1072 \u1094 \u1080 \u1103 </label>\
          <button onClick=\{() => setIsSynced(!isSynced)\} className=\{`relative w-12 h-7 rounded-full transition-colors duration-200 $\{isSynced ? 'bg-cyan-500' : 'bg-slate-700'\}`\}>\
            <span className=\{`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform duration-200 $\{isSynced ? 'translate-x-5' : 'translate-x-0'\}`\}></span>\
          </button>\
        </div>\
        <div className="flex items-center gap-3">\
          <label htmlFor="vibration" className="text-sm font-medium text-slate-300">\uc0\u1042 \u1080 \u1073 \u1088 \u1072 \u1094 \u1080 \u1103 </label>\
          <button onClick=\{() => setIsVibrationEnabled(!isVibrationEnabled)\} className=\{`relative w-12 h-7 rounded-full transition-colors duration-200 $\{isVibrationEnabled ? 'bg-cyan-500' : 'bg-slate-700'\}`\}>\
            <span className=\{`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform duration-200 $\{isVibrationEnabled ? 'translate-x-5' : 'translate-x-0'\}`\}></span>\
          </button>\
        </div>\
      </div>\
\
    </div>\
  );\
\};\
\
export default Metronome;}