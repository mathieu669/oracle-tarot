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



app.use(express.json({ limit: "1mb" }));

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
      description: "Action prescrite concrète, triviale, ferme, piquante, contemporaine, urbaine, terminée par un point. Elle doit matcher le contexte et peut aller vers le geste absurde, social ou domestique."
    },
    fatum: {
      type: "integer",
      minimum: 0,
      maximum: 100,
      description: "Score Fatum en points, de 0 à 100. Il indique le degré d’accomplissement, d’alignement ou de fatalité active du tirage. Ne pas exprimer en pourcentage."
    }
  }
};

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

    if (!Array.isArray(cards) || cards.length !== 3) {
      return res.status(400).json({
        error: "Le tirage doit contenir exactement trois cartes."
      });
    }

    const payload = {
      currentDate: new Date().toISOString().slice(0, 10),
      dynamicContextSecrets: contextSecretsToPromptText(readContextSecretsFromServer()),
      question: question?.trim() || "Question silencieuse",
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

Votre style est sibyllin, précis, littéraire, légèrement ironique, parfois cru, mais jamais grotesque.
Vous pouvez être drôle, noir, élégant, tranchant, mais jamais moralisateur.
Vous ne glorifiez pas la consommation de drogues et ne donnez aucun conseil lié aux substances. Vous pouvez les traiter comme signes, dépendances, rituels ou fuites.

Vous travaillez à partir de la question, des cartes tirées, de leurs clés, de leurs indices, de leurs positions, de la date courante fournie dans le payload, du contexte privé, et des éventuels secrets dynamiques ajoutés par les utilisateurs dans dynamicContextSecrets.
Répondez réellement à la question posée : soyez moins abstrait, plus concret, et orientez plus fermement dans une direction identifiable.
Vous pouvez formuler une recommandation existentielle ou tactique, mais sans donner de conseil médical, juridique ou financier.
Des références contemporaines sont bienvenues pour rendre la réponse plus réelle : IA, fatigue numérique, crise climatique, immobilier, travail, conflits culturels, tensions géopolitiques, économie de l’attention, élections, etc.
Ne donnez pas de chiffre, de date ou d’événement récent précis si vous n’en êtes pas certain ; utilisez l’actualité comme texture, pas comme bulletin d’information.
Vous ne donnez pas de prédictions factuelles.
Vous ne donnez pas de conseil médical, juridique ou financier.
Vous ne dites pas que vous êtes une IA.
Vous ne vous excusez pas.
Vous ne commentez pas le fonctionnement du tirage.

La question sera affichée séparément par l’interface au début du résultat. Ne la répétez pas dans le JSON.
La lecture complète doit pouvoir être lue à voix haute en moins d’une minute : 140 à 180 mots maximum pour l’ensemble du JSON visible.
Chaque interprétation de carte doit tenir en 20 à 28 mots.
La lecture croisée et la synthèse doivent être courtes.
La phrase-oracle doit être très mémorable, courte, et trancher nettement une direction.
Après la phrase-oracle, générez aussi une action prescrite concrète, triviale, ferme, assez piquante, contemporaine et urbaine. Elle doit matcher la question, les cartes et le contexte privé. Elle se termine par un point.
Générez aussi un score Fatum en points, entre 0 et 100 : il mesure la densité du signe, l’alignement du tirage et la pression de nécessité. Ne l’exprimez jamais en pourcentage. Exemples de tonalité : reprends un verre, achète un jeu au PMU, fume un saumon de plus, ouvre une huître, prends une douche froide, refais-toi l’intégrale de Breaking Bad, passe trois heures devant CNews sans cligner des yeux, fais une sieste, sors, change de look, arrête la pizza pendant une semaine. Ne copiez pas systématiquement ces exemples : inventez une action adaptée. Évitez de revenir trop souvent aux huîtres ou au bar à huître dans l’injonction ; piochez largement dans le Cameroun, le Honduras, les échecs, la jungle, les rhums vieux, les negronis, les expressos martini, l’IPA, Lisbonne, la main bleue, le surmatelas, la bouteille sur le front, le vélo, le kayak, la coinche, les discussions intellectuelles et l’humour noir.
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

    res.json({ reading });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Erreur pendant la génération de la lecture."
    });
  }
});





app.get("/api/archives", (req, res) => {
  res.json({
    archives: readJsonArrayFromServer(ARCHIVES_FILE),
    storage: ARCHIVES_FILE
  });
});

