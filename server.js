import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

const app = express();
const PORT = process.env.PORT || 3000;
const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const ELEVENLABS_MODEL_ID = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";
const ELEVENLABS_OUTPUT_FORMAT = process.env.ELEVENLABS_OUTPUT_FORMAT || "mp3_44100_128";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = process.env.NOX_DATA_DIR || path.join(__dirname, "data");
const CONTEXT_SECRETS_FILE = path.join(DATA_DIR, "context-secrets.json");
const ARCHIVES_FILE = path.join(DATA_DIR, "archives.json");
const FATUM_USERS_FILE = path.join(DATA_DIR, "fatum-users.json");
const LABYRINTHUS_CHRONICON_FILE = path.join(DATA_DIR, "labyrinthus-chronicon.json");
const LABYRINTHUS_EXVOTOS_FILE = path.join(DATA_DIR, "labyrinthus-exvotos.json");
const LABYRINTHUS_STATE_FILE = path.join(DATA_DIR, "labyrinthus-state.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readContextSecretsFromServer() {
  try {
    ensureDataDir();

    if (!fs.existsSync(CONTEXT_SECRETS_FILE)) {
      return [];
    }

    const raw = fs.readFileSync(CONTEXT_SECRETS_FILE, "utf8");
    const parsed = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Context secrets read error:", error);
    return [];
  }
}

function writeContextSecretsToServer(secrets) {
  ensureDataDir();

  const safeSecrets = Array.isArray(secrets) ? secrets.slice(0, 300) : [];
  fs.writeFileSync(CONTEXT_SECRETS_FILE, JSON.stringify(safeSecrets, null, 2), "utf8");

  return safeSecrets;
}


function readJsonArrayFromServer(filePath) {
  try {
    ensureDataDir();

    if (!fs.existsSync(filePath)) {
      return [];
    }

    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("JSON array read error:", filePath, error);
    return [];
  }
}

function writeJsonArrayToServer(filePath, values, maxItems = 500) {
  ensureDataDir();

  const safeValues = Array.isArray(values) ? values.slice(0, maxItems) : [];
  fs.writeFileSync(filePath, JSON.stringify(safeValues, null, 2), "utf8");

  return safeValues;
}

