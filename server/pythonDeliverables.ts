export const PYTHON_MODELS_CODE = `"""
models.py - Esquema de Base de Datos con SQLAlchemy y Pydantic
NutriVoice AI - Calorie Tracker Multimodal
"""
from datetime import date, datetime
from typing import List, Optional
from sqlalchemy import (
    Column, Integer, String, Float, Text, Date, DateTime, 
    ForeignKey, JSON
)
from sqlalchemy.orm import declarative_base, relationship
from pydantic import BaseModel, Field

Base = declarative_base()

# ==========================================
# 1. MODELOS SQLALCHEMY (Base de Datos)
# ==========================================

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, index=True) # UUID o ID único
    name = Column(String(100), nullable=False)
    age = Column(Integer, nullable=False)
    gender = Column(String(20), nullable=False) # 'masculino', 'femenino', 'otro'
    weight_kg = Column(Float, nullable=False)
    height_cm = Column(Float, nullable=False)
    activity_level = Column(String(30), nullable=False) # 'sedentario', 'moderado', etc.
    goal = Column(String(30), nullable=False) # 'deficit', 'mantenimiento', 'volumen', 'recomposicion'
    
    # Metas nutricionales calculadas / personalizadas
    target_calories = Column(Integer, nullable=False, default=2000)
    target_protein_g = Column(Integer, nullable=False, default=140)
    target_carbs_g = Column(Integer, nullable=False, default=200)
    target_fat_g = Column(Integer, nullable=False, default=65)
    
    # Restricciones y notas (almacenadas como JSON o Text)
    allergies = Column(JSON, default=list) # ej: ["gluten", "lactosa"]
    dietary_preferences = Column(JSON, default=list) # ej: ["keto", "vegano"]
    notes = Column(Text, nullable=True) # ej: "Resistencia a la insulina"
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relaciones
    meals = relationship("Meal", back_populates="user", cascade="all, delete-orphan")
    daily_summaries = relationship("DailySummary", back_populates="user", cascade="all, delete-orphan")


class Meal(Base):
    __tablename__ = "meals"

    id = Column(String(36), primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    
    date = Column(Date, nullable=False, index=True) # YYYY-MM-DD
    time = Column(String(10), nullable=False) # "14:30"
    meal_type = Column(String(20), nullable=False) # 'desayuno', 'almuerzo', 'cena', 'snack'
    
    # Multimedia
    image_url = Column(Text, nullable=True) # URI en Cloud Storage / S3 / base64
    audio_url = Column(Text, nullable=True) # URI del audio original grabado
    audio_transcript = Column(Text, nullable=True) # Transcripción generada por Gemini
    
    # Análisis devuelto por Gemini
    nombre_plato = Column(String(200), nullable=False)
    calorias_estimadas = Column(Integer, nullable=False)
    
    # Macros individuales
    proteinas_g = Column(Float, nullable=False, default=0.0)
    carbohidratos_g = Column(Float, nullable=False, default=0.0)
    grasas_g = Column(Float, nullable=False, default=0.0)
    fibra_g = Column(Float, nullable=True, default=0.0)
    
    puntaje_plato = Column(Float, nullable=False) # 1.0 a 10.0
    feedback_breve = Column(Text, nullable=False)
    ingredientes_detectados = Column(JSON, default=list)
    detalles_audio = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relación inversa
    user = relationship("User", back_populates="meals")


class DailySummary(Base):
    __tablename__ = "daily_summaries"

    id = Column(String(36), primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    
    total_calories = Column(Integer, nullable=False, default=0)
    total_protein = Column(Float, nullable=False, default=0.0)
    total_carbs = Column(Float, nullable=False, default=0.0)
    total_fat = Column(Float, nullable=False, default=0.0)
    
    # Análisis Holístico Diario de Gemini
    puntaje_diario = Column(Integer, nullable=False, default=0) # 1 a 100
    consejo_diario = Column(Text, nullable=True)
    balance_nutricional = Column(String(100), nullable=True)
    puntos_fuertes = Column(JSON, default=list)
    areas_de_mejora = Column(JSON, default=list)
    
    meals_count = Column(Integer, default=0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="daily_summaries")


# ==========================================
# 2. ESQUEMAS PYDANTIC (Validación y APIs)
# ==========================================

class UserProfileSchema(BaseModel):
    name: str
    age: int = Field(..., ge=10, le=120)
    gender: str
    weight_kg: float = Field(..., gt=20)
    height_cm: float = Field(..., gt=50)
    activity_level: str
    goal: str
    target_calories: int
    target_protein_g: int
    target_carbs_g: int
    target_fat_g: int
    allergies: List[str] = []
    dietary_preferences: List[str] = []
    notes: Optional[str] = None

class MealMacroSchema(BaseModel):
    proteinas: float
    carbohidratos: float
    grasas: float
    fibra: Optional[float] = 0.0

class GeminiMealOutputSchema(BaseModel):
    nombre_plato: str
    calorias_estimadas: int
    macros: MealMacroSchema
    puntaje_plato: float = Field(..., ge=1, le=10)
    feedback_breve: str
    ingredientes_detectados: List[str]
    detalles_audio: str

class GeminiDailyScoreOutputSchema(BaseModel):
    puntaje_diario: int = Field(..., ge=1, le=100)
    consejo_diario: str
    balance_nutricional: str
    puntos_fuertes: List[str]
    areas_de_mejora: List[str]
`;

