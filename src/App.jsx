import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { deck, positions } from "./cards";

const DRAW_TARGET = 3;
const REVEAL_MS = 1800;
const OBSERVE_MS = 10000;
const ZOOM_MS = 3200;
const KEYS_MS = 6200;

function pickRandomCard(excluded = []) {
  const available = deck.filter((card) => !excluded.includes(card.slug));
  return available[Math.floor(Math.random() * available.length)];
}

function fallbackReading(cards) {
  return {
    title: "Le tirage n’a pas cligné des yeux",
    cards: cards.map((card, index) => ({
      position: positions[index].label,
      cardName: card.name,
      key: card.key,
      interpretation: `${card.name} ${index === 0 ? "insiste" : index === 1 ? "dévie" : "tranche"} : ${card.promptHint}`
    })),
    crossReading: `${cards[0]?.name}, ${cards[1]?.name} et ${cards[2]?.name} décrivent une situation qui se répète, se déforme, puis exige une réponse plus nette que d’habitude.`,
    synthesis: "Ce tirage ne demande pas d’y croire. Il demande de reconnaître le point où l’on tourne autour de quelque chose qui sait déjà comment revenir.",
    oracleSentence: "Le signe n’insiste jamais pour rien ; c’est l’habitude qui lui fait de la place."
  };
}

function Media({ card, back = false, autoplay = false, className = "" }) {
  const [failed, setFailed] = useState(false);
  const poster = back ? "/images/cards/fond-graphique.jpg" : card.imageFace;
  const src = back ? "/videos/cards/fond-graphique.mp4" : card.videoFace;
  const canVideo = autoplay && src && !failed;

  return (
    <div className={`overflow-hidden rounded-[28px] bg-black shadow-[0_28px_80px_rgba(0,0,0,0.58)] ${className}`}>
      {canVideo ? (
        <video
          src={src}
          poster={poster}
          className="h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          onError={() => setFailed(true)}
        />
      ) : (
        <img src={poster} alt={back ? "Dos de carte" : card.name} className="h-full w-full object-cover" />
      )}
    </div>
  );
}

function Shell({ children }) {
  return (
    <main className="fixed inset-0 overflow-hidden bg-[#060504] text-stone-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_14%,rgba(255,255,255,0.08),transparent_26%),linear-gradient(180deg,#120f0d_0%,#060504_54%,#040302_100%)]" />
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/30 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black/45 to-transparent" />
      <div className="relative z-10 h-full w-full">{children}</div>
    </main>
  );
}

function Intro({ onStart }) {
  return (
    <Shell>
      <section className="flex h-full flex-col items-center justify-center px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] text-center">
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.9 }} className="aspect-[2/3.2] h-[72vh] max-h-[710px] w-auto max-w-[92vw]">
          <Media back autoplay className="h-full w-full" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.7 }} className="mt-5">
          <p className="text-[10px] uppercase tracking-[0.42em] text-stone-500">oracle original</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-[0.03em] text-stone-50">Le tirage peut commencer.</h1>
        </motion.div>
        <motion.button initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.7 }} onClick={onStart} className="mt-6 rounded-full border border-stone-700 bg-black/30 px-6 py-3 text-[11px] uppercase tracking-[0.34em] text-stone-200 backdrop-blur-md active:scale-95">
          Commencer
        </motion.button>
      </section>
    </Shell>
  );
}

function Awaiting({ count, onDraw }) {
  return (
    <Shell>
      <button type="button" onClick={onDraw} className="flex h-full w-full flex-col items-center justify-center px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] text-center">
        <motion.div key={count} initial={{ opacity: 0, rotate: -1.5, scale: 0.98 }} animate={{ opacity: 1, rotate: 0, scale: 1 }} whileTap={{ scale: 0.985, rotate: 1.5 }} transition={{ duration: 0.65 }} className="aspect-[2/3.2] h-[74vh] max-h-[720px] w-auto max-w-[92vw]">
          <Media back autoplay className="h-full w-full" />
        </motion.div>
        <div className="mt-5 text-center">
          <p className="text-[10px] uppercase tracking-[0.42em] text-stone-500">{count + 1} / III</p>
          <p className="mt-3 text-sm text-stone-400">Touchez la carte</p>
        </div>
      </button>
    </Shell>
  );
}

function Reveal({ card, index }) {
  return (
    <Shell>
      <section className="flex h-full flex-col items-center justify-center px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] text-center">
        <motion.div initial={{ opacity: 0, rotateY: 92, scale: 0.93 }} animate={{ opacity: 1, rotateY: 0, scale: 1 }} transition={{ duration: 0.82, ease: "easeOut" }} className="aspect-[2/3.2] h-[72vh] max-h-[700px] w-auto max-w-[92vw] [perspective:1200px]">
          <Media card={card} autoplay className="h-full w-full" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="mt-5">
          <p className="text-[10px] uppercase tracking-[0.42em] text-stone-500">Carte {index + 1}</p>
          <h2 className="mt-2 text-3xl font-semibold text-stone-50">{card.name}</h2>
        </motion.div>
      </section>
    </Shell>
  );
}