function readJsonObjectFromServer(filePath) {
  try {
    ensureDataDir();
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch (error) {
    console.error("JSON object read error:", filePath, error);
    return null;
  }
}

function writeJsonObjectToServer(filePath, value) {
  ensureDataDir();
  const safeValue = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  fs.writeFileSync(filePath, JSON.stringify(safeValue, null, 2), "utf8");
  return safeValue;
}

function contextSecretsToPromptText(secrets) {
  return (Array.isArray(secrets) ? secrets : [])
    .map((entry) => {
      const who = entry.userName ? `${entry.userName} : ` : "";
      return `${who}${entry.text || ""}`;
    })
    .filter(Boolean)
    .join("\n")
    .slice(0, 6000);
}


function isSupabaseEnabled() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function supabaseHeaders(extra = {}) {
  return {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
    ...extra
  };
}

async function supabaseRequest(pathname, options = {}) {
  if (!isSupabaseEnabled()) {
    throw new Error("Supabase is not configured.");
  }

  const baseUrl = process.env.SUPABASE_URL.replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/rest/v1/${pathname}`, {
    ...options,
    headers: supabaseHeaders(options.headers || {})
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(`Supabase ${response.status}: ${text}`);
  }

  return data;
}

function mapContextSecretFromDb(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    userName: row.user_name || "",
    text: row.text || ""
  };
}

function mapArchiveFromDb(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    message: row.message || "",
    photoDataUrl: row.photo_data_url || "",
    question: row.question || "",
    oracleSentence: row.oracle_sentence || "",
    action: row.action || "",
    fatum: Number.isFinite(Number(row.fatum)) ? Number(row.fatum) : null,
    reaction: row.reaction || "",
    reactions: Array.isArray(row.reactions) ? row.reactions : [],
    comments: Array.isArray(row.comments) ? row.comments : []
  };
}

function mapFatumUserFromDb(row) {
  return {
    id: row.id,
    name: row.name || "",
    score: Number(row.score) || 0,
    credited: Array.isArray(row.credited) ? row.credited : [],
    secretumUnlockedLevel: Number(row.secretum_unlocked_level) || 0
  };
}

function mapLabyrinthusChroniconFromDb(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    timestamp: row.timestamp || "",
    text: row.text || ""
  };
}

function mapLabyrinthusExVotoFromDb(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    row: Number(row.row),
    col: Number(row.col),
    owner: row.owner || "",
    type: row.type || "",
    dataUrl: row.data_url || "",
    openedAt: row.opened_at || null,
    openedBy: row.opened_by || ""
  };
}

function mapLabyrinthusStateFromDb(row) {
  return {
    id: row.id || "current",
    updatedAt: row.updated_at || row.created_at || null,
    state: row.state && typeof row.state === "object" ? row.state : null
  };
}

async function readLabyrinthusChronicon() {
  if (isSupabaseEnabled()) {
    try {
      const rows = await supabaseRequest("nox_labyrinthus_chronicon?select=*&order=created_at.desc&limit=500");
      return rows.map(mapLabyrinthusChroniconFromDb);
    } catch (error) {
      console.error("Labyrinthus chronicon Supabase read error:", error);
      return readJsonArrayFromServer(LABYRINTHUS_CHRONICON_FILE).slice(0, 500);
    }
  }

  return readJsonArrayFromServer(LABYRINTHUS_CHRONICON_FILE).slice(0, 500);
}

async function insertLabyrinthusChroniconEvent(entry) {
  const text = String(entry?.text || "").trim().slice(0, 600);
  if (!text) return null;

  const timestamp = String(entry?.timestamp || "").trim().slice(0, 40);

  if (isSupabaseEnabled()) {
    try {
      const rows = await supabaseRequest("nox_labyrinthus_chronicon", {
        method: "POST",
        body: JSON.stringify({
          timestamp,
          text
        })
      });
      return rows?.[0] ? mapLabyrinthusChroniconFromDb(rows[0]) : null;
    } catch (error) {
      console.error("Labyrinthus chronicon Supabase write error:", error);
    }
  }

  const events = readJsonArrayFromServer(LABYRINTHUS_CHRONICON_FILE);
  const nextEvents = [
    {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: new Date().toISOString(),
      timestamp,
      text
    },
    ...events
  ].slice(0, 500);

  writeJsonArrayToServer(LABYRINTHUS_CHRONICON_FILE, nextEvents, 500);
  return nextEvents[0];
}

async function readLabyrinthusExVotos() {
  if (isSupabaseEnabled()) {
    try {
      const rows = await supabaseRequest("nox_labyrinthus_exvotos?select=*&opened_at=is.null&order=created_at.desc&limit=500");
      return rows.map(mapLabyrinthusExVotoFromDb);
    } catch (error) {
      console.error("Labyrinthus ex voto Supabase read error:", error);
      return readJsonArrayFromServer(LABYRINTHUS_EXVOTOS_FILE).slice(0, 500);
    }
  }

  return readJsonArrayFromServer(LABYRINTHUS_EXVOTOS_FILE).slice(0, 500);
}

async function insertLabyrinthusExVoto(entry) {
  const row = Number(entry?.row);
  const col = Number(entry?.col);
  const owner = String(entry?.owner || "").trim().slice(0, 80);
  const type = String(entry?.type || "").trim().slice(0, 20);
  const dataUrl = String(entry?.dataUrl || entry?.data_url || "").trim();

  if (!Number.isFinite(row) || !Number.isFinite(col) || !owner || !type || !dataUrl) {
    throw new Error("Invalid Labyrinthus ex voto payload.");
  }

  if (isSupabaseEnabled()) {
    try {
      const rows = await supabaseRequest("nox_labyrinthus_exvotos", {
        method: "POST",
        body: JSON.stringify({
          row: Math.round(row),
          col: Math.round(col),
          owner,
          type,
          data_url: dataUrl
        })
      });
      return rows?.[0] ? mapLabyrinthusExVotoFromDb(rows[0]) : null;
    } catch (error) {
      console.error("Labyrinthus ex voto Supabase write error:", error);
    }
  }

  const values = readJsonArrayFromServer(LABYRINTHUS_EXVOTOS_FILE);
  const created = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: new Date().toISOString(),
    row: Math.round(row),
    col: Math.round(col),
    owner,
    type,
    dataUrl,
    openedAt: null,
    openedBy: ""
  };
  const next = [created, ...values].slice(0, 500);
  writeJsonArrayToServer(LABYRINTHUS_EXVOTOS_FILE, next, 500);
  return created;
}

async function openLabyrinthusExVoto(id, openedBy = "") {
  const safeId = String(id || "").trim();
  if (!safeId) return null;

  if (isSupabaseEnabled()) {
    try {
      const rows = await supabaseRequest(`nox_labyrinthus_exvotos?id=eq.${encodeURIComponent(safeId)}`, {
        method: "PATCH",
        body: JSON.stringify({
          opened_at: new Date().toISOString(),
          opened_by: String(openedBy || "").slice(0, 80)
        })
      });
      return rows?.[0] ? mapLabyrinthusExVotoFromDb(rows[0]) : null;
    } catch (error) {
      console.error("Labyrinthus ex voto Supabase open error:", error);
    }
  }

  const values = readJsonArrayFromServer(LABYRINTHUS_EXVOTOS_FILE);
  const openedAt = new Date().toISOString();
  const next = values.map((entry) => entry.id === safeId ? { ...entry, openedAt, openedBy } : entry);
  writeJsonArrayToServer(LABYRINTHUS_EXVOTOS_FILE, next, 500);
  return next.find(entry => entry.id === safeId) || null;
}

async function readLabyrinthusState() {
  if (isSupabaseEnabled()) {
    try {
      const rows = await supabaseRequest("nox_labyrinthus_state?select=*&id=eq.current&limit=1");
      const mapped = rows?.[0] ? mapLabyrinthusStateFromDb(rows[0]) : null;
      if (mapped?.state) return mapped;
    } catch (error) {
      console.error("Labyrinthus state Supabase read error:", error);
    }
  }

  const localState = readJsonObjectFromServer(LABYRINTHUS_STATE_FILE);
  return localState ? { id:"current", updatedAt:localState.updatedAt || null, state:localState.state || localState } : { id:"current", updatedAt:null, state:null };
}

async function writeLabyrinthusState(state) {
  const safeState = state && typeof state === "object" && !Array.isArray(state) ? state : null;
  if (!safeState) throw new Error("Invalid Labyrinthus state payload.");
  const updatedAt = new Date().toISOString();

  if (isSupabaseEnabled()) {
    try {
      const rows = await supabaseRequest("nox_labyrinthus_state?on_conflict=id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({ id: "current", updated_at: updatedAt, state: safeState })
      });
      return rows?.[0] ? mapLabyrinthusStateFromDb(rows[0]) : { id:"current", updatedAt, state:safeState };
    } catch (error) {
      console.error("Labyrinthus state Supabase write error:", error);
    }
  }

  return writeJsonObjectToServer(LABYRINTHUS_STATE_FILE, { id:"current", updatedAt, state:safeState });
}

async function readContextSecrets() {
  if (isSupabaseEnabled()) {
    const rows = await supabaseRequest("nox_context_secrets?select=*&order=created_at.desc&limit=300");
    return rows.map(mapContextSecretFromDb);
  }

  return readContextSecretsFromServer();
}

async function insertContextSecret({ text, userName }) {
  if (isSupabaseEnabled()) {
    const rows = await supabaseRequest("nox_context_secrets", {
      method: "POST",
      body: JSON.stringify({
        user_name: userName || "",
        text
      })
    });

    return rows?.[0] ? mapContextSecretFromDb(rows[0]) : null;
  }

  const secrets = readContextSecretsFromServer();
  const nextSecrets = [
    {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: new Date().toISOString(),
      userName: userName || "",
      text
    },
    ...secrets
  ].slice(0, 300);

  writeContextSecretsToServer(nextSecrets);
  return nextSecrets[0];
}

async function readArchives() {
  if (isSupabaseEnabled()) {
    const rows = await supabaseRequest("nox_archives?select=*&order=created_at.desc&limit=500");
    return rows.map(mapArchiveFromDb);
  }

  return readJsonArrayFromServer(ARCHIVES_FILE);
}

async function insertArchive(entry) {
  if (isSupabaseEnabled()) {
    const rows = await supabaseRequest("nox_archives", {
      method: "POST",
      body: JSON.stringify({
        message: entry.message || "",
        photo_data_url: entry.photoDataUrl || "",
        question: entry.question || "",
        oracle_sentence: entry.oracleSentence || "",
        action: entry.action || "",
        fatum: Number.isFinite(Number(entry.fatum)) ? Number(entry.fatum) : null,
        reaction: "",
        reactions: [],
        comments: []
      })
    });

    return rows?.[0] ? mapArchiveFromDb(rows[0]) : null;
  }

  const archives = readJsonArrayFromServer(ARCHIVES_FILE);
  const nextArchives = [
    {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: new Date().toISOString(),
      message: entry.message || "",
      photoDataUrl: entry.photoDataUrl || "",
      question: entry.question || "",
      oracleSentence: entry.oracleSentence || "",
      action: entry.action || "",
      fatum: Number.isFinite(Number(entry.fatum)) ? Number(entry.fatum) : null,
      reaction: "",
      comments: []
    },
    ...archives
  ].slice(0, 500);

  writeJsonArrayToServer(ARCHIVES_FILE, nextArchives, 500);
  return nextArchives[0];
}

async function updateArchive(id, patch) {
  if (isSupabaseEnabled()) {
    const currentRows = await supabaseRequest(`nox_archives?select=comments,reactions&id=eq.${encodeURIComponent(id)}&limit=1`);
    const current = currentRows?.[0] || {};
    const updatePayload = {};

    if (typeof patch.reaction === "string") {
      const reactions = Array.isArray(current.reactions) ? current.reactions : [];
      updatePayload.reaction = patch.reaction;
      updatePayload.reactions = [...reactions, patch.reaction];
    }

    if (typeof patch.comment === "string") {
      const comments = Array.isArray(current.comments) ? current.comments : [];
      if (patch.comment.trim()) {
        updatePayload.comments = [...comments, patch.comment.trim()];
      }
    }

    if (!Object.keys(updatePayload).length) {
      return null;
    }

    const rows = await supabaseRequest(`nox_archives?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(updatePayload)
    });

    return rows?.[0] ? mapArchiveFromDb(rows[0]) : null;
  }

  const archives = readJsonArrayFromServer(ARCHIVES_FILE);
  const nextArchives = archives.map((entry) => {
    if (entry.id !== id) return entry;

    const nextEntry = { ...entry };

    if (typeof patch.reaction === "string") {
      const reactions = Array.isArray(nextEntry.reactions)
        ? nextEntry.reactions
        : nextEntry.reaction
          ? [nextEntry.reaction]
          : [];

      nextEntry.reaction = patch.reaction;
      nextEntry.reactions = [...reactions, patch.reaction];
    }

    if (typeof patch.comment === "string") {
      const comments = Array.isArray(nextEntry.comments)
        ? nextEntry.comments
        : nextEntry.comment
          ? [nextEntry.comment]
          : [];

      if (patch.comment.trim()) {
        nextEntry.comments = [...comments, patch.comment.trim()];
        delete nextEntry.comment;
      }
    }

    return nextEntry;
  });

  writeJsonArrayToServer(ARCHIVES_FILE, nextArchives, 500);
  return nextArchives.find((entry) => entry.id === id) || null;
}

