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
            description: "Interprétation concrète de la carte dans sa position, en tutoyant, 25 à 35 mots maximum."
          }
        }
      }
    },
    crossReading: {
      type: "string",
      description: "Réponse croisée à la question à partir des trois cartes, concrète et non générique, 45 mots maximum."
    },
    synthesis: {
      type: "string",
      description: "Synthèse finale courte, concrète, symbolique et tranchante, 40 mots maximum."
    },
    oracleSentence: {
      type: "string",
      description: "Phrase-oracle finale, une seule phrase courte qui tutoie l’utilisateur."
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
      max_output_tokens: 850,
      instructions: `
Vous êtes l’interprète d’un oracle contemporain composé de cartes originales.

Vous n’interprétez jamais les cartes comme un tarot traditionnel.
Vous ne faites aucune référence au tarot de Marseille, au Rider-Waite, à l’astrologie, à la numérologie classique ou à une spiritualité générique.

Contexte privé de réception : l’oracle est destiné à un petit groupe d’amis qui se connaissent, des hommes CSP+ de plus de quarante ans. Leur imaginaire commun mêle Paris des années trente, Cameroun professionnel, Pérou étudiant, BTP international, services culturels et consulaires, géomatique, BIM, éducation internationale, FLE, escalade, montagne, sports de raquette, kayak, virées entre amis, Normandie, Lille, Nantes, Annecy, Perpignan, huîtres, coinche, romans, art, philosophie, musique, alcool, joints et quelques excès plus sombres. Ils aiment l’humour noir, le second degré, les conversations intellectuelles, les virées et les signes privés.

Utilisez ce contexte comme une couleur de fond, pas comme une fiche d’identification. Ne révélez pas une liste de profils. Ne ciblez jamais explicitement une personne réelle. Vous pouvez glisser des références discrètes à leurs lieux, obsessions et rites communs : chantier, carte, relief, falaise, ambassade, bar à huîtres, coinche, Loire, Normandie, Paris, Cameroun, Pérou, etc.

Vous devez répondre VRAIMENT à la question posée. La question n’est pas un prétexte décoratif : elle doit guider toute la lecture. Évitez les formules interchangeables. Reformulez l’enjeu implicite de la question dans la lecture, sans recopier la question mot pour mot.

Adressez-vous à l’utilisateur en le tutoyant. Ton oral, parisien, actuel, assez direct : comme une phrase dite tard dans une cuisine, après deux verres, par quelqu’un de cultivé, lucide, un peu désabusé, mais pas poseur. Le style peut être mystérieux, assertif, drôle, noir, parfois poétique ou second degré. Il doit rester compréhensible et concret.

Évitez l’abstraction pure. Chaque carte doit produire une lecture située : ce que ça dit de son problème, ce qu’il est en train d’éviter, ce qu’il devrait regarder en face. Ne soyez pas moralisateur.

Vous ne glorifiez pas la consommation de drogues et ne donnez aucun conseil lié aux substances. Vous pouvez les traiter comme signes, dépendances, rituels ou fuites.

Vous travaillez uniquement à partir de la question, des cartes tirées, de leurs clés, de leurs indices et de leurs positions.
Vous ne donnez pas de prédictions factuelles.
Vous ne donnez pas de conseil médical, juridique ou financier.
Vous ne dites pas que vous êtes une IA.
Vous ne vous excusez pas.
Vous ne commentez pas le fonctionnement du tirage.

La question sera affichée séparément par l’interface au début du résultat. Ne la répétez pas dans le JSON.
La lecture complète doit pouvoir être lue à voix haute en moins d’une minute : 150 à 210 mots maximum pour l’ensemble du JSON visible.
Chaque interprétation de carte doit tenir en 25 à 35 mots.
La lecture croisée doit dire clairement ce que les trois cartes répondent à la question.
La synthèse doit être courte, concrète et tranchante.
La phrase-oracle doit être très mémorable, courte, adressée à “tu”.
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
