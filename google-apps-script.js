/**
 * ============================================================================
 * NUTRI VOICE AI - GOOGLE APPS SCRIPT WEB APP
 * ============================================================================
 * Este script actúa como backend serverless 100% GRATUITO para NutriVoice AI.
 * Permite usar Google Sheets como base de datos y Google Drive para fotos
 * sin necesidad de configurar Google Cloud Platform, tarjetas ni Service Accounts.
 *
 * INSTRUCCIONES DE INSTALACIÓN (3 minutos):
 * 1. Abre tu hoja de cálculo en Google Sheets (o crea una nueva en sheets.new).
 * 2. En el menú superior, ve a "Extensiones" > "Apps Script".
 * 3. Borra todo el código que aparezca en el editor y pega este archivo completo.
 * 4. (Opcional) Si quieres una carpeta específica de Drive para fotos, pon su ID
 *    en la variable GOOGLE_DRIVE_FOLDER_ID abajo o pásala desde el archivo .env.
 * 5. Haz clic en el botón azul "Implementar" (arriba a la derecha) > "Nueva implementación".
 * 6. En el engranaje "Seleccionar tipo", elige "Aplicación web".
 * 7. Configura:
 *    - Descripción: NutriVoice API
 *    - Ejecutar como: "Yo" (tu cuenta de Google)
 *    - Quién tiene acceso: "Cualquier usuario" (Anyone)
 * 8. Haz clic en "Implementar" y autoriza los permisos que solicite Google.
 * 9. Copia la "URL de la aplicación web" (termina en /exec) y pégala en tu archivo .env
 *    como GOOGLE_APPS_SCRIPT_URL.
 * ============================================================================
 */

// Si deseas definir un token secreto para proteger tu Web App, colócalo aquí:
var OPTIONAL_SECRET_TOKEN = "";

// Nombres estándar de las pestañas
var SHEETS = {
  MEALS: "Comidas",
  USERS: "Usuarios",
  SUMMARIES: "Resumenes_Diarios"
};

var MEALS_HEADERS = [
  "id", "user_id", "meal_date", "meal_time", "meal_type", "image_url",
  "drive_file_id", "audio_duration_seconds", "audio_transcript", "nombre_plato",
  "calorias_estimadas", "proteinas", "carbohidratos", "grasas", "fibra",
  "puntaje_plato", "feedback_breve", "ingredientes_detectados", "detalles_audio",
  "created_at"
];

var USERS_HEADERS = [
  "id", "name", "age", "gender", "weight_kg", "height_cm", "activity_level",
  "goal", "target_calories", "target_protein_g", "target_carbs_g", "target_fat_g",
  "allergies", "dietary_preferences", "notes", "created_at", "updated_at"
];

var SUMMARIES_HEADERS = [
  "id", "user_id", "summary_date", "total_calories", "total_protein",
  "total_carbs", "total_fat", "puntaje_diario", "consejo_diario",
  "balance_nutricional", "puntos_fuertes", "areas_de_mejora", "meals_count",
  "updated_at"
];

/**
 * Endpoint GET para verificar que el Web App está activo desde el navegador
 */
function doGet(e) {
  return createJsonResponse({
    status: "ok",
    message: "NutriVoice AI Google Apps Script Web App está activo y listo.",
    timestamp: new Date().toISOString()
  });
}