async function deleteArchive(id) {
  if (isSupabaseEnabled()) {
    await supabaseRequest(`nox_archives?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" }
    });

    return true;
  }

  const archives = readJsonArrayFromServer(ARCHIVES_FILE);
  const nextArchives = archives.filter((entry) => entry.id !== id);
  writeJsonArrayToServer(ARCHIVES_FILE, nextArchives, 500);
  return true;
}

async function readFatumUsers() {
  if (isSupabaseEnabled()) {
    const rows = await supabaseRequest("nox_fatum_users?select=*&order=created_at.asc&limit=9");
    return rows.map(mapFatumUserFromDb);
  }

  return readJsonArrayFromServer(FATUM_USERS_FILE);
}

async function insertFatumUser(name) {
  if (isSupabaseEnabled()) {
    const rows = await supabaseRequest("nox_fatum_users", {
      method: "POST",
      body: JSON.stringify({
        name,
        score: 0,
        credited: [],
        secretum_unlocked_level: 0
      })
    });

    return rows?.[0] ? mapFatumUserFromDb(rows[0]) : null;
  }

  const users = readJsonArrayFromServer(FATUM_USERS_FILE);
  const nextUsers = [
    ...users,
    {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name,
      score: 0,
      credited: [],
      secretumUnlockedLevel: 0
    }
  ].slice(0, 9);

  writeJsonArrayToServer(FATUM_USERS_FILE, nextUsers, 9);
  return nextUsers[nextUsers.length - 1];
}

async function updateFatumUser(id, patch) {
  if (isSupabaseEnabled()) {
    const updatePayload = {};

    if (Number.isFinite(Number(patch.score))) {
      updatePayload.score = Math.max(0, Math.round(Number(patch.score)));
    }

    if (Array.isArray(patch.credited)) {
      updatePayload.credited = patch.credited.slice(0, 500);
    }

    if (Number.isFinite(Number(patch.secretumUnlockedLevel))) {
      updatePayload.secretum_unlocked_level = Math.max(0, Math.round(Number(patch.secretumUnlockedLevel)));
    }

    if (!Object.keys(updatePayload).length) {
      return null;
    }

    const rows = await supabaseRequest(`nox_fatum_users?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(updatePayload)
    });

    return rows?.[0] ? mapFatumUserFromDb(rows[0]) : null;
  }

  const users = readJsonArrayFromServer(FATUM_USERS_FILE);
  const nextUsers = users.map((user) => {
    if (user.id !== id) return user;

    const nextUser = { ...user };

    if (Number.isFinite(Number(patch.score))) {
      nextUser.score = Math.max(0, Math.round(Number(patch.score)));
    }

    if (Array.isArray(patch.credited)) {
      nextUser.credited = patch.credited.slice(0, 500);
    }

    if (Number.isFinite(Number(patch.secretumUnlockedLevel))) {
      nextUser.secretumUnlockedLevel = Math.max(0, Math.round(Number(patch.secretumUnlockedLevel)));
    }

    return nextUser;
  });

  writeJsonArrayToServer(FATUM_USERS_FILE, nextUsers, 9);
  return nextUsers.find((user) => user.id === id) || null;
}