function Spread({ cards, onContinue }) {
  const [zoomed, setZoomed] = useState(null);

  useEffect(() => {
    const timer = window.setTimeout(onContinue, OBSERVE_MS);
    return () => window.clearTimeout(timer);
  }, [onContinue]);

  useEffect(() => {
    if (!zoomed) return undefined;
    const timer = window.setTimeout(() => setZoomed(null), ZOOM_MS);
    return () => window.clearTimeout(timer);
  }, [zoomed]);

  return (
    <Shell>
      <section className="flex h-full flex-col justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
        <p className="mb-4 text-center text-[10px] uppercase tracking-[0.42em] text-stone-500">Le tirage</p>
        <div className="mx-auto flex h-[82vh] w-full max-w-[430px] flex-col items-center justify-center">
          {cards.map((card, index) => (
            <motion.button key={card.slug} initial={{ opacity: 0, y: 24, rotate: index === 0 ? -4 : index === 1 ? 2.5 : -1.5 }} animate={{ opacity: 1, y: 0, rotate: index === 0 ? -4 : index === 1 ? 2.5 : -1.5 }} transition={{ delay: index * 0.16, duration: 0.55 }} className="relative -my-3 aspect-[2/3.2] h-[29vh] min-h-[188px] max-h-[246px] active:scale-[0.985]" onClick={() => setZoomed(card)}>
              <Media card={card} autoplay className="h-full w-full rounded-[24px]" />
              <span className="absolute -right-2 top-4 rounded-full border border-stone-700 bg-black/70 px-2.5 py-1 text-[9px] uppercase tracking-[0.24em] text-stone-300 backdrop-blur-md">{positions[index].label}</span>
            </motion.button>
          ))}
        </div>
        <AnimatePresence>
          {zoomed && (
            <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/84 px-4 py-6 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setZoomed(null)}>
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} transition={{ duration: 0.25 }} className="aspect-[2/3.2] h-[86vh] max-h-[780px] w-auto max-w-[95vw]">
                <Media card={zoomed} autoplay className="h-full w-full" />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </Shell>
  );
}

function Keys({ cards, onContinue }) {
  useEffect(() => {
    const timer = window.setTimeout(onContinue, KEYS_MS);
    return () => window.clearTimeout(timer);
  }, [onContinue]);

  return (
    <Shell>
      <section className="flex h-full flex-col justify-center overflow-y-auto px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
        <p className="mb-6 text-center text-[10px] uppercase tracking-[0.42em] text-stone-500">Les clés</p>
        <div className="space-y-6">
          {cards.map((card, index) => (
            <motion.article key={card.slug} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.35, duration: 0.55 }} className="border-b border-stone-800 pb-6">
              <p className="text-[10px] uppercase tracking-[0.32em] text-stone-600">{positions[index].label}</p>
              <h2 className="mt-2 text-3xl font-semibold text-stone-50">{card.name}</h2>
              <p className="mt-2 text-lg italic leading-7 text-stone-400">{card.key}</p>
            </motion.article>
          ))}
        </div>
      </section>
    </Shell>
  );
}

function Generating() {
  return (
    <Shell>
      <section className="flex h-full flex-col items-center justify-center px-6 text-center">
        <motion.div animate={{ opacity: [0.38, 1, 0.38], scale: [0.985, 1, 0.985] }} transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }} className="aspect-[2/3.2] h-[58vh] max-h-[590px] w-auto max-w-[82vw]">
          <Media back autoplay className="h-full w-full" />
        </motion.div>
        <p className="mt-7 text-[10px] uppercase tracking-[0.42em] text-stone-500">L’oracle se formule</p>
      </section>
    </Shell>
  );
}

