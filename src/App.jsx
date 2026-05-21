import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { deck, positions } from "./cards";

const DRAW_TARGET = 3;
const QUESTION_DISPLAY_MS = 5000;
const NEGATIVE_SIGNAL_MS = 5000;
const CARD_FADE_MS = 2000;
const FALLBACK_CARD_DURATION_MS = 5000;
const REVELATION_DISPLAY_MS = 6200;
const FADE_DURATION = 0.85;

function pickRandomCard(excluded = []) {
  const available = deck.filter((card) => !excluded.includes(card.slug));
  return available[Math.floor(Math.random() * available.length)];
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
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

function Background({ onClick, children, negativeSignal = false }) {
  return (
    <main className="fixed inset-0 overflow-hidden bg-black text-stone-100" onClick={onClick}>
      <motion.video
        src="/videos/cards/fond-graphique.mp4"
        poster="/images/cards/fond-graphique.jpg"
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        initial={false}
        animate={
          negativeSignal
            ? { filter: ["invert(1)", "invert(1)", "invert(0)"] }
            : { filter: "invert(0)" }
        }
        transition={
          negativeSignal
            ? { duration: 5, times: [0, 0.4, 1], ease: "linear" }
            : { duration: 0 }
        }
      />
      <div className="absolute inset-0 bg-black/5" />
      <div className="relative z-10 h-full w-full">{children}</div>
    </main>
  );
}

function TimedCardVideo({ card, onDone }) {
  const [isLeaving, setIsLeaving] = useState(false);
  const fallbackTimerRef = useRef(null);
  const leaveTimerRef = useRef(null);
  const doneTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      window.clearTimeout(fallbackTimerRef.current);
      window.clearTimeout(leaveTimerRef.current);
      window.clearTimeout(doneTimerRef.current);
    };
  }, []);

  const scheduleFromDuration = (durationSeconds) => {
    window.clearTimeout(fallbackTimerRef.current);
    window.clearTimeout(leaveTimerRef.current);
    window.clearTimeout(doneTimerRef.current);

    const durationMs =
      Number.isFinite(durationSeconds) && durationSeconds > 0
        ? durationSeconds * 1000
        : FALLBACK_CARD_DURATION_MS;

    leaveTimerRef.current = window.setTimeout(() => {
      setIsLeaving(true);
    }, CARD_FADE_MS + durationMs);

    doneTimerRef.current = window.setTimeout(() => {
      onDone();
    }, CARD_FADE_MS + durationMs + CARD_FADE_MS);
  };

  useEffect(() => {
    fallbackTimerRef.current = window.setTimeout(() => {
      scheduleFromDuration(FALLBACK_CARD_DURATION_MS / 1000);
    }, 900);

    return () => {
      window.clearTimeout(fallbackTimerRef.current);
    };
  }, [card.slug]);

  return (
    <main className="fixed inset-0 overflow-hidden bg-black">
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
        onLoadedMetadata={(event) => {
          scheduleFromDuration(event.currentTarget.duration);
        }}
        initial={{ opacity: 0, filter: "blur(0px)" }}
        animate={
          isLeaving
            ? { opacity: 0, filter: "blur(28px)" }
            : { opacity: 1, filter: "blur(0px)" }
        }
        transition={{ duration: CARD_FADE_MS / 1000, ease: "easeInOut" }}
      />
    </main>
  );
}

function RevelationVideo() {
  const videoRef = useRef(null);
  const sources = ["/videos/revelation.mp4?v=5", "/videos/cards/revelation.mp4?v=5"];
  const [sourceIndex, setSourceIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(false);
    const video = videoRef.current;
    if (!video) return undefined;

    video.load();

    const playPromise = video.play();
    if (playPromise?.catch) {
      playPromise.catch(() => {
        // On ne revient plus au fond graphique : la vidéo doit rester l’écran de révélation.
      });
    }

    return undefined;
  }, [sourceIndex]);

  const handleReady = () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      video.currentTime = 0;
      video.play();
    } catch {
      // Ignore playback errors.
    }

    setVisible(true);
  };

  const handleError = () => {
    if (sourceIndex < sources.length - 1) {
      setSourceIndex((index) => index + 1);
      return;
    }

    setVisible(true);
  };

  return (
    <main className="fixed inset-0 overflow-hidden bg-black">
      <motion.video
        ref={videoRef}
        key={sources[sourceIndex]}
        src={sources[sourceIndex]}
        className="fixed inset-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        onLoadedData={handleReady}
        onCanPlay={handleReady}
        onPlaying={handleReady}
        onError={handleError}
        initial={{ opacity: 0 }}
        animate={{ opacity: visible ? 1 : 0 }}
        transition={{ duration: 0.65, ease: "easeInOut" }}
      />
    </main>
  );
}