async function getContextSecretsForPrompt() {
  return contextSecretsToPromptText(await readContextSecrets());
}



app.use(express.json({ limit: "20mb" }));

const readingSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "cards", "crossReading", "synthesis", "oracleSentence", "action", "fatum"],
  properties: {
    title: {
      type: "string",
      description: "Titre bref, littéraire, très court."
    },
    cards: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["position", "cardName", "key", "interpretation"],
        properties: {
          position: { type: "string" },
          cardName: { type: "string" },
          key: { type: "string" },
          interpretation: {
            type: "string",
            description: "Interprétation concise de la carte dans sa position, 20 à 28 mots maximum."
          }
        }
      }
    },
    crossReading: {
      type: "string",
      description: "Lecture croisée très concise des tensions entre les trois cartes, 35 mots maximum."
    },
    synthesis: {
      type: "string",
      description: "Synthèse finale courte, symbolique et tranchante, 35 mots maximum."
    },
    oracleSentence: {
      type: "string",
      description: "Phrase-oracle finale, une seule phrase courte."
    },
    action: {
      type: "string",
      description: "Action prescrite concrète, triviale, ferme, piquante, contemporaine et urbaine, terminée par un point. Si une question explicite est fournie, elle doit répondre strictement à cette question et non seulement commenter le tirage."
    },
    fatum: {
      type: "integer",
      minimum: 0,
      maximum: 100,
      description: "Score Fatum en points, de 0 à 100. Il indique le degré d’accomplissement, d’alignement ou de fatalité active du tirage. Ne pas exprimer en pourcentage."
    }
  }
};


const strictActionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["action"],
  properties: {
    action: {
      type: "string",
      description: "Action concrète qui répond strictement à la question posée. Pour une question de type dois-je, elle tranche explicitement ou implicitement oui/non. Une seule phrase terminée par un point."
    }
  }
};

async function rewriteActionForExplicitQuestion(openai, question, reading, payload) {
  if (!question?.trim()) return reading?.action || "";

  const response = await openai.responses.create({
    model: MODEL,
    temperature: 0.45,
    max_output_tokens: 180,
    instructions: `
Vous réécrivez uniquement l’action prescrite d’un oracle.

La question de l’utilisateur est prioritaire sur tout le reste.
L’action doit être une réponse stricte, pratique et directement exécutable à cette question.
Elle ne doit pas commenter les cartes, ne doit pas rester symbolique, ne doit pas donner une ambiance générale.
Si la question demande « dois-je… ? », l’action doit trancher oui ou non par une consigne claire.
La phrase peut être ironique, sèche et piquante, mais elle doit répondre au choix demandé.
Ne répétez pas la question.
Ne produisez qu’une seule phrase, terminée par un point.
`,
    input: JSON.stringify({
      question: question.trim(),
      currentAction: reading?.action || "",
      oracleSentence: reading?.oracleSentence || "",
      synthesis: reading?.synthesis || "",
      cards: payload?.cards || []
    }),
    text: {
      format: {
        type: "json_schema",
        name: "strict_oracle_action",
        strict: true,
        schema: strictActionSchema
      }
    }
  });

  const parsed = JSON.parse(response.output_text || "{}");
  const action = String(parsed.action || "").trim();
  return action.endsWith(".") || action.endsWith("!") || action.endsWith("?") ? action : `${action}.`;
}

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
}


