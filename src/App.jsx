import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { deck, positions } from "./cards";

const DRAW_TARGET = 3;
const QUESTION_DISPLAY_MS = 5000;
const NEGATIVE_SIGNAL_MS = 5000;
const CARD_FADE_MS = 6000;
const FALLBACK_CARD_DURATION_MS = 5000;
const ORACLE_WAIT_MS = 3600;
const ORACLE_PANEL_MS = 8000;
const FADE_DURATION = 0.85;

function pickRandomCard(excluded = []) {
  const available = deck.filter((card) => !excluded.includes(card.slug));
  return available[Math.floor(Math.random() * available.length)];
}

let oracleAudioContext = null;
let oracleKeepAlive = null;
let oracleCurrentSource = null;

function getOracleAudioContext() {
  if (typeof window === "undefined") return null;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!oracleAudioContext) {
    oracleAudioContext = new AudioContextClass();
  }

  return oracleAudioContext;
}

function unlockOracleAudio() {
  const context = getOracleAudioContext();
  if (!context) return;

  context.resume().catch(() => {
    // Silent fallback. The user can retry by tapping the audio icon again.
  });

  if (!oracleKeepAlive) {
    const gain = context.createGain();
    gain.gain.value = 0.00001;
    gain.connect(context.destination);

    const oscillator = context.createOscillator();
    oscillator.frequency.value = 40;
    oscillator.connect(gain);
    oscillator.start();

    oracleKeepAlive = { oscillator, gain };
  }
}