/**
 * Endpoint POST principal que recibe y procesa todas las acciones de la aplicación
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("No se recibieron datos en el cuerpo de la petición.");
    }

    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;

    // Validación de token secreto si está configurado
    if (OPTIONAL_SECRET_TOKEN && OPTIONAL_SECRET_TOKEN.trim() !== "") {
      if (payload.secretToken !== OPTIONAL_SECRET_TOKEN) {
        return createJsonResponse({ success: false, error: "Token de autorización inválido." });
      }
    }

    var result;
    switch (action) {
      case "initialize":
        result = handleInitialize();
        break;
      case "getUser":
        result = handleGetUser(payload.userId || "user_default");
        break;
      case "updateUser":
        result = handleUpdateUser(payload.user, payload.userId || "user_default");
        break;
      case "getMeals":
        result = handleGetMeals(payload.date, payload.userId || "user_default");
        break;
      case "getMealById":
        result = handleGetMealById(payload.id);
        break;
      case "addMeal":
        result = handleAddMeal(payload.meal);
        break;
      case "deleteMeal":
        result = handleDeleteMeal(payload.id);
        break;
      case "purgePastMeals":
        result = handlePurgePastMeals(payload.beforeDate, payload.userId || "user_default");
        break;
      case "getDailySummary":
        result = handleGetDailySummary(payload.date, payload.userId || "user_default");
        break;
      case "saveDailySummary":
        result = handleSaveDailySummary(payload.summary);
        break;
      case "uploadImage":
        result = handleUploadImage(payload);
        break;
      case "deleteImage":
        result = handleDeleteImage(payload.fileId);
        break;
      default:
        throw new Error("Acción no reconocida: " + action);
    }

    return createJsonResponse({ success: true, data: result });
  } catch (err) {
    return createJsonResponse({ success: false, error: err.toString() });
  }
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSpreadsheet() {
  try {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (e) {}
  var propId = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (propId) return SpreadsheetApp.openById(propId);
  throw new Error("No se pudo enlazar la hoja de cálculo. Asegúrate de crear este script desde Extensiones > Apps Script dentro de la hoja.");
}

function getOrCreateSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (headers && headers.length > 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
    }
  } else if (sheet.getLastRow() === 0 && headers && headers.length > 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function safeJsonParse(val, fallback) {
  if (val === null || val === undefined || val === "") return fallback;
  if (typeof val === "object") return val;
  try {
    return JSON.parse(val);
  } catch (e) {
    return fallback;
  }
}

function formatCellDate(val) {
  if (val === null || val === undefined) return "";
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone() || "GMT-3", "yyyy-MM-dd HH:mm:ss");
  }
  return String(val);
}

function formatCellDateOnly(val) {
  if (val === null || val === undefined) return "";
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone() || "GMT-3", "yyyy-MM-dd");
  }
  return String(val);
}

function formatCellTimeOnly(val) {
  if (val === null || val === undefined) return "";
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone() || "GMT-3", "HH:mm");
  }
  return String(val);
}

// ============================================================================
// 1. INICIALIZACIÓN
// ============================================================================
function handleInitialize() {
  var ss = getSpreadsheet();
  getOrCreateSheet(ss, SHEETS.MEALS, MEALS_HEADERS);
  getOrCreateSheet(ss, SHEETS.USERS, USERS_HEADERS);
  getOrCreateSheet(ss, SHEETS.SUMMARIES, SUMMARIES_HEADERS);

  // Asegurar usuario por defecto
  var userSheet = ss.getSheetByName(SHEETS.USERS);
  if (userSheet.getLastRow() <= 1) {
    var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "GMT-3", "yyyy-MM-dd HH:mm:ss");
    var defaultUserRow = [
      "user_default",
      "Usuario Demo",
      28,
      "masculino",
      78,
      178,
      "moderado",
      "deficit",
      2150,
      160,
      200,
      65,
      JSON.stringify(["Lactosa moderada"]),
      JSON.stringify(["Alto en proteína", "Comida real"]),
      "Entrenamiento de fuerza 4x por semana. Buscando definición muscular preservando masa magra.",
      now,
      now
    ];
    userSheet.appendRow(defaultUserRow);
  }

  return { initialized: true };
}

// ============================================================================
// 2. USUARIOS (UserProfile)
// ============================================================================
function handleGetUser(userId) {
  var ss = getSpreadsheet();
  var sheet = getOrCreateSheet(ss, SHEETS.USERS, USERS_HEADERS);
  var rows = sheet.getDataRange().getValues();

  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(userId)) {
      var r = rows[i];
      return {
        id: String(r[0]),
        name: String(r[1] || "Usuario"),
        age: Number(r[2]) || 28,
        gender: r[3] || "masculino",
        weightKg: Number(r[4]) || 70,
        heightCm: Number(r[5]) || 170,
        activityLevel: r[6] || "moderado",
        goal: r[7] || "deficit",
        targetCalories: Number(r[8]) || 2000,
        targetProteinG: Number(r[9]) || 140,
        targetCarbsG: Number(r[10]) || 200,
        targetFatG: Number(r[11]) || 65,
        allergies: safeJsonParse(r[12], []),
        dietaryPreferences: safeJsonParse(r[13], []),
        notes: String(r[14] || ""),
        createdAt: formatCellDate(r[15]),
        updatedAt: formatCellDate(r[16])
      };
    }
  }

  // Fallback por defecto si no existe
  return {
    id: userId,
    name: "Usuario Demo",
    age: 28,
    gender: "masculino",
    weightKg: 78,
    heightCm: 178,
    activityLevel: "moderado",
    goal: "deficit",
    targetCalories: 2150,
    targetProteinG: 160,
    targetCarbsG: 200,
    targetFatG: 65,
    allergies: ["Lactosa moderada"],
    dietaryPreferences: ["Alto en proteína"],
    notes: ""
  };
}

function handleUpdateUser(userData, userId) {
  var ss = getSpreadsheet();
  var sheet = getOrCreateSheet(ss, SHEETS.USERS, USERS_HEADERS);
  var current = handleGetUser(userId);
  var updated = Object.assign({}, current, userData);

  var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "GMT-3", "yyyy-MM-dd HH:mm:ss");
  var rowData = [
    userId,
    updated.name,
    updated.age,
    updated.gender,
    updated.weightKg,
    updated.heightCm,
    updated.activityLevel,
    updated.goal,
    updated.targetCalories,
    updated.targetProteinG,
    updated.targetCarbsG,
    updated.targetFatG,
    JSON.stringify(updated.allergies || []),
    JSON.stringify(updated.dietaryPreferences || []),
    updated.notes || "",
    current.createdAt || now,
    now
  ];

  var rows = sheet.getDataRange().getValues();
  var foundIndex = -1;
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(userId)) {
      foundIndex = i + 1; // 1-based row index
      break;
    }
  }

  if (foundIndex !== -1) {
    sheet.getRange(foundIndex, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }

  return updated;
}

// ============================================================================
// 3. COMIDAS (Meal)
// ============================================================================
function rowToMeal(r) {
  return {
    id: String(r[0]),
    userId: String(r[1]),
    date: formatCellDateOnly(r[2]),
    time: formatCellTimeOnly(r[3]),
    mealType: r[4] || "almuerzo",
    imageUrl: r[5] ? String(r[5]) : undefined,
    driveFileId: r[6] ? String(r[6]) : undefined,
    audioDurationSeconds: Number(r[7]) || 0,
    audioTranscript: r[8] ? String(r[8]) : undefined,
    nombre_plato: String(r[9] || "Comida"),
    calorias_estimadas: Number(r[10]) || 0,
    macros: {
      proteinas: Number(r[11]) || 0,
      carbohidratos: Number(r[12]) || 0,
      grasas: Number(r[13]) || 0,
      fibra: r[14] !== "" && r[14] !== undefined ? Number(r[14]) : undefined
    },
    puntaje_plato: Number(r[15]) || 0,
    feedback_breve: String(r[16] || ""),
    ingredientes_detectados: safeJsonParse(r[17], []),
    detalles_audio: r[18] ? String(r[18]) : undefined,
    createdAt: formatCellDate(r[19])
  };
}

function handleGetMeals(date, userId) {
  var ss = getSpreadsheet();
  var sheet = getOrCreateSheet(ss, SHEETS.MEALS, MEALS_HEADERS);
  var rows = sheet.getDataRange().getValues();
  var meals = [];

  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (String(r[1]) === String(userId)) {
      var rowDate = formatCellDateOnly(r[2]);
      if (!date || rowDate === date) {
        meals.push(rowToMeal(r));
      }
    }
  }

  // Ordenar por hora ascendente
  meals.sort(function(a, b) {
    return (a.time || "").localeCompare(b.time || "");
  });

  return meals;
}

function handleGetMealById(id) {
  var ss = getSpreadsheet();
  var sheet = getOrCreateSheet(ss, SHEETS.MEALS, MEALS_HEADERS);
  var rows = sheet.getDataRange().getValues();

  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(id)) {
      return rowToMeal(rows[i]);
    }
  }
  return null;
}

function handleAddMeal(meal) {
  var ss = getSpreadsheet();
  var sheet = getOrCreateSheet(ss, SHEETS.MEALS, MEALS_HEADERS);

  var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "GMT-3", "yyyy-MM-dd HH:mm:ss");
  var createdAt = meal.createdAt || now;

  var row = [
    meal.id,
    meal.userId,
    meal.date,
    meal.time,
    meal.mealType,
    meal.imageUrl || "",
    meal.driveFileId || "",
    meal.audioDurationSeconds || 0,
    meal.audioTranscript || "",
    meal.nombre_plato,
    meal.calorias_estimadas,
    meal.macros ? meal.macros.proteinas : 0,
    meal.macros ? meal.macros.carbohidratos : 0,
    meal.macros ? meal.macros.grasas : 0,
    meal.macros && meal.macros.fibra !== undefined ? meal.macros.fibra : "",
    meal.puntaje_plato,
    meal.feedback_breve || "",
    JSON.stringify(meal.ingredientes_detectados || []),
    meal.detalles_audio || "",
    createdAt
  ];

  sheet.appendRow(row);
  meal.createdAt = createdAt;
  return meal;
}

function handleDeleteMeal(id) {
  var ss = getSpreadsheet();
  var sheet = getOrCreateSheet(ss, SHEETS.MEALS, MEALS_HEADERS);
  var rows = sheet.getDataRange().getValues();

  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(id)) {
      // Si tiene foto en Drive, intentar borrarla también
      var driveFileId = rows[i][6];
      if (driveFileId) {
        handleDeleteImage(driveFileId);
      }
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

function handlePurgePastMeals(beforeDate, userId) {
  var ss = getSpreadsheet();
  var sheet = getOrCreateSheet(ss, SHEETS.MEALS, MEALS_HEADERS);
  var rows = sheet.getDataRange().getValues();
  var count = 0;

  // Recorrer de abajo hacia arriba para no alterar índices
  for (var i = rows.length - 1; i >= 1; i--) {
    var r = rows[i];
    if (String(r[1]) === String(userId)) {
      var rowDate = formatCellDateOnly(r[2]);
      if (rowDate && rowDate < beforeDate) {
        var driveFileId = r[6];
        if (driveFileId) {
          handleDeleteImage(driveFileId);
        }
        sheet.deleteRow(i + 1);
        count++;
      }
    }
  }

  return count;
}

// ============================================================================
// 4. RESÚMENES DIARIOS (DailySummary)
// ============================================================================
function handleGetDailySummary(date, userId) {
  var ss = getSpreadsheet();
  var sheet = getOrCreateSheet(ss, SHEETS.SUMMARIES, SUMMARIES_HEADERS);
  var rows = sheet.getDataRange().getValues();

  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (String(r[1]) === String(userId) && formatCellDateOnly(r[2]) === date) {
      return {
        id: String(r[0]),
        userId: String(r[1]),
        date: formatCellDateOnly(r[2]),
        totalCalories: Number(r[3]) || 0,
        totalProtein: Number(r[4]) || 0,
        totalCarbs: Number(r[5]) || 0,
        totalFat: Number(r[6]) || 0,
        puntaje_diario: Number(r[7]) || 0,
        consejo_diario: String(r[8] || ""),
        balance_nutricional: String(r[9] || ""),
        puntos_fuertes: safeJsonParse(r[10], []),
        areas_de_mejora: safeJsonParse(r[11], []),
        mealsCount: Number(r[12]) || 0,
        updatedAt: formatCellDate(r[13])
      };
    }
  }
  return null;
}

function handleSaveDailySummary(summary) {
  var ss = getSpreadsheet();
  var sheet = getOrCreateSheet(ss, SHEETS.SUMMARIES, SUMMARIES_HEADERS);
  var rows = sheet.getDataRange().getValues();

  var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "GMT-3", "yyyy-MM-dd HH:mm:ss");
  var id = summary.userId + "_" + summary.date;

  var rowData = [
    id,
    summary.userId,
    summary.date,
    summary.totalCalories,
    summary.totalProtein,
    summary.totalCarbs,
    summary.totalFat,
    summary.puntaje_diario,
    summary.consejo_diario,
    summary.balance_nutricional,
    JSON.stringify(summary.puntos_fuertes || []),
    JSON.stringify(summary.areas_de_mejora || []),
    summary.mealsCount,
    summary.updatedAt || now
  ];

  var foundIndex = -1;
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][1]) === String(summary.userId) && formatCellDateOnly(rows[i][2]) === summary.date) {
      foundIndex = i + 1;
      break;
    }
  }

  if (foundIndex !== -1) {
    sheet.getRange(foundIndex, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }

  return summary;
}

// ============================================================================
// 5. GOOGLE DRIVE (Subida y borrado de imágenes)
// ============================================================================
function handleUploadImage(payload) {
  var base64 = payload.imageBase64;
  if (!base64) throw new Error("No se proporcionó contenido de imagen.");

  var cleanBase64 = base64.replace(/^data:image\/[a-zA-Z]+;base64,/, "");
  var bytes = Utilities.base64Decode(cleanBase64);
  var mimeType = payload.mimeType || "image/jpeg";
  var fileName = payload.fileName || ("comida_" + new Date().getTime() + ".jpg");
  var blob = Utilities.newBlob(bytes, mimeType, fileName);

  var folder;
  if (payload.folderId && String(payload.folderId).trim() !== "") {
    try {
      folder = DriveApp.getFolderById(String(payload.folderId).trim());
    } catch (e) {
      // Si el ID es inválido, busca o crea la carpeta NutriVoice_Fotos
      folder = getNutriVoiceFolder();
    }
  } else {
    folder = getNutriVoiceFolder();
  }

  var file = folder.createFile(blob);
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (permErr) {
    // Si la organización restringe compartir públicamente, continúa
  }

  var fileId = file.getId();
  var directImageUrl = "https://lh3.googleusercontent.com/d/" + fileId;

  return {
    fileId: fileId,
    directImageUrl: directImageUrl,
    webViewLink: file.getUrl()
  };
}

function getNutriVoiceFolder() {
  var folders = DriveApp.getFoldersByName("NutriVoice_Fotos");
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder("NutriVoice_Fotos");
}

function handleDeleteImage(fileId) {
  if (!fileId) return false;
  try {
    var file = DriveApp.getFileById(fileId);
    file.setTrashed(true);
    return true;
  } catch (e) {
    return false;
  }
}

