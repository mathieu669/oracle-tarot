import express from "express";
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

app.use(express.json({ limit: "1mb" }));

const readingSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "cards", "crossReading", "synthesis", "oracleSentence"],
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

Utilisez ce contexte comme une couleur de fond, pas comme une fiche d’identification. Ne révélez pas une liste de profils. Ne ciblez jamais explicitement une personne réelle. Vous pouvez glisser des références discrètes à leurs lieux, obsessions et rites communs : chantier, carte, relief, falaise, ambassade, bar à huîtres, la coinche, Loire, Normandie, Paris, Cameroun, Pérou, etc.

Votre style est sibyllin, précis, littéraire, légèrement ironique, parfois cru, mais jamais grotesque.
Vous pouvez être drôle, noir, élégant, tranchant, mais jamais moralisateur.
Vous ne glorifiez pas la consommation de drogues et ne donnez aucun conseil lié aux substances. Vous pouvez les traiter comme signes, dépendances, rituels ou fuites.

Vous travaillez à partir de la question, des cartes tirées, de leurs clés, de leurs indices, de leurs positions et de la date courante fournie dans le payload.
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

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "dist")));

  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Oracle app running on port ${PORT}`);
});
