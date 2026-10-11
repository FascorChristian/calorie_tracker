import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

function cleanEnvString(val: string | undefined): string {
  if (!val) return '';
  return val.trim().replace(/^["']|["'];?$/g, '').replace(/;$/, '').trim();
}

export const GOOGLE_APPS_SCRIPT_URL = cleanEnvString(process.env.GOOGLE_APPS_SCRIPT_URL);
export const GOOGLE_APPS_SCRIPT_SECRET_TOKEN = cleanEnvString(process.env.GOOGLE_APPS_SCRIPT_SECRET_TOKEN);
export const GOOGLE_SPREADSHEET_ID = cleanEnvString(process.env.GOOGLE_SPREADSHEET_ID);
export const GOOGLE_DRIVE_FOLDER_ID = cleanEnvString(process.env.GOOGLE_DRIVE_FOLDER_ID);

/**
 * Determina si la aplicación está operando en modo Google Apps Script Web App
 * (100% gratuito sin Google Cloud Console).
 */
export function isUsingAppsScript(): boolean {
  return Boolean(GOOGLE_APPS_SCRIPT_URL && GOOGLE_APPS_SCRIPT_URL.trim() !== '');
}

/**
 * Cliente HTTP para invocar el Google Apps Script Web App.
 * Ejecuta acciones en Google Sheets y Google Drive con seguimiento automático de redirecciones (302).
 */
export async function callAppsScript<T = any>(action: string, payload: any = {}): Promise<T> {
  if (!GOOGLE_APPS_SCRIPT_URL) {
    throw new Error('Falta configurar GOOGLE_APPS_SCRIPT_URL en el archivo .env');
  }

  const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action,
      secretToken: GOOGLE_APPS_SCRIPT_SECRET_TOKEN,
      folderId: GOOGLE_DRIVE_FOLDER_ID,
      ...payload,
    }),
    redirect: 'follow',
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Error HTTP en Google Apps Script (${response.status}): ${errorText}`);
  }

  const result: any = await response.json();
  if (result && result.success === false) {
    throw new Error(result.error || 'Error reportado por Google Apps Script');
  }

  return (result.data !== undefined ? result.data : result) as T;
}

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive',
];

/**
 * Obtiene la instancia de autenticación de Google Cloud (Service Account).
 * Se mantiene como respaldo si se prefiere GCP en lugar de Apps Script.
 */
export function getGoogleAuth() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS) {
    try {
      const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS);
      return new google.auth.GoogleAuth({
        credentials,
        scopes: SCOPES,
      });
    } catch (err) {
      console.error('Error al parsear GOOGLE_SERVICE_ACCOUNT_CREDENTIALS:', err);
    }
  }

  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (clientEmail && privateKey) {
    return new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
      scopes: SCOPES,
    });
  }

  const keyFilePath =
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE ||
    path.join(process.cwd(), 'service-account.json');

  if (fs.existsSync(keyFilePath)) {
    return new google.auth.GoogleAuth({
      keyFile: keyFilePath,
      scopes: SCOPES,
    });
  }

  return new google.auth.GoogleAuth({
    scopes: SCOPES,
  });
}

export function getSheetsClient() {
  const auth = getGoogleAuth();
  return google.sheets({ version: 'v4', auth });
}

export function getDriveClient() {
  const auth = getGoogleAuth();
  return google.drive({ version: 'v3', auth });
}

/**
 * Valida la configuración de Google.
 * Prioriza Google Apps Script (sin GCP) y admite Service Account como alternativa.
 */
export function validateGoogleConfig(): {
  isValid: boolean;
  mode: 'apps_script' | 'service_account' | 'none';
  missing: string[];
} {
  if (isUsingAppsScript()) {
    return {
      isValid: true,
      mode: 'apps_script',
      missing: [],
    };
  }

  const hasCredentials =
    Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS) ||
    Boolean(process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) ||
    fs.existsSync(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || path.join(process.cwd(), 'service-account.json'));

  if (GOOGLE_SPREADSHEET_ID && hasCredentials) {
    return {
      isValid: true,
      mode: 'service_account',
      missing: [],
    };
  }

  return {
    isValid: false,
    mode: 'none',
    missing: [
      'GOOGLE_APPS_SCRIPT_URL (Recomendado sin GCP) o GOOGLE_SPREADSHEET_ID + service-account.json',
    ],
  };
}
