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
const VOICE_WAIT_TIMEOUT_MS = 15000;
const LONG_PRESS_MS = 2500;
const FADE_DURATION = 0.85;

function pickRandomCard(excluded = []) {
  const available = deck.filter((card) => !excluded.includes(card.slug));
  return available[Math.floor(Math.random() * available.length)];
}

const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";

function unlockAudioElement(audioElement) {
  if (!audioElement) return;

  audioElement.muted = false;
  audioElement.volume = 0.01;
  audioElement.src = SILENT_WAV;
  audioElement.load();

  const promise = audioElement.play();

  if (promise?.then) {
    promise
      .then(() => {
        audioElement.pause();
        audioElement.currentTime = 0;
        audioElement.volume = 1;
        audioElement.dataset.unlocked = "true";
      })
      .catch(() => {
        audioElement.dataset.unlocked = "false";
      });
  }
}

function base64ToObjectUrl(base64, mimeType = "audio/mpeg") {
  const binaryString = window.atob(base64);
  const length = binaryString.length;
  const bytes = new Uint8Array(length);

  for (let i = 0; i < length; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
}

function startBackgroundMusic(audioElement) {
  if (!audioElement) return;

  audioElement.loop = true;
  audioElement.muted = false;
  audioElement.volume = 0.34;

  if (!audioElement.src || !audioElement.src.includes("/audio/background.mp3")) {
    audioElement.src = "/audio/background.mp3?v=2";
  }

  const promise = audioElement.play();
  if (promise?.catch) {
    promise.catch(() => {
      // Mobile browsers may block audio until the user taps the sound icon again.
    });
  }
}

function stopBackgroundMusic(audioElement) {
  if (!audioElement) return;
  audioElement.pause();
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
  const [visible, setVisible] = useState(false);
  const endedRef = useRef(false);
  const fallbackTimerRef = useRef(null);

  useEffect(() => {
    endedRef.current = false;
    setVisible(false);

    window.clearTimeout(fallbackTimerRef.current);
    fallbackTimerRef.current = window.setTimeout(() => {
      if (!endedRef.current) {
        endedRef.current = true;
        onEnded();
      }
    }, 6500);

    return () => {
      window.clearTimeout(fallbackTimerRef.current);
    };
  }, [onEnded]);

  const handleReady = () => {
    setVisible(true);
  };

  const handleEnded = () => {
    if (endedRef.current) return;
    endedRef.current = true;
    window.clearTimeout(fallbackTimerRef.current);
    onEnded();
  };

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
        src="/videos/revelation.mp4?v=10"
        className="fixed inset-0 h-full w-full object-cover"
        autoPlay
        muted
        playsInline
        preload="auto"
        onLoadedData={handleReady}
        onCanPlay={handleReady}
        onEnded={handleEnded}
        initial={{ opacity: 0 }}
        animate={{ opacity: visible ? 1 : 0 }}
        transition={{ duration: 1.2, ease: "easeInOut" }}
      />
    </main>
  );
}

