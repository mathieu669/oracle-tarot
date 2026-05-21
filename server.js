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
      parts.push(`${card.cardName}. ${card.interpretation}`);
    }
  }

  if (reading?.crossReading) parts.push(reading.crossReading);
  if (reading?.synthesis) parts.push(reading.synthesis);
  if (reading?.oracleSentence) parts.push(reading.oracleSentence);

  return stripMarkdown(parts.filter(Boolean).join("\n\n"));
}

async function generateElevenLabsAudio(text) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;

  if (!apiKey || !voiceId || !text?.trim()) {
    console.warn("ElevenLabs skipped: missing API key, voice ID, or text.");
    return null;
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
    console.error("ElevenLabs error:", response.status, errorText);
    return null;
  }

  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  console.log(`ElevenLabs audio generated: ${base64.length} base64 chars.`);

  return {
    mimeType: "audio/mpeg",
    base64
  };
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

app.get("/api/voice-test", async (req, res) => {
  try {
    console.log("Voice test requested.");

    const audio = await generateElevenLabsAudio(
      "Attends. L’oracle parle enfin. Si tu entends cette phrase, ElevenLabs fonctionne."
    );

    if (!audio?.base64) {
      console.error("Voice test failed: no audio generated.");
      return res.status(500).json({
        error: "No ElevenLabs audio generated.",
        hasApiKey: Boolean(process.env.ELEVENLABS_API_KEY),
        hasVoiceId: Boolean(process.env.ELEVENLABS_VOICE_ID)
      });
    }

    const buffer = Buffer.from(audio.base64, "base64");

    res.setHeader("Content-Type", audio.mimeType || "audio/mpeg");
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "no-store");
    res.send(buffer);
  } catch (error) {
    console.error("Voice test error:", error);
    res.status(500).json({ error: "Voice test failed." });
  }
});

app.post("/api/reading", async (req, res) => {
  try {
    console.log("Oracle reading requested.", {
      hasElevenLabsKey: Boolean(process.env.ELEVENLABS_API_KEY),
      hasElevenLabsVoice: Boolean(process.env.ELEVENLABS_VOICE_ID),
      elevenLabsModel: ELEVENLABS_MODEL_ID
    });
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

Vous travaillez uniquement à partir de la question, des cartes tirées, de leurs clés, de leurs indices et de leurs positions.
Vous ne donnez pas de prédictions factuelles.
Vous ne donnez pas de conseil médical, juridique ou financier.
Vous ne dites pas que vous êtes une IA.
Vous ne vous excusez pas.
Vous ne commentez pas le fonctionnement du tirage.

La question sera affichée séparément par l’interface au début du résultat. Ne la répétez pas dans le JSON.
La lecture complète doit pouvoir être lue à voix haute en moins d’une minute : 140 à 180 mots maximum pour l’ensemble du JSON visible.
Chaque interprétation de carte doit tenir en 20 à 28 mots.
La lecture croisée et la synthèse doivent être courtes.
La phrase-oracle doit être très mémorable et courte.
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

    const wantsAudio = payload.audioEnabled === true;
    const speechText = wantsAudio ? buildOracleSpeechText(reading, payload.question) : "";
    const audio = wantsAudio ? await generateElevenLabsAudio(speechText) : null;

    console.log("Oracle reading ready.", {
      wantsAudio,
      speechChars: speechText.length,
      hasAudio: Boolean(audio?.base64),
      audioBase64Chars: audio?.base64?.length || 0
    });

    res.json({ reading, audio });
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