export const PYTHON_BACKEND_CODE = `"""
main.py - Backend FastAPI con Integración Nativa Gemini Multimodal (Imagen + Audio + Texto)
SDK: google-genai
"""
import os
import uuid
import json
from datetime import date, datetime
from typing import Optional, List
from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from google import genai
from google.genai import types

from models import Base, User, Meal, DailySummary, GeminiMealOutputSchema, GeminiDailyScoreOutputSchema

# ----------------------------------------------------
# 1. Configuración de Base de Datos SQLite / PostgreSQL
# ----------------------------------------------------
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./nutrivoice.db")
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ----------------------------------------------------
# 2. Inicialización de FastAPI y Cliente Gemini
# ----------------------------------------------------
app = FastAPI(title="NutriVoice AI - API Multimodal", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inicialización con SDK moderno de Google GenAI
ai_client = genai.Client(
    api_key=os.environ.get("GEMINI_API_KEY")
)

# ----------------------------------------------------
# 3. System Prompts Detallados
# ----------------------------------------------------
MEAL_ANALYSIS_SYSTEM_PROMPT = """
Eres un Nutricionista Clínico y Dietista Deportivo de Élite con visión multimodal avanzada y comprensión auditiva nativa.
Tu objetivo es analizar simultáneamente la FOTO de un plato de comida y la NOTA DE VOZ (audio) adjunta donde el usuario describe detalles clave de preparación, ingredientes ocultos, salsas, porciones o aderezos.

Debes contrastar siempre este análisis con el PERFIL BIOMÉTRICO y los OBJETIVOS del usuario inyectados como Contexto Base.

CRITERIOS DE ANÁLISIS:
1. IMAGEN: Identifica los alimentos visuales, estimación de volumen, tipo de cocción visible y distribución del plato.
2. AUDIO: Presta máxima atención a ingredientes invisibles mencionados por el usuario (ej: aceites, mantecas, mantequilla, endulzantes, salsas, suplementos, métodos de cocción reales). El audio prevalece sobre la suposición visual.
3. CONTEXTO DE USUARIO: Evalúa si el plato es óptimo para su objetivo (Déficit Calórico, Volumen/Hipertrofia, Mantenimiento, Recomposición), si respeta sus alergias o preferencias, y si aporta los macronutrientes necesarios.
4. PUNTAJE DEL PLATO (1 al 10):
   - 9-10: Excelente densidad nutricional, alto en proteína de calidad o acorde a la meta, sin excesos calóricos ocultos, respeta restricciones.
   - 7-8: Buena comida, ligeros ajustes posibles en porciones o grasas.
   - 4-6: Regular, ultraprocesado o desbalanceado respecto a sus objetivos.
   - 1-3: Muy desfavorable para su objetivo o infringe advertencias de salud/alergias.

Responde ÚNICAMENTE en JSON válido con el esquema indicado.
"""

DAILY_SUMMARY_SYSTEM_PROMPT = """
Eres un Coach Nutricional Inteligente de Alto Rendimiento.
Tu objetivo es evaluar el balance nutricional integral de un día completo para un usuario específico, analizando todas las comidas registradas hoy junto a su perfil biométrico y metas.

CRITERIOS DE EVALUACIÓN:
1. BALANCE ENERGÉTICO: ¿Cumplió con el rango de calorías requerido para su meta (déficit, mantenimiento, volumen)?
2. RATIO DE MACRONUTRIENTES: ¿Alcanzó su meta de proteínas diarias? ¿El aporte de grasas y carbohidratos fue equilibrado?
3. CALIDAD DE ALIMENTOS: ¿Predominaron alimentos densos en nutrientes o hubo exceso de ultraprocesados y calorías vacías?
4. ADHERENCIA Y SALUD: ¿Fue consistente a lo largo del día (desayuno, almuerzo, cena, snacks)?

Responde ÚNICAMENTE en JSON válido con el esquema indicado.
"""

# ----------------------------------------------------
# 4. Endpoint Core: Registro Multimodal de Comida
# ----------------------------------------------------
@app.post("/api/meals/analyze", response_model=dict)
async def analyze_and_create_meal(
    user_id: str = Form("default_user"),
    meal_type: str = Form("almuerzo"),
    notes: Optional[str] = Form(None),
    image_file: Optional[UploadFile] = File(None),
    audio_file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    """
    Recibe la imagen del plato y la nota de voz grabada (audio nativo).
    Inyecta el perfil de usuario desde la BD y realiza la inferencia multimodal con Gemini.
    """
    # 1. Recuperar contexto base del usuario desde la BD
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    user_context = f"""
    CONTEXTO BASE DEL USUARIO:
    - Nombre: {user.name}
    - Edad: {user.age} años | Género: {user.gender}
    - Peso: {user.weight_kg} kg | Altura: {user.height_cm} cm
    - Nivel de Actividad: {user.activity_level}
    - Objetivo Principal: {user.goal.upper()}
    - Meta Calórica Diaria: {user.target_calories} kcal
    - Metas de Macros Diarias: Proteína: {user.target_protein_g}g | Carbs: {user.target_carbs_g}g | Grasas: {user.target_fat_g}g
    - Alergias / Intolerancias: {', '.join(user.allergies) if user.allergies else 'Ninguna'}
    - Preferencias Dietarias: {', '.join(user.dietary_preferences) if user.dietary_preferences else 'Omnívoro'}
    - Notas Médicas: {user.notes or 'Ninguna'}

    INFORMACIÓN DEL REGISTRO ACTUAL:
    - Tipo de Comida: {meal_type.upper()}
    - Notas Adicionales: {notes or 'Ninguna en texto, escuchar la nota de voz adjunta.'}
    """

    # 2. Preparar las partes multimodales para Gemini
    contents = []

    # A) Adjuntar Imagen (si existe)
    if image_file:
        image_bytes = await image_file.read()
        mime_type = image_file.content_type or "image/jpeg"
        contents.append(
            types.Part.from_bytes(
                data=image_bytes,
                mime_type=mime_type
            )
        )

    # B) Adjuntar Audio Nativo (si existe)
    if audio_file:
        audio_bytes = await audio_file.read()
        audio_mime = audio_file.content_type or "audio/webm"
        contents.append(
            types.Part.from_bytes(
                data=audio_bytes,
                mime_type=audio_mime
            )
        )

    # C) Adjuntar el Texto con el Contexto Base y la Solicitud
    contents.append(types.Part.from_text(text=user_context))

    # 3. Llamar a Gemini con respuesta JSON estructurada
    try:
        response = ai_client.models.generate_content(
            model="gemini-3.7-flash", # Modelo recomendado
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=MEAL_ANALYSIS_SYSTEM_PROMPT,
                response_mime_type="application/json",
                response_schema=GeminiMealOutputSchema,
                temperature=0.2, # Baja temperatura para alta precisión nutricional
            )
        )

        parsed_data = json.loads(response.text)

    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Error al procesar con Gemini: {str(e)}"
        )

    # 4. Guardar en Base de Datos
    today = date.today()
    current_time = datetime.now().strftime("%H:%M")
    
    new_meal = Meal(
        id=str(uuid.uuid4()),
        user_id=user.id,
        date=today,
        time=current_time,
        meal_type=meal_type,
        nombre_plato=parsed_data["nombre_plato"],
        calorias_estimadas=parsed_data["calorias_estimadas"],
        proteinas_g=parsed_data["macros"]["proteinas"],
        carbohidratos_g=parsed_data["macros"]["carbohidratos"],
        grasas_g=parsed_data["macros"]["grasas"],
        fibra_g=parsed_data["macros"].get("fibra", 0.0),
        puntaje_plato=parsed_data["puntaje_plato"],
        feedback_breve=parsed_data["feedback_breve"],
        ingredientes_detectados=parsed_data["ingredientes_detectados"],
        detalles_audio=parsed_data["detalles_audio"],
    )

    db.add(new_meal)
    db.commit()
    db.refresh(new_meal)

    return {
        "status": "success",
        "meal": {
            "id": new_meal.id,
            "nombre_plato": new_meal.nombre_plato,
            "calorias_estimadas": new_meal.calorias_estimadas,
            "macros": {
                "proteinas": new_meal.proteinas_g,
                "carbohidratos": new_meal.carbohidratos_g,
                "grasas": new_meal.grasas_g,
                "fibra": new_meal.fibra_g,
            },
            "puntaje_plato": new_meal.puntaje_plato,
            "feedback_breve": new_meal.feedback_breve,
            "ingredientes_detectados": new_meal.ingredientes_detectados,
            "detalles_audio": new_meal.detalles_audio,
            "date": str(new_meal.date),
            "time": new_meal.time,
            "meal_type": new_meal.meal_type
        }
    }

# ----------------------------------------------------
# 5. Endpoint: Cálculo de Puntaje Diario con Gemini
# ----------------------------------------------------
@app.post("/api/daily-summary/evaluate")
async def evaluate_daily_summary(
    user_id: str = Form("default_user"),
    target_date: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Recupera todos los platos del día y el perfil de usuario.
    Llama a Gemini para emitir un puntaje diario (1-100) y feedback holístico.
    """
    eval_date = datetime.strptime(target_date, "%Y-%m-%d").date() if target_date else date.today()
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    meals = db.query(Meal).filter(Meal.user_id == user_id, Meal.date == eval_date).all()
    
    total_cal = sum(m.calorias_estimadas for m in meals)
    total_prot = sum(m.proteinas_g for m in meals)
    total_carbs = sum(m.carbohidratos_g for m in meals)
    total_fat = sum(m.grasas_g for m in meals)

    meals_summary_text = "\\n\\n".join([
        f"{i+1}. [{m.meal_type.upper()}] {m.nombre_plato} ({m.calorias_estimadas} kcal) - P:{m.proteinas_g}g C:{m.carbohidratos_g}g G:{m.grasas_g}g. Puntaje: {m.puntaje_plato}/10. Feedback: {m.feedback_breve}"
        for i, m in enumerate(meals)
    ]) if meals else "No hay comidas registradas en este día."

    prompt_content = f"""
    CONTEXTO DEL USUARIO:
    - Objetivo: {user.goal.upper()} (Meta calórica: {user.target_calories} kcal, P: {user.target_protein_g}g, C: {user.target_carbs_g}g, G: {user.target_fat_g}g)

    RESUMEN CONSUMIDO EN LA FECHA ({eval_date}):
    - Calorías totales: {total_cal} kcal vs Meta {user.target_calories} kcal
    - Proteínas: {total_prot}g vs Meta {user.target_protein_g}g
    - Carbohidratos: {total_carbs}g vs Meta {user.target_carbs_g}g
    - Grasas: {total_fat}g vs Meta {user.target_fat_g}g

    DETALLE DE PLATOS:
    {meals_summary_text}
    """

    response = ai_client.models.generate_content(
        model="gemini-3.7-flash",
        contents=prompt_content,
        config=types.GenerateContentConfig(
            system_instruction=DAILY_SUMMARY_SYSTEM_PROMPT,
            response_mime_type="application/json",
            response_schema=GeminiDailyScoreOutputSchema,
            temperature=0.3
        )
    )

    daily_data = json.loads(response.text)

    # Actualizar o crear DailySummary en BD
    summary = db.query(DailySummary).filter(
        DailySummary.user_id == user_id, 
        DailySummary.date == eval_date
    ).first()

    if not summary:
        summary = DailySummary(
            id=str(uuid.uuid4()),
            user_id=user_id,
            date=eval_date
        )
        db.add(summary)

    summary.total_calories = total_cal
    summary.total_protein = total_prot
    summary.total_carbs = total_carbs
    summary.total_fat = total_fat
    summary.puntaje_diario = daily_data["puntaje_diario"]
    summary.consejo_diario = daily_data["consejo_diario"]
    summary.balance_nutricional = daily_data["balance_nutricional"]
    summary.puntos_fuertes = daily_data["puntos_fuertes"]
    summary.areas_de_mejora = daily_data["areas_de_mejora"]
    summary.meals_count = len(meals)

    db.commit()

    return {
        "status": "success",
        "summary": daily_data,
        "totals": {
            "calories": total_cal,
            "protein": total_prot,
            "carbs": total_carbs,
            "fat": total_fat
        }
    }
`;