function stripMarkdown(text = "") {
  return String(text)
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/_/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildOracleSpeechText(reading, question) {
  const parts = [];

  if (question?.trim()) {
    parts.push(`Ta question : ${question.trim()}`);
  }

  if (Array.isArray(reading?.cards)) {
    for (const card of reading.cards) {
      if (card?.cardName || card?.interpretation) {
        parts.push(`${card.cardName || ""}. ${card.interpretation || ""}`.trim());
      }
    }
  }

  if (reading?.crossReading) parts.push(reading.crossReading);
  if (reading?.synthesis) parts.push(reading.synthesis);
  if (reading?.oracleSentence) parts.push(reading.oracleSentence);

  return stripMarkdown(parts.filter(Boolean).join("\n\n"));
}

async function generateElevenLabsBuffer(text) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;

  if (!apiKey || !voiceId) {
    throw new Error("ELEVENLABS_API_KEY ou ELEVENLABS_VOICE_ID manquant.");
  }

  if (!text?.trim()) {
    throw new Error("Texte audio vide.");
  }

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=${ELEVENLABS_OUTPUT_FORMAT}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg"
    },
    body: JSON.stringify({
      text,
      model_id: ELEVENLABS_MODEL_ID,
      voice_settings: {
        stability: 0.48,
        similarity_boost: 0.78,
        style: 0.18,
        use_speaker_boost: true
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs ${response.status}: ${errorText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});


app.get("/api/voice-health", (req, res) => {
  res.json({
    elevenlabs: {
      hasApiKey: Boolean(process.env.ELEVENLABS_API_KEY),
      hasVoiceId: Boolean(process.env.ELEVENLABS_VOICE_ID),
      modelId: ELEVENLABS_MODEL_ID,
      outputFormat: ELEVENLABS_OUTPUT_FORMAT
    }
  });
});

app.post("/api/oracle-audio", async (req, res) => {
  try {
    const { question, reading } = req.body || {};
    const speechText = buildOracleSpeechText(reading, question);
    const buffer = await generateElevenLabsBuffer(speechText);

    console.log("Oracle audio generated.", {
      chars: speechText.length,
      bytes: buffer.length
    });

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "no-store");
    res.send(buffer);
  } catch (error) {
    console.error("Oracle audio error:", error);
    res.status(500).json({
      error: "Erreur pendant la génération audio de l’oracle."
    });
  }
});

app.post("/api/reading", async (req, res) => {
  try {
    const openai = getOpenAIClient();

    if (!openai) {
      return res.status(500).json({
        error: "OPENAI_API_KEY n’est pas renseignée sur le serveur."
      });
    }

    const { question, cards } = req.body;
    const explicitQuestion = question?.trim() || "";

    if (!Array.isArray(cards) || cards.length !== 3) {
      return res.status(400).json({
        error: "Le tirage doit contenir exactement trois cartes."
      });
    }

    const payload = {
      currentDate: new Date().toISOString().slice(0, 10),
      dynamicContextSecrets: await getContextSecretsForPrompt(),
      question: explicitQuestion || "Question silencieuse",
      hasExplicitQuestion: Boolean(explicitQuestion),
      spread: "Ce qui insiste / Ce qui dévie / Ce qui tranche",
      cards: cards.map((card, index) => ({
        position: card.position,
        positionMeaning: card.positionMeaning,
        number: card.number,
        roman: card.roman,
        name: card.name,
        key: card.key,
        tags: card.tags,
        promptHint: card.promptHint,
        order: index + 1
      }))
    };

    const response = await openai.responses.create({
      model: MODEL,
      temperature: 0.85,
      max_output_tokens: 750,
      instructions: `
Vous êtes l’interprète d’un oracle contemporain composé de cartes originales.

Vous n’interprétez jamais les cartes comme un tarot traditionnel.
Vous ne faites aucune référence au tarot de Marseille, au Rider-Waite, à l’astrologie, à la numérologie classique ou à une spiritualité générique.

Contexte privé de réception : l’oracle est destiné à un petit groupe d’amis qui se connaissent, des hommes CSP+ de plus de quarante ans. Leur imaginaire commun mêle Paris des années trente, Cameroun professionnel, Pérou étudiant, BTP international, services culturels et consulaires, géomatique, BIM, éducation internationale, FLE, escalade, montagne, sports de raquette, kayak, virées entre amis, Normandie, Lille, Nantes, Annecy, Perpignan, huîtres, la coinche, romans, art, philosophie, musique, alcool, joints et quelques excès plus sombres. Ils aiment l’humour noir, le second degré, les conversations intellectuelles, les virées et les signes privés.

À utiliser plus souvent que les huîtres : “on est ensemble”, le Honduras auprès de l’ambassadeur, la jungle camerounaise au rhum, les échecs, les rhums vieux, les negronis, les expressos martini, l’IPA, Lisbonne, la main bleue du jean brut, le surmatelas, la bouteille sur le front, le jonglage, le vélo, le kayak, la coinche.
Les huîtres, le bar à huître et les fruits de mer doivent rester ponctuels : évitez d’en faire le ressort récurrent de l’injonction.


Utilisez ce contexte comme une couleur de fond, pas comme une fiche d’identification. Ne révélez pas une liste de profils. Ne ciblez jamais explicitement une personne réelle. Vous pouvez glisser des références discrètes à leurs lieux, obsessions et rites communs : chantier, carte, relief, falaise, ambassade, bar à huîtres, la coinche, Loire, Normandie, Paris, Cameroun, Pérou, etc.

Votre style est direct, psychologique, actuel, légèrement divinatoire, avec une ironie sèche. Évitez le style ampoulé, les accumulations d’adjectifs, les grandes envolées poétiques et les abstractions décoratives.
Vous pouvez être drôle, noir, tranchant, mais jamais moralisateur. Une phrase simple vaut mieux qu’une image trop ornée.
Vous ne glorifiez pas la consommation de drogues et ne donnez aucun conseil lié aux substances. Vous pouvez les traiter comme signes, dépendances, rituels ou fuites.

Vous travaillez à partir de la question, des cartes tirées, de leurs clés, de leurs indices, de leurs positions, de la date courante fournie dans le payload, du contexte privé, et des éventuels secrets dynamiques ajoutés par les utilisateurs dans dynamicContextSecrets.
Si hasExplicitQuestion vaut true, répondez réellement et strictement à la question posée. Ne produisez pas une ambiance générale, un commentaire symbolique ou une morale vague.
L’action prescrite est le champ le plus important : elle doit être la réponse pratique à la question, pas une illustration des cartes. Elle doit décider, orienter ou trancher. Pour une question de type « dois-je… ? », répondez oui/non par la consigne elle-même.
Si la question porte sur une action concrète, l’action prescrite doit dire de faire ou de ne pas faire cette action, puis ajouter une justification piquante.
Exemple : pour « Dois-je sortir ce soir ? », une action valable serait « Tu ferais mieux de rester chez toi et de mater un télé-crochet, ça t’évitera de te ridiculiser avec tes propos pseudo-experts sur la situation géopolitique. »
Si hasExplicitQuestion vaut false, l’oracle peut rester non spécifique et travailler plus librement à partir des cartes.
Soyez concret, psychologique, lisible, et orientez plus fermement dans une direction identifiable. Dites ce que la personne devrait comprendre d’elle-même ou de la situation.
Vous pouvez formuler une recommandation existentielle ou tactique, mais sans donner de conseil médical, juridique ou financier.
Des références contemporaines sont bienvenues pour rendre la réponse plus réelle : IA, fatigue numérique, crise climatique, immobilier, travail, conflits culturels, tensions géopolitiques, économie de l’attention, élections, etc.
Ne donnez pas de chiffre, de date ou d’événement récent précis si vous n’en êtes pas certain ; utilisez l’actualité comme texture, pas comme bulletin d’information.
Vous ne donnez pas de prédictions factuelles.
Vous ne donnez pas de conseil médical, juridique ou financier.
Vous ne dites pas que vous êtes une IA.
Vous ne vous excusez pas.
Vous ne commentez pas le fonctionnement du tirage.

La question sera affichée séparément par l’interface au début du résultat. Ne la répétez pas dans le JSON.
La lecture complète doit pouvoir être lue à voix haute en moins d’une minute : 120 à 160 mots maximum pour l’ensemble du JSON visible.
Chaque interprétation de carte doit tenir en 16 à 24 mots, avec peu d’adjectifs.
La lecture croisée et la synthèse doivent être courtes, nettes, presque conversationnelles.
Règle de ton : gardez l’étrangeté, mais écrivez comme quelqu’un qui comprend le problème, pas comme un grimoire. Pas plus d’un adjectif fort par phrase.
La phrase-oracle doit être très mémorable, courte, et trancher nettement une direction.
Après la phrase-oracle, générez aussi une action prescrite concrète, triviale, ferme, assez piquante, contemporaine et urbaine. Si une question explicite existe, cette action doit être une réponse stricte à cette question, formulée comme une consigne directement exécutable. Elle ne doit pas seulement « matcher » la question : elle doit y répondre. Elle se termine par un point.
Générez aussi un score Fatum en points, entre 0 et 100 : il mesure la densité du signe, l’alignement du tirage et la pression de nécessité. Ne l’exprimez jamais en pourcentage. Utilisez tout le spectre : certains tirages doivent tomber très bas (0–20), d’autres moyens (40–65), d’autres très hauts (85–100). Évitez de concentrer les scores autour de 70. Exemples de tonalité : reprends un verre, achète un jeu au PMU, fume un saumon de plus, ouvre une huître, prends une douche froide, refais-toi l’intégrale de Breaking Bad, passe trois heures devant CNews sans cligner des yeux, fais une sieste, sors, change de look, arrête la pizza pendant une semaine. Ne copiez pas systématiquement ces exemples : inventez une action adaptée. Évitez de revenir trop souvent aux huîtres ou au bar à huître dans l’injonction ; piochez largement dans le Cameroun, le Honduras, les échecs, la jungle, les rhums vieux, les negronis, les expressos martini, l’IPA, Lisbonne, la main bleue, le surmatelas, la bouteille sur le front, le vélo, le kayak, la coinche, les discussions intellectuelles et l’humour noir.
      `,
      input: JSON.stringify(payload),
      text: {
        format: {
          type: "json_schema",
          name: "oracle_reading",
          strict: true,
          schema: readingSchema
        }
      }
    });

    const outputText = response.output_text || "{}";
    const reading = JSON.parse(outputText);

    if (explicitQuestion) {
      try {
        reading.action = await rewriteActionForExplicitQuestion(openai, explicitQuestion, reading, payload);
      } catch (rewriteError) {
        console.error("Strict action rewrite error:", rewriteError);
      }
    }

    const fatumSeed = JSON.stringify({
      question: payload.question,
      cards: payload.cards.map((card) => card.name),
      oracleSentence: reading.oracleSentence || "",
      action: reading.action || ""
    });

    let fatumHash = 0;
    for (let index = 0; index < fatumSeed.length; index += 1) {
      fatumHash = (fatumHash * 33 + fatumSeed.charCodeAt(index)) % 10007;
    }

    const modelFatum = Number.isFinite(Number(reading.fatum)) ? Number(reading.fatum) : 50;
    const spreadFatum = fatumHash % 101;
    reading.fatum = Math.max(0, Math.min(100, Math.round((modelFatum * 0.35) + (spreadFatum * 0.65))));

    res.json({ reading });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Erreur pendant la génération de la lecture."
    });
  }
});