function MicrophoneIcon({ active = false }) {
  return (
    <motion.div
      animate={{ scale: active ? 0.95 : 1 }}
      transition={{ duration: 0.18 }}
      className={[
        "flex h-24 w-24 items-center justify-center rounded-full border backdrop-blur-md",
        "shadow-[0_0_45px_rgba(255,255,255,0.22)]",
        active
          ? "border-black bg-white text-black"
          : "border-white/70 bg-black/35 text-white"
      ].join(" ")}
    >
      <svg width="42" height="42" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 14.5c1.8 0 3.2-1.4 3.2-3.2V5.7C15.2 3.9 13.8 2.5 12 2.5S8.8 3.9 8.8 5.7v5.6c0 1.8 1.4 3.2 3.2 3.2Z"
          stroke="currentColor"
          strokeWidth="1.7"
        />
        <path
          d="M5.5 10.5c0 3.6 2.8 6.4 6.5 6.4s6.5-2.8 6.5-6.4M12 16.9v4.6M8.8 21.5h6.4"
          stroke="currentColor"
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
      animate={{ opacity: [0, 1, 1, 0] }}
      transition={{ duration: 5, times: [0, 0.17, 0.83, 1], ease: "easeInOut" }}
    >
      <p
        className="text-4xl font-semibold leading-tight text-white md:text-6xl"
        style={{
          textShadow:
            "0 6px 18px rgba(0,0,0,0.95), 0 2px 4px rgba(0,0,0,0.95), 0 0 28px rgba(0,0,0,0.85)"
        }}
      >
        {question}
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
  const [micActive, setMicActive] = useState(false);
  const [question, setQuestion] = useState("");
  const [drawnCards, setDrawnCards] = useState([]);
  const [currentCard, setCurrentCard] = useState(null);
  const [reading, setReading] = useState(null);
  const [error, setError] = useState(null);

  const recognitionRef = useRef(null);
  const transcriptRef = useRef("");
  const hasStartedRef = useRef(false);
  const finalizedRef = useRef(false);

  const SpeechRecognition =
    typeof window !== "undefined"
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;

  const resetRecognition = () => {
    recognitionRef.current = null;
    hasStartedRef.current = false;
    finalizedRef.current = false;
  };

  const finalizeQuestion = () => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;

    const capturedQuestion = transcriptRef.current.trim();

    if (!capturedQuestion) {
      setMicActive(false);
      resetRecognition();
      return;
    }

    setMicActive(false);
    setQuestion(capturedQuestion);
    resetRecognition();
    setStage("question");
  };

  const startRecording = (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (micActive) return;

    transcriptRef.current = "";
    finalizedRef.current = false;

    if (!SpeechRecognition) return;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // Ignore abort errors.
      }
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "fr-FR";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      hasStartedRef.current = true;
      setMicActive(true);
    };

    recognition.onresult = (speechEvent) => {
      let finalText = "";
      let interimText = "";

      for (let i = 0; i < speechEvent.results.length; i += 1) {
        const transcript = speechEvent.results[i][0].transcript;
        if (speechEvent.results[i].isFinal) {
          finalText += transcript;
        } else {
          interimText += transcript;
        }
      }

      transcriptRef.current = `${finalText} ${interimText}`.trim();
    };

    recognition.onerror = () => {
      setMicActive(false);
      resetRecognition();
    };

    recognition.onend = () => {
      if (hasStartedRef.current && !finalizedRef.current) {
        finalizeQuestion();
      } else {
        resetRecognition();
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      setMicActive(false);
      resetRecognition();
    }
  };

  const stopRecording = (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (!micActive || !recognitionRef.current) return;

    try {
      recognitionRef.current.stop();
    } catch {
      finalizeQuestion();
    }
  };

  useEffect(() => {
    if (stage !== "question") return undefined;
    const timer = window.setTimeout(() => {
      setStage("signal");
    }, QUESTION_DISPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [stage]);

  useEffect(() => {
    if (stage !== "signal") return undefined;
    const timer = window.setTimeout(() => {
      setStage("awaitingDraw");
    }, NEGATIVE_SIGNAL_MS);
    return () => window.clearTimeout(timer);
  }, [stage]);

  const drawNextCard = () => {
    if (stage !== "awaitingDraw" || drawnCards.length >= DRAW_TARGET) return;

    const nextCard = pickRandomCard(drawnCards.map((card) => card.slug));
    setCurrentCard(nextCard);
    setDrawnCards((prev) => [...prev, nextCard]);
    setStage("cardReveal");
  };

  const completeCardReveal = () => {
    setCurrentCard(null);
    setStage(drawnCards.length >= DRAW_TARGET ? "generating" : "awaitingDraw");
  };

  useEffect(() => {
    if (stage !== "generating") return undefined;
    let cancelled = false;

    async function fetchReading() {
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

      return data.reading;
    }

    async function generateReading() {
      setError(null);

      try {
        const [apiReading] = await Promise.all([
          fetchReading(),
          wait(REVELATION_DISPLAY_MS)
        ]);

        if (!cancelled) {
          setReading(apiReading);
          setStage("result");
        }
      } catch (err) {
        await wait(REVELATION_DISPLAY_MS);

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
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // Ignore abort errors.
      }
    }

    resetRecognition();
    setStage("home");
    setMicActive(false);
    setQuestion("");
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
    return <RevelationVideo />;
  }

  if (stage === "cardReveal" && currentCard) {
    return <TimedCardVideo card={currentCard} onDone={completeCardReveal} />;
  }

  if (stage === "awaitingDraw") {
    return <Background onClick={drawNextCard} />;
  }

  if (stage === "signal") {
    return <Background negativeSignal />;
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
        <div className="flex h-full flex-col items-center justify-center px-6 text-center">
          <button
            type="button"
            aria-label="Microphone"
            onPointerDown={startRecording}
            onPointerUp={stopRecording}
            onPointerCancel={stopRecording}
            className="touch-none"
          >
            <MicrophoneIcon active={micActive} />
          </button>
        </div>
      </Background>
    );
  }

  return <Background onClick={() => setStage("microphone")} />;
}