function OracleVideoBackground() {
  const videoRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    video.load();

    const playPromise = video.play();
    if (playPromise?.catch) {
      playPromise.catch(() => {
        // The black background remains if autoplay is blocked.
      });
    }

    return undefined;
  }, []);

  const handleReady = () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      video.play();
    } catch {
      // Ignore playback errors.
    }

    setReady(true);
  };

  return (
    <>
      <img
        src="/images/revelation-final.png"
        alt=""
        className="fixed inset-0 h-full w-full object-cover"
      />

      <motion.video
        ref={videoRef}
        src="/videos/oracle.mp4?v=5"
        className="fixed inset-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        onLoadedData={handleReady}
        onCanPlay={handleReady}
        initial={{ opacity: 0 }}
        animate={{ opacity: ready ? 1 : 0 }}
        transition={{ duration: 1.2, ease: "easeInOut" }}
      />
    </>
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


function LongPressDrawScreen({ onDraw }) {
  const [isPressing, setIsPressing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const timerRef = useRef(null);

  const clearPress = () => {
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const startPress = (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (event.currentTarget.setPointerCapture && event.pointerId !== undefined) {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Ignore pointer capture errors.
      }
    }

    clearPress();
    setIsPressing(true);
    setIsReady(false);

    timerRef.current = window.setTimeout(() => {
      setIsReady(true);
    }, LONG_PRESS_MS);
  };

  const endPress = (event) => {
    event.preventDefault();
    event.stopPropagation();

    const ready = isReady;
    clearPress();
    setIsPressing(false);
    setIsReady(false);

    if (ready) {
      onDraw();
    }
  };

  const cancelPress = (event) => {
    event.preventDefault();
    event.stopPropagation();

    clearPress();
    setIsPressing(false);
    setIsReady(false);
  };

  useEffect(() => {
    return () => clearPress();
  }, []);

  return (
    <Background>
      <motion.div
        className="pointer-events-none fixed inset-0 z-20"
        initial={false}
        animate={{
          opacity: isPressing ? 1 : 0,
          scale: isPressing ? 1.02 : 1
        }}
        transition={{ duration: isPressing ? LONG_PRESS_MS / 1000 : 0.55, ease: "easeInOut" }}
        style={{
          backdropFilter: isReady
            ? "invert(1) contrast(1.25) saturate(1.35)"
            : "invert(0.55) contrast(1.1) saturate(1.15)",
          WebkitBackdropFilter: isReady
            ? "invert(1) contrast(1.25) saturate(1.35)"
            : "invert(0.55) contrast(1.1) saturate(1.15)"
        }}
      />

      <motion.div
        className="pointer-events-none fixed inset-0 z-20 bg-white/0"
        animate={
          isPressing
            ? { opacity: [0.05, 0.18, 0.05] }
            : { opacity: 0 }
        }
        transition={{
          duration: 1.6,
          repeat: isPressing ? Infinity : 0,
          ease: "easeInOut"
        }}
        style={{ mixBlendMode: "overlay" }}
      />

      <button
        type="button"
        aria-label="Tirer"
        className="fixed inset-0 z-30 cursor-default touch-none"
        onPointerDown={startPress}
        onPointerUp={endPress}
        onPointerCancel={cancelPress}
        onPointerLeave={cancelPress}
      />
    </Background>
  );
}


function MouthButton({ status, onClick }) {
  const isLoading = status === "loading";
  const isPlaying = status === "playing";

  return (
    <motion.button
      type="button"
      aria-label="Lire l’oracle"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
      className="fixed left-1/2 z-40 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full border border-white/60 shadow-[0_0_32px_rgba(255,255,255,0.22)] backdrop-blur-md active:scale-95"
      style={{
        bottom: "calc(50vh + 1.25rem)",
        backgroundColor: isPlaying ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.54)",
        color: isPlaying ? "black" : "white"
      }}
      animate={
        isLoading
          ? { opacity: [0.42, 1, 0.42], scale: [0.98, 1.04, 0.98], x: "-50%" }
          : { opacity: 1, scale: 1, x: "-50%" }
      }
      transition={
        isLoading
          ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
          : { duration: 0.25, ease: "easeOut" }
      }
    >
      <svg width="31" height="20" viewBox="0 0 64 38" fill="none" aria-hidden="true">
        <path
          d="M6 19C14 7.5 22.5 5 32 12C41.5 5 50 7.5 58 19C50 30.5 41.5 33 32 26C22.5 33 14 30.5 6 19Z"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinejoin="round"
        />
        <path
          d="M9 19H55"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {isPlaying ? (
          <path
            d="M23 24C28.5 29 35.5 29 41 24"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        ) : null}
      </svg>
    </motion.button>
  );
}

function ResultScreen({ reading, question, musicPlayer }) {
  const [voiceStatus, setVoiceStatus] = useState("idle");
  const [voiceStarted, setVoiceStarted] = useState(false);
  const [voiceFailed, setVoiceFailed] = useState(false);
  const voiceAudioRef = useRef(null);
  const voiceUrlRef = useRef(null);
  const fallbackTimerRef = useRef(null);

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
  const shouldShowVoiceWaiting = voiceStatus === "loading" && panelIndex < 0;

  const startPanels = () => {
    setVoiceStarted(true);
    setPanelIndex((index) => (index < 0 ? 0 : index));
  };

  useEffect(() => {
    if (panelIndex < 0 || isLastPanel) return undefined;

    const timer = window.setTimeout(() => {
      setPanelIndex((index) => Math.min(index + 1, panels.length - 1));
    }, ORACLE_PANEL_MS);

    return () => window.clearTimeout(timer);
  }, [panelIndex, isLastPanel, panels.length]);

  useEffect(() => {
    return () => {
      window.clearTimeout(fallbackTimerRef.current);

      if (voiceAudioRef.current) {
        voiceAudioRef.current.pause();
      }

      if (voiceUrlRef.current) {
        URL.revokeObjectURL(voiceUrlRef.current);
        voiceUrlRef.current = null;
      }

      if (musicPlayer) {
        musicPlayer.volume = 0.34;
      }
    };
  }, [musicPlayer]);

  const playOracleVoice = async () => {
    if (voiceStatus === "loading" || voiceStarted) return;

    setVoiceStatus("loading");
    setVoiceFailed(false);

    if (musicPlayer) {
      musicPlayer.volume = 0.12;
    }

    fallbackTimerRef.current = window.setTimeout(() => {
      setVoiceFailed(true);
      setVoiceStatus("timeout");
      startPanels();

      if (musicPlayer) {
        musicPlayer.volume = 0.34;
      }
    }, VOICE_WAIT_TIMEOUT_MS);

    const controller = new AbortController();

    try {
      const response = await fetch("/api/oracle-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, reading }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error("Audio unavailable");
      }

      const audioBlob = await response.blob();

      if (voiceUrlRef.current) {
        URL.revokeObjectURL(voiceUrlRef.current);
      }

      const audioUrl = URL.createObjectURL(audioBlob);
      voiceUrlRef.current = audioUrl;

      const audio = new Audio(audioUrl);
      audio.preload = "auto";
      audio.volume = 1;

      voiceAudioRef.current = audio;

      audio.onended = () => {
        setVoiceStatus("done");

        if (musicPlayer) {
          musicPlayer.volume = 0.34;
        }
      };

      audio.onerror = () => {
        setVoiceFailed(true);
        setVoiceStatus("error");
        startPanels();

        if (musicPlayer) {
          musicPlayer.volume = 0.34;
        }
      };

      const playPromise = audio.play();

      if (playPromise?.catch) {
        await playPromise;
      }

      window.clearTimeout(fallbackTimerRef.current);
      setVoiceStatus("playing");
      startPanels();
    } catch (error) {
      window.clearTimeout(fallbackTimerRef.current);
      setVoiceFailed(true);
      setVoiceStatus("error");
      startPanels();

      if (musicPlayer) {
        musicPlayer.volume = 0.34;
      }
    }

    return () => {
      controller.abort();
    };
  };

  return (
    <main className="fixed inset-0 overflow-hidden bg-black text-stone-100">
      <OracleVideoBackground />

      <div className="pointer-events-none fixed inset-0 bg-gradient-to-b from-black/0 via-black/10 to-black/70" />

      {!voiceStarted ? (
        <MouthButton status={voiceStatus} onClick={playOracleVoice} />
      ) : null}

      {shouldShowVoiceWaiting ? (
        <motion.div
          className="fixed left-1/2 z-30 -translate-x-1/2 text-center"
          style={{ bottom: "calc(50vh + 5.1rem)" }}
          animate={{ opacity: [0.35, 1, 0.35] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <p className="text-2xl font-semibold text-white drop-shadow-[0_5px_18px_rgba(0,0,0,0.95)]">
            attends.
          </p>
        </motion.div>
      ) : null}

      {voiceFailed && panelIndex >= 0 ? (
        <motion.div
          className="fixed left-1/2 z-30 -translate-x-1/2 text-center"
          style={{ bottom: "calc(50vh + 1.25rem)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.72 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <p className="text-sm uppercase tracking-[0.26em] text-white/70 drop-shadow-[0_4px_14px_rgba(0,0,0,0.9)]">
            silence.
          </p>
        </motion.div>
      ) : null}

      {panelIndex >= 0 ? (
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
      ) : null}
    </main>
  );
}

export default function App() {
  const backgroundMusicRef = useRef(null);

  if (!backgroundMusicRef.current && typeof Audio !== "undefined") {
    backgroundMusicRef.current = new Audio("/audio/background.mp3?v=2");
    backgroundMusicRef.current.loop = true;
    backgroundMusicRef.current.preload = "auto";
    backgroundMusicRef.current.volume = 0.34;
  }

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
        startBackgroundMusic(backgroundMusicRef.current);
      } else {
        stopBackgroundMusic(backgroundMusicRef.current);
      }

      return next;
    });
  };

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
        <ResultScreen reading={reading || createFallbackReading(drawnCards, question)} question={question} musicPlayer={backgroundMusicRef.current} />
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
    return <LongPressDrawScreen onDraw={drawNextCard} />;
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
    <Background onClick={() => {
      if (audioEnabled) startBackgroundMusic(backgroundMusicRef.current);
      setStage("microphone");
    }}>
      <AudioToggleButton enabled={audioEnabled} onToggle={toggleAudio} />
    </Background>
  );
}
