import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { deck, positions } from "./cards";

const DRAW_TARGET = 3;
const QUESTION_DISPLAY_MS = 5000;
const CARD_DISPLAY_MS = 5000;
const FADE_DURATION = 0.85;

function pickRandomCard(excluded = []) {
  const available = deck.filter((card) => !excluded.includes(card.slug));
  return available[Math.floor(Math.random() * available.length)];
}

function createFallbackReading(cards, question) {
  return {
    title: "Le tirage n’a pas cligné des yeux",
    cards: cards.map((card, index) => ({
      position: positions[index].label,
      cardName: card.name,
      key: card.key,
      interpretation:
        index === 0
          ? `${card.name} insiste : ${card.promptHint}`
          : index === 1
            ? `${card.name} tord la situation : ${card.promptHint}`
            : `${card.name} tranche : ${card.promptHint}`
    })),
    crossReading: `${cards[0].name}, ${cards[1].name} et ${cards[2].name} répondent à cette question : « ${question || "Question silencieuse"} ». La situation ne se contente pas d’exister : elle se répète, se déforme, puis exige une réponse plus nette que d’habitude.`,
    synthesis: "Ce tirage ne demande pas d’y croire. Il demande surtout de reconnaître le point où l’on tourne autour de quelque chose qui sait déjà comment revenir.",
    oracleSentence: "Le signe n’insiste jamais pour rien ; c’est l’habitude qui lui fait de la place."
  };
}

function Background({ onClick, children }) {
  return (
    <main
      className="fixed inset-0 overflow-hidden bg-black text-stone-100"
      onClick={onClick}
    >
      <video
        src="/videos/cards/fond-graphique.mp4"
        poster="/images/cards/fond-graphique.jpg"
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
      />
      <div className="absolute inset-0 bg-black/5" />
      <div className="relative z-10 h-full w-full">{children}</div>
    </main>
  );
}

function CardVideo({ card }) {
  return (
    <motion.video
      key={card.slug}
      src={card.videoFace}
      poster={card.imageFace}
      className="fixed inset-0 h-full w-full bg-black object-cover"
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: FADE_DURATION, ease: "easeInOut" }}
    />
  );
}

function MicrophoneIcon({ pressed = false }) {
  return (
    <motion.div
      animate={{ scale: pressed ? 0.92 : 1, opacity: pressed ? 1 : 0.92 }}
      transition={{ duration: 0.18 }}
      className="flex h-24 w-24 items-center justify-center rounded-full border border-white/70 bg-black/35 shadow-[0_0_45px_rgba(255,255,255,0.22)] backdrop-blur-md"
    >
      <svg width="42" height="42" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 14.5c1.8 0 3.2-1.4 3.2-3.2V5.7C15.2 3.9 13.8 2.5 12 2.5S8.8 3.9 8.8 5.7v5.6c0 1.8 1.4 3.2 3.2 3.2Z"
          stroke="white"
          strokeWidth="1.7"
        />
        <path
          d="M5.5 10.5c0 3.6 2.8 6.4 6.5 6.4s6.5-2.8 6.5-6.4M12 16.9v4.6M8.8 21.5h6.4"
          stroke="white"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    </motion.div>
  );
}

function QuestionOverlay({ question }) {
  return (
    <motion.div
      className="fixed inset-0 z-20 flex items-center justify-center px-7 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: FADE_DURATION }}
    >
      <p
        className="text-3xl font-semibold leading-tight text-white md:text-5xl"
        style={{
          WebkitTextStroke: "1.15px black",
          textShadow:
            "0 2px 0 #000, 2px 0 0 #000, -2px 0 0 #000, 0 -2px 0 #000, 0 0 18px rgba(0,0,0,0.9)"
        }}
      >
        {question || "Question silencieuse"}
      </p>
    </motion.div>
  );
}

