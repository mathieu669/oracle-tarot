import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { deck, positions } from "./cards.js";

const delay = (duration) => new Promise((resolve) => setTimeout(resolve, duration));

function randomDraw() {
  const copy = [...deck];
  const result = [];

  while (result.length < 3) {
    const index = Math.floor(Math.random() * copy.length);
    result.push(copy.splice(index, 1)[0]);
  }

  return result;
}

function buildCardsForApi(cards) {
  return cards.map((card, index) => ({
    number: card.number,
    roman: card.roman,
    name: card.name,
    key: card.key,
    tags: card.tags,
    promptHint: card.promptHint,
    position: positions[index].label,
    positionMeaning: positions[index].meaning
  }));
}

function CardBack({ small = false }) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[1.35rem] bg-black shadow-2xl ring-1 ring-stone-100/25">
      <img
        src="/images/cards/fond-graphique.jpg"
        alt="Dos de carte"
        className="h-full w-full object-cover"
        draggable="false"
      />
      {!small && (
        <div className="absolute inset-x-5 bottom-5 border-t border-stone-100/65 pt-3 text-center text-[10px] uppercase tracking-[0.35em] text-stone-100/90">
          Oracle
        </div>
      )}
    </div>
  );
}

function CardFace({ card }) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[1.35rem] bg-black shadow-2xl ring-1 ring-stone-100/25">
      <img
        src={card.imageFace}
        alt={card.name}
        className="h-full w-full object-contain"
        draggable="false"
      />
    </div>
  );
}

function CardSlot({ card, index, revealed }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className="min-w-0"
    >
      <div className="mb-3 text-center">
        <p className="text-sm font-semibold text-stone-100">{positions[index].label}</p>
        <p className="text-xs text-stone-400">{positions[index].detail}</p>
      </div>

      <div className="mx-auto aspect-[826/1446] w-full max-w-[250px] [perspective:1000px]">
        <motion.div
          className="relative h-full w-full [transform-style:preserve-3d]"
          animate={{ rotateY: revealed ? 180 : 0 }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
        >
          <div className="absolute inset-0 [backface-visibility:hidden]">
            <CardBack />
          </div>
          <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <CardFace card={card} />
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

function LoadingReading() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-10 rounded-[2rem] border border-stone-700/80 bg-stone-950/75 p-6 shadow-2xl backdrop-blur"
    >
      <p className="text-xs uppercase tracking-[0.35em] text-stone-500">lecture en cours</p>
      <div className="mt-5 space-y-3">
        <div className="h-5 w-2/3 animate-pulse rounded-full bg-stone-800" />
        <div className="h-4 w-full animate-pulse rounded-full bg-stone-800" />
        <div className="h-4 w-5/6 animate-pulse rounded-full bg-stone-800" />
        <div className="h-4 w-4/6 animate-pulse rounded-full bg-stone-800" />
      </div>
    </motion.section>
  );
}

function ErrorMessage({ message }) {
  if (!message) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-10 rounded-[2rem] border border-red-900/60 bg-red-950/25 p-6 text-red-100"
    >
      <p className="text-xs uppercase tracking-[0.35em] text-red-300/70">erreur</p>
      <p className="mt-3 leading-7">{message}</p>
    </motion.section>
  );
}

function Reading({ reading, question }) {
  if (!reading) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-10 rounded-[2rem] border border-stone-700/80 bg-stone-950/75 p-6 shadow-2xl backdrop-blur"
    >
      <div className="mb-6 flex flex-col gap-2 border-b border-stone-800 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-stone-500">lecture générée</p>
          <h2 className="mt-2 font-serif text-3xl font-black text-stone-50">{reading.title}</h2>
        </div>
        <p className="max-w-md text-sm italic text-stone-400">{question || "Question silencieuse"}</p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {reading.cards.map((card, index) => (
          <article key={`${card.cardName}-${index}`} className="rounded-2xl border border-stone-800 bg-black/40 p-4">
            <p className="text-xs uppercase tracking-[0.25em] text-stone-500">{card.position}</p>
            <h3 className="mt-2 font-serif text-xl font-bold text-stone-100">{card.cardName}</h3>
            <p className="mt-1 text-sm text-stone-400">{card.key}</p>
            <p className="mt-4 text-sm leading-6 text-stone-300">{card.interpretation}</p>
          </article>
        ))}
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-2xl border border-stone-800 bg-black/35 p-5">
          <p className="text-xs uppercase tracking-[0.25em] text-stone-500">lecture croisée</p>
          <p className="mt-3 leading-7 text-stone-300">{reading.crossReading}</p>

          <p className="mt-6 text-xs uppercase tracking-[0.25em] text-stone-500">synthèse</p>
          <p className="mt-3 leading-7 text-stone-300">{reading.synthesis}</p>
        </div>

        <div className="rounded-2xl border border-stone-800 bg-stone-100 p-5 text-black">
          <p className="text-xs uppercase tracking-[0.25em] text-stone-500">phrase-oracle</p>
          <p className="mt-3 font-serif text-xl font-black leading-7">{reading.oracleSentence}</p>
        </div>
      </div>
    </motion.section>
  );
}