app.use(["/api/archives", "/api/fatum-users", "/api/labyrinthus-chronicon", "/api/labyrinthus-exvotos", "/api/labyrinthus-state", "/api/memory-status"], (req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});


app.get("/api/memory-status", async (req, res) => {
  try {
    const [contextSecrets, archives, fatumUsers, labyrinthusChronicon, labyrinthusExVotos] = await Promise.all([
      readContextSecrets(),
      readArchives(),
      readFatumUsers(),
      readLabyrinthusChronicon(),
      readLabyrinthusExVotos()
    ]);

    res.json({
      backend: isSupabaseEnabled() ? "supabase" : "json",
      dataDir: DATA_DIR,
      supabaseConfigured: isSupabaseEnabled(),
      files: {
        contextSecrets: {
          path: isSupabaseEnabled() ? "supabase:nox_context_secrets" : CONTEXT_SECRETS_FILE,
          count: contextSecrets.length
        },
        archives: {
          path: isSupabaseEnabled() ? "supabase:nox_archives" : ARCHIVES_FILE,
          count: archives.length
        },
        fatumUsers: {
          path: isSupabaseEnabled() ? "supabase:nox_fatum_users" : FATUM_USERS_FILE,
          count: fatumUsers.length
        },
        labyrinthusChronicon: {
          path: isSupabaseEnabled() ? "supabase:nox_labyrinthus_chronicon" : LABYRINTHUS_CHRONICON_FILE,
          count: labyrinthusChronicon.length
        },
        labyrinthusExVotos: {
          path: isSupabaseEnabled() ? "supabase:nox_labyrinthus_exvotos" : LABYRINTHUS_EXVOTOS_FILE,
          count: labyrinthusExVotos.length
        }
      }
    });
  } catch (error) {
    console.error("Memory status error:", error);
    res.status(500).json({ error: "Erreur pendant la lecture de la mémoire." });
  }
});

app.get("/api/labyrinthus-chronicon", async (req, res) => {
  try {
    res.json({
      events: await readLabyrinthusChronicon(),
      storage: isSupabaseEnabled() ? "supabase:nox_labyrinthus_chronicon" : LABYRINTHUS_CHRONICON_FILE
    });
  } catch (error) {
    console.error("Labyrinthus chronicon read error:", error);
    res.status(500).json({ error: "Erreur pendant la lecture du Chronicon." });
  }
});

app.post("/api/labyrinthus-chronicon", async (req, res) => {
  try {
    await insertLabyrinthusChroniconEvent(req.body || {});
    res.json({ ok: true, events: await readLabyrinthusChronicon() });
  } catch (error) {
    console.error("Labyrinthus chronicon write error:", error);
    res.status(500).json({ error: "Erreur pendant l’écriture du Chronicon." });
  }
});

