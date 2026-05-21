import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { deck, positions } from "./cards";

const DRAW_TARGET = 3;
const QUESTION_DISPLAY_MS = 5000;
const NEGATIVE_SIGNAL_MS = 5000;
const CARD_FADE_MS = 4000;
const FALLBACK_CARD_DURATION_MS = 5000;
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
          ? `${card.name} insiste : ${card.key}. Ce qui revient n’a pas encore tout dit.`
          : index === 1
            ? `${card.name} dévie : ${card.key}. Le détour est peut-être plus parlant que l’obstacle.`
            : `${card.name} tranche : ${card.key}. Il faut entendre ce qui cesse de négocier.`
    })),
    crossReading: `${cards[0].name}, ${cards[1].name} et ${cards[2].name} disent ceci : le même motif revient, mais il a changé de costume.`,
    synthesis: "La question ne demande pas une solution héroïque : elle demande de cesser d’appeler destin une vieille habitude bien entretenue.",
    oracleSentence: "Le signe frappe moins fort quand on arrête de lui servir à boire."
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
      <video
        src="/videos/cards/fond-graphique.mp4"
        poster="/images/cards/fond-graphique.jpg"
        className="fixed inset-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
      />

      <motion.video
        key={card.slug}
        src={card.videoFace}
        poster={card.imageFace}
        className="fixed inset-0 h-full w-full object-cover"
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