export default function App() {
  const initial = useMemo(() => [deck[0], deck[14], deck[12]], []);
  const [cards, setCards] = useState(initial);
  const [revealed, setRevealed] = useState(true);
  const [question, setQuestion] = useState("Que dois-je comprendre de ce qui revient en ce moment ?");
  const [reading, setReading] = useState(null);
  const [error, setError] = useState("");
  const [isDrawing, setIsDrawing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const draw = async () => {
    if (isDrawing || isGenerating) return;

    setReading(null);
    setError("");
    setIsDrawing(true);
    setRevealed(false);

    await delay(650);

    const nextCards = randomDraw();
    setCards(nextCards);
    setIsDrawing(false);
    setRevealed(true);
    setIsGenerating(true);

    try {
      const response = await fetch("/api/reading", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question,
          cards: buildCardsForApi(nextCards)
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "La lecture n’a pas pu être générée.");
      }

      setReading(data.reading);
    } catch (err) {
      setError(err.message || "La lecture n’a pas pu être générée.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#090806] px-5 py-6 text-stone-100 md:px-10 md:py-10">
      <div className="pointer-events-none fixed inset-0 opacity-40">
        <div className="absolute -left-32 top-16 h-72 w-[45rem] rotate-[-18deg] rounded-full bg-stone-200/10 blur-3xl" />
        <div className="absolute right-[-10rem] top-60 h-80 w-[50rem] rotate-[22deg] rounded-full bg-red-900/20 blur-3xl" />
        <div className="absolute bottom-[-8rem] left-1/4 h-72 w-[45rem] rounded-full bg-stone-100/10 blur-3xl" />
      </div>

      <section className="relative mx-auto max-w-7xl">
        <header className="grid gap-6 rounded-[2.5rem] border border-stone-800 bg-black/45 p-6 shadow-2xl backdrop-blur md:grid-cols-[1.05fr_0.95fr] md:p-8">
          <div className="flex flex-col justify-between gap-8">
            <div>
              <p className="mb-4 text-xs uppercase tracking-[0.45em] text-stone-500">Oracle original</p>
              <h1 className="max-w-2xl font-serif text-5xl font-black leading-[0.95] text-stone-50 md:text-7xl">
                Tirez trois cartes. Laissez-les mal répondre.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-stone-300">
                Une interface de tirage pour un oracle contemporain, ironique et sibyllin. Le dos commun reprend le fond graphique ; les faces se révèlent au tirage.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Votre question"
                className="h-12 rounded-full border border-stone-700 bg-stone-950 px-5 text-sm text-stone-100 outline-none placeholder:text-stone-600 focus:border-stone-300"
              />
              <button
                onClick={draw}
                disabled={isDrawing || isGenerating}
                className="h-12 rounded-full bg-stone-100 px-7 text-sm font-bold uppercase tracking-[0.18em] text-black transition hover:bg-white active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"
              >
                {isDrawing ? "Tirage…" : isGenerating ? "Lecture…" : "Tirer"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 md:gap-4">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <motion.div
                key={item}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: item * 0.04 }}
                className="aspect-[826/1446] min-h-[155px]"
              >
                <CardBack small />
              </motion.div>
            ))}
          </div>
        </header>

        <section className="relative mt-10 rounded-[2.5rem] border border-stone-800 bg-black/35 p-5 shadow-2xl backdrop-blur md:p-8">
          <div className="mb-8 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-stone-500">tirage en 3 cartes</p>
              <h2 className="mt-2 font-serif text-3xl font-black text-stone-50">Ce qui insiste / Ce qui dévie / Ce qui tranche</h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-stone-400">
              Les cartes sont tirées localement, puis l’API génère la lecture à partir de la question, des positions et des clés symboliques.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {cards.map((card, index) => (
                <CardSlot key={`${card.name}-${index}`} card={card} index={index} revealed={revealed} />
              ))}
            </AnimatePresence>
          </div>
        </section>

        {isGenerating && <LoadingReading />}
        <ErrorMessage message={error} />
        <Reading reading={reading} question={question} />
      </section>
    </main>
  );
}