app.get("/api/labyrinthus-exvotos", async (req, res) => {
  try {
    res.json({
      exvotos: await readLabyrinthusExVotos(),
      storage: isSupabaseEnabled() ? "supabase:nox_labyrinthus_exvotos" : LABYRINTHUS_EXVOTOS_FILE
    });
  } catch (error) {
    console.error("Labyrinthus ex voto read error:", error);
    res.status(500).json({ error: "Erreur pendant la lecture des Ex voto." });
  }
});

app.post("/api/labyrinthus-exvotos", async (req, res) => {
  try {
    const exvoto = await insertLabyrinthusExVoto(req.body || {});
    res.json({ ok: true, exvoto, exvotos: await readLabyrinthusExVotos() });
  } catch (error) {
    console.error("Labyrinthus ex voto write error:", error);
    res.status(500).json({ error: "Erreur pendant l’écriture de l’Ex voto." });
  }
});

app.patch("/api/labyrinthus-exvotos/:id/open", async (req, res) => {
  try {
    const exvoto = await openLabyrinthusExVoto(req.params.id, req.body?.openedBy || "");
    res.json({ ok: true, exvoto, exvotos: await readLabyrinthusExVotos() });
  } catch (error) {
    console.error("Labyrinthus ex voto open error:", error);
    res.status(500).json({ error: "Erreur pendant l’ouverture de l’Ex voto." });
  }
});

app.get("/api/labyrinthus-state", async (req, res) => {
  try {
    const state = await readLabyrinthusState();
    res.json({
      state: state?.state || null,
      updatedAt: state?.updatedAt || null,
      storage: isSupabaseEnabled() ? "supabase:nox_labyrinthus_state" : LABYRINTHUS_STATE_FILE
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur pendant la lecture de l’état Labyrinthus." });
  }
});

app.put("/api/labyrinthus-state", async (req, res) => {
  try {
    const saved = await writeLabyrinthusState(req.body?.state);
    res.json({ state: saved?.state || null, updatedAt: saved?.updatedAt || null });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur pendant l’enregistrement de l’état Labyrinthus." });
  }
});

app.get("/api/archives", async (req, res) => {
  try {
    res.json({
      archives: await readArchives(),
      storage: isSupabaseEnabled() ? "supabase:nox_archives" : ARCHIVES_FILE
    });
  } catch (error) {
    console.error("Archive read error:", error);
    res.status(500).json({ error: "Erreur pendant la lecture des archives." });
  }
});

app.post("/api/archives", async (req, res) => {
  try {
    const entry = req.body || {};
    const message = String(entry.message || "").trim();

    if (!message && !entry.photoDataUrl) {
      return res.status(400).json({ error: "Archive vide." });
    }

    await insertArchive({
      message: message || "Image sans légende.",
      photoDataUrl: entry.photoDataUrl || "",
      question: entry.question || "",
      oracleSentence: entry.oracleSentence || "",
      action: entry.action || "",
      fatum: Number.isFinite(Number(entry.fatum)) ? Number(entry.fatum) : null
    });

    const archives = await readArchives();

    console.log("Archive saved.", {
      count: archives.length,
      storage: isSupabaseEnabled() ? "supabase:nox_archives" : ARCHIVES_FILE
    });

    res.json({ ok: true, archives });
  } catch (error) {
    console.error("Archive save error:", error);
    res.status(500).json({ error: "Erreur pendant l’écriture de l’archive." });
  }
});

app.patch("/api/archives/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await updateArchive(id, req.body || {});
    res.json({ ok: true, archives: await readArchives() });
  } catch (error) {
    console.error("Archive update error:", error);
    res.status(500).json({ error: "Erreur pendant la mise à jour de l’archive." });
  }
});

app.delete("/api/archives/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await deleteArchive(id);
    res.json({ ok: true, archives: await readArchives() });
  } catch (error) {
    console.error("Archive delete error:", error);
    res.status(500).json({ error: "Erreur pendant la suppression de l’archive." });
  }
});

app.get("/api/fatum-users", async (req, res) => {
  try {
    res.json({
      users: await readFatumUsers(),
      storage: isSupabaseEnabled() ? "supabase:nox_fatum_users" : FATUM_USERS_FILE
    });
  } catch (error) {
    console.error("Fatum user read error:", error);
    res.status(500).json({ error: "Erreur pendant la lecture du fatum." });
  }
});

app.post("/api/fatum-users", async (req, res) => {
  try {
    const { name } = req.body || {};
    const trimmed = String(name || "").trim();

    if (!trimmed) {
      return res.status(400).json({ error: "Nom vide." });
    }

    const users = await readFatumUsers();

    if (users.length >= 9) {
      return res.status(400).json({ error: "Limite de 9 utilisateurs atteinte." });
    }

    await insertFatumUser(trimmed);
    const nextUsers = await readFatumUsers();

    console.log("Fatum user saved.", {
      count: nextUsers.length,
      storage: isSupabaseEnabled() ? "supabase:nox_fatum_users" : FATUM_USERS_FILE
    });

    res.json({ ok: true, users: nextUsers });
  } catch (error) {
    console.error("Fatum user create error:", error);
    res.status(500).json({ error: "Erreur pendant la création du socius." });
  }
});

app.patch("/api/fatum-users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await updateFatumUser(id, req.body || {});
    res.json({ ok: true, users: await readFatumUsers() });
  } catch (error) {
    console.error("Fatum user update error:", error);
    res.status(500).json({ error: "Erreur pendant la mise à jour du fatum." });
  }
});

app.get("/api/context-secrets", async (req, res) => {
  try {
    const secrets = await readContextSecrets();

    res.json({
      secrets,
      count: secrets.length,
      storage: isSupabaseEnabled() ? "supabase:nox_context_secrets" : CONTEXT_SECRETS_FILE
    });
  } catch (error) {
    console.error("Context secret read error:", error);
    res.status(500).json({ error: "Erreur pendant la lecture des secrets." });
  }
});