function base64ToArrayBuffer(base64) {
  const binaryString = window.atob(base64);
  const length = binaryString.length;
  const bytes = new Uint8Array(length);

  for (let i = 0; i < length; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes.buffer;
}

async function playOracleAudioBuffer(base64) {
  const context = getOracleAudioContext();
  if (!context || !base64) return;

  await context.resume();

  if (oracleCurrentSource) {
    try {
      oracleCurrentSource.stop();
    } catch {
      // Ignore stop errors.
    }
    oracleCurrentSource = null;
  }

  const arrayBuffer = base64ToArrayBuffer(base64);
  const decoded = await context.decodeAudioData(arrayBuffer.slice(0));

  const source = context.createBufferSource();
  source.buffer = decoded;
  source.connect(context.destination);
  source.start(0);

  oracleCurrentSource = source;
}

function stopOracleAudioBuffer() {
  if (oracleCurrentSource) {
    try {
      oracleCurrentSource.stop();
    } catch {
      // Ignore stop errors.
    }
    oracleCurrentSource = null;
  }
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


function AudioToggleButton({ enabled, onToggle }) {
  return (
    <button
      type="button"
      aria-label="Audio"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
      className="fixed right-5 top-[max(1.25rem,env(safe-area-inset-top))] z-30 flex h-11 w-11 items-center justify-center rounded-full border border-white/60 shadow-[0_0_28px_rgba(255,255,255,0.2)] backdrop-blur-md active:scale-95"
      style={{
        backgroundColor: enabled ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.52)",
        color: enabled ? "black" : "white"
      }}
    >
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4.5 9.5v5h3.2l4.3 3.7V5.8L7.7 9.5H4.5Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        {enabled ? (
          <>
            <path d="M15.2 8.4c.9.9 1.4 2.2 1.4 3.6s-.5 2.7-1.4 3.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            <path d="M17.6 6.2c1.5 1.5 2.4 3.6 2.4 5.8s-.9 4.3-2.4 5.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </>
        ) : (
          <path d="M16 9l4 6M20 9l-4 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        )}
      </svg>
    </button>
  );
}

function ResultScreen({ reading, question, audio }) {
  const playOracleAudio = () => {
    if (!audio?.base64) return;

    playOracleAudioBuffer(audio.base64).catch(() => {
      // Silent fallback if the browser still blocks or cannot decode audio.
    });
  };

  useEffect(() => {
    if (!audio?.base64) return undefined;

    const timer = window.setTimeout(() => {
      playOracleAudio();
    }, ORACLE_WAIT_MS);

    return () => {
      window.clearTimeout(timer);
      stopOracleAudioBuffer();
    };
  }, [audio]);

  const panels = [
    [question || "Question silencieuse"],
    ...reading.cards.map((item) => [
      `${item.cardName}.`,
      item.interpretation
    ]),
    [reading.crossReading],
    [reading.synthesis],
    [reading.oracleSentence]
  ];

  const [panelIndex, setPanelIndex] = useState(-1);
  const isLastPanel = panelIndex === panels.length - 1;

  useEffect(() => {
    const introTimer = window.setTimeout(() => {
      setPanelIndex(0);
    }, ORACLE_WAIT_MS);

    return () => window.clearTimeout(introTimer);
  }, []);

  useEffect(() => {
    if (panelIndex < 0 || isLastPanel) return undefined;

    const timer = window.setTimeout(() => {
      setPanelIndex((index) => Math.min(index + 1, panels.length - 1));
    }, ORACLE_PANEL_MS);

    return () => window.clearTimeout(timer);
  }, [panelIndex, isLastPanel, panels.length]);

  return (
    <main className="fixed inset-0 overflow-hidden bg-black text-stone-100" onPointerDown={playOracleAudio}>
      <OracleVideoBackground />

      <div className="pointer-events-none fixed inset-0 bg-gradient-to-b from-black/0 via-black/10 to-black/70" />

      {panelIndex < 0 ? (
        <motion.div
          className="fixed inset-x-0 bottom-[18vh] z-20 flex justify-center px-8 text-center"
          animate={{ opacity: [0.38, 1, 0.38], scale: [0.985, 1, 0.985] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <p className="text-3xl font-semibold text-white drop-shadow-[0_5px_18px_rgba(0,0,0,0.95)]">
            attends.
          </p>
        </motion.div>
      ) : (
        <section className="fixed bottom-0 left-0 right-0 z-20 flex h-[50vh] items-center justify-center px-7 pb-[max(2rem,env(safe-area-inset-bottom))] pt-8">
          <motion.div
            key={panelIndex}
            className="mx-auto max-w-[560px] text-center"
            initial={{ opacity: 0, y: 12, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, filter: "blur(10px)" }}
            transition={{ duration: 1.1, ease: "easeInOut" }}
          >
            {panels[panelIndex].map((line, index) => (
              <p
                key={`${panelIndex}-${index}`}
                className={[
                  "text-white drop-shadow-[0_5px_18px_rgba(0,0,0,0.95)]",
                  isLastPanel
                    ? "text-3xl font-semibold leading-10"
                    : index === 0 && panels[panelIndex].length > 1
                      ? "text-3xl font-semibold leading-10"
                      : "text-2xl font-medium leading-9"
                ].join(" ")}
              >
                {line}
              </p>
            ))}
          </motion.div>
        </section>
      )}
    </main>
  );
}

export default function App() {
  const [stage, setStage] = useState("home");
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [question, setQuestion] = useState("");
  const [drawnCards, setDrawnCards] = useState([]);
  const [currentCard, setCurrentCard] = useState(null);
  const [reading, setReading] = useState(null);
  const [audio, setAudio] = useState(null);
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
    setStage("signal");
  };

  const startRecording = (event) => {
    if (audioEnabled) unlockOracleAudio();
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
    if (audioEnabled) unlockOracleAudio();
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
          audioEnabled,
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

      return data;
    }

    async function generateReading() {
      setError(null);

      try {
        const result = await fetchReading();

        if (!cancelled) {
          setReading(result.reading);
          setAudio(result.audio || null);
        }
      } catch (err) {
        await wait(REVELATION_DISPLAY_MS);

        if (!cancelled) {
          setError(err.message);
          setReading(createFallbackReading(drawnCards, question));
          setAudio(null);
        }
      }
    }

    generateReading();

    return () => {
      cancelled = true;
    };
  }, [stage, drawnCards, question, audioEnabled]);

  useEffect(() => {
    if (stage === "revelation" && revelationEnded && reading) {
      setStage("result");
    }
  }, [stage, revelationEnded, reading]);


  const toggleAudio = () => {
    setAudioEnabled((enabled) => {
      const next = !enabled;

      if (next) {
        unlockOracleAudio();
      } else if (globalAudioRef.current) {
        globalAudioRef.current.pause();
        globalAudioRef.current.removeAttribute("src");
        globalAudioRef.current.dataset.unlocked = "false";
      }

      return next;
    });
  };

  const restart = () => {
    stopOracleAudioBuffer();

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
    setAudio(null);
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
        <ResultScreen reading={reading || createFallbackReading(drawnCards, question)} question={question} audio={audio} />
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

  return (
    <Background onClick={() => setStage("microphone")}>
      <AudioToggleButton enabled={audioEnabled} onToggle={toggleAudio} />
    </Background>
  );
}