export const REACT_COMPONENT_CODE = `import React, { useState, useRef, useEffect } from 'react';
import { Camera, Mic, Square, RefreshCw, Send, CheckCircle2 } from 'lucide-react';

interface MultimodalMealCaptureProps {
  onAnalyze: (payload: { imageBase64: string; audioBlob?: Blob; mealType: string }) => Promise<void>;
  isAnalyzing: boolean;
}

export const MultimodalMealCapture: React.FC<MultimodalMealCaptureProps> = ({ onAnalyze, isAnalyzing }) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [mealType, setMealType] = useState<string>('almuerzo');
  
  // Referencias para Web Audio API y MediaRecorder
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasVisualizerRef = useRef<HTMLCanvasElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // 1. Iniciar Grabación de Voz (Web Audio API + MediaRecorder)
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // AudioContext para visualizador de ondas sonoras en tiempo real
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      // Iniciar animación visual en Canvas
      drawAudioWave();

      // Configurar MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const fullAudioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(fullAudioBlob);
        stream.getTracks().forEach((track) => track.stop());
        if (audioCtx.state !== 'closed') audioCtx.close();
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      };

      mediaRecorder.start(100);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setAudioDuration(0);

      // Cronómetro
      timerIntervalRef.current = setInterval(() => {
        setAudioDuration((prev) => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Error al acceder al micrófono:', err);
      alert('Por favor autoriza el permiso de micrófono en tu navegador.');
    }
  };

  // 2. Detener Grabación
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };

  // 3. Visualizador de Espectro en Canvas (Web Audio API)
  const drawAudioWave = () => {
    const canvas = canvasVisualizerRef.current;
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
      const barWidth = (canvas.width / bufferLength) * 2;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        ctx.fillStyle = '#10b981'; // Emerald 500
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
        x += barWidth;
      }
    };
    render();
  };

  // 4. Captura de Foto con Cámara o Archivo
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImageSrc(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // 5. Enviar al Backend
  const handleSubmit = async () => {
    if (!imageSrc) {
      alert('Por favor toma o sube una foto de tu comida.');
      return;
    }
    await onAnalyze({
      imageBase64: imageSrc,
      audioBlob: audioBlob || undefined,
      mealType
    });
  };

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 text-stone-100 max-w-xl mx-auto shadow-2xl">
      <h2 className="text-xl font-bold text-emerald-400 mb-4 flex items-center gap-2">
        <Camera className="w-6 h-6" /> Registro Multimodal (Foto + Audio)
      </h2>

      {/* Selector de Foto */}
      <div className="mb-4">
        {imageSrc ? (
          <div className="relative rounded-xl overflow-hidden border border-stone-700 aspect-video">
            <img src={imageSrc} alt="Plato" className="w-full h-full object-cover" />
            <button 
              onClick={() => setImageSrc(null)}
              className="absolute top-2 right-2 bg-stone-900/80 hover:bg-stone-800 px-3 py-1 rounded-lg text-xs"
            >
              Cambiar foto
            </button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-stone-700 hover:border-emerald-500 rounded-xl p-8 cursor-pointer transition-colors">
            <Camera className="w-10 h-10 text-stone-500 mb-2" />
            <span className="text-sm font-medium">Subir foto del plato o tomar con cámara</span>
            <input type="file" accept="image/*" capture="environment" onChange={handleFileUpload} className="hidden" />
          </label>
        )}
      </div>

      {/* Grabadora de Voz Push-to-Talk / Alternar */}
      <div className="bg-stone-800/60 rounded-xl p-4 mb-4 border border-stone-700/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold flex items-center gap-2">
            <Mic className="w-4 h-4 text-emerald-400" /> Nota de voz (Ingredientes ocultos, salsas, etc.)
          </span>
          {isRecording && (
            <span className="text-xs text-red-400 font-mono animate-pulse">
              ● Grabando {audioDuration}s
            </span>
          )}
        </div>

        {/* Canvas de Ondas */}
        {isRecording && (
          <canvas ref={canvasVisualizerRef} width={300} height={40} className="w-full h-10 bg-stone-900 rounded mb-2" />
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            className={\`flex-1 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all \${
              isRecording 
                ? 'bg-red-500 text-white scale-95 shadow-lg shadow-red-500/30' 
                : 'bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-bold'
            }\`}
          >
            <Mic className="w-5 h-5" />
            {isRecording ? '¡Soltar para terminar audio!' : 'Mantener presionado para hablar'}
          </button>

          {audioBlob && !isRecording && (
            <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
              <CheckCircle2 className="w-4 h-4" /> Audio listo ({audioDuration}s)
            </span>
          )}
        </div>
      </div>

      {/* Botón de Enviar a Gemini */}
      <button
        onClick={handleSubmit}
        disabled={isAnalyzing || !imageSrc}
        className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-stone-950 font-bold rounded-xl hover:opacity-95 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
      >
        {isAnalyzing ? (
          <>
            <RefreshCw className="w-5 h-5 animate-spin" />
            Analizando plato con Gemini...
          </>
        ) : (
          <>
            <Send className="w-5 h-5" />
            Analizar y Guardar Registro
          </>
        )}
      </button>
    </div>
  );
};
`;