app.post("/api/context-secret", async (req, res) => {
  try {
    const { text, userName } = req.body || {};
    const trimmed = String(text || "").trim();

    if (!trimmed) {
      return res.status(400).json({ error: "Secret vide." });
    }

    await insertContextSecret({
      text: trimmed,
      userName: String(userName || "").trim()
    });

    const secrets = await readContextSecrets();

    console.log("Context secret saved.", {
      count: secrets.length,
      userName: userName || "",
      storage: isSupabaseEnabled() ? "supabase:nox_context_secrets" : CONTEXT_SECRETS_FILE
    });

    res.json({ ok: true, count: secrets.length });
  } catch (error) {
    console.error("Context secret save error:", error);
    res.status(500).json({ error: "Erreur pendant l’écriture du secret." });
  }
});


app.post("/api/duodecim-advice", async (req, res) => {
  try {
    const client = getOpenAIClient();

    if (!client) {
      return res.status(500).json({ error: "OPENAI_API_KEY manquante." });
    }

    const { name, question, hasExplicitQuestion, reading } = req.body || {};
    const allowedNames = [
      "Jagger",
      "Freud",
      "Marx",
      "Nietzsche",
      "Gainsbourg",
      "Kant",
      "Cantona",
      "VDB",
      "Raël",
      "Verges",
      "Houellebecq",
      "Bowie"
    ];

    if (!allowedNames.includes(name)) {
      return res.status(400).json({ error: "Nom Duodecim invalide." });
    }

    const explicitQuestion = Boolean(hasExplicitQuestion && String(question || "").trim());

    const response = await client.responses.create({
      model: MODEL,
      instructions: `
Vous écrivez une seule citation fictive pour l’écran Duodecim de l’app Nox.

La phrase est attribuée à : ${name}.
Évoquez l’imaginaire public associé à ce nom, sa posture ou son univers intellectuel.
Ne prétendez pas citer réellement la personne.
N’imitez pas longuement un style littéraire vivant ; faites une évocation courte, libre, satirique et transformée.

Règle prioritaire :
${explicitQuestion ? `L’utilisateur a posé une question spécifique. La citation doit répondre strictement à cette question : ${String(question || "").trim()}. Elle doit trancher, donner une conduite concrète et ne pas rester symbolique. Pour une question de type « Dois-je… ? », répondez clairement par une action à faire ou à ne pas faire.` : `L’utilisateur n’a pas posé de question spécifique. La citation doit réagir à l’oracle déjà généré et à son action concrète, sans inventer une nouvelle question.`}

Ton : concret, tranchant, contemporain, légèrement noir ou ironique. La réponse peut être sèche, drôle, cruelle ou élégante, mais elle doit rester utilisable comme consigne.

Format :
- Une seule phrase.
- 24 à 48 mots.
- Commencer par : "${name} dirait :"
- Pas de guillemets.
- Pas de markdown.
      `,
      input: JSON.stringify({
        name,
        mode: explicitQuestion ? "question_specifique" : "reaction_oracle",
        question: explicitQuestion ? String(question || "").trim() : "",
        oracle: {
          cards: reading?.cards || [],
          crossReading: reading?.crossReading || "",
          synthesis: reading?.synthesis || "",
          oracleSentence: reading?.oracleSentence || "",
          action: reading?.action || ""
        }
      })
    });

    const sentence = String(response.output_text || "").trim();

    res.json({ sentence });
  } catch (error) {
    console.error("Duodecim advice error:", error);
    res.status(500).json({ error: "Erreur pendant la génération Duodecim." });
  }
});


app.post("/api/bulla-message", async (req, res) => {
  try {
    const { message, question, oracleSentence, action } = req.body || {};
    const trimmed = String(message || "").trim();

    if (!trimmed) {
      return res.status(400).json({ error: "Message vide." });
    }

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM || "Nox <onboarding@resend.dev>";
    const to = "mathieubaudouin.mail@gmail.com";

    if (!apiKey) {
      console.error("Bulla message not sent: RESEND_API_KEY missing.", { message: trimmed });
      return res.status(500).json({ error: "RESEND_API_KEY manquante." });
    }

    const body = [
      "Message Bulla",
      "",
      trimmed,
      "",
      "Question",
      question || "",
      "",
      "Phrase-oracle",
      oracleSentence || "",
      "",
      "Action",
      action || ""
    ].join("\n");

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to,
        subject: "NOX — Bulla",
        text: body
      })
    });

    const resultText = await response.text();

    if (!response.ok) {
      console.error("Bulla email error:", response.status, resultText);
      return res.status(500).json({ error: "Erreur envoi Bulla.", details: resultText });
    }

    console.log("Bulla email sent.", { bytes: trimmed.length });
    res.json({ ok: true });
  } catch (error) {
    console.error("Bulla message error:", error);
    res.status(500).json({ error: "Erreur pendant l’envoi Bulla." });
  }
});


if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "dist")));

  app.get("/manifest.webmanifest", (req, res) => {
    res.type("application/manifest+json");
    res.send({
      name: "Nox",
      short_name: "Nox",
      description: "Signes privés pour heures basses.",
      start_url: "/",
      display: "standalone",
      background_color: "#050509",
      theme_color: "#050509",
      icons: [
        {
          src: "/images/nox-icon.png",
          sizes: "1024x1024",
          type: "image/png",
          purpose: "any maskable"
        }
      ]
    });
  });

  app.get("/apple-touch-icon.png", (req, res) => {
    res.sendFile(path.join(__dirname, "dist", "images", "nox-icon.png"));
  });

  app.get(/.*/, (req, res) => {
    const indexPath = path.join(__dirname, "dist", "index.html");

    fs.readFile(indexPath, "utf8", (error, html) => {
      if (error) {
        return res.sendFile(indexPath);
      }

      const iconTags = `
<link rel="manifest" href="/manifest.webmanifest">
<link rel="apple-touch-icon" href="/images/nox-icon.png">
<link rel="icon" type="image/png" href="/images/nox-icon.png">
<meta name="apple-mobile-web-app-title" content="Nox">
<meta name="application-name" content="Nox">
<meta name="theme-color" content="#050509">
`;

      const output = html.includes("apple-touch-icon")
        ? html
        : html.replace("</head>", `${iconTags}</head>`);

      res.type("html").send(output);
    });
  });
}

app.listen(PORT, () => {
  console.log(`Oracle app running on port ${PORT}`);
});
