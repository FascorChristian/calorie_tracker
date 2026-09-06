import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Camera,
  Mic,
  Square,
  RefreshCw,
  Sparkles,
  Upload,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Play,
} from 'lucide-react';
import { Meal, UserProfile } from '../../../shared/types.js';

interface MultimodalMealModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onMealCreated: (newMeal: Meal) => void;
}

// Convert an AudioBuffer to standard 16-bit PCM WAV Blob (Mono for voice recordings)
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = 1;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const result = buffer.getChannelData(0);

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = result.length * bytesPerSample;
  const bufferSize = 44 + dataSize;
  const arrayBuffer = new ArrayBuffer(bufferSize);
  const view = new DataView(arrayBuffer);

  // "RIFF" chunk descriptor
  view.setUint32(0, 0x52494646, false);
  view.setUint32(4, 36 + dataSize, true);
  // "WAVE" format
  view.setUint32(8, 0x57415645, false);
  // "fmt " sub-chunk
  view.setUint32(12, 0x666d7420, false);
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  // "data" sub-chunk
  view.setUint32(36, 0x64617461, false);
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < result.length; i++) {
    const s = Math.max(-1, Math.min(1, result[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([view], { type: 'audio/wav' });
}

export const MultimodalMealModal: React.FC<MultimodalMealModalProps> = ({
  isOpen,
  onClose,
  user,
  onMealCreated,
}) => {
  // Mode: 'camera' | 'upload' | 'preview'
  const [cameraActive, setCameraActive] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [mealType, setMealType] = useState<'desayuno' | 'almuerzo' | 'cena' | 'snack'>('almuerzo');
  const [textNotes, setTextNotes] = useState('');
  
  // Audio state
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioWarning, setAudioWarning] = useState<string | null>(null);

  // Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const visualizerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const isStartingAudioRef = useRef<boolean>(false);

  // Direct Web Audio API playback refs
  const decodedAudioBufferRef = useRef<AudioBuffer | null>(null);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      stopRecording();
      discardAudio();
      resetForm();
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      stopCamera();
      stopRecording();
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      if (playbackCtxRef.current && playbackCtxRef.current.state !== 'closed') {
        playbackCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    if (cameraActive && mediaStreamRef.current && videoRef.current) {
      videoRef.current.srcObject = mediaStreamRef.current;
      videoRef.current.play().catch((err) => {
        console.error('Error al reproducir el video de la cámara:', err);
      });
    }
  }, [cameraActive]);

  const discardAudio = () => {
    stopRecording();
    if (activeSourceRef.current) {
      try {
        activeSourceRef.current.stop();
      } catch {}
      activeSourceRef.current = null;
    }
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    decodedAudioBufferRef.current = null;
    setIsPlayingAudio(false);
    setAudioBlob(null);
    setAudioBase64(null);
    setAudioUrl(null);
    setAudioDuration(0);
    setAudioWarning(null);
  };

  const resetForm = () => {
    setImageSrc(null);
    discardAudio();
    setTextNotes('');
    setErrorMessage(null);
    setIsAnalyzing(false);
  };

  // ==========================================
  // CAMERA HANDLING
  // ==========================================
  const startCamera = async () => {
    try {
      setErrorMessage(null);
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }
      mediaStreamRef.current = stream;
      setCameraActive(true);
    } catch (err: any) {
      console.error('Error starting camera:', err);
      setErrorMessage('No se pudo acceder a la cámara. Puedes subir una foto desde tu dispositivo.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setImageSrc(dataUrl);
        stopCamera();
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageSrc(reader.result as string);
        stopCamera();
      };
      reader.readAsDataURL(file);
    }
  };

  // ==========================================
  // AUDIO & WEB AUDIO API HANDLING
  // ==========================================
  const startRecording = async () => {
    if (isStartingAudioRef.current) return;
    isStartingAudioRef.current = true;

    try {
      setErrorMessage(null);
      setAudioWarning(null);

      // Clean up previous audio state, active playback and timers
      discardAudio();

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
      }

      // Request microphone stream with voice enhancements
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Setup Web Audio API Analyser for Live Waveform
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      drawWaveform();

      // Determine supported MIME type
      let mimeType = '';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
        mimeType = 'audio/ogg';
      }

      const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const rawType = mediaRecorder.mimeType || mimeType || 'audio/webm';
        const cleanType = rawType.split(';')[0];
        const fullBlob = new Blob(audioChunksRef.current, { type: cleanType });

        try {
          const arrayBuffer = await fullBlob.arrayBuffer();
          const decodeCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer);

          // Save decoded buffer for direct Web Audio hardware playback
          decodedAudioBufferRef.current = audioBuffer;

          // Check amplitude across audio samples to warn if mic was muted in Windows
          let maxAmp = 0;
          const channelData = audioBuffer.getChannelData(0);
          for (let i = 0; i < channelData.length; i++) {
            const val = Math.abs(channelData[i]);
            if (val > maxAmp) maxAmp = val;
          }

          if (maxAmp < 0.008) {
            setAudioWarning('El micrófono grabó casi en silencio. Revisa el volumen o activación de tu micrófono en Windows.');
          } else {
            setAudioWarning(null);
          }

          // Convert to standard 16-bit PCM WAV (universally playable in all browsers)
          const wavBlob = audioBufferToWav(audioBuffer);
          setAudioBlob(wavBlob);
          const u = URL.createObjectURL(wavBlob);
          setAudioUrl(u);

          if (audioBuffer.duration && audioBuffer.duration > 0) {
            setAudioDuration(Math.max(1, Math.round(audioBuffer.duration)));
          }

          // Convert to Base64 for Gemini & backend
          const reader = new FileReader();
          reader.onloadend = () => {
            setAudioBase64(reader.result as string);
          };
          reader.readAsDataURL(wavBlob);

          decodeCtx.close().catch(() => {});
        } catch (decodeErr) {
          console.warn('Audio decoding fallback to raw blob:', decodeErr);
          setAudioBlob(fullBlob);
          const u = URL.createObjectURL(fullBlob);
          setAudioUrl(u);

          const reader = new FileReader();
          reader.onloadend = () => {
            setAudioBase64(reader.result as string);
          };
          reader.readAsDataURL(fullBlob);
        }

        // Stop media stream tracks
        stream.getTracks().forEach((track) => track.stop());
        if (audioCtx.state !== 'closed') {
          audioCtx.close().catch(() => {});
        }
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
      };

      // Start recording without timeslice so container isn't fragmented
      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);

      // Start duration counter safely
      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        const elapsed = Math.max(1, Math.round((Date.now() - startTime) / 1000));
        setAudioDuration(elapsed);
      }, 500);
    } catch (err: any) {
      console.error('Error starting audio recording:', err);
      setErrorMessage('No se pudo acceder al micrófono. Por favor verifica los permisos en el navegador.');
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    } finally {
      isStartingAudioRef.current = false;
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.warn('Error stopping media recorder:', err);
      }
    }
    setIsRecording(false);
  };

  const toggleRecording = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  };

  const playAudio = async () => {
    if (isPlayingAudio) {
      if (activeSourceRef.current) {
        try {
          activeSourceRef.current.stop();
        } catch {}
        activeSourceRef.current = null;
      }
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current.currentTime = 0;
      }
      setIsPlayingAudio(false);
      return;
    }

    // 1. Direct Web Audio API playback from decoded buffer (hardware direct, no browser container bug)
    if (decodedAudioBufferRef.current) {
      try {
        if (!playbackCtxRef.current || playbackCtxRef.current.state === 'closed') {
          playbackCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        const ctx = playbackCtxRef.current;
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }

        if (activeSourceRef.current) {
          try { activeSourceRef.current.stop(); } catch {}
          activeSourceRef.current = null;
        }

        if (audioElementRef.current) {
          audioElementRef.current.pause();
        }

        const source = ctx.createBufferSource();
        source.buffer = decodedAudioBufferRef.current;

        const gain = ctx.createGain();
        gain.gain.value = 1.0;
        source.connect(gain);
        gain.connect(ctx.destination);

        source.onended = () => {
          setIsPlayingAudio(false);
          activeSourceRef.current = null;
        };

        activeSourceRef.current = source;
        source.start(0);
        setIsPlayingAudio(true);
        return;
      } catch (err) {
        console.warn('Web Audio direct playback failed, falling back to HTMLAudioElement:', err);
      }
    }

    // 2. Fallback to HTML Audio Element with WAV URL
    if (audioUrl) {
      try {
        if (audioElementRef.current) {
          audioElementRef.current.currentTime = 0;
          await audioElementRef.current.play();
          setIsPlayingAudio(true);
        }
      } catch (err) {
        console.error('HTMLAudioElement play failed:', err);
        setErrorMessage('No se pudo reproducir el audio. Verifica tu dispositivo de salida de sonido.');
        setIsPlayingAudio(false);
      }
    }
  };

  const drawWaveform = () => {
    const canvas = visualizerCanvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      if (!analyserRef.current) return;
      animationFrameRef.current = requestAnimationFrame(render);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / bufferLength) * 1.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        // Gradient color
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
        gradient.addColorStop(0, '#10b981');
        gradient.addColorStop(1, '#2dd4bf');
        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 2, barHeight);
        x += barWidth;
      }
    };
    render();
  };

  // ==========================================
  // SUBMIT MULTIMODAL TO BACKEND / GEMINI
  // ==========================================
  const handleAnalyzeAndSave = async () => {
    if (!imageSrc && !audioBase64 && !textNotes.trim()) {
      setErrorMessage('Por favor toma una foto, graba un audio o escribe la descripción del plato.');
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);

    const steps = [
      'Extrayendo datos de la imagen y nota de voz...',
      'Inyectando contexto biométrico y metas...',
      'Consultando modelo multimodal Gemini 3.7 Flash...',
      'Calculando macros y puntaje del 1 al 10...',
    ];

    let currentStepIdx = 0;
    setAnalysisStep(steps[0]);
    const stepInterval = setInterval(() => {
      currentStepIdx = (currentStepIdx + 1) % steps.length;
      setAnalysisStep(steps[currentStepIdx]);
    }, 1200);

    try {
      const response = await fetch('/api/meals/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: imageSrc || undefined,
          imageMimeType: 'image/jpeg',
          audioBase64: audioBase64 || undefined,
          audioMimeType: audioBlob?.type || 'audio/wav',
          audioTranscript: textNotes || undefined,
          audioDurationSeconds: audioDuration,
          mealType: mealType,
          notes: textNotes || undefined,
        }),
      });

      clearInterval(stepInterval);

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Error en la respuesta del servidor');
      }

      const data = await response.json();
      if (data.meal) {
        onMealCreated(data.meal);
        onClose();
      }
    } catch (err: any) {
      clearInterval(stepInterval);
      console.error('Error analyzing meal:', err);
      setErrorMessage(err.message || 'Error al conectar con el servidor');
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-stone-900 border border-stone-800 rounded-3xl shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-stone-900 via-stone-850 to-stone-900 border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-stone-950 font-bold shadow-md shadow-emerald-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-stone-100 flex items-center gap-2">
                Registro Multimodal de Comida
              </h2>
              <p className="text-xs text-stone-400">
                Foto + Nota de Voz descriptiva analizada con Gemini
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isAnalyzing}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5 max-h-[78vh] overflow-y-auto">
          {/* Error Message if any */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Meal Type Selection */}
          <div className="flex items-center justify-between bg-stone-950/80 p-1.5 rounded-2xl border border-stone-800">
            {(['desayuno', 'almuerzo', 'cena', 'snack'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setMealType(type)}
                className={`flex-1 py-2 text-xs font-bold rounded-xl capitalize transition-all ${
                  mealType === type
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-stone-950 shadow-md'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Photo Capture Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-stone-300">
              <span className="flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-emerald-400" />
                1. Foto del Plato
              </span>
              {imageSrc && (
                <button
                  onClick={() => {
                    setImageSrc(null);
                    stopCamera();
                  }}
                  className="text-stone-400 hover:text-rose-400 text-[11px] font-normal"
                >
                  Cambiar foto
                </button>
              )}
            </div>

            {/* Viewfinder / Preview / Upload Area */}
            {imageSrc ? (
              <div className="relative rounded-2xl overflow-hidden border border-stone-700 bg-stone-950 aspect-[4/3] sm:aspect-video flex items-center justify-center">
                <img
                  src={imageSrc}
                  alt="Plato capturado"
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-3 left-3 bg-stone-950/80 backdrop-blur-md px-3 py-1 rounded-lg text-xs font-medium text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Imagen lista para Gemini
                </div>
              </div>
            ) : cameraActive ? (
              <div className="relative rounded-2xl overflow-hidden border border-emerald-500/40 bg-black aspect-[4/3] sm:aspect-video flex items-center justify-center">
                <video
                  ref={(el) => {
                    videoRef.current = el;
                    if (el && mediaStreamRef.current && el.srcObject !== mediaStreamRef.current) {
                      el.srcObject = mediaStreamRef.current;
                      el.play().catch(() => {});
                    }
                  }}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 border-2 border-emerald-500/30 rounded-2xl pointer-events-none" />

                {/* Shutter / Capture Button */}
                <div className="absolute bottom-4 inset-x-0 flex items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={capturePhoto}
                    className="w-14 h-14 rounded-full bg-white border-4 border-emerald-500 shadow-xl flex items-center justify-center transform active:scale-90 transition-transform"
                    title="Capturar foto"
                  >
                    <div className="w-10 h-10 rounded-full bg-emerald-500" />
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="px-3 py-1.5 rounded-xl bg-stone-900/80 backdrop-blur-md text-xs text-stone-300 hover:text-white border border-stone-700"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Camera Button */}
                <button
                  type="button"
                  onClick={startCamera}
                  className="flex flex-col items-center justify-center gap-2 p-6 rounded-2xl bg-stone-950 hover:bg-stone-850 border border-stone-800 hover:border-emerald-500/50 transition-all group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Camera className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold text-stone-200">Tomar Foto con Cámara</span>
                  <span className="text-[11px] text-stone-500 text-center">
                    Apunta a tu plato para detección visual
                  </span>
                </button>

                {/* Upload File Input */}
                <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-2xl bg-stone-950 hover:bg-stone-850 border border-stone-800 hover:border-teal-500/50 cursor-pointer transition-all group">
                  <div className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Upload className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold text-stone-200">Subir Imagen</span>
                  <span className="text-[11px] text-stone-500 text-center">
                    PNG, JPG o WEBP desde galería
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </div>

          {/* Voice Note & Web Audio API Section */}
          <div className="space-y-3 bg-stone-950/70 p-4 rounded-2xl border border-stone-800/90">
            <div className="flex items-center justify-between text-xs font-bold text-stone-300">
              <span className="flex items-center gap-1.5">
                <Mic className="w-4 h-4 text-emerald-400" />
                2. Nota de Voz
              </span>
              {isRecording && (
                <span className="text-rose-400 text-xs font-mono animate-pulse flex items-center gap-1">
                  ● Grabando {audioDuration}s
                </span>
              )}
            </div>

            {/* Live Visualizer Canvas when recording */}
            {isRecording && (
              <div className="w-full bg-stone-900 rounded-xl p-2 border border-emerald-500/30">
                <canvas
                  ref={visualizerCanvasRef}
                  width={360}
                  height={48}
                  className="w-full h-12 rounded bg-stone-950"
                />
              </div>
            )}

            {/* Audio Recording Controls */}
            <div className="space-y-2.5">
              <div className="flex flex-col sm:flex-row items-center gap-2.5">
                {/* Click to Record / Click to Stop Button */}
                <button
                  type="button"
                  onClick={toggleRecording}
                  className={`w-full sm:flex-1 py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all select-none cursor-pointer ${
                    isRecording
                      ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse shadow-lg shadow-rose-600/40'
                      : audioBlob
                      ? 'bg-stone-800 hover:bg-stone-750 text-stone-300 border border-stone-700'
                      : 'bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {isRecording ? (
                    <>
                      <Square className="w-4 h-4 fill-white text-white" />
                      <span>Terminar grabación ({audioDuration}s)</span>
                    </>
                  ) : audioBlob ? (
                    <>
                      <RefreshCw className="w-4 h-4 text-emerald-400" />
                      <span>Volver a grabar nota de voz</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4 text-emerald-400" />
                      <span>Presiona para comenzar a grabar</span>
                    </>
                  )}
                </button>

                {/* Recorded Audio Controls */}
                {audioBlob && !isRecording && (
                  <div className="flex items-center gap-2 w-full sm:w-auto bg-stone-900 p-2 rounded-xl border border-stone-800">
                    {/* Direct Hardware Web Audio API Playback Button */}
                    <button
                      type="button"
                      onClick={playAudio}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        isPlayingAudio
                          ? 'bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-md shadow-amber-500/20'
                          : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
                      }`}
                      title={isPlayingAudio ? 'Pausar reproducción' : 'Reproducir audio'}
                    >
                      {isPlayingAudio ? (
                        <>
                          <Square className="w-3.5 h-3.5 fill-current" />
                          <span>Pausar</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Escuchar ({audioDuration}s)</span>
                        </>
                      )}
                    </button>

                    {/* Native Audio Tag with Scrubber */}
                    <audio
                      ref={audioElementRef}
                      src={audioUrl || undefined}
                      controls
                      onPlay={() => {
                        if (activeSourceRef.current) {
                          try { activeSourceRef.current.stop(); } catch {}
                          activeSourceRef.current = null;
                        }
                        setIsPlayingAudio(true);
                      }}
                      onPause={() => setIsPlayingAudio(false)}
                      onEnded={() => setIsPlayingAudio(false)}
                      className="h-8 max-w-[150px] sm:max-w-[180px] accent-emerald-500"
                    />

                    <button
                      type="button"
                      onClick={discardAudio}
                      className="p-1.5 text-stone-400 hover:text-rose-400 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
                      title="Eliminar audio y volver a grabar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Warning if microphone recorded silence */}
              {audioWarning && (
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>{audioWarning}</span>
                </div>
              )}
            </div>

            {/* Notas Adicionales */}
            <div className="pt-2">
              <label className="text-xs font-bold text-stone-300 block mb-1.5">
                Notas adicionales:
              </label>
              <textarea
                rows={3}
                value={textNotes}
                onChange={(e) => setTextNotes(e.target.value)}
                placeholder="Escribe notas adicionales sobre tu comida (ingredientes, salsas, porciones, etc.)..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-stone-900 border border-stone-800 text-stone-200 text-xs focus:outline-none focus:border-emerald-500 resize-none leading-relaxed"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-stone-950 border-t border-stone-800 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={isAnalyzing}
            className="px-4 py-2.5 rounded-xl border border-stone-700 hover:bg-stone-850 text-stone-300 text-xs font-semibold transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleAnalyzeAndSave}
            disabled={isAnalyzing || (!imageSrc && !audioBase64 && !textNotes.trim())}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-stone-950 font-bold text-xs hover:from-emerald-400 hover:to-teal-400 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>{analysisStep || 'Analizando con Gemini...'}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Analizar y Registrar Plato</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