function ResultScreen({ cards, reading, onRestart }) {
  return (
    <main className="fixed inset-0 overflow-y-auto bg-[#060504] px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] text-stone-100">
      <div className="mx-auto w-full max-w-[460px]">
        <div className="mb-5 flex items-center justify-between gap-4">
          <p className="text-[10px] uppercase tracking-[0.42em] text-stone-500">Oracle</p>
          <button
            onClick={onRestart}
            className="rounded-full border border-stone-700 bg-black/30 px-4 py-2 text-[10px] uppercase tracking-[0.32em] text-stone-200 backdrop-blur-md active:scale-95"
          >
            Recommencer
          </button>
        </div>

        <div className="mb-6 flex items-start justify-center gap-3">
          {cards.map((card) => (
            <img
              key={card.slug}
              src={card.imageFace}
              alt={card.name}
              className="aspect-[2/3.2] h-[112px] w-auto shrink-0 rounded-[18px] object-cover"
            />
          ))}
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

          <div className="mt-6 border-t border-stone-800 pt-5">
            <p className="text-[10px] uppercase tracking-[0.32em] text-stone-500">Lecture croisée</p>
            <p className="mt-3 text-[15px] leading-7 text-stone-300">{reading.crossReading}</p>
          </div>

          <div className="mt-6 border-t border-stone-800 pt-5">
            <p className="text-[10px] uppercase tracking-[0.32em] text-stone-500">Synthèse</p>
            <p className="mt-3 text-[15px] leading-7 text-stone-300">{reading.synthesis}</p>
          </div>

          <div className="mt-6 rounded-[1.5rem] border border-stone-700 bg-stone-100 p-4 text-black">
            <p className="text-[10px] uppercase tracking-[0.32em] text-stone-500">Phrase-oracle</p>
            <p className="mt-3 text-xl font-semibold leading-8">{reading.oracleSentence}</p>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function App() {
  const [stage, setStage] = useState("home");
  const [isRecording, setIsRecording] = useState(false);
  const [question, setQuestion] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [drawnCards, setDrawnCards] = useState([]);
  const [currentCard, setCurrentCard] = useState(null);
  const [reading, setReading] = useState(null);
  const [error, setError] = useState(null);

  const recognitionRef = useRef(null);
  const transcriptRef = useRef("");

  const SpeechRecognition =
    typeof window !== "undefined"
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;

  const startRecording = (event) => {
    event.preventDefault();
    event.stopPropagation();

    transcriptRef.current = "";
    setLiveTranscript("");
    setQuestion("");
    setIsRecording(true);

    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = "fr-FR";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (speechEvent) => {
      let text = "";
      for (let i = 0; i < speechEvent.results.length; i += 1) {
        text += speechEvent.results[i][0].transcript;
      }
      transcriptRef.current = text.trim();
      setLiveTranscript(text.trim());
    };

    recognition.onerror = () => {
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopRecording = (event) => {
    event.preventDefault();
    event.stopPropagation();

    setIsRecording(false);

    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    window.setTimeout(() => {
      const capturedQuestion = transcriptRef.current.trim() || liveTranscript.trim() || "Question silencieuse";
      setQuestion(capturedQuestion);
      setStage("question");
    }, 280);
  };

  useEffect(() => {
    if (stage !== "question") return undefined;
    const timer = window.setTimeout(() => {
      setStage("awaitingDraw");
    }, QUESTION_DISPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [stage]);

  const drawNextCard = () => {
    if (stage !== "awaitingDraw" || drawnCards.length >= DRAW_TARGET) return;

    const nextCard = pickRandomCard(drawnCards.map((card) => card.slug));
    setCurrentCard(nextCard);
    setDrawnCards((prev) => [...prev, nextCard]);
    setStage("cardReveal");
  };

  useEffect(() => {
    if (stage !== "cardReveal") return undefined;

    const timer = window.setTimeout(() => {
      setCurrentCard(null);
      setStage(drawnCards.length >= DRAW_TARGET ? "generating" : "awaitingDraw");
    }, CARD_DISPLAY_MS);

    return () => window.clearTimeout(timer);
  }, [stage, drawnCards.length]);

  useEffect(() => {
    if (stage !== "generating") return undefined;
    let cancelled = false;

    async function generateReading() {
      setError(null);

      try {
        const response = await fetch("/api/reading", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: question || "Question silencieuse",
            cards: drawnCards.map((card, index) => ({
              ...card,
              position: positions[index].label,
              positionMeaning: positions[index].meaning
            }))
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || "Erreur pendant la génération de la lecture.");
        }

        if (!cancelled) {
          setReading(data.reading);
          setStage("result");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setReading(createFallbackReading(drawnCards, question));
          setStage("result");
        }
      }
    }

    generateReading();

    return () => {
      cancelled = true;
    };
  }, [stage, drawnCards, question]);

  const restart = () => {
    setStage("home");
    setIsRecording(false);
    setQuestion("");
    setLiveTranscript("");
    setDrawnCards([]);
    setCurrentCard(null);
    setReading(null);
    setError(null);
  };

  if (stage === "result") {
    return (
      <>
        {error ? (
          <div className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+12px)] z-50 w-[calc(100%-32px)] max-w-[430px] -translate-x-1/2 rounded-2xl border border-amber-600/60 bg-amber-100/92 px-4 py-3 text-sm text-amber-950 shadow-xl backdrop-blur">
            Lecture locale affichée : {error}
          </div>
        ) : null}
        <ResultScreen cards={drawnCards} reading={reading || createFallbackReading(drawnCards, question)} onRestart={restart} />
      </>
    );
  }

  if (stage === "generating") {
    return (
      <Background>
        <div className="flex h-full items-center justify-center px-8 text-center">
          <motion.p
            className="text-[11px] uppercase tracking-[0.42em] text-white"
            style={{ textShadow: "0 0 12px black, 0 2px 0 black" }}
            animate={{ opacity: [0.35, 1, 0.35] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          >
            L’oracle se formule
          </motion.p>
        </div>
      </Background>
    );
  }

  if (stage === "cardReveal" && currentCard) {
    return (
      <main className="fixed inset-0 overflow-hidden bg-black">
        <CardVideo card={currentCard} />
      </main>
    );
  }

  if (stage === "awaitingDraw") {
    return <Background onClick={drawNextCard} />;
  }

  if (stage === "question") {
    return (
      <Background>
        <QuestionOverlay question={question} />
      </Background>
    );
  }

  if (stage === "microphone") {
    return (
      <Background>
        <div className="flex h-full flex-col items-center justify-center">
          <button
            type="button"
            aria-label="Dicter la question"
            onPointerDown={startRecording}
            onPointerUp={stopRecording}
            onPointerCancel={stopRecording}
            onPointerLeave={isRecording ? stopRecording : undefined}
            className="touch-none"
          >
            <MicrophoneIcon pressed={isRecording} />
          </button>

          {isRecording && liveTranscript ? (
            <p
              className="mt-8 max-w-[82vw] text-center text-2xl font-semibold leading-tight text-white"
              style={{
                WebkitTextStroke: "0.9px black",
                textShadow: "0 2px 0 #000, 0 0 16px rgba(0,0,0,0.9)"
              }}
            >
              {liveTranscript}
            </p>
          ) : null}
        </div>
      </Background>
    );
  }

  return <Background onClick={() => setStage("microphone")} />;
}
