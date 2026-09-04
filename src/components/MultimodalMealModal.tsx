import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Camera,
  Mic,
  Square,
  RefreshCw,
  Sparkles,
  Upload,
  Play,
  Pause,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Volume2,
  Flame,
  Utensils,
  Lightbulb,
} from 'lucide-react';
import { Meal, UserProfile, MultimodalAnalysisRequest } from '../types.js';

interface MultimodalMealModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onMealCreated: (newMeal: Meal) => void;
}

const SAMPLE_MEALS = [
  {
    title: 'Bowl de Pollo, Arroz y Aguacate',
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
    audioText: 'Es pechuga de pollo a la plancha (unos 180g), con 1 taza de arroz jazmín y medio aguacate. Usé 1 cucharada de aceite de oliva para saltear el pollo.',
    mealType: 'almuerzo' as const,
  },
  {
    title: 'Pancakes de Avena y Proteína con Frutos Rojos',
    image: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=600&q=80',
    audioText: 'Son 3 pancakes hechos con 50g de avena molida, 1 scoop de proteína de suero y 2 claras de huevo. Encima tienen 50g de arándanos y 1 cucharada de miel cruda.',
    mealType: 'desayuno' as const,
  },
  {
    title: 'Tacos de Bistec con Guacamole y Salsa',
    image: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?auto=format&fit=crop&w=600&q=80',
    audioText: 'Comí 3 tacos de bistec de res en tortilla de maíz. Tienen cebolla, cilantro, unas 2 cucharadas de guacamole y salsa roja sin aceite añadido.',
    mealType: 'cena' as const,
  },
];

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

  // Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const visualizerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      stopRecording();
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setImageSrc(null);
    setAudioBlob(null);
    setAudioBase64(null);
    setAudioUrl(null);
    setAudioDuration(0);
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
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
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
    try {
      setErrorMessage(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Setup Web Audio API Analyser for Live Waveform
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      drawWaveform();

      // Setup MediaRecorder
      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg';
        }
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const fullBlob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(fullBlob);
        const u = URL.createObjectURL(fullBlob);
        setAudioUrl(u);

        // Convert blob to base64
        const reader = new FileReader();
        reader.onloadend = () => {
          setAudioBase64(reader.result as string);
        };
        reader.readAsDataURL(fullBlob);

        // Stop tracks
        stream.getTracks().forEach((track) => track.stop());
        if (audioCtx.state !== 'closed') {
          audioCtx.close();
        }
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };

      mediaRecorder.start(100);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setAudioDuration(0);

      // Start duration counter
      timerRef.current = setInterval(() => {
        setAudioDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Error starting audio recording:', err);
      setErrorMessage('Permiso de micrófono denegado. Puedes escribir detalles en el campo de texto.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
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

  const togglePlayAudio = () => {
    if (!audioUrl) return;
    if (!audioElementRef.current) {
      audioElementRef.current = new Audio(audioUrl);
      audioElementRef.current.onended = () => setIsPlayingAudio(false);
    }

    if (isPlayingAudio) {
      audioElementRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioElementRef.current.play();
      setIsPlayingAudio(true);
    }
  };

  const handleSelectSample = (sample: typeof SAMPLE_MEALS[0]) => {
    setImageSrc(sample.image);
    setTextNotes(sample.audioText);
    setMealType(sample.mealType);
    stopCamera();
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
          audioMimeType: audioBlob?.type || 'audio/webm',
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
                  ref={videoRef}
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
          <div className="space-y-2 bg-stone-950/70 p-4 rounded-2xl border border-stone-800/90">
            <div className="flex items-center justify-between text-xs font-bold text-stone-300">
              <span className="flex items-center gap-1.5">
                <Mic className="w-4 h-4 text-emerald-400" />
                2. Nota de Voz Nativa (Ingredientes Ocultos & Porciones)
              </span>
              {isRecording && (
                <span className="text-rose-400 text-xs font-mono animate-pulse flex items-center gap-1">
                  ● Grabando {audioDuration}s
                </span>
              )}
            </div>

            <p className="text-[11px] text-stone-400">
              Menciona aceites utilizados, mantequilla, salsas, azúcar o aderezos que no se ven a simple vista.
            </p>

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
            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
              {/* Push-to-Talk or Click-to-record Button */}
              <button
                type="button"
                onMouseDown={() => {
                  if (!isRecording) startRecording();
                }}
                onMouseUp={() => {
                  if (isRecording) stopRecording();
                }}
                onTouchStart={() => {
                  if (!isRecording) startRecording();
                }}
                onTouchEnd={() => {
                  if (isRecording) stopRecording();
                }}
                onClick={() => {
                  // Fallback for click toggle
                  if (isRecording) {
                    stopRecording();
                  } else if (!audioBlob) {
                    startRecording();
                  }
                }}
                className={`w-full sm:flex-1 py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all select-none ${
                  isRecording
                    ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-500/30 scale-[0.98]'
                    : 'bg-stone-800 hover:bg-stone-750 text-stone-200 border border-stone-700'
                }`}
              >
                <Mic className={`w-4 h-4 ${isRecording ? 'text-white' : 'text-emerald-400'}`} />
                {isRecording
                  ? '¡Soltar para finalizar grabación!'
                  : 'Mantener presionado para hablar (o clic)'}
              </button>

              {/* Recorded Audio Player / Reset */}
              {audioBlob && !isRecording && (
                <div className="flex items-center gap-2 w-full sm:w-auto bg-stone-900 px-3 py-2 rounded-xl border border-stone-800">
                  <button
                    type="button"
                    onClick={togglePlayAudio}
                    className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                    title="Reproducir audio"
                  >
                    {isPlayingAudio ? (
                      <Pause className="w-3.5 h-3.5" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <span className="text-[11px] font-mono text-stone-300">
                    Audio ({audioDuration}s)
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      setAudioBlob(null);
                      setAudioBase64(null);
                      setAudioUrl(null);
                      setAudioDuration(0);
                    }}
                    className="p-1.5 text-stone-500 hover:text-rose-400 transition-colors ml-1"
                    title="Eliminar audio"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Quick voice chip presets */}
            <div className="pt-2">
              <span className="text-[10px] uppercase font-bold text-stone-500 block mb-1.5">
                Ejemplos de detalles hablados:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Cociné con 1 cda de aceite de oliva',
                  'Añadí 1 cda de mantequilla',
                  'Salsa BBQ con azúcar',
                  'Pollo sin piel a la plancha',
                  'Porción doble de arroz',
                ].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => {
                      setTextNotes((prev) =>
                        prev ? `${prev}. ${chip}` : chip
                      );
                    }}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-emerald-300 border border-stone-800 transition-colors"
                  >
                    + {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Optional Written Text / Transcription */}
            <div className="pt-2">
              <textarea
                rows={2}
                value={textNotes}
                onChange={(e) => setTextNotes(e.target.value)}
                placeholder="Notas adicionales escritas (opcional)..."
                className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-stone-200 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Quick Presets for Instant Testing */}
          <div className="p-3.5 rounded-2xl bg-stone-950 border border-stone-800/80">
            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-stone-300">
              <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
              <span>¿Quieres probar rápido? Selecciona un plato de prueba:</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {SAMPLE_MEALS.map((sample, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectSample(sample)}
                  className="flex items-center gap-2 p-2 rounded-xl bg-stone-900 hover:bg-stone-800/80 border border-stone-800 text-left transition-all group"
                >
                  <img
                    src={sample.image}
                    alt={sample.title}
                    className="w-10 h-10 rounded-lg object-cover group-hover:scale-105 transition-transform"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="block text-[11px] font-bold text-stone-200 truncate">
                      {sample.title}
                    </span>
                    <span className="block text-[10px] text-emerald-400 capitalize">
                      {sample.mealType}
                    </span>
                  </div>
                </button>
              ))}
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