function Result({ cards, reading, onRestart }) {
  return (
    <Shell>
      <section className="h-full overflow-y-auto px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div className="mx-auto w-full max-w-[460px]">
          <div className="mb-5 flex items-center justify-between gap-4">
            <p className="text-[10px] uppercase tracking-[0.42em] text-stone-500">Oracle</p>
            <button onClick={onRestart} className="rounded-full border border-stone-700 bg-black/30 px-4 py-2 text-[10px] uppercase tracking-[0.32em] text-stone-200 backdrop-blur-md active:scale-95">Recommencer</button>
          </div>
          <div className="mb-6 flex items-start justify-center gap-3">
            {cards.map((card) => <div key={card.slug} className="aspect-[2/3.2] h-[112px] w-auto shrink-0"><Media card={card} className="h-full w-full rounded-[18px]" /></div>)}
          </div>
          <div className="rounded-[2rem] border border-stone-800 bg-black/38 p-5 shadow-2xl backdrop-blur-md">
            <p className="text-[10px] uppercase tracking-[0.32em] text-stone-500">Titre</p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight text-stone-50">{reading.title}</h1>
            <div className="mt-6 space-y-5">
              {reading.cards.map((item, index) => (
                <article key={`${item.cardName}-${index}`} className="border-b border-stone-800 pb-5 last:border-b-0 last:pb-0">
                  <p className="text-[10px] uppercase tracking-[0.32em] text-stone-600">{item.position}</p>
                  <h2 className="mt-2 text-2xl font-semibold text-stone-100">{item.cardName}</h2>
                  <p className="mt-1 text-sm italic text-stone-400">{item.key}</p>
                  <p className="mt-3 text-[15px] leading-7 text-stone-300">{item.interpretation}</p>
                </article>
              ))}
            </div>
            <div className="mt-6 border-t border-stone-800 pt-5"><p className="text-[10px] uppercase tracking-[0.32em] text-stone-500">Lecture croisée</p><p className="mt-3 text-[15px] leading-7 text-stone-300">{reading.crossReading}</p></div>
            <div className="mt-6 border-t border-stone-800 pt-5"><p className="text-[10px] uppercase tracking-[0.32em] text-stone-500">Synthèse</p><p className="mt-3 text-[15px] leading-7 text-stone-300">{reading.synthesis}</p></div>
            <div className="mt-6 rounded-[1.5rem] border border-stone-700 bg-stone-100 p-4 text-black"><p className="text-[10px] uppercase tracking-[0.32em] text-stone-500">Phrase-oracle</p><p className="mt-3 text-xl font-semibold leading-8">{reading.oracleSentence}</p></div>
          </div>
        </div>
      </section>
    </Shell>
  );
}

export default function App() {
  const [stage, setStage] = useState("intro");
  const [drawn, setDrawn] = useState([]);
  const [current, setCurrent] = useState(null);
  const [reading, setReading] = useState(null);
  const [error, setError] = useState(null);

  const drawNext = () => {
    if (stage !== "awaiting" || drawn.length >= DRAW_TARGET) return;
    const card = pickRandomCard(drawn.map((item) => item.slug));
    setCurrent(card);
    setDrawn((prev) => [...prev, card]);
    setStage("reveal");
  };

  useEffect(() => {
    if (stage !== "reveal") return undefined;
    const timer = window.setTimeout(() => {
      setCurrent(null);
      setStage(drawn.length >= DRAW_TARGET ? "spread" : "awaiting");
    }, REVEAL_MS);
    return () => window.clearTimeout(timer);
  }, [stage, drawn.length]);

  useEffect(() => {
    if (stage !== "generating") return undefined;
    let cancelled = false;
    async function run() {
      try {
        const response = await fetch("/api/reading", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: "Question silencieuse",
            cards: drawn.map((card, index) => ({ ...card, position: positions[index].label, positionMeaning: positions[index].meaning }))
          })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "Erreur pendant la génération de la lecture.");
        if (!cancelled) {
          setReading(data.reading);
          setStage("result");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setReading(fallbackReading(drawn));
          setStage("result");
        }
      }
    }
    run();
    return () => { cancelled = true; };
  }, [stage, drawn]);

  const revealIndex = useMemo(() => Math.max(drawn.length - 1, 0), [drawn.length]);

  const restart = () => {
    setStage("intro");
    setDrawn([]);
    setCurrent(null);
    setReading(null);
    setError(null);
  };

  if (stage === "intro") return <Intro onStart={() => setStage("awaiting")} />;
  if (stage === "awaiting") return <Awaiting count={drawn.length} onDraw={drawNext} />;
  if (stage === "reveal" && current) return <Reveal card={current} index={revealIndex} />;
  if (stage === "spread") return <Spread cards={drawn} onContinue={() => setStage("keys")} />;
  if (stage === "keys") return <Keys cards={drawn} onContinue={() => setStage("generating")} />;
  if (stage === "generating") return <Generating />;

  return (
    <>
      {error ? <div className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+12px)] z-50 w-[calc(100%-32px)] max-w-[430px] -translate-x-1/2 rounded-2xl border border-amber-600/60 bg-amber-100/92 px-4 py-3 text-sm text-amber-950 shadow-xl backdrop-blur">Lecture locale affichée : {error}</div> : null}
      <Result cards={drawn} reading={reading || fallbackReading(drawn)} onRestart={restart} />
    </>
  );
}