app.post("/api/archives", (req, res) => {
  try {
    const entry = req.body || {};
    const message = String(entry.message || "").trim();

    if (!message && !entry.photoDataUrl) {
      return res.status(400).json({ error: "Archive vide." });
    }

    const archives = readJsonArrayFromServer(ARCHIVES_FILE);
    const nextArchives = [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        createdAt: new Date().toISOString(),
        message: message || "Image sans légende.",
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
    res.json({ ok: true, archives: nextArchives });
  } catch (error) {
    console.error("Archive save error:", error);
    res.status(500).json({ error: "Erreur pendant l’écriture de l’archive." });
  }
});

app.patch("/api/archives/:id", (req, res) => {
  try {
    const { id } = req.params;
    const patch = req.body || {};
    const archives = readJsonArrayFromServer(ARCHIVES_FILE);

    const nextArchives = archives.map((entry) => {
      if (entry.id !== id) return entry;

      const nextEntry = { ...entry };

      if (typeof patch.reaction === "string") {
        nextEntry.reaction = patch.reaction;
      }

      if (typeof patch.comment === "string") {
        const comments = Array.isArray(nextEntry.comments)
          ? nextEntry.comments
          : nextEntry.comment
            ? [nextEntry.comment]
            : [];

        if (comments.length < 9 && patch.comment.trim()) {
          nextEntry.comments = [...comments, patch.comment.trim()].slice(0, 9);
          delete nextEntry.comment;
        }
      }

      return nextEntry;
    });

    writeJsonArrayToServer(ARCHIVES_FILE, nextArchives, 500);
    res.json({ ok: true, archives: nextArchives });
  } catch (error) {
    console.error("Archive update error:", error);
    res.status(500).json({ error: "Erreur pendant la mise à jour de l’archive." });
  }
});

app.delete("/api/archives/:id", (req, res) => {
  try {
    const { id } = req.params;
    const archives = readJsonArrayFromServer(ARCHIVES_FILE);
    const nextArchives = archives.filter((entry) => entry.id !== id);

    writeJsonArrayToServer(ARCHIVES_FILE, nextArchives, 500);
    res.json({ ok: true, archives: nextArchives });
  } catch (error) {
    console.error("Archive delete error:", error);
    res.status(500).json({ error: "Erreur pendant la suppression de l’archive." });
  }
});

app.get("/api/fatum-users", (req, res) => {
  res.json({
    users: readJsonArrayFromServer(FATUM_USERS_FILE),
    storage: FATUM_USERS_FILE
  });
});

app.post("/api/fatum-users", (req, res) => {
  try {
    const { name } = req.body || {};
    const trimmed = String(name || "").trim();

    if (!trimmed) {
      return res.status(400).json({ error: "Nom vide." });
    }

    const users = readJsonArrayFromServer(FATUM_USERS_FILE);

    if (users.length >= 9) {
      return res.status(400).json({ error: "Limite de 9 utilisateurs atteinte." });
    }

    const nextUsers = [
      ...users,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: trimmed,
        score: 0,
        credited: [],
        secretumUnlockedLevel: 0
      }
    ].slice(0, 9);

    writeJsonArrayToServer(FATUM_USERS_FILE, nextUsers, 9);
    res.json({ ok: true, users: nextUsers });
  } catch (error) {
    console.error("Fatum user create error:", error);
    res.status(500).json({ error: "Erreur pendant la création du socius." });
  }
});

app.patch("/api/fatum-users/:id", (req, res) => {
  try {
    const { id } = req.params;
    const patch = req.body || {};
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
    res.json({ ok: true, users: nextUsers });
  } catch (error) {
    console.error("Fatum user update error:", error);
    res.status(500).json({ error: "Erreur pendant la mise à jour du fatum." });
  }
});


app.get("/api/context-secrets", (req, res) => {
  const secrets = readContextSecretsFromServer();
  res.json({
    secrets,
    count: secrets.length,
    storage: CONTEXT_SECRETS_FILE
  });
});

app.post("/api/context-secret", (req, res) => {
  try {
    const { text, userName } = req.body || {};
    const trimmed = String(text || "").trim();

    if (!trimmed) {
      return res.status(400).json({ error: "Secret vide." });
    }

    const secrets = readContextSecretsFromServer();

    const nextSecrets = [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        createdAt: new Date().toISOString(),
        userName: String(userName || "").trim(),
        text: trimmed
      },
      ...secrets
    ].slice(0, 300);

    writeContextSecretsToServer(nextSecrets);

    console.log("Context secret saved.", {
      count: nextSecrets.length,
      userName: userName || "",
      storage: CONTEXT_SECRETS_FILE
    });

    res.json({ ok: true, count: nextSecrets.length });
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

    const { name, question, reading } = req.body || {};
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

    const response = await client.responses.create({
      model: MODEL,
      instructions: `
Vous écrivez une seule phrase de conseil pour l’écran Duodecim de l’app Nox.

La phrase répond directement à la question de l’utilisateur, à partir de l’oracle déjà généré.
Elle doit changer à chaque oracle : ne produisez jamais une formule générique.
Elle doit être concrète, tranchante, contemporaine, légèrement noire ou ironique.

La phrase est attribuée à un nom : ${name}.
Évoquez l’imaginaire public associé à ce nom, sa posture ou son univers intellectuel.
Ne prétendez pas citer réellement la personne.
N’imitez pas longuement un style littéraire vivant ; faites une évocation courte, libre, satirique et transformée.

Format :
- Une seule phrase.
- 24 à 42 mots.
- Commencer par : "${name} dirait :"
- Pas de guillemets.
- Pas de markdown.
      `,
      input: JSON.stringify({
        name,
        question: question || "Question silencieuse",
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
