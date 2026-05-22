import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { deck, positions } from "./cards";

const DRAW_TARGET = 3;
const QUESTION_DISPLAY_MS = 5000;
const NEGATIVE_SIGNAL_MS = 5000;
const CARD_FADE_MS = 6000;
const FALLBACK_CARD_DURATION_MS = 5000;
const REVELATION_DISPLAY_MS = 5000;
const ORACLE_WAIT_MS = 3600;
const ORACLE_PANEL_MS = 9000;
const SWIPE_UP_THRESHOLD = 105;
const FADE_DURATION = 0.85;

function pickRandomCard(excluded = []) {
  const available = deck.filter((card) => !excluded.includes(card.slug));
  return available[Math.floor(Math.random() * available.length)];
}

function preloadEssentialMedia() {
  if (typeof window === "undefined") return;

  const videoSources = [
    "/videos/cards/fond-graphique.mp4",
    "/videos/revelation.mp4?v=10",
    "/videos/oracle.mp4?v=5"
  ];

  videoSources.forEach((source) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.src = source;
    video.load();
  });

  const audio = new Audio("/audio/background.mp3?v=3");
  audio.preload = "auto";
}
function PersistentFond() {
  return (
    <video
      src="/videos/cards/fond-graphique.mp4"
      poster="/images/cards/fond-graphique.jpg"
      className="fixed inset-0 z-0 h-full w-full object-cover"
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
    />
  );
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
    audioElement.src = "/audio/background.mp3?v=3";
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


function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function normalizeCardLabel(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getCardClavis(card) {
  const searchable = normalizeCardLabel(`${card.name || ""} ${card.slug || ""}`);

  if (searchable.includes("petite") && searchable.includes("merde")) {
    return {
      key: "Majeur en la mineur",
      description:
        "Carte de résilience modeste : joie dans la douleur, dignité minuscule, rire sec au milieu de l’adversité."
    };
  }

  if (searchable.includes("oasis")) {
    return {
      key: "La carte ou le territoire",
      description:
        "Carte du conflit entre foyer et aventure : explorer, structurer, puis parfois détruire ce qui rassurait trop."
    };
  }

  if (searchable.includes("huitre") || searchable.includes("huitres")) {
    return {
      key: card.key || "Le nacre et le profit",
      description:
        "Carte du succès professionnel, de l’appât du gain et du plaisir froid : elle ouvre ce qui brille, mais coupe parfois les doigts."
    };
  }

  if (searchable.includes("ecran")) {
    return {
      key: card.key || "La volonté de plaire",
      description:
        "Carte du regard captif : elle parle du désir d’être vu, validé, choisi, et de la fatigue douce que cela impose."
    };
  }

  if (searchable.includes("excel")) {
    return {
      key: card.key || "La tentation de la norme",
      description:
        "Carte du retour au rang : elle signale le risque de rebasculer dans une vie morne de travailleur, bien rangée, bien triste."
    };
  }

  if (searchable.includes("noah")) {
    return {
      key: card.key || "Le jardin secret",
      description:
        "Carte de la parenthèse enchantée : un lieu à l’écart du monde, fragile, intime, presque enfantin, où l’on respire sans rendre de comptes."
    };
  }

  if (searchable.includes("bambou")) {
    return {
      key: card.key || "Le pacte amical",
      description:
        "Carte du contrat tacite : elle évoque l’alliance, le pacte entre amis, la promesse tenue sans notaire et parfois sans sobriété."
    };
  }

  const key = card.key || card.tags?.[0] || "Signe ouvert";
  const description =
    card.promptHint ||
    (Array.isArray(card.tags) && card.tags.length
      ? `Carte de ${card.tags.slice(0, 3).join(", ")} : elle déplace le regard et force un choix moins confortable.`
      : "Carte de déplacement intérieur : elle indique une tension, une faille ou un passage à interpréter sans folklore.");

  return { key, description };
}

function ActionButtons({ onIterum, onClaves, onFigurae, compact = false }) {
  const buttonClass = [
    "border border-current bg-transparent tracking-[0.16em] uppercase backdrop-blur-md active:scale-95",
    compact ? "px-2.5 py-1.5 text-[9px]" : "px-3 py-2 text-[10px]"
  ].join(" ");

  return (
    <div className="flex items-center justify-center gap-2">
      {onIterum ? (
        <button type="button" onClick={onIterum} className={buttonClass}>
          Iterum
        </button>
      ) : null}
      {onClaves ? (
        <button type="button" onClick={onClaves} className={buttonClass}>
          Claves
        </button>
      ) : null}
      {onFigurae ? (
        <button type="button" onClick={onFigurae} className={buttonClass}>
          Figurae
        </button>
      ) : null}
    </div>
  );
}

function ClavesScreen({ onIterum, onFigurae }) {
  return (
    <motion.main
      className="fixed inset-0 overflow-y-auto bg-white px-7 pb-28 pt-[max(2rem,env(safe-area-inset-top))] text-center text-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: FADE_DURATION, ease: "easeInOut" }}
    >
      <div className="mx-auto max-w-[680px]">
        <h1 className="mb-8 text-center text-4xl font-semibold tracking-[0.08em]">Claves</h1>

        <div className="space-y-8">
          {deck.map((card, index) => {
            const clavis = getCardClavis(card);

            return (
              <article key={card.slug || card.name} className="pt-1">
                {index > 0 ? (
                  <img
                    src="/images/ornament-separator.png"
                    alt=""
                    className="mx-auto mb-7 h-auto max-w-[70px] opacity-90"
                    loading="lazy"
                  />
                ) : null}

                <h2 className="text-2xl font-semibold leading-tight">{card.name}</h2>
                <p className="mt-1 text-sm uppercase tracking-[0.18em] text-black/55">{clavis.key}</p>
                <p className="mx-auto mt-3 max-w-[540px] text-xl leading-8 text-black/88">{clavis.description}</p>
              </article>
            );
          })}
        </div>
      </div>

      <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-0 right-0 z-30 text-black">
        <ActionButtons onIterum={onIterum} onFigurae={onFigurae} compact />
      </div>
    </motion.main>
  );
}

function FiguraeScreen({ onIterum, onClaves }) {
  const [selectedCard, setSelectedCard] = useState(null);
  const [isClosingCard, setIsClosingCard] = useState(false);

  const closeSelectedCard = () => {
    setIsClosingCard(true);

    window.setTimeout(() => {
      setSelectedCard(null);
      setIsClosingCard(false);
    }, FADE_DURATION * 1000);
  };

  useEffect(() => {
    if (!selectedCard) return undefined;

    setIsClosingCard(false);

    const timer = window.setTimeout(() => {
      closeSelectedCard();
    }, 7000);

    return () => window.clearTimeout(timer);
  }, [selectedCard]);

  return (
    <motion.main
      className="fixed inset-0 overflow-y-auto bg-black px-4 pb-24 pt-[max(1.25rem,env(safe-area-inset-top))] text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: FADE_DURATION, ease: "easeInOut" }}
    >
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {deck.map((card) => (
          <button
            key={card.slug || card.name}
            type="button"
            className="overflow-hidden border border-white/12 bg-white/5 active:scale-[0.985]"
            onClick={() => setSelectedCard(card)}
          >
            <img
              src={card.imageFace}
              alt={card.name}
              className="aspect-[9/16] h-full w-full object-cover"
              loading="lazy"
            />
          </button>
        ))}
      </div>

      <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-0 right-0 z-30 text-white">
        <ActionButtons onIterum={onIterum} onClaves={onClaves} compact />
      </div>

      {selectedCard ? (
        <motion.div
          className="fixed inset-0 z-50 bg-black"
          initial={{ opacity: 0 }}
          animate={{ opacity: isClosingCard ? 0 : 1 }}
          transition={{ duration: FADE_DURATION, ease: "easeInOut" }}
          onClick={closeSelectedCard}
        >
          <video
            key={selectedCard.slug}
            src={selectedCard.videoFace}
            poster={selectedCard.imageFace}
            className="h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
          />
        </motion.div>
      ) : null}
    </motion.main>
  );
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
    oracleSentence: "Le signe frappe moins fort quand on arrête de lui servir à boire.",
    action: "Sors marcher dix minutes sans regarder ton téléphone."
  };
}

function Background({ onClick, children, negativeSignal = false }) {
  return (
    <main className="fixed inset-0 z-10 overflow-hidden text-stone-100" onClick={onClick}>
      <motion.div
        className="pointer-events-none absolute inset-0 z-0"
        initial={false}
        animate={
          negativeSignal
            ? { opacity: [1, 1, 0] }
            : { opacity: 0 }
        }
        transition={
          negativeSignal
            ? { duration: 5, times: [0, 0.4, 1], ease: "linear" }
            : { duration: 0 }
        }
        style={{
          backdropFilter: "invert(1)",
          WebkitBackdropFilter: "invert(1)"
        }}
      />
      <div className="absolute inset-0 z-0 bg-black/5" />
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
    <main className="fixed inset-0 z-20 overflow-hidden">

      <motion.video
        key={card.slug}
        src={card.videoFace}
        poster={card.imageFace}
        className="fixed inset-0 z-20 h-full w-full object-cover"
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
    <main className="fixed inset-0 z-20 overflow-hidden">

      <motion.video
        src="/videos/revelation.mp4?v=10"
        className="fixed inset-0 z-20 h-full w-full object-cover"
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
        src="/videos/oracle.mp4?v=6"
        className="fixed inset-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        onLoadedData={handleReady}
        onCanPlay={handleReady}
        initial={{ opacity: 0, filter: "blur(8px)" }}
        animate={{ opacity: ready ? 1 : 0, filter: ready ? "blur(0px)" : "blur(8px)" }}
        transition={{ duration: 2.2, ease: "easeInOut" }}
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


function SwipeUpDrawScreen({ onDraw }) {
  const startYRef = useRef(null);
  const hasDrawnRef = useRef(false);

  const resetSwipe = () => {
    startYRef.current = null;
    hasDrawnRef.current = false;
  };

  const startSwipe = (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (event.currentTarget.setPointerCapture && event.pointerId !== undefined) {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Ignore pointer capture errors.
      }
    }

    startYRef.current = event.clientY;
    hasDrawnRef.current = false;
  };

  const moveSwipe = (event) => {
    if (startYRef.current === null || hasDrawnRef.current) return;

    event.preventDefault();
    event.stopPropagation();

    const deltaY = startYRef.current - event.clientY;

    if (deltaY >= SWIPE_UP_THRESHOLD) {
      hasDrawnRef.current = true;
      onDraw();
    }
  };

  const endSwipe = (event) => {
    event.preventDefault();
    event.stopPropagation();
    resetSwipe();
  };

  const cancelSwipe = (event) => {
    event.preventDefault();
    event.stopPropagation();
    resetSwipe();
  };

  return (
    <Background>
      <button
        type="button"
        aria-label="Tirer"
        className="fixed inset-0 z-30 cursor-default touch-none select-none"
        style={{
          WebkitUserSelect: "none",
          userSelect: "none",
          WebkitTouchCallout: "none",
          touchAction: "none"
        }}
        onPointerDown={startSwipe}
        onPointerMove={moveSwipe}
        onPointerUp={endSwipe}
        onPointerCancel={cancelSwipe}
        onPointerLeave={cancelSwipe}
      />
    </Background>
  );
}

function ResultScreen({ reading, question, onShowClaves, onShowFigurae }) {
  const panels = [
    { type: "question", lines: [question || "Question silencieuse"] },
    ...reading.cards.map((item) => ({
      type: "card",
      lines: [`${item.cardName}.`, item.interpretation]
    })),
    { type: "cross", lines: [reading.crossReading] },
    { type: "synthesis", lines: [reading.synthesis] },
    { type: "oracle", lines: [reading.oracleSentence] },
    {
      type: "action",
      lines: [
        reading.action ||
          "Reprends un verre d’eau, pose ton téléphone, et fais enfin ce que tu repousses depuis trois semaines."
      ]
    }
  ];

  const [panelIndex, setPanelIndex] = useState(-1);
  const currentPanel = panelIndex >= 0 ? panels[panelIndex] : null;
  const isLastPanel = panelIndex === panels.length - 1;

  const replayPanels = () => {
    setPanelIndex(-1);

    window.setTimeout(() => {
      setPanelIndex(0);
    }, 450);
  };

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

  const getLineClass = (index, panel) => {
    const base = "text-white drop-shadow-[0_5px_18px_rgba(0,0,0,0.95)]";

    if (panel.type === "question") {
      return `${base} text-xl font-medium leading-8`;
    }

    if (panel.type === "action") {
      return `${base} text-2xl font-semibold leading-9`;
    }

    if (panel.type === "oracle") {
      return `${base} text-3xl font-semibold leading-10`;
    }

    if (index === 0 && panel.lines.length > 1) {
      return `${base} text-3xl font-semibold leading-10`;
    }

    return `${base} text-2xl font-medium leading-9`;
  };

  return (
    <motion.main
      className="fixed inset-0 overflow-hidden bg-black text-stone-100"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: FADE_DURATION, ease: "easeInOut" }}
    >
      <OracleVideoBackground />

      <div className="pointer-events-none fixed inset-0 bg-gradient-to-b from-black/0 via-black/10 to-black/70" />

      {panelIndex < 0 ? (
        <section className="fixed bottom-0 left-0 right-0 z-20 flex h-[50vh] items-center justify-center px-7 pb-[max(2rem,env(safe-area-inset-bottom))] pt-8">
          <motion.div
            className="mx-auto max-w-[560px] text-center"
            animate={{ opacity: [0.38, 1, 0.38], scale: [0.985, 1, 0.985] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
          >
            <p className="text-3xl font-semibold text-white drop-shadow-[0_5px_18px_rgba(0,0,0,0.95)]">
              Attends.
            </p>
          </motion.div>
        </section>
      ) : (
        <section className="fixed bottom-0 left-0 right-0 z-20 flex h-[50vh] items-center justify-center px-7 pb-[max(2rem,env(safe-area-inset-bottom))] pt-8">
          <motion.div
            key={panelIndex}
            className={[
              "mx-auto max-w-[560px] text-center",
              currentPanel?.type === "question"
                ? "max-h-[42vh] overflow-y-auto overscroll-contain pr-1"
                : ""
            ].join(" ")}
            initial={{ opacity: 0, y: 12, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, filter: "blur(10px)" }}
            transition={{ duration: 1.1, ease: "easeInOut" }}
          >
            {currentPanel.lines.map((line, index) => (
              <p
                key={`${panelIndex}-${index}`}
                className={getLineClass(index, currentPanel)}
              >
                {line}
              </p>
            ))}

            {isLastPanel ? (
              <motion.div
                className="mt-8 text-white"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: FADE_DURATION, ease: "easeInOut" }}
              >
                <ActionButtons
                  onIterum={replayPanels}
                  onClaves={onShowClaves}
                  onFigurae={onShowFigurae}
                />
              </motion.div>
            ) : null}
          </motion.div>
        </section>
      )}
    </motion.main>
  );
}

