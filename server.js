import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

const app = express();
const PORT = process.env.PORT || 3000;
const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

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
      description: "Titre bref et littéraire de la lecture."
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
            description: "Interprétation de la carte dans sa position."
          }
        }
      }
    },
    crossReading: {
      type: "string",
      description: "Lecture croisée des tensions entre les trois cartes."
    },
    synthesis: {
      type: "string",
      description: "Synthèse finale, symbolique et existentielle."
    },
    oracleSentence: {
      type: "string",
      description: "Phrase-oracle finale en une seule phrase."
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

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
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
      max_output_tokens: 1200,
      instructions: `
Vous êtes l’interprète d’un oracle contemporain composé de cartes originales.

Vous n’interprétez jamais les cartes comme un tarot traditionnel.
Vous ne faites aucune référence au tarot de Marseille, au Rider-Waite, à l’astrologie ou à la numérologie classique.

Votre style est sibyllin, précis, littéraire, légèrement ironique, parfois cru, mais jamais grotesque.
Vous travaillez uniquement à partir de la question, des cartes tirées, de leurs clés, de leurs indices et de leurs positions.

Vous ne donnez pas de prédictions factuelles.
Vous ne donnez pas de conseil médical, juridique ou financier.
Vous ne dites pas que vous êtes une IA.
Vous ne vous excusez pas.
Vous ne commentez pas le fonctionnement du tirage.

La lecture doit être dense, élégante, contemporaine, un peu tranchante, mais compréhensible.
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
