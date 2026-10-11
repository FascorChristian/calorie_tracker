<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# NutriVoice AI - Calorie & Nutrition Tracker

Aplicación inteligente fullstack para seguimiento nutricional con captura multimodal (fotos y notas de voz) impulsada por **Google Gemini AI**, almacenamiento estructurado en **Google Sheets** y almacenamiento fotográfico en **Google Drive**.

---

## 🚀 Requisitos Previos

- **Node.js** (v18 o superior)
- **NPM**
- Una cuenta gratuita de Google (Gmail / Google Drive)

---

## 🛠️ Configuración Rápida

### 1. Clonar e Instalar Dependencias
```bash
git clone <tu-repositorio>
cd calorie_tracker
npm install
```

### 2. Configurar Variables de Entorno (`.env`)
Copia la plantilla:
```bash
cp .env.example .env
```

Configura en tu archivo `.env`:
```env
GEMINI_API_KEY="tu_clave_de_gemini"
GOOGLE_APPS_SCRIPT_URL="https://script.google.com/macros/s/TU_SCRIPT_ID/exec"
```

---

## 📑 Configuración con Google Apps Script (100% Gratis sin Google Cloud)

Esta es la opción recomendada porque **no requiere tarjeta de crédito, ni crear proyectos en Google Cloud, ni configurar Service Accounts**:

1. **Crear o Abrir una Hoja en Google Sheets:**
   - Entra a [sheets.new](https://sheets.new) y crea una nueva hoja de cálculo (ej: "NutriVoice DB").
2. **Abrir el Editor de Apps Script:**
   - En el menú superior de la hoja, haz clic en **Extensiones > Apps Script**.
3. **Pegar el Código:**
   - Borra el contenido por defecto en el archivo `Código.gs`.
   - Abre el archivo [`google-apps-script.js`](./google-apps-script.js) de este repositorio, copia todo su contenido y pégalo en el editor.
4. **Implementar como Aplicación Web:**
   - Haz clic en el botón azul superior **Implementar > Nueva implementación**.
   - Haz clic en el icono de engranaje ⚙️ (*Seleccionar tipo*) y elige **Aplicación web**.
   - En la configuración:
     - **Descripción:** `NutriVoice API`
     - **Ejecutar como:** `Yo (tu correo)`
     - **Quién tiene acceso:** `Cualquier usuario` *(Anyone)*
   - Presiona **Implementar**.
   - Acepta la ventana de permisos de Google (*Configuración avanzada > Ir a NutriVoice (no seguro)*).
5. **Copiar la URL generada:**
   - Copia la **URL de la aplicación web** (termina en `/exec`).
   - Pégala en tu archivo `.env`:
     ```env
     GOOGLE_APPS_SCRIPT_URL="https://script.google.com/macros/s/.../exec"
     ```
   - *(Opcional)* Si quieres que las fotos vayan a una carpeta específica en Drive, puedes crear una carpeta, copiar su ID de la URL y ponerlo en `GOOGLE_DRIVE_FOLDER_ID`. Si lo dejas vacío, el script creará automáticamente una carpeta llamada `NutriVoice_Fotos` en tu Drive.

¡Listo! Al arrancar la aplicación, se crearán de inmediato las pestañas `Comidas`, `Usuarios` y `Resumenes_Diarios`.

---

## ⚙️ Opción Alternativa: Google Cloud Service Account
Si prefieres usar Google Cloud Platform en lugar de Apps Script:
1. Habilita Google Sheets API y Google Drive API en Google Cloud Console.
2. Crea una Service Account, descarga `service-account.json` y ponlo en la raíz.
3. Comparte tu hoja de Google Sheets y tu carpeta de Drive con el correo de la Service Account (Editor).
4. Configura `GOOGLE_SPREADSHEET_ID` y `GOOGLE_SERVICE_ACCOUNT_KEY_FILE="./service-account.json"`.

---

## 🏃‍♂️ Ejecución

### Modo Desarrollo
```bash
npm run dev
```
Abre tu navegador en `http://localhost:3000`.

### Compilación para Producción
```bash
npm run build
npm run start
```
