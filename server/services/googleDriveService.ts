import { Readable } from 'stream';
import {
  getDriveClient,
  GOOGLE_DRIVE_FOLDER_ID,
  isUsingAppsScript,
  callAppsScript,
} from '../config/google.js';

export interface UploadImageResult {
  fileId: string;
  directImageUrl: string;
  webViewLink?: string;
}

/**
 * Sube una imagen en formato Base64 a Google Drive.
 * Si está configurado Google Apps Script, delega la subida a Apps Script (sin GCP).
 * De lo contrario, utiliza la Google Drive API mediante Service Account.
 */
export async function uploadMealImageToDrive({
  imageBase64,
  fileName,
  mimeType = 'image/jpeg',
}: {
  imageBase64: string;
  fileName: string;
  mimeType?: string;
}): Promise<UploadImageResult> {
  // 1. Modo Google Apps Script Web App (Recomendado sin Google Cloud)
  if (isUsingAppsScript()) {
    return await callAppsScript<UploadImageResult>('uploadImage', {
      imageBase64,
      fileName,
      mimeType,
      folderId: GOOGLE_DRIVE_FOLDER_ID,
    });
  }

  // 2. Modo Google Cloud Service Account
  if (!GOOGLE_DRIVE_FOLDER_ID) {
    throw new Error(
      'Falta configurar la variable GOOGLE_DRIVE_FOLDER_ID (o GOOGLE_APPS_SCRIPT_URL) en el archivo .env'
    );
  }

  // Limpiar encabezado data:image/...;base64, si viene presente
  let cleanBase64 = imageBase64;
  let detectedMime = mimeType;

  if (imageBase64.includes(';base64,')) {
    const parts = imageBase64.split(';base64,');
    cleanBase64 = parts[1];
    const mimeMatch = parts[0].match(/data:(.*)/);
    if (mimeMatch && mimeMatch[1]) {
      detectedMime = mimeMatch[1];
    }
  }

  const imageBuffer = Buffer.from(cleanBase64, 'base64');
  const drive = getDriveClient();

  const uploadResponse = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [GOOGLE_DRIVE_FOLDER_ID],
      mimeType: detectedMime,
    },
    media: {
      mimeType: detectedMime,
      body: Readable.from(imageBuffer),
    },
    fields: 'id, name, webViewLink, webContentLink',
  });

  const fileId = uploadResponse.data.id;
  if (!fileId) {
    throw new Error('Google Drive no devolvió un ID para el archivo subido.');
  }

  // Hacer el archivo legible públicamente
  try {
    await drive.permissions.create({
      fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });
  } catch (permErr: any) {
    console.warn(
      'Aviso: No se pudo configurar permiso público automático en Drive:',
      permErr?.message || permErr
    );
  }

  const directImageUrl = `https://lh3.googleusercontent.com/d/${fileId}`;

  return {
    fileId,
    directImageUrl,
    webViewLink: uploadResponse.data.webViewLink || undefined,
  };
}

/**
 * Elimina un archivo de Google Drive por su ID.
 */
export async function deleteImageFromDrive(fileId: string): Promise<boolean> {
  if (!fileId) return false;

  if (isUsingAppsScript()) {
    try {
      return await callAppsScript<boolean>('deleteImage', { fileId });
    } catch (err: any) {
      console.warn(`No se pudo eliminar el archivo ${fileId} vía Apps Script:`, err?.message || err);
      return false;
    }
  }

  try {
    const drive = getDriveClient();
    await drive.files.delete({ fileId });
    return true;
  } catch (err: any) {
    console.warn(`No se pudo eliminar el archivo ${fileId} de Google Drive:`, err?.message || err);
    return false;
  }
}