function RevelationVideo({ onEnded }) {
  const videoRef = useRef(null);
  const sources = ["/videos/revelation.mp4?v=7", "/videos/cards/revelation.mp4?v=7"];
  const [sourceIndex, setSourceIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [finished, setFinished] = useState(false);
  const endedRef = useRef(false);
  const fallbackTimerRef = useRef(null);

  useEffect(() => {
    endedRef.current = false;
    setVisible(false);
    setFinished(false);

    window.clearTimeout(fallbackTimerRef.current);
    fallbackTimerRef.current = window.setTimeout(() => {
      if (!endedRef.current) {
        endedRef.current = true;
        setFinished(true);
        onEnded();
      }
    }, 12000);

    const video = videoRef.current;
    if (!video) return undefined;

    video.load();

    const playPromise = video.play();
    if (playPromise?.catch) {
      playPromise.catch(() => {
        // Keep this stage active. The fallback timer will release the flow if playback is blocked.
      });
    }

    return () => {
      window.clearTimeout(fallbackTimerRef.current);
    };
  }, [sourceIndex, onEnded]);

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

    if (!endedRef.current) {
      endedRef.current = true;
      setFinished(true);
      onEnded();
    }
  };

  const handleEnded = () => {
    if (endedRef.current) return;
    endedRef.current = true;
    window.clearTimeout(fallbackTimerRef.current);
    setFinished(true);
    onEnded();
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
        playsInline
        preload="auto"
        onLoadedData={handleReady}
        onCanPlay={handleReady}
        onPlaying={handleReady}
        onEnded={handleEnded}
        onError={handleError}
        initial={{ opacity: 0 }}
        animate={{ opacity: visible && !finished ? 1 : 0 }}
        transition={{ duration: 0.65, ease: "easeInOut" }}
      />

      <motion.img
        src="/images/revelation-final.png"
        alt=""
        className="fixed inset-0 h-full w-full object-cover"
        initial={{ opacity: 0 }}
        animate={{ opacity: finished ? 1 : 0 }}
        transition={{ duration: 0.45, ease: "easeInOut" }}
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

function ResultScreen({ reading, question, onRestart }) {
  return (
    <main className="fixed inset-0 overflow-hidden bg-black text-stone-100">
      <video
        src="/videos/oracle.mp4"
        className="fixed inset-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      />

      <div className="pointer-events-none fixed inset-0 bg-gradient-to-b from-black/5 via-black/12 to-black/72" />

      <button
        onClick={onRestart}
        className="fixed right-4 top-[max(1rem,env(safe-area-inset-top))] z-30 rounded-full border border-white/30 bg-black/25 px-4 py-2 text-[10px] uppercase tracking-[0.32em] text-white/80 backdrop-blur-md active:scale-95"
      >
        Recommencer
      </button>

      <section className="fixed bottom-0 left-0 right-0 z-20 h-[52vh] overflow-hidden px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-8">
        <motion.div
          className="mx-auto max-w-[520px] text-center"
          initial={{ y: "88%", opacity: 0 }}
          animate={{ y: "-100%", opacity: 1 }}
          transition={{ duration: 58, ease: "linear" }}
        >
          <p className="text-[10px] uppercase tracking-[0.38em] text-white/62">Question</p>
          <p className="mt-3 text-2xl font-semibold leading-8 text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.95)]">
            {question || "Question silencieuse"}
          </p>

          <div className="my-9 h-px w-24 bg-white/30 mx-auto" />

          <h1 className="text-3xl font-semibold leading-tight text-white drop-shadow-[0_4px_18px_rgba(0,0,0,0.95)]">
            {reading.title}
          </h1>

          <div className="mt-8 space-y-8 text-left">
            {reading.cards.map((item, index) => (
              <article key={`${item.cardName}-${index}`}>
                <p className="text-[10px] uppercase tracking-[0.32em] text-white/45">{item.position}</p>
                <h2 className="mt-2 text-2xl font-semibold text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.95)]">
                  {item.cardName}
                </h2>
                <p className="mt-1 text-base italic text-white/72">{item.key}</p>
                <p className="mt-3 text-xl leading-8 text-white drop-shadow-[0_4px_14px_rgba(0,0,0,0.95)]">
                  {item.interpretation}
                </p>
              </article>
            ))}
          </div>

          <div className="my-9 h-px w-24 bg-white/30 mx-auto" />

          <p className="text-[10px] uppercase tracking-[0.32em] text-white/45">Lecture croisée</p>
          <p className="mt-3 text-xl leading-8 text-white drop-shadow-[0_4px_14px_rgba(0,0,0,0.95)]">
            {reading.crossReading}
          </p>

          <div className="mt-9">
            <p className="text-[10px] uppercase tracking-[0.32em] text-white/45">Synthèse</p>
            <p className="mt-3 text-xl leading-8 text-white drop-shadow-[0_4px_14px_rgba(0,0,0,0.95)]">
              {reading.synthesis}
            </p>
          </div>

          <div className="mt-10 mb-24">
            <p className="text-[10px] uppercase tracking-[0.32em] text-white/45">Phrase-oracle</p>
            <p className="mt-3 text-3xl font-semibold leading-10 text-white drop-shadow-[0_4px_18px_rgba(0,0,0,0.95)]">
              {reading.oracleSentence}
            </p>
          </div>
        </motion.div>
      </section>
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
  const [revelationEnded, setRevelationEnded] = useState(false);

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

    if (drawnCards.length >= DRAW_TARGET) {
      setRevelationEnded(false);
      setStage("revelation");
      return;
    }

    setStage("awaitingDraw");
  };

  useEffect(() => {
    if (stage !== "revelation") return undefined;
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
        const apiReading = await fetchReading();

        if (!cancelled) {
          setReading(apiReading);
        }
      } catch (err) {
        await wait(REVELATION_DISPLAY_MS);

        if (!cancelled) {
          setError(err.message);
          setReading(createFallbackReading(drawnCards, question));
        }
      }
    }

    generateReading();

    return () => {
      cancelled = true;
    };
  }, [stage, drawnCards, question]);

  useEffect(() => {
    if (stage === "revelation" && revelationEnded && reading) {
      setStage("result");
    }
  }, [stage, revelationEnded, reading]);

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
    setRevelationEnded(false);
  };

  if (stage === "result") {
    return (
      <>
        {error ? (
          <div className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+12px)] z-50 w-[calc(100%-32px)] max-w-[430px] -translate-x-1/2 rounded-2xl border border-amber-600/60 bg-amber-100/92 px-4 py-3 text-sm text-amber-950 shadow-xl backdrop-blur">
            Lecture locale affichée : {error}
          </div>
        ) : null}
        <ResultScreen reading={reading || createFallbackReading(drawnCards, question)} question={question} onRestart={restart} />
      </>
    );
  }

  if (stage === "revelation") {
    return <RevelationVideo onEnded={() => setRevelationEnded(true)} />;
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