export default function App() {
  const backgroundMusicRef = useRef(null);

  if (!backgroundMusicRef.current && typeof Audio !== "undefined") {
    backgroundMusicRef.current = new Audio("/audio/background.mp3?v=3");
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

  useEffect(() => {
    preloadEssentialMedia();
  }, []);

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

  const withFond = (content) => (
    <>
      <PersistentFond />
      {content}
    </>
  );

  if (stage === "claves") {
    return (
      <ClavesScreen
        onIterum={() => setStage("result")}
        onFigurae={() => setStage("figurae")}
      />
    );
  }

  if (stage === "figurae") {
    return (
      <FiguraeScreen
        onIterum={() => setStage("result")}
        onClaves={() => setStage("claves")}
      />
    );
  }

  if (stage === "result") {
    return (
      <>
        {error ? (
          <div className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+12px)] z-50 w-[calc(100%-32px)] max-w-[430px] -translate-x-1/2 rounded-2xl border border-amber-600/60 bg-amber-100/92 px-4 py-3 text-sm text-amber-950 shadow-xl backdrop-blur">
            Lecture locale affichée : {error}
          </div>
        ) : null}
        <ResultScreen
          reading={reading || createFallbackReading(drawnCards, question)}
          question={question}
          onShowClaves={() => setStage("claves")}
          onShowFigurae={() => setStage("figurae")}
        />
      </>
    );
  }

  if (stage === "revelation") {
    return withFond(<RevelationVideo onEnded={() => setRevelationEnded(true)} />);
  }

  if (stage === "cardReveal" && currentCard) {
    return withFond(<TimedCardVideo card={currentCard} onDone={completeCardReveal} />);
  }

  if (stage === "awaitingDraw") {
    return withFond(<SwipeUpDrawScreen onDraw={drawNextCard} />);
  }

  if (stage === "signal") {
    return withFond(<Background negativeSignal />);
  }

  if (stage === "question") {
    return withFond(
      <Background>
        <QuestionOverlay question={question} />
      </Background>
    );
  }

  if (stage === "microphone") {
    return withFond(
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

  return withFond(
    <Background onClick={() => {
      if (audioEnabled) startBackgroundMusic(backgroundMusicRef.current);
      setStage("microphone");
    }}>
      <AudioToggleButton enabled={audioEnabled} onToggle={toggleAudio} />
    </Background>
  );
}
