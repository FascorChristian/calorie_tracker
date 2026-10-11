import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './routes/index.js';
import { validateGoogleConfig } from './config/google.js';
import { initializeGoogleSheets } from './services/googleSheetsService.js';

export async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Verificar estado de almacenamiento Google (Apps Script o GCP)
  const googleConfig = validateGoogleConfig();
  if (googleConfig.isValid) {
    try {
      await initializeGoogleSheets();
      if (googleConfig.mode === 'apps_script') {
        console.log('✅ Google Apps Script Web App conectado e inicializado (100% gratuito sin GCP).');
      } else {
        console.log('✅ Google Cloud Service Account conectado e inicializado correctamente.');
      }
    } catch (err: any) {
      console.warn('⚠️ No se pudo inicializar Google Sheets al arranque:', err?.message || err);
    }
  } else {
    console.warn(`ℹ️ Modo Google Sheets: Configuración pendiente (${googleConfig.missing.join(', ')}).`);
    console.warn('   Recomendado: Pega tu GOOGLE_APPS_SCRIPT_URL en .env (instrucciones en google-apps-script.js).');
  }

  // Middleware for large base64 uploads (image + audio)
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Mount API Router
  app.use('/api', apiRouter);

  // Vite Development Server or Static Production Files
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NutriVoice AI Fullstack Server running on http://0.0.0.0:${PORT}`);
  });
}

// Auto-start server when executed directly
startServer();

