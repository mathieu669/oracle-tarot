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

function preloadHomeMedia() {
  if (typeof window === "undefined") return Promise.resolve();

  const videoSources = [
    "/videos/cards/fond-graphique.mp4",
    "/videos/revelation.mp4?v=10",
    "/videos/oracle.mp4?v=5",
    "/videos/oracle.mp4?v=6"
  ];

  const imageSources = [
    "/images/revelation-final.png",
    "/images/nox-icon.png",
    "/images/ornament-separator.png",
    "/images/fatum/calvaria.png",
    "/images/fatum/manus.png",
    "/images/fatum/maleficium.png",
    "/images/fatum/oculus.png"
  ];

  const videoPromises = videoSources.map((source) =>
    new Promise((resolve) => {
      const video = document.createElement("video");
      video.preload = "auto";
      video.muted = true;
      video.playsInline = true;
      video.src = source;

      const done = () => resolve();
      video.addEventListener("canplaythrough", done, { once: true });
      video.addEventListener("loadeddata", done, { once: true });
      video.addEventListener("error", done, { once: true });
      video.load();

      window.setTimeout(done, 1800);
    })
  );

  const imagePromises = imageSources.map((source) =>
    new Promise((resolve) => {
      const image = new Image();
      image.onload = resolve;
      image.onerror = resolve;
      image.src = source;
    })
  );

  const audioPromise = new Promise((resolve) => {
    const audio = new Audio("/audio/background.mp3?v=3");
    audio.preload = "auto";
    audio.addEventListener("canplaythrough", resolve, { once: true });
    audio.addEventListener("error", resolve, { once: true });
    audio.load();
    window.setTimeout(resolve, 1800);
  });

  return Promise.all([...videoPromises, ...imagePromises, audioPromise]);
}

const DEV_USERS = ["Mathieu", "Jonathan", "Jean-Philippe", "Rémi", "Brice", "Antoine", "Fred", "Johan"];
const ROMAN_KEYS = ["I", "V", "X", "L", "C", "D", "M"];

function DevLatinHome({ onStage, onVerbatim }) {
  const [phase, setPhase] = useState("loading");
  const [selectedUser, setSelectedUser] = useState("");
  const [romanPass, setRomanPass] = useState("");
  const [email, setEmail] = useState("");
  const [notifications, setNotifications] = useState(true);
  const [spaceLoading, setSpaceLoading] = useState(false);
  const [spaceSummary, setSpaceSummary] = useState({ fatum: "—", archives: "—" });
  const [isRegisteredUser, setIsRegisteredUser] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const minimum = new Promise((resolve) => window.setTimeout(resolve, 1350));

    Promise.all([preloadHomeMedia(), minimum]).then(() => {
      if (!cancelled) setPhase("users");
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const readDevUsers = () => {
    try {
      const raw = window.localStorage.getItem("nox:dev-users");
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  };

  const readDevUser = (userName) => {
    const users = readDevUsers();
    const registered = users[userName];

    if (registered) return registered;

    try {
      const legacyRaw = window.localStorage.getItem("nox:dev-user");
      const legacy = legacyRaw ? JSON.parse(legacyRaw) : null;

      if (legacy?.name === userName) return legacy;
    } catch {
      // Ignore legacy parsing.
    }

    return null;
  };

  const writeDevUser = (entry) => {
    const users = readDevUsers();
    const nextUsers = {
      ...users,
      [entry.name]: entry
    };

    window.localStorage.setItem("nox:dev-users", JSON.stringify(nextUsers));
    window.localStorage.setItem("nox:dev-user", JSON.stringify(entry));
  };

  const loadUserSpace = () => {
    setSpaceLoading(true);
    setSpaceSummary({ fatum: "—", archives: "—" });

    Promise.allSettled([fetchServerFatumUsers(), fetchServerArchives()])
      .then(([fatumResult, archiveResult]) => {
        const users = fatumResult.status === "fulfilled" ? fatumResult.value : readFatumUsers();
        const archives = archiveResult.status === "fulfilled" ? archiveResult.value : readBullaArchives();
        const matchedUser = users.find((user) => user.name?.toLowerCase() === selectedUser.toLowerCase());

        if (matchedUser?.id) {
          window.localStorage.setItem(FATUM_ACTIVE_USER_KEY, matchedUser.id);
        }

        setSpaceSummary({
          fatum: Number.isFinite(Number(matchedUser?.score)) ? Math.round(Number(matchedUser.score)) : 0,
          archives: Array.isArray(archives) ? archives.length : 0
        });
      })
      .finally(() => {
        window.setTimeout(() => {
          setSpaceLoading(false);
          setPhase("space");
        }, 450);
      });
  };

  const chooseUser = (userName) => {
    const registered = readDevUser(userName);

    setSelectedUser(userName);
    setRomanPass("");
    setEmail("");
    setIsRegisteredUser(Boolean(registered));
    setNotifications(registered?.notifications ?? true);
    setPhase("pass");
  };

  const addRoman = (symbol) => {
    setRomanPass((value) => (value.length >= 8 ? value : `${value}${symbol}`));
  };

  const removeRoman = () => {
    setRomanPass((value) => value.slice(0, -1));
  };

  const submitPass = () => {
    if (romanPass.length < 5) return;

    if (isRegisteredUser) {
      loadUserSpace();
      return;
    }

    setPhase("email");
  };

  const submitEmail = () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) return;

    writeDevUser({
      name: selectedUser,
      pass: romanPass,
      email: trimmed,
      notifications,
      createdAt: new Date().toISOString()
    });

    setIsRegisteredUser(true);
    loadUserSpace();
  };

  const bottomNav = (
    <div className="fixed bottom-[max(2.25rem,calc(env(safe-area-inset-bottom)+1.25rem))] left-0 right-0 z-30 text-black">
      <ActionButtons
        onIterum={() => onStage("divinatio")}
        onClaves={() => onStage("claves")}
        onNoctem={() => onStage("noctem")}
        onVerbatim={onVerbatim}
        onDuodecim={() => onStage("duodecim")}
        onBulla={() => onStage("bulla")}
        onArchive={() => onStage("archives")}
        onFatum={() => onStage("fatum")}
        onSalvatio={() => onStage("salvatio")}
        active=""
        compact
      />
    </div>
  );

  return (
    <main className="fixed inset-0 overflow-hidden bg-white text-black">
      {phase === "loading" ? (
        <motion.section
          className="flex h-full flex-col items-center justify-center px-6 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.1, ease: "easeInOut" }}
        >
          <motion.h1
            className="select-none text-5xl font-semibold tracking-[0.08em]"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.25, ease: "easeInOut" }}
          >
            Nox.
          </motion.h1>
          <motion.p
            className="mt-5 select-none text-[10px] uppercase tracking-[0.22em] text-black/40"
            animate={{ opacity: [0.35, 0.85, 0.35] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          >
            Onerat.
          </motion.p>
        </motion.section>
      ) : null}

      {phase === "users" ? (
        <motion.section
          className="flex h-full flex-col items-center justify-center px-6 pb-24 text-center"
          initial={{ opacity: 0, filter: "blur(12px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 1.1, ease: "easeInOut" }}
        >
          <p className="mb-7 select-none text-[10px] uppercase tracking-[0.22em] text-black/38">Socius.</p>
          <div className="grid w-full max-w-[17rem] grid-cols-1 gap-2">
            {DEV_USERS.map((userName) => (
              <button
                key={userName}
                type="button"
                className="select-none border border-black/28 bg-white px-4 py-2.5 text-sm tracking-[0.08em] active:bg-black active:text-white"
                onClick={() => chooseUser(userName)}
              >
                {userName}
              </button>
            ))}
          </div>
        </motion.section>
      ) : null}

      {phase === "pass" ? (
        <motion.section
          className="flex h-full flex-col items-center justify-center px-6 pb-24 text-center"
          initial={{ opacity: 0, filter: "blur(12px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.85, ease: "easeInOut" }}
        >
          <p className="select-none text-[10px] uppercase tracking-[0.22em] text-black/38">Signum.</p>
          <h2 className="mt-3 select-none text-2xl font-semibold tracking-[0.08em]">{selectedUser}</h2>
          <div className="mt-6 flex h-10 items-center justify-center gap-1.5">
            {Array.from({ length: Math.max(8, romanPass.length) }).slice(0, 8).map((_, index) => (
              <span
                key={`roman-dot-${index}`}
                className={[
                  "flex h-7 w-7 items-center justify-center border text-[10px] tracking-[0.08em]",
                  romanPass[index] ? "border-black bg-black text-white" : "border-black/18 text-transparent"
                ].join(" ")}
              >
                {romanPass[index] || "·"}
              </span>
            ))}
          </div>
          <p className="mt-2 select-none text-[9px] uppercase tracking-[0.18em] text-black/35">V–VIII.</p>

          <div className="mt-7 grid grid-cols-4 gap-2">
            {ROMAN_KEYS.map((symbol) => (
              <button
                key={symbol}
                type="button"
                className="h-12 w-12 select-none border border-black bg-white text-lg tracking-[0.08em] active:bg-black active:text-white"
                onClick={() => addRoman(symbol)}
              >
                {symbol}
              </button>
            ))}
            <button
              type="button"
              className="h-12 w-12 select-none border border-black/35 bg-white text-xs uppercase tracking-[0.08em] text-black/52 active:bg-black active:text-white"
              onClick={removeRoman}
            >
              Del.
            </button>
          </div>

          <button
            type="button"
            className="mt-7 select-none border border-black bg-black px-5 py-2 text-[10px] uppercase tracking-[0.16em] text-white disabled:opacity-25"
            disabled={romanPass.length < 5}
            onClick={submitPass}
          >
            Valida.
          </button>
        </motion.section>
      ) : null}

      {phase === "email" ? (
        <motion.section
          className="flex h-full flex-col items-center justify-center px-6 pb-24 text-center"
          initial={{ opacity: 0, filter: "blur(12px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.85, ease: "easeInOut" }}
        >
          <p className="select-none text-[10px] uppercase tracking-[0.22em] text-black/38">Epistula.</p>
          <input
            className="mt-6 w-full max-w-[18rem] border border-black bg-white px-4 py-3 text-center text-sm outline-none"
            value={email}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="mail"
            onChange={(event) => setEmail(event.target.value)}
          />

          <div className="mt-6 flex items-center justify-center gap-3">
            <p className="select-none text-[10px] uppercase tracking-[0.18em] text-black/38">Nuntii?</p>
            <button
              type="button"
              className={[
                "select-none border px-3 py-1 text-[9px] uppercase tracking-[0.14em]",
                notifications ? "border-black bg-black text-white" : "border-black/25 text-black/45"
              ].join(" ")}
              onClick={() => setNotifications(true)}
            >
              Ita.
            </button>
            <button
              type="button"
              className={[
                "select-none border px-3 py-1 text-[9px] uppercase tracking-[0.14em]",
                !notifications ? "border-black bg-black text-white" : "border-black/25 text-black/45"
              ].join(" ")}
              onClick={() => setNotifications(false)}
            >
              Non.
            </button>
          </div>

          <p className="mt-5 max-w-[16rem] select-none text-[10px] leading-5 text-black/38">Signum mittetur.</p>

          <button
            type="button"
            className="mt-7 select-none border border-black bg-black px-5 py-2 text-[10px] uppercase tracking-[0.16em] text-white disabled:opacity-25"
            disabled={!email.trim().includes("@")}
            onClick={submitEmail}
          >
            Scribere.
          </button>
        </motion.section>
      ) : null}

      {spaceLoading ? (
        <motion.div
          className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-white text-center text-black"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.65, ease: "easeInOut" }}
        >
          <p className="select-none text-[10px] uppercase tracking-[0.22em] text-black/42">Onerat.</p>
        </motion.div>
      ) : null}

      {phase === "space" ? (
        <motion.section
          className="flex h-full flex-col items-center justify-center px-6 pb-24 text-center"
          initial={{ opacity: 0, filter: "blur(12px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.85, ease: "easeInOut" }}
        >
          <p className="select-none text-[10px] uppercase tracking-[0.22em] text-black/38">Intratum.</p>
          <h2 className="mt-3 select-none text-3xl font-semibold tracking-[0.08em]">{selectedUser}</h2>
          <div className="mt-8 grid w-full max-w-[18rem] grid-cols-2 gap-3">
            <div className="border border-black/20 p-4">
              <p className="text-[9px] uppercase tracking-[0.18em] text-black/38">Fatum.</p>
              <p className="mt-2 text-2xl">{spaceSummary.fatum}</p>
            </div>
            <div className="border border-black/20 p-4">
              <p className="text-[9px] uppercase tracking-[0.18em] text-black/38">Archivum.</p>
              <p className="mt-2 text-2xl">{spaceSummary.archives}</p>
            </div>
          </div>
        </motion.section>
      ) : null}

      {phase !== "loading" && phase !== "users" ? bottomNav : null}
    </main>
  );
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

function ActionButtons({
  onIterum,
  onClaves,
  onNoctem,
  onVerbatim,
  onDuodecim,
  onBulla,
  onArchive,
  onFatum,
  onSalvatio,
  active = "",
  compact = false
}) {
  const [open, setOpen] = useState(false);
  const [activeLabel, setActiveLabel] = useState(active);

  useEffect(() => {
    setActiveLabel(active);
  }, [active]);

  const sectionClass = "mb-1 border-b border-black/20 pb-1 text-center text-[9px] uppercase tracking-[0.16em] text-black/68";
  const itemClass = (label) =>
    [
      "block w-full select-none px-3 py-1 text-center text-[9px] uppercase tracking-[0.16em] active:bg-black active:text-white disabled:opacity-22",
      activeLabel === label ? "font-medium text-black opacity-100" : "text-black/38"
    ].join(" ");

  const whiteHandScreens = ["Noctem", "Duodecim", "Bulla", "Fatum", "Salvatio"];
  const isWhiteHandScreen = whiteHandScreens.includes(activeLabel);
  const handIconClass = [
    "h-7 w-7 object-contain",
    isWhiteHandScreen ? "[filter:brightness(0)_invert(1)]" : ""
  ].join(" ");

  const groups = [
    {
      title: "Alea",
      items: [
        ["Divinatio", onIterum],
        ["Labyrinthus", null],
        ["Salvatio", onSalvatio]
      ]
    },
    {
      title: "Oraculum",
      items: [
        ["Claves", onClaves],
        ["Noctem", onNoctem],
        ["Verbatim", onVerbatim],
        ["Duodecim", onDuodecim]
      ]
    },
    {
      title: "Nexus",
      items: [
        ["Bulla", onBulla],
        ["Archivum", onArchive]
      ]
    },
    {
      title: "Ratio",
      items: [
        ["Fatum", onFatum],
        ["Spiritus", null]
      ]
    }
  ];

  return (
    <div className="fixed left-1/2 top-[max(0.62rem,env(safe-area-inset-top))] z-[90] -translate-x-1/2">
      <button
        type="button"
        aria-label="Menu"
        className="flex h-10 w-10 select-none items-center justify-center bg-transparent active:scale-95"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        <img src="/images/main.png" alt="" className={handIconClass} draggable={false} />
      </button>

      {open ? (
        <motion.div
          className="absolute left-1/2 top-12 z-[95] w-[11.5rem] -translate-x-1/2 border border-black/18 bg-white px-3 py-3 text-black shadow-2xl backdrop-blur-md"
          initial={{ opacity: 0, y: -8, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.35, ease: "easeInOut" }}
          onClick={(event) => event.stopPropagation()}
        >
          {groups.map((group) => (
            <div key={group.title} className="mb-6 last:mb-0">
              <p className={sectionClass}>{group.title}</p>
              <div className="mt-1 space-y-0.5">
                {group.items.map(([label, action]) => (
                  <button
                    key={label}
                    type="button"
                    disabled={!action}
                    className={itemClass(label)}
                    onClick={() => {
                      if (!action) return;
                      setActiveLabel(label);
                      setOpen(false);
                      action();
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </motion.div>
      ) : null}
    </div>
  );
}

function ClavesScreen({ reading, question, onIterum, onNoctem, onVerbatim, onDuodecim, onBulla, onArchive, onFatum, onSalvatio }) {
  return (
    <motion.main
      className="fixed inset-0 overflow-y-auto bg-white px-7 pb-28 pt-[max(2rem,env(safe-area-inset-top))] text-center text-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: FADE_DURATION, ease: "easeInOut" }}
    >
      <div className="mx-auto max-w-[680px]">
        <h1 className="mt-14 mb-8 text-center text-4xl font-semibold tracking-[0.08em]">Claves</h1>

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

      <div className="fixed bottom-[max(2.25rem,calc(env(safe-area-inset-bottom)+1.25rem))] left-0 right-0 z-30 text-black">
        <ActionButtons onIterum={onIterum} onNoctem={onNoctem} onVerbatim={onVerbatim} onDuodecim={onDuodecim} onBulla={onBulla} onArchive={onArchive} onFatum={onFatum} onSalvatio={onSalvatio} active="Claves" compact />
      </div>
    </motion.main>
  );
}

function NoctemScreen({ reading, question, onIterum, onClaves, onVerbatim, onDuodecim, onBulla, onArchive, onFatum, onSalvatio }) {
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
      <h1 className="mt-14 mb-6 text-center text-3xl font-semibold tracking-[0.12em] text-white">Noctem.</h1>

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

      <div className="fixed bottom-[max(2.25rem,calc(env(safe-area-inset-bottom)+1.25rem))] left-0 right-0 z-30 text-white">
        <ActionButtons onIterum={onIterum} onClaves={onClaves} onVerbatim={onVerbatim} onDuodecim={onDuodecim} onBulla={onBulla} onArchive={onArchive} onFatum={onFatum} onSalvatio={onSalvatio} active="Noctem" compact />
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


function sanitizePdfText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[—–]/g, "-")
    .replace(/œ/g, "oe")
    .replace(/Œ/g, "OE")
    .replace(/[^\x20-\x7E\n]/g, "");
}

function escapePdfText(value = "") {
  return sanitizePdfText(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapTextForPdf(text, maxLength = 78) {
  const words = sanitizePdfText(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLength) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });

  if (current) lines.push(current);
  return lines;
}

function createPdfBlobFromLines(lines) {
  const pageWidth = 595;
  const pageHeight = 842;
  const marginX = 54;
  const startY = 790;
  const lineHeight = 18;
  const maxLinesPerPage = 39;

  const pages = [];
  for (let i = 0; i < lines.length; i += maxLinesPerPage) {
    pages.push(lines.slice(i, i + maxLinesPerPage));
  }

  const objects = [];
  const addObject = (content) => {
    objects.push(content);
    return objects.length;
  };

  const catalogId = addObject("<< /Type /Catalog /Pages 2 0 R >>");
  const pagesId = addObject("__PAGES__");
  const fontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /WinAnsiEncoding >>");

  const pageIds = [];

  pages.forEach((pageLines) => {
    const textCommands = pageLines
      .map((line, index) => {
        const y = startY - index * lineHeight;
        return `BT /F1 11 Tf ${marginX} ${y} Td (${escapePdfText(line)}) Tj ET`;
      })
      .join("\n");

    const stream = `<< /Length ${textCommands.length} >>\nstream\n${textCommands}\nendstream`;
    const contentId = addObject(stream);

    const pageId = addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`
    );

    pageIds.push(pageId);
  });

  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((content, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${content}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

function downloadVerbatimPdf(reading, question) {
  const lines = [
    "NOX - VERBATIM",
    "",
    "Question",
    ...wrapTextForPdf(question || "Question silencieuse"),
    "",
    "Cartes"
  ];

  reading.cards.forEach((card) => {
    lines.push("");
    lines.push(`${card.position || ""} - ${card.cardName || ""}`);
    lines.push(`Cle: ${card.key || ""}`);
    lines.push(...wrapTextForPdf(card.interpretation || ""));
  });

  lines.push("");
  lines.push("Lecture croisee");
  lines.push(...wrapTextForPdf(reading.crossReading || ""));
  lines.push("");
  lines.push("Synthese");
  lines.push(...wrapTextForPdf(reading.synthesis || ""));
  lines.push("");
  lines.push("Phrase-oracle");
  lines.push(...wrapTextForPdf(reading.oracleSentence || ""));
  lines.push("");
  lines.push("Action");
  lines.push(...wrapTextForPdf(reading.action || ""));

  const blob = createPdfBlobFromLines(lines);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "nox-verbatim.pdf";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const DUODECIM_NAMES = [
  "Jagger",
  "Freud",
  "Marx",
  "Nietzsche",
  "Gainsbourg",
  "Kant",
  "Cantona",
  "VDB",
  "Raël",
  "Verges",
  "Houellebecq",
  "Bowie"
];

const DUODECIM_DICE = [
  DUODECIM_NAMES.slice(0, 6),
  DUODECIM_NAMES.slice(6, 12)
];

const DICE_FACE_TRANSFORMS = [
  "translateZ(62px)",
  "rotateY(180deg) translateZ(62px)",
  "rotateY(90deg) translateZ(62px)",
  "rotateY(-90deg) translateZ(62px)",
  "rotateX(90deg) translateZ(62px)",
  "rotateX(-90deg) translateZ(62px)"
];

function getDuodecimFallbackSentence(name, reading, question) {
  const q = question ? `À ta question — ${question} —` : "À ta question,";
  const sign = reading?.oracleSentence || reading?.synthesis || "le signe refuse de rester décoratif.";

  const sentences = {
    Jagger: `${q} Jagger répondrait : garde le mouvement, coupe ce qui pèse, et transforme « ${sign} » en entrée de scène.`,
    Freud: `${q} Freud répondrait : le vrai sujet n’est pas la décision, mais le plaisir suspect que tu prends à la différer.`,
    Marx: `${q} Marx répondrait : regarde qui encaisse ton hésitation ; si ce n’est pas toi, change le rapport de force.`,
    Nietzsche: `${q} Nietzsche répondrait : choisis ce qui t’augmente, même si ton petit confort bourgeois te regarde avec effroi.`,
    Gainsbourg: `${q} Gainsbourg répondrait : fais le geste sale avec une élégance propre, puis assume l’odeur de tabac froid.`,
    Kant: `${q} Kant répondrait : agis comme si ton esquive devenait une loi universelle ; normalement, cela devrait te faire honte.`,
    Cantona: `${q} Cantona répondrait : quand le stade se tait, le ballon sait encore où frapper. Vise la lucarne, pas l’excuse.`,
    VDB: `${q} VDB répondrait : tu voulais un signe propre ; il arrive crotté, magnifique, et demande juste qu’on lui ouvre.`,
    Raël: `${q} Raël répondrait : la réponse vient peut-être de très loin, mais elle exige surtout un peignoir net et une décision locale.`,
    Verges: `${q} Vergès répondrait : défends l’indéfendable en toi, non pour l’absoudre, mais pour identifier le vrai coupable.`,
    Houellebecq: `${q} Houellebecq répondrait : le monde restera décevant ; évite seulement d’ajouter ta propre médiocrité au désastre.`,
    Bowie: `${q} Bowie répondrait : change de peau maintenant, avant que l’ancienne ne commence à parler à ta place.`
  };

  return sentences[name] || `${q} ${sign}`;
}

function DuodecimScreen({ reading, question, onIterum, onClaves, onNoctem, onVerbatim, onBulla, onArchive, onFatum, onSalvatio }) {
  const [rotations, setRotations] = useState([
    { x: -18, y: 26 },
    { x: 18, y: -24 }
  ]);
  const [selectedName, setSelectedName] = useState(null);
  const [selectedSentence, setSelectedSentence] = useState("");
  const [sentenceStatus, setSentenceStatus] = useState("idle");
  const dragRef = useRef(null);
  const rotationsRef = useRef(rotations);
  const velocityRef = useRef([
    { x: 0.015, y: 0.028 },
    { x: -0.018, y: 0.024 }
  ]);
  const animationRef = useRef(null);
  const lastFrameRef = useRef(0);
  const adviceRequestRef = useRef(0);

  useEffect(() => {
    rotationsRef.current = rotations;
  }, [rotations]);

  useEffect(() => {
    const tick = (time) => {
      const last = lastFrameRef.current || time;
      const delta = Math.min(48, time - last);
      lastFrameRef.current = time;

      if (!dragRef.current) {
        setRotations((current) => {
          const next = current.map((rotation, index) => {
            const baseX = index === 0 ? 0.012 : -0.014;
            const baseY = index === 0 ? 0.026 : 0.022;
            const velocity = velocityRef.current[index];

            velocity.x *= 0.965;
            velocity.y *= 0.965;

            return {
              x: rotation.x + (baseX + velocity.x) * delta,
              y: rotation.y + (baseY + velocity.y) * delta
            };
          });

          rotationsRef.current = next;
          return next;
        });
      }

      animationRef.current = window.requestAnimationFrame(tick);
    };

    animationRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (animationRef.current) {
        window.cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const requestDuodecimSentence = async (name) => {
    const requestId = Date.now();
    adviceRequestRef.current = requestId;

    setSelectedName(name);
    setSelectedSentence("");
    setSentenceStatus("loading");

    try {
      const response = await fetch("/api/duodecim-advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, question, reading })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Duodecim unavailable");
      }

      if (adviceRequestRef.current === requestId) {
        setSelectedSentence(data.sentence || getDuodecimFallbackSentence(name, reading, question));
        setSentenceStatus("ready");
      }
    } catch {
      if (adviceRequestRef.current === requestId) {
        setSelectedSentence(getDuodecimFallbackSentence(name, reading, question));
        setSentenceStatus("ready");
      }
    }
  };

  const startDrag = (event, diceIndex) => {
    event.preventDefault();

    if (event.currentTarget.setPointerCapture && event.pointerId !== undefined) {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Ignore pointer capture errors.
      }
    }

    dragRef.current = {
      diceIndex,
      x: event.clientX,
      y: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      lastTime: event.timeStamp || performance.now(),
      rotation: rotationsRef.current[diceIndex]
    };
  };

  const moveDrag = (event) => {
    if (!dragRef.current) return;
    event.preventDefault();

    const now = event.timeStamp || performance.now();
    const deltaX = event.clientX - dragRef.current.x;
    const deltaY = event.clientY - dragRef.current.y;
    const frameMs = Math.max(12, now - dragRef.current.lastTime);
    const frameDeltaX = event.clientX - dragRef.current.lastX;
    const frameDeltaY = event.clientY - dragRef.current.lastY;
    const diceIndex = dragRef.current.diceIndex;

    velocityRef.current[diceIndex] = {
      x: (-frameDeltaY * 0.030) / frameMs,
      y: (frameDeltaX * 0.030) / frameMs
    };

    const nextRotation = {
      x: dragRef.current.rotation.x - deltaY * 0.42,
      y: dragRef.current.rotation.y + deltaX * 0.42
    };

    setRotations((current) => {
      const next = current.map((rotation, index) => (index === diceIndex ? nextRotation : rotation));
      rotationsRef.current = next;
      return next;
    });

    dragRef.current.lastX = event.clientX;
    dragRef.current.lastY = event.clientY;
    dragRef.current.lastTime = now;
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const diceOffsetClass = (diceIndex) => (diceIndex === 0 ? "-translate-x-[62px]" : "translate-x-[62px]");

  return (
    <motion.main
      className="fixed inset-0 overflow-hidden bg-black text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: FADE_DURATION, ease: "easeInOut" }}
    >
      <h1 className="mt-14 text-center text-3xl font-semibold tracking-[0.12em] text-white">Duodecim.</h1>

      <div className="flex h-[calc(100%-5rem)] flex-col items-center justify-center gap-6 px-6 [perspective:900px]">
        {DUODECIM_DICE.map((names, diceIndex) => (
          <div
            key={`duodecim-die-${diceIndex}`}
            className={`relative h-[124px] w-[124px] touch-none ${diceOffsetClass(diceIndex)}`}
            onPointerDown={(event) => startDrag(event, diceIndex)}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onPointerLeave={endDrag}
          >
            <div
              className="absolute inset-0 [transform-style:preserve-3d]"
              style={{
                transform: `rotateX(${rotations[diceIndex].x}deg) rotateY(${rotations[diceIndex].y}deg)`,
                transition: dragRef.current ? "none" : "transform 0.08s linear"
              }}
            >
              {names.map((name, faceIndex) => (
                <button
                  key={name}
                  type="button"
                  className="absolute left-1/2 top-1/2 flex h-[124px] w-[124px] -translate-x-1/2 -translate-y-1/2 select-none items-center justify-center border border-white/88 bg-black text-center text-[9px] uppercase leading-[1.05] tracking-[0.08em] text-white"
                  style={{
                    transform: DICE_FACE_TRANSFORMS[faceIndex],
                    transformStyle: "preserve-3d"
                  }}
                  onClick={(event) => event.stopPropagation()}
                  onDoubleClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    requestDuodecimSentence(name);
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {selectedName ? (
        <motion.div
          className="fixed inset-x-6 top-1/2 z-40 -translate-y-1/2 bg-white px-6 py-7 text-center text-black shadow-2xl"
          initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: FADE_DURATION, ease: "easeInOut" }}
          onClick={() => {
            setSelectedName(null);
            setSelectedSentence("");
            setSentenceStatus("idle");
          }}
        >
          {sentenceStatus === "loading" ? (
            <motion.p
              className="text-xl leading-8"
              animate={{ opacity: [0.35, 1, 0.35] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            >
              Attends.
            </motion.p>
          ) : (
            <p className="text-xl leading-8">{selectedSentence}</p>
          )}
        </motion.div>
      ) : null}

      <div className="fixed bottom-[max(2.25rem,calc(env(safe-area-inset-bottom)+1.25rem))] left-0 right-0 z-30">
        <ActionButtons onIterum={onIterum} onClaves={onClaves} onNoctem={onNoctem} onVerbatim={onVerbatim} onBulla={onBulla} onArchive={onArchive} onFatum={onFatum} onSalvatio={onSalvatio} active="Duodecim" compact />
      </div>
    </motion.main>
  );
}

function fileToArchivePhotoDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }

    const reader = new FileReader();

    reader.onerror = () => reject(new Error("Image read error"));

    reader.onload = () => {
      const image = new Image();

      image.onerror = () => reject(new Error("Image load error"));

      image.onload = () => {
        const maxSize = 1200;
        const ratio = Math.min(1, maxSize / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * ratio));
        const height = Math.max(1, Math.round(image.height * ratio));

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, width, height);

        resolve(canvas.toDataURL("image/jpeg", 0.76));
      };

      image.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
}

function BullaScreen({ reading, question, onIterum, onClaves, onNoctem, onVerbatim, onDuodecim, onArchive, onFatum, onSalvatio }) {
  const [status, setStatus] = useState("idle");
  const [photoDataUrl, setPhotoDataUrl] = useState("");
  const [photoStatus, setPhotoStatus] = useState("idle");
  const [textEntryOpen, setTextEntryOpen] = useState(false);
  const [textEntryValue, setTextEntryValue] = useState("");
  const fileInputRef = useRef(null);

  const archiveBulla = async (message = "") => {
    const trimmed = message.trim();

    if (!trimmed && !photoDataUrl) {
      setStatus("empty");
      return false;
    }

    try {
      await saveBullaArchive({
        message: trimmed,
        photoDataUrl,
        question: question || "",
        oracleSentence: reading?.oracleSentence || "",
        action: reading?.action || "",
        fatum: getFatumScore(reading, question)
      });

      setStatus("archived");
    } catch {
      setStatus("error");
      return false;
    }

    setPhotoStatus("idle");
    setPhotoDataUrl("");
    return true;
  };

  const selectPhoto = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setPhotoStatus("loading");

    try {
      const dataUrl = await fileToArchivePhotoDataUrl(file);
      setPhotoDataUrl(dataUrl);
      setPhotoStatus("ready");
    } catch {
      setPhotoStatus("error");
    } finally {
      event.target.value = "";
    }
  };

  const saveTypedBulla = async () => {
    const archived = await archiveBulla(textEntryValue);

    if (archived) {
      setTextEntryValue("");
      setTextEntryOpen(false);
    }
  };

  const savePhotoOnlyBulla = async () => {
    await archiveBulla("");
  };

  const statusText = {
    idle: "",
    empty: "vacua.",
    archived: "In archivum.",
    error: "fractum."
  }[status];

  const photoText = {
    idle: "",
    loading: "imago.",
    ready: "imago capta.",
    error: "imago fracta."
  }[photoStatus];

  return (
    <motion.main
      className="fixed inset-0 flex items-center justify-center overflow-hidden bg-black px-8 text-center text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: FADE_DURATION, ease: "easeInOut" }}
    >
      <h1 className="fixed left-0 right-0 top-[max(3.9rem,calc(env(safe-area-inset-top)+3.2rem))] z-20 text-center text-3xl font-semibold tracking-[0.12em] text-white">Bulla.</h1>

      <div className="flex flex-col items-center justify-center gap-5">
        <div className="flex items-center justify-center gap-5">
          <button
            type="button"
            aria-label="Écrire un message"
            onClick={() => setTextEntryOpen(true)}
            className="flex h-12 w-12 select-none items-center justify-center border border-white/55 bg-transparent text-white active:scale-95"
          >
            <svg width="23" height="23" viewBox="0 0 48 48" fill="none" aria-hidden="true">
              <path d="M12 13H36" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M12 24H32" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M12 35H27" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </button>

          <button
            type="button"
            aria-label="Ajouter une image"
            onClick={selectPhoto}
            className="flex h-12 w-12 select-none items-center justify-center border border-white/55 bg-transparent text-white active:scale-95"
          >
            <svg width="25" height="25" viewBox="0 0 48 48" fill="none" aria-hidden="true">
              <path d="M8 14H18L21 10H27L30 14H40V38H8V14Z" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round" />
              <circle cx="24" cy="26" r="7" stroke="currentColor" strokeWidth="2.6" />
            </svg>
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePhotoChange}
        />

        {photoDataUrl ? (
          <div className="flex flex-col items-center gap-3">
            <img
              src={photoDataUrl}
              alt=""
              className="h-20 w-20 border border-white/30 object-cover"
            />

            <button
              type="button"
              className="border border-white px-4 py-2 text-[10px] uppercase tracking-[0.16em] text-white"
              onClick={savePhotoOnlyBulla}
            >
              Scribere.
            </button>
          </div>
        ) : null}

        {photoText ? (
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/42">{photoText}</p>
        ) : null}

        {statusText ? (
          <motion.p
            className="text-sm uppercase tracking-[0.22em] text-white/62"
            initial={{ opacity: 0 }}
            animate={{ opacity: status === "archived" ? [0.35, 1, 0.35] : 1 }}
            transition={{ duration: 2.2, repeat: status === "archived" ? Infinity : 0, ease: "easeInOut" }}
          >
            {statusText}
          </motion.p>
        ) : null}
      </div>

      {textEntryOpen ? (
        <motion.div
          className="fixed inset-x-4 top-[max(1.25rem,env(safe-area-inset-top))] bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-50 flex flex-col border border-white bg-black p-4 text-white shadow-2xl"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: FADE_DURATION, ease: "easeInOut" }}
        >
          <textarea
            className="min-h-0 flex-1 w-full resize-none border border-white/35 bg-black p-3 text-base leading-6 text-white outline-none"
            value={textEntryValue}
            onChange={(event) => setTextEntryValue(event.target.value)}
            placeholder="Bulla"
            autoFocus
          />

          <div className="mt-3 flex justify-center gap-2">
            <button
              type="button"
              className="border border-white px-4 py-2 text-[10px] uppercase tracking-[0.16em]"
              onClick={saveTypedBulla}
            >
              Scribere
            </button>
            <button
              type="button"
              className="border border-white/35 px-4 py-2 text-[10px] uppercase tracking-[0.16em] text-white/55"
              onClick={() => {
                setTextEntryOpen(false);
                setTextEntryValue("");
              }}
            >
              Delere
            </button>
          </div>
        </motion.div>
      ) : null}

      <div className="fixed bottom-[max(2.25rem,calc(env(safe-area-inset-bottom)+1.25rem))] left-0 right-0 z-30">
        <ActionButtons onIterum={onIterum} onClaves={onClaves} onNoctem={onNoctem} onVerbatim={onVerbatim} onDuodecim={onDuodecim} onArchive={onArchive} onFatum={onFatum} onSalvatio={onSalvatio} active="Bulla" compact />
      </div>
    </motion.main>
  );
}

const BULLA_ARCHIVE_KEY = "nox:bulla-archives-cache";

async function fetchServerArchives() {
  const response = await fetch("/api/archives", { cache: "no-store" });
  const data = await response.json();

  if (!response.ok) throw new Error(data?.error || "Archives unavailable");

  window.localStorage.setItem(BULLA_ARCHIVE_KEY, JSON.stringify(data.archives || []));
  return data.archives || [];
}

function readBullaArchives() {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(BULLA_ARCHIVE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveBullaArchive(entry) {
  const response = await fetch("/api/archives", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry)
  });
  const data = await response.json();

  if (!response.ok) throw new Error(data?.error || "Archive save failed");

  window.localStorage.setItem(BULLA_ARCHIVE_KEY, JSON.stringify(data.archives || []));
  window.dispatchEvent(new CustomEvent("nox:bulla-archives-updated", { detail: data.archives || [] }));

  return data.archives || [];
}

async function updateServerArchive(id, patch) {
  const response = await fetch(`/api/archives/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch)
  });
  const data = await response.json();

  if (!response.ok) throw new Error(data?.error || "Archive update failed");

  window.localStorage.setItem(BULLA_ARCHIVE_KEY, JSON.stringify(data.archives || []));
  window.dispatchEvent(new CustomEvent("nox:bulla-archives-updated", { detail: data.archives || [] }));

  return data.archives || [];
}

async function deleteServerArchive(id) {
  const response = await fetch(`/api/archives/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
  const data = await response.json();

  if (!response.ok) throw new Error(data?.error || "Archive delete failed");

  window.localStorage.setItem(BULLA_ARCHIVE_KEY, JSON.stringify(data.archives || []));
  window.dispatchEvent(new CustomEvent("nox:bulla-archives-updated", { detail: data.archives || [] }));

  return data.archives || [];
}

function formatArchiveDate(value) {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function ArchivesScreen({ onIterum, onClaves, onNoctem, onVerbatim, onDuodecim, onBulla, onFatum, onSalvatio }) {
  const [archives, setArchives] = useState(() => readBullaArchives());
  const [reactionTarget, setReactionTarget] = useState(null);
  const [commentTarget, setCommentTarget] = useState(null);
  const [commentValue, setCommentValue] = useState("");
  const [burnTargetId, setBurnTargetId] = useState(null);
  const [syncStatus, setSyncStatus] = useState("idle");
  const longPressTimerRef = useRef(null);
  const lastTapRef = useRef({ id: null, time: 0 });

  const writeArchives = (nextArchives) => {
    window.localStorage.setItem(BULLA_ARCHIVE_KEY, JSON.stringify(nextArchives));
    window.dispatchEvent(new CustomEvent("nox:bulla-archives-updated", { detail: nextArchives }));
    setArchives(nextArchives);
  };

  const updateArchive = async (id, patch) => {
    setSyncStatus("syncing");

    try {
      const nextArchives = await updateServerArchive(id, patch);
      writeArchives(nextArchives);
      setSyncStatus("ok");
    } catch {
      setArchives(readBullaArchives());
      setSyncStatus("error");
    }
  };

  const deleteArchive = async (id) => {
    setSyncStatus("syncing");

    try {
      const nextArchives = await deleteServerArchive(id);
      writeArchives(nextArchives);
      setSyncStatus("ok");
    } catch {
      setArchives(readBullaArchives());
      setSyncStatus("error");
    }

    setBurnTargetId(null);
  };

  const startArchivePress = (entry) => {
    window.clearTimeout(longPressTimerRef.current);

    longPressTimerRef.current = window.setTimeout(() => {
      setReactionTarget(entry);
      setCommentTarget(null);
      setBurnTargetId(null);
    }, 520);
  };

  const endArchivePress = (entry) => {
    window.clearTimeout(longPressTimerRef.current);

    const now = Date.now();

    if (lastTapRef.current.id === entry.id && now - lastTapRef.current.time < 330) {
      setBurnTargetId(entry.id);
      setReactionTarget(null);
      setCommentTarget(null);
      lastTapRef.current = { id: null, time: 0 };
      return;
    }

    lastTapRef.current = { id: entry.id, time: now };
  };

  const applyReaction = (emoji) => {
    if (!reactionTarget) return;

    updateArchive(reactionTarget.id, { reaction: emoji });

    setReactionTarget(null);
  };

  const openComment = () => {
    if (!reactionTarget) return;

    setCommentTarget(reactionTarget);
    setCommentValue("");
    setReactionTarget(null);
  };

  const saveComment = () => {
    if (!commentTarget) return;

    const trimmed = commentValue.trim();
    if (!trimmed) {
      setCommentTarget(null);
      setCommentValue("");
      return;
    }

    updateArchive(commentTarget.id, { comment: trimmed });

    setCommentTarget(null);
    setCommentValue("");
  };

  useEffect(() => {
    setSyncStatus("syncing");

    fetchServerArchives()
      .then((serverArchives) => {
        setArchives(serverArchives);
        setSyncStatus("ok");
      })
      .catch(() => {
        setArchives(readBullaArchives());
        setSyncStatus("error");
      });

    const refreshArchives = () => {
      setArchives(readBullaArchives());
    };

    window.addEventListener("storage", refreshArchives);
    window.addEventListener("nox:bulla-archives-updated", refreshArchives);

    return () => {
      window.clearTimeout(longPressTimerRef.current);
      window.removeEventListener("storage", refreshArchives);
      window.removeEventListener("nox:bulla-archives-updated", refreshArchives);
    };
  }, []);

  return (
    <motion.main
      className="fixed inset-0 overflow-y-auto bg-white px-5 pb-32 pt-[max(1.5rem,env(safe-area-inset-top))] text-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: FADE_DURATION, ease: "easeInOut" }}
    >
      <h1 className="mt-14 mb-2 text-center text-3xl font-semibold tracking-[0.12em]">Archivum</h1>
      {syncStatus === "error" ? (
        <p className="mb-4 text-center text-[9px] uppercase tracking-[0.18em] text-red-700">Memoria fracta.</p>
      ) : syncStatus === "syncing" ? (
        <p className="mb-4 text-center text-[9px] uppercase tracking-[0.18em] text-black/38">Memoria.</p>
      ) : (
        <p className="mb-4 text-center text-[9px] uppercase tracking-[0.18em] text-black/32">{archives.length} signa</p>
      )}

      {archives.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {archives.map((entry) => {
            const burning = burnTargetId === entry.id;
            const fatum = Number.isFinite(Number(entry.fatum)) ? Number(entry.fatum) : null;

            return (
              <article
                key={entry.id}
                className={[
                  "relative select-none p-3 text-left transition-colors duration-300",
                  burning
                    ? "border border-red-700 bg-red-700 text-white"
                    : "border border-black/18 bg-white text-black"
                ].join(" ")}
                onPointerDown={() => startArchivePress(entry)}
                onPointerUp={() => endArchivePress(entry)}
                onPointerCancel={() => window.clearTimeout(longPressTimerRef.current)}
                onPointerLeave={() => window.clearTimeout(longPressTimerRef.current)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setReactionTarget(entry);
                  setBurnTargetId(null);
                }}
              >
                {burning ? (
                  <div className="absolute inset-0 z-20 flex items-center justify-center gap-5 bg-red-700">
                    <button
                      type="button"
                      className="select-none text-3xl active:scale-95"
                      aria-label="Brûler l’archive"
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteArchive(entry.id);
                      }}
                    >
                      🔥
                    </button>
                    <button
                      type="button"
                      className="select-none text-3xl active:scale-95"
                      aria-label="Verrouiller l’archive"
                      onClick={(event) => {
                        event.stopPropagation();
                        setBurnTargetId(null);
                      }}
                    >
                      🔒
                    </button>
                  </div>
                ) : null}

                <div className="mb-2 flex items-start justify-between gap-2">
                  <p className={["text-[10px] uppercase tracking-[0.16em]", burning ? "text-white/80" : "text-black/46"].join(" ")}>
                    {formatArchiveDate(entry.createdAt)}
                  </p>
                  {entry.reaction ? (
                    <p className="text-base leading-none">{entry.reaction}</p>
                  ) : null}
                </div>

                <div className="mb-3 border border-white/88 bg-black p-3 text-center text-white">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/58">
                    Fatum {fatum !== null ? `${fatum} pts` : "—"}
                  </p>
                  {entry.oracleSentence ? (
                    <p className="mt-2 text-[12px] font-semibold leading-[1.35]">{entry.oracleSentence}</p>
                  ) : null}
                  {entry.action ? (
                    <p className="mt-2 text-[11px] leading-[1.35] text-white/72">{entry.action}</p>
                  ) : null}
                </div>

                <p className={["whitespace-pre-wrap text-[12px] leading-[1.45]", burning ? "text-white/88" : "text-black/88"].join(" ")}>
                  {entry.message}
                </p>

                {entry.photoDataUrl ? (
                  <img
                    src={entry.photoDataUrl}
                    alt=""
                    className="mt-3 aspect-square w-full object-cover"
                    loading="lazy"
                  />
                ) : null}

                {(Array.isArray(entry.comments) ? entry.comments : entry.comment ? [entry.comment] : []).length ? (
                  <div className={["mt-3 space-y-1 border-t pt-2", burning ? "border-white/22 text-white/70" : "border-black/12 text-black/58"].join(" ")}>
                    {(Array.isArray(entry.comments) ? entry.comments : entry.comment ? [entry.comment] : []).map((comment, commentIndex) => (
                      <p key={`${entry.id}-comment-${commentIndex}`} className="text-[11px] italic leading-[1.4]">
                        {comment}
                      </p>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="flex min-h-[50vh] items-center justify-center text-center">
          <p className="text-sm uppercase tracking-[0.2em] text-black/45">Nihil.</p>
        </div>
      )}

      {reactionTarget ? (
        <motion.div
          className="fixed inset-x-6 top-1/2 z-50 -translate-y-1/2 border border-black bg-white px-4 py-5 text-center shadow-2xl"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: FADE_DURATION, ease: "easeInOut" }}
        >
          <div className="mx-auto max-w-[292px] overflow-x-auto overscroll-x-contain px-1 pb-2 [scrollbar-width:none] [-ms-overflow-style:none]">
            <div className="grid grid-flow-col grid-rows-2 auto-cols-[32px] gap-2">
              {[
                "🔮", "🃏", "🕯️", "🧿", "🗝️", "🪬", "🌘", "✨",
                "🌀", "⚖️", "💀", "🪦", "🦴", "🕳️", "🖤", "🦉",
                "🥀", "🌑", "⚰️", "❤️‍🔥", "🫀", "💘", "💞", "🫶",
                "🔗", "💋", "🩸", "🔥", "⚡️", "👁️", "💥", "🌋",
                "🫨", "🗡️"
              ].map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="flex h-8 w-8 select-none items-center justify-center text-xl active:scale-95"
                  onClick={() => applyReaction(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {((Array.isArray(reactionTarget.comments) ? reactionTarget.comments : reactionTarget.comment ? [reactionTarget.comment] : []).length < 9) ? (
            <button
              type="button"
              className="mt-5 border border-black px-4 py-2 text-[10px] uppercase tracking-[0.16em]"
              onClick={openComment}
            >
              Commentarium
            </button>
          ) : null}

          <button
            type="button"
            className="mt-4 block w-full text-[10px] uppercase tracking-[0.16em] text-black/45"
            onClick={() => setReactionTarget(null)}
          >
            Claudere
          </button>
        </motion.div>
      ) : null}

      {commentTarget ? (
        <motion.div
          className="fixed inset-x-4 top-[max(1.25rem,env(safe-area-inset-top))] bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-50 flex flex-col border border-black bg-white p-4 shadow-2xl"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: FADE_DURATION, ease: "easeInOut" }}
        >
          <textarea
            className="min-h-0 flex-1 w-full resize-none border border-black/30 bg-white p-3 text-base leading-6 outline-none"
            value={commentValue}
            onChange={(event) => setCommentValue(event.target.value)}
            placeholder="Commentarium"
            autoFocus
          />

          <div className="mt-3 flex justify-center gap-2">
            <button
              type="button"
              className="border border-black px-4 py-2 text-[10px] uppercase tracking-[0.16em]"
              onClick={saveComment}
            >
              Scribere
            </button>
            <button
              type="button"
              className="border border-black/35 px-4 py-2 text-[10px] uppercase tracking-[0.16em] text-black/55"
              onClick={() => {
                setCommentTarget(null);
                setCommentValue("");
              }}
            >
              Delere
            </button>
          </div>
        </motion.div>
      ) : null}

      <div className="fixed bottom-[max(2.25rem,calc(env(safe-area-inset-bottom)+1.25rem))] left-0 right-0 z-30 text-black">
        <ActionButtons
          onIterum={onIterum}
          onClaves={onClaves}
          onNoctem={onNoctem}
          onVerbatim={onVerbatim}
          onDuodecim={onDuodecim}
          onBulla={onBulla}
          onFatum={onFatum}
          onSalvatio={onSalvatio}
          active="Archivum"
          compact
        />
      </div>
    </motion.main>
  );
}



const NOX_CONTEXT_KEY = "nox:context-secrets";
const SECRETUM_INTERVAL = 500;

function readContextSecrets() {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(NOX_CONTEXT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveContextSecret(text, userName = "") {
  const trimmed = String(text || "").trim();

  if (!trimmed || typeof window === "undefined") return [];

  const secrets = readContextSecrets();
  const nextSecrets = [
    {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: new Date().toISOString(),
      userName,
      text: trimmed
    },
    ...secrets
  ].slice(0, 80);

  window.localStorage.setItem(NOX_CONTEXT_KEY, JSON.stringify(nextSecrets));
  window.dispatchEvent(new CustomEvent("nox:context-secrets-updated", { detail: nextSecrets }));

  return nextSecrets;
}

function getContextSecretsText() {
  return readContextSecrets()
    .map((entry) => {
      const who = entry.userName ? `${entry.userName} : ` : "";
      return `${who}${entry.text}`;
    })
    .join("\n");
}

function shouldOfferSecretum(user) {
  if (!user) return false;

  const score = Math.max(0, Number(user.score) || 0);
  const isMathieu = normalizeCardLabel(user.name || "") === "mathieu";

  if (isMathieu) return true;

  if (score < SECRETUM_INTERVAL) return false;

  const currentLevel = Math.floor(score / SECRETUM_INTERVAL);
  const unlocked = Math.max(0, Number(user.secretumUnlockedLevel) || 0);

  return currentLevel > unlocked;
}

const FATUM_USERS_KEY = "nox:fatum-users-cache";
const FATUM_ACTIVE_USER_KEY = "nox:fatum-active-user";
const NOX_DEV_USER_KEY = "nox:dev-user";

function readNoxSessionUser() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(NOX_DEV_USER_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.name ? parsed : null;
  } catch {
    return null;
  }
}

function findFatumUserByName(users, name) {
  const normalizedName = normalizeCardLabel(name || "");
  if (!normalizedName) return null;

  return users.find((user) => normalizeCardLabel(user.name || "") === normalizedName) || null;
}

async function ensureSessionFatumUser(baseUsers = readFatumUsers()) {
  const sessionUser = readNoxSessionUser();
  const sessionName = sessionUser?.name || "";

  if (!sessionName) return { user: null, users: baseUsers, sessionName: "" };

  const matchedUser = findFatumUserByName(baseUsers, sessionName);
  if (matchedUser) {
    window.localStorage.setItem(FATUM_ACTIVE_USER_KEY, matchedUser.id);
    return { user: matchedUser, users: baseUsers, sessionName };
  }

  const nextUsers = await createServerFatumUser(sessionName);
  const createdUser = findFatumUserByName(nextUsers, sessionName) || nextUsers[nextUsers.length - 1] || null;

  if (createdUser?.id) {
    window.localStorage.setItem(FATUM_ACTIVE_USER_KEY, createdUser.id);
  }

  return { user: createdUser, users: nextUsers, sessionName };
}

async function fetchServerFatumUsers() {
  const response = await fetch("/api/fatum-users", { cache: "no-store" });
  const data = await response.json();

  if (!response.ok) throw new Error(data?.error || "Fatum users unavailable");

  writeFatumUsers(data.users || []);
  return data.users || [];
}

function readFatumUsers() {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(FATUM_USERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeFatumUsers(users) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(FATUM_USERS_KEY, JSON.stringify(users.slice(0, 9)));
  window.dispatchEvent(new CustomEvent("nox:fatum-users-updated"));
}

async function createServerFatumUser(name) {
  const response = await fetch("/api/fatum-users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name })
  });
  const data = await response.json();

  if (!response.ok) throw new Error(data?.error || "Fatum user create failed");

  writeFatumUsers(data.users || []);
  return data.users || [];
}

async function updateServerFatumUser(id, patch) {
  const response = await fetch(`/api/fatum-users/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch)
  });
  const data = await response.json();

  if (!response.ok) throw new Error(data?.error || "Fatum user update failed");

  writeFatumUsers(data.users || []);
  return data.users || [];
}

function getCurrentOracleKey(reading, question = "") {
  return `${question || ""}::${reading?.oracleSentence || ""}::${reading?.action || ""}::${getFatumScore(reading, question)}`;
}

function decomposeFatum(score) {
  let remaining = Math.max(0, Math.floor(Number(score) || 0));
  const oculus = Math.floor(remaining / 1000);
  remaining %= 1000;
  const maleficium = Math.floor(remaining / 500);
  remaining %= 500;
  const manus = Math.floor(remaining / 100);
  remaining %= 100;
  const calvaria = Math.floor(remaining / 50);

  return { oculus, maleficium, manus, calvaria };
}

function FatumIcon({ src, label, large = false, invert = false }) {
  const sizeClass = large ? "h-10 w-10 object-contain" : "h-5 w-5 object-contain";
  const colorClass = invert ? "[filter:brightness(0)_invert(1)]" : "";

  return (
    <img
      src={src}
      alt={label}
      title={label}
      className={[sizeClass, colorClass].join(" ")}
      draggable={false}
    />
  );
}

function FatumGlyphs({ score, invert = false }) {
  const parts = decomposeFatum(score);

  return (
    <div className="mt-2 flex min-h-[3rem] flex-wrap items-end justify-center gap-1.5">
      {Array.from({ length: parts.oculus }).map((_, index) => (
        <FatumIcon key={`oculus-${index}`} src="/images/fatum/oculus.png" label="Oculus — 1000 pts" large invert={invert} />
      ))}
      {Array.from({ length: parts.maleficium }).map((_, index) => (
        <FatumIcon key={`maleficium-${index}`} src="/images/fatum/maleficium.png" label="Maleficium — 500 pts" invert={invert} />
      ))}
      {Array.from({ length: parts.manus }).map((_, index) => (
        <FatumIcon key={`manus-${index}`} src="/images/fatum/manus.png" label="Manus — 100 pts" invert={invert} />
      ))}
      {Array.from({ length: parts.calvaria }).map((_, index) => (
        <FatumIcon key={`calvaria-${index}`} src="/images/fatum/calvaria.png" label="Calvaria — 50 pts" invert={invert} />
      ))}
    </div>
  );
}


const SALVATIO_COST = 50;
const SALVATIO_CARD_SRC = "/images/salvatio/salvatio-card.png?v=1";
const SALVATIO_ANGUIS_SRC = "/images/salvatio/anguis.png?v=1";
const SALVATIO_SKULL_SRC = "/images/fatum/calvaria.png";

const SALVATIO_ZONES = [
  { id: "sinistra-superior", x: 15.2, y: 51.4, size: 11.8 },
  { id: "sinistra-inferior", x: 18.8, y: 65.0, size: 11.8 },
  { id: "ima-sinistra", x: 31.0, y: 73.5, size: 11.8 },
  { id: "ima-media", x: 50.0, y: 73.6, size: 11.8 },
  { id: "ima-dextra", x: 69.2, y: 73.5, size: 11.8 },
  { id: "dextra-inferior", x: 83.6, y: 65.0, size: 11.8 },
  { id: "dextra-superior", x: 86.0, y: 51.4, size: 11.8 }
];

function pickWeightedLucrum() {
  const options = [
    { value: 0, weight: 42 },
    { value: 10, weight: 28 },
    { value: 30, weight: 17 },
    { value: 50, weight: 9 },
    { value: 100, weight: 3.6 },
    { value: 1000, weight: 0.4 }
  ];
  const total = options.reduce((sum, option) => sum + option.weight, 0);
  let cursor = Math.random() * total;

  for (const option of options) {
    cursor -= option.weight;
    if (cursor <= 0) return option.value;
  }

  return 0;
}

function shuffleValues(values) {
  const next = [...values];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [next[index], next[target]] = [next[target], next[index]];
  }
  return next;
}

function createSalvatioSymbols() {
  const roll = Math.random();
  const anguisCount = roll < 0.16 ? 2 : roll < 0.5 ? 1 : 0;
  return shuffleValues([
    ...Array.from({ length: anguisCount }, () => "anguis"),
    ...Array.from({ length: SALVATIO_ZONES.length - anguisCount }, () => "calvaria")
  ]);
}

function ScratchPatch({ disabled, resetSignal = 0, className = "", onReveal }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const revealedRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const size = 180;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = size * ratio;
    canvas.height = size * ratio;
    canvas.style.width = "100%";
    canvas.style.height = "100%";

    const context = canvas.getContext("2d");
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    revealedRef.current = false;

    const gradient = context.createRadialGradient(size * 0.35, size * 0.25, size * 0.08, size * 0.5, size * 0.5, size * 0.7);
    gradient.addColorStop(0, "rgba(232, 229, 216, 1)");
    gradient.addColorStop(0.55, "rgba(177, 174, 164, 1)");
    gradient.addColorStop(1, "rgba(112, 108, 101, 1)");

    context.clearRect(0, 0, size, size);
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(size / 2, size / 2, size * 0.46, 0, Math.PI * 2);
    context.fill();

    context.globalAlpha = 0.28;
    context.strokeStyle = "#f5f0df";
    context.lineWidth = 1;
    for (let line = 0; line < 20; line += 1) {
      context.beginPath();
      context.moveTo(20, 18 + line * 7);
      context.lineTo(160, 6 + line * 8);
      context.stroke();
    }
    context.globalAlpha = 1;
  }, [resetSignal]);

  const scratchAt = (event) => {
    const canvas = canvasRef.current;
    if (!canvas || disabled || revealedRef.current) return;

    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const clientX = event.clientX ?? event.touches?.[0]?.clientX;
    const clientY = event.clientY ?? event.touches?.[0]?.clientY;
    if (clientX === undefined || clientY === undefined) return;

    const size = 180;
    const x = ((clientX - rect.left) / rect.width) * size;
    const y = ((clientY - rect.top) / rect.height) * size;
    const context = canvas.getContext("2d");

    context.save();
    context.globalCompositeOperation = "destination-out";
    context.beginPath();
    context.arc(x, y, size * 0.23, 0, Math.PI * 2);
    context.fill();
    context.restore();

    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let covered = 0;
    let transparent = 0;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] > 0) covered += 1;
      if (pixels[index] < 12) transparent += 1;
    }

    const totalScratchSurface = covered + transparent;
    if (totalScratchSurface > 0 && transparent / totalScratchSurface > 0.38) {
      revealedRef.current = true;
      onReveal();
    }
  };

  return (
    <canvas
      ref={canvasRef}
      className={["absolute inset-0 z-20 h-full w-full touch-none rounded-full", className].join(" ")}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture?.(event.pointerId);
        drawingRef.current = true;
        scratchAt(event);
      }}
      onPointerMove={(event) => {
        if (drawingRef.current) scratchAt(event);
      }}
      onPointerUp={(event) => {
        drawingRef.current = false;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      }}
      onPointerCancel={() => {
        drawingRef.current = false;
      }}
      onPointerLeave={() => {
        drawingRef.current = false;
      }}
    />
  );
}

function SalvatioScreen({ onIterum, onClaves, onNoctem, onVerbatim, onDuodecim, onBulla, onArchive, onFatum }) {
  const [users, setUsers] = useState(() => readFatumUsers());
  const [activeUserId, setActiveUserId] = useState(() => window.localStorage.getItem(FATUM_ACTIVE_USER_KEY) || "");
  const [sessionName, setSessionName] = useState(() => readNoxSessionUser()?.name || "");
  const [paymentOpen, setPaymentOpen] = useState(true);
  const [paid, setPaid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [symbols, setSymbols] = useState(() => createSalvatioSymbols());
  const [revealed, setRevealed] = useState([]);
  const [lucrum, setLucrum] = useState(() => pickWeightedLucrum());
  const [lucrumUnlocked, setLucrumUnlocked] = useState(false);
  const [lucrumRevealed, setLucrumRevealed] = useState(false);
  const [settled, setSettled] = useState(false);
  const [scratchReset, setScratchReset] = useState(0);

  const activeUser = users.find((user) => user.id === activeUserId);
  const score = Number(activeUser?.score) || 0;
  const revealedAnguis = revealed.filter((index) => symbols[index] === "anguis").length;

  const refreshUsers = () => {
    const nextUsers = readFatumUsers();
    setUsers(nextUsers);
    setActiveUserId(window.localStorage.getItem(FATUM_ACTIVE_USER_KEY) || "");
    setSessionName(readNoxSessionUser()?.name || "");
  };

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      const currentSessionName = readNoxSessionUser()?.name || "";
      setSessionName(currentSessionName);

      if (!currentSessionName) {
        setUsers(readFatumUsers());
        setActiveUserId("");
        setStatus("error");
        setMessage("Session intratum absente. Revenez à l’entrée de Nox.");
        return;
      }

      try {
        const serverUsers = await fetchServerFatumUsers();
        const ensured = await ensureSessionFatumUser(serverUsers);
        if (cancelled) return;
        setUsers(ensured.users);
        setActiveUserId(ensured.user?.id || "");
      } catch {
        const cachedUsers = readFatumUsers();
        const cachedUser = findFatumUserByName(cachedUsers, currentSessionName);
        if (cachedUser?.id) window.localStorage.setItem(FATUM_ACTIVE_USER_KEY, cachedUser.id);
        if (cancelled) return;
        setUsers(cachedUsers);
        setActiveUserId(cachedUser?.id || "");
      }
    };

    boot();
    window.addEventListener("nox:fatum-users-updated", refreshUsers);
    return () => {
      cancelled = true;
      window.removeEventListener("nox:fatum-users-updated", refreshUsers);
    };
  }, []);

  const applyUserScore = async (nextScore) => {
    const currentUser = readFatumUsers().find((user) => user.id === activeUserId) || activeUser;
    if (!currentUser?.id) throw new Error("No active Fatum user");

    const nextUsers = await updateServerFatumUser(currentUser.id, {
      score: Math.max(0, Math.floor(Number(nextScore) || 0)),
      credited: Array.isArray(currentUser.credited) ? currentUser.credited : [],
      secretumUnlockedLevel: Number(currentUser.secretumUnlockedLevel) || 0
    });
    setUsers(nextUsers);
    return nextUsers.find((user) => user.id === currentUser.id);
  };

  const resetPlayState = () => {
    setSymbols(createSalvatioSymbols());
    setRevealed([]);
    setLucrum(pickWeightedLucrum());
    setLucrumUnlocked(false);
    setLucrumRevealed(false);
    setSettled(false);
    setScratchReset((value) => value + 1);
  };

  const paySalvatio = async () => {
    if (!sessionName) {
      setStatus("error");
      setMessage("Session intratum absente. Revenez à l’entrée de Nox.");
      return;
    }

    if (!activeUser) {
      setStatus("error");
      setMessage("Profil Fatum introuvable pour cette session.");
      return;
    }

    if (score < SALVATIO_COST) {
      setStatus("error");
      setMessage(`Solde insuffisant : ${score} Fat. disponibles, ${SALVATIO_COST} Fat. requis.`);
      return;
    }

    setBusy(true);
    setStatus("syncing");
    setMessage("Paiement en cours.");

    try {
      await applyUserScore(score - SALVATIO_COST);
      resetPlayState();
      setPaid(true);
      setPaymentOpen(false);
      setStatus("ok");
      setMessage("Paiement accepté. Salvatio est ouverte.");
    } catch {
      setStatus("error");
      setMessage("Paiement impossible. Le solde Fatum n’a pas été modifié.");
    } finally {
      setBusy(false);
    }
  };

  const revealLucrum = async () => {
    if (!lucrumUnlocked || lucrumRevealed || !activeUser) return;

    setLucrumRevealed(true);
    setSettled(true);
    setStatus("syncing");
    setMessage(`Lucrum révélé : ${lucrum} Fat.`);

    try {
      const currentUser = readFatumUsers().find((user) => user.id === activeUserId) || activeUser;
      await applyUserScore((Number(currentUser?.score) || 0) + lucrum);
      setStatus("ok");
      setMessage(`Salvatio accomplie. Lucrum versé : ${lucrum} Fat.`);
    } catch {
      setStatus("error");
      setMessage(`Lucrum gagné (${lucrum} Fat.), mais le versement a échoué.`);
    }
  };

  const revealZone = (index) => {
    if (!paid || settled || revealed.includes(index)) return;

    const nextRevealed = [...revealed, index];
    setRevealed(nextRevealed);

    const nextAnguis = nextRevealed.filter((entry) => symbols[entry] === "anguis").length;

    if (nextAnguis >= 2) {
      setLucrumUnlocked(true);
      setStatus("ok");
      setMessage("Deux signes Anguis découverts. Grattez le Lucrum.");
      return;
    }

    if (nextRevealed.length === SALVATIO_ZONES.length) {
      setSettled(true);
      setStatus("lost");
      setMessage("Aucun Lucrum : deux signes Anguis n’ont pas été découverts.");
    }
  };

  const resetPayment = () => {
    setPaid(false);
    setPaymentOpen(true);
    resetPlayState();
    setStatus("idle");
    setMessage("");
  };

  return (
    <main className="min-h-screen bg-[#080807] px-4 pb-28 pt-[max(4.75rem,env(safe-area-inset-top))] text-white">
      <ActionButtons
        onIterum={onIterum}
        onClaves={onClaves}
        onNoctem={onNoctem}
        onVerbatim={onVerbatim}
        onDuodecim={onDuodecim}
        onBulla={onBulla}
        onArchive={onArchive}
        onFatum={onFatum}
        onSalvatio={() => {}}
        active="Salvatio"
        compact
      />

      <section className="mx-auto max-w-[560px]">
        <div className="mb-3 px-1 text-center">
          <h1 className="text-2xl font-semibold uppercase tracking-[0.18em]">Salvatio</h1>
          <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/52">Alea · 50 Fat. par tentative</p>
          <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-white/62">
            {activeUser?.name || sessionName || "Session absente"} · <span className="text-white">{score} Fat.</span>
          </p>
        </div>

        <div className="relative mx-auto aspect-square w-full overflow-hidden rounded-[1.25rem] shadow-2xl shadow-black/50">
          <img src={SALVATIO_CARD_SRC} alt="Carte Salvatio" className="absolute inset-0 h-full w-full select-none object-cover" draggable={false} />

          <div className="pointer-events-none absolute left-[8.8%] top-[84.7%] z-[11] flex h-[7.6%] w-[28.3%] items-center justify-center rounded-[0.4rem] bg-[#11100d]/88 text-[clamp(0.7rem,3.2vw,1.2rem)] font-semibold uppercase tracking-[0.08em] text-white/88">
            Lucrum
          </div>
          <div className="pointer-events-none absolute left-[42%] top-[84.3%] z-[11] flex h-[8.4%] w-[48%] items-center justify-start gap-[1.4%] rounded-[0.4rem] bg-[#11100d]/88 px-[2%] text-left text-[clamp(0.44rem,1.9vw,0.72rem)] font-semibold leading-[1.1] text-white/82">
            <span>Trouvez deux signes</span>
            <img src={SALVATIO_ANGUIS_SRC} alt="Anguis" className="h-[1.3em] w-[1.3em] object-contain [filter:brightness(0)_invert(1)]" draggable={false} />
            <span>et remportez le Lucrum.</span>
          </div>

          {SALVATIO_ZONES.map((zone, index) => {
            const revealedZone = revealed.includes(index);
            const symbol = symbols[index];
            const icon = symbol === "anguis" ? SALVATIO_ANGUIS_SRC : SALVATIO_SKULL_SRC;
            const label = symbol === "anguis" ? "Anguis" : "Calvaria";

            return (
              <div
                key={zone.id}
                className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.size}%`, height: `${zone.size}%` }}
              >
                <div className="absolute inset-[12%] z-0 flex items-center justify-center rounded-full bg-[#ece4d0] shadow-inner shadow-black/40">
                  <img
                    src={icon}
                    alt={label}
                    className={[
                      "h-[62%] w-[62%] object-contain transition duration-500",
                      symbol === "anguis" ? "" : "opacity-92 [filter:brightness(0)]"
                    ].join(" ")}
                    draggable={false}
                  />
                </div>
                {!revealedZone ? <ScratchPatch disabled={!paid || settled} resetSignal={scratchReset} onReveal={() => revealZone(index)} /> : null}
              </div>
            );
          })}

          {lucrumUnlocked ? (
            <div className="absolute left-[8.8%] top-[84.8%] z-20 h-[8.3%] w-[27.8%] overflow-hidden rounded-[0.7rem] border border-white/24 bg-[#ece4d0] shadow-inner shadow-black/50">
              <div className="absolute inset-0 z-0 flex items-center justify-center bg-[#ece4d0] text-[clamp(0.7rem,3.2vw,1.1rem)] font-semibold uppercase tracking-[0.08em] text-black">
                {lucrum} Fat.
              </div>
              {!lucrumRevealed ? (
                <ScratchPatch
                  disabled={!lucrumUnlocked || lucrumRevealed}
                  resetSignal={scratchReset}
                  className="rounded-[0.7rem]"
                  onReveal={revealLucrum}
                />
              ) : null}
            </div>
          ) : null}

          {!paid ? <div className="absolute inset-0 z-30 bg-black/24 backdrop-blur-[1px]" /> : null}
        </div>

        <div className="mt-4 min-h-[4.2rem] border border-white/18 bg-black/52 px-4 py-3 text-center shadow-xl">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/46">État</p>
          <p className="mt-1 text-sm text-white/88">{message || "Cramez 50 Fat. pour ouvrir Salvatio."}</p>
          {paid ? (
            <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-white/48">
              Anguis révélés : {revealedAnguis}/2{lucrumUnlocked ? " · Lucrum ouvert" : ""}
            </p>
          ) : null}
        </div>

        <div className="mt-4 flex justify-center gap-3">
          <button
            type="button"
            className="border border-white/30 px-4 py-2 text-[10px] uppercase tracking-[0.16em] text-white active:scale-95 disabled:opacity-35"
            onClick={() => setPaymentOpen(true)}
            disabled={paid || busy}
          >
            Jouer
          </button>
          <button
            type="button"
            className="border border-white/18 px-4 py-2 text-[10px] uppercase tracking-[0.16em] text-white/68 active:scale-95 disabled:opacity-35"
            onClick={resetPayment}
            disabled={busy}
          >
            Nouvelle tentative
          </button>
        </div>
      </section>

      {paymentOpen && !paid ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/68 px-5 backdrop-blur-sm">
          <motion.div
            className="w-full max-w-[360px] border border-white/28 bg-[#0b0a09] px-5 py-5 text-center text-white shadow-2xl"
            initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/48">Paiement Fatum</p>
            <h2 className="mt-2 text-2xl font-semibold uppercase tracking-[0.14em]">Salvatio</h2>
            <p className="mt-4 flex flex-wrap items-center justify-center gap-1.5 text-sm leading-relaxed text-white/76">
              <span>Cramer 50 Fat. pour jouer ? Trouvez deux signes</span>
              <img src={SALVATIO_ANGUIS_SRC} alt="Anguis" className="inline h-5 w-5 object-contain [filter:brightness(0)_invert(1)]" draggable={false} />
              <span>et remportez le Lucrum.</span>
            </p>
            <div className="mt-4 border border-white/14 bg-white/[0.04] px-3 py-3 text-[11px] uppercase tracking-[0.14em] text-white/62">
              <p>{activeUser?.name || sessionName || "Session intratum absente"}</p>
              <p className="mt-1 text-white">Solde : {score} Fat.</p>
            </div>
            {status === "error" && message ? <p className="mt-3 text-xs text-white/72">{message}</p> : null}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                className="border border-white/22 px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-white/62 active:scale-95 disabled:opacity-35"
                onClick={() => setPaymentOpen(false)}
                disabled={busy}
              >
                Refuser
              </button>
              <button
                type="button"
                className="border border-white bg-white px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-black active:scale-95 disabled:opacity-35"
                onClick={paySalvatio}
                disabled={busy || !activeUser || score < SALVATIO_COST}
              >
                {busy ? "Paiement…" : "Payer 50 Fat."}
              </button>
            </div>
            {!sessionName ? (
              <button
                type="button"
                className="mt-4 text-[10px] uppercase tracking-[0.16em] text-white/52 underline underline-offset-4"
                onClick={onIterum}
              >
                Revenir à Intratum
              </button>
            ) : null}
          </motion.div>
        </div>
      ) : null}
    </main>
  );
}

function FatumScreen({ reading, question, onIterum, onClaves, onNoctem, onVerbatim, onDuodecim, onBulla, onArchive, onSalvatio }) {
  const [users, setUsers] = useState(() => readFatumUsers());
  const [activeUserId, setActiveUserId] = useState(() => window.localStorage.getItem(FATUM_ACTIVE_USER_KEY) || "");
  const [creating, setCreating] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [secretumVisible, setSecretumVisible] = useState(false);
  const [secretumActive, setSecretumActive] = useState(false);
  const [secretumStatus, setSecretumStatus] = useState("idle");
  const [syncStatus, setSyncStatus] = useState("idle");
  const secretumRecognitionRef = useRef(null);
  const secretumTranscriptRef = useRef("");
  const secretumTimerRef = useRef(null);
  const currentScore = getFatumScore(reading, question);
  const currentOracleKey = getCurrentOracleKey(reading, question);
  const activeUser = users.find((user) => user.id === activeUserId);
  const sortedUsers = [...users].sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));

  const persistUsers = (nextUsers) => {
    writeFatumUsers(nextUsers);
    setUsers(nextUsers.slice(0, 9));
  };

  const creditUser = async (userId, baseUsers = readFatumUsers()) => {
    const user = baseUsers.find((item) => item.id === userId);
    if (!user) return;

    const credited = Array.isArray(user.credited) ? user.credited : [];
    if (credited.includes(currentOracleKey)) return;

    const patch = {
      score: Math.max(0, Number(user.score) || 0) + currentScore,
      credited: [currentOracleKey, ...credited].slice(0, 500)
    };

    setSyncStatus("syncing");

    try {
      const nextUsers = await updateServerFatumUser(userId, patch);
      persistUsers(nextUsers);
      setSyncStatus("ok");
    } catch {
      persistUsers(baseUsers);
      setSyncStatus("error");
    }
  };

  const markSecretumLevel = async (userId) => {
    const user = readFatumUsers().find((item) => item.id === userId);
    if (!user) return;

    const score = Math.max(0, Number(user.score) || 0);
    const isMathieu = normalizeCardLabel(user.name || "") === "mathieu";
    const patch = {
      secretumUnlockedLevel: isMathieu
        ? Number(user.secretumUnlockedLevel) || 0
        : Math.max(Number(user.secretumUnlockedLevel) || 0, Math.floor(score / SECRETUM_INTERVAL))
    };

    try {
      const nextUsers = await updateServerFatumUser(userId, patch);
      persistUsers(nextUsers);
    } catch {
      // Server sync failed silently.
    }
  };

  useEffect(() => {
    setSyncStatus("syncing");

    fetchServerFatumUsers()
      .then((serverUsers) => {
        setUsers(serverUsers);
        setSyncStatus("ok");
      })
      .catch(() => {
        setUsers(readFatumUsers());
        setSyncStatus("error");
      });

    const refresh = () => {
      setUsers(readFatumUsers());
    };

    window.addEventListener("storage", refresh);
    window.addEventListener("nox:fatum-users-updated", refresh);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("nox:fatum-users-updated", refresh);

      if (secretumRecognitionRef.current) {
        try {
          secretumRecognitionRef.current.abort();
        } catch {
          // Ignore.
        }
      }

      window.clearTimeout(secretumTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (activeUserId) {
      creditUser(activeUserId);
    }
  }, [activeUserId]);

  useEffect(() => {
    const user = readFatumUsers().find((item) => item.id === activeUserId);
    if (shouldOfferSecretum(user)) {
      setSecretumVisible(true);
      setSecretumStatus("idle");
    }
  }, [activeUserId, users.length]);

  const selectUser = (id) => {
    if (activeUserId && id !== activeUserId) return;

    setActiveUserId(id);
    window.localStorage.setItem(FATUM_ACTIVE_USER_KEY, id);

    if (!activeUserId) {
      creditUser(id);
    }
  };

  const createUser = async () => {
    const name = nameValue.trim();

    if (!name || users.length >= 9) return;

    setSyncStatus("syncing");

    try {
      const nextUsers = await createServerFatumUser(name);
      persistUsers(nextUsers);
      const createdUser = nextUsers[nextUsers.length - 1];

      setCreating(false);
      setNameValue("");
      setSyncStatus("ok");

      if (createdUser?.id) {
        selectUser(createdUser.id);
      }
    } catch {
      setCreating(false);
      setSyncStatus("error");
    }
  };

  const closeSecretum = () => {
    if (activeUserId) markSecretumLevel(activeUserId);
    setSecretumVisible(false);
    setSecretumActive(false);
    setSecretumStatus("idle");

    if (secretumRecognitionRef.current) {
      try {
        secretumRecognitionRef.current.abort();
      } catch {
        // Ignore.
      }
    }

    window.clearTimeout(secretumTimerRef.current);
  };

  const finishSecretum = async () => {
    const text = secretumTranscriptRef.current.trim();

    if (text) {
      try {
        const response = await fetch("/api/context-secret", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            userName: activeUser?.name || ""
          })
        });

        if (!response.ok) {
          throw new Error("Secretum server write failed");
        }

        if (activeUserId) markSecretumLevel(activeUserId);
        setSecretumStatus("sculpted");
      } catch {
        setSecretumStatus("fractum");
      }
    } else {
      setSecretumStatus("empty");
    }

    setSecretumActive(false);
    window.clearTimeout(secretumTimerRef.current);

    if (secretumRecognitionRef.current) {
      try {
        secretumRecognitionRef.current.abort();
      } catch {
        // Ignore.
      }
    }

    secretumRecognitionRef.current = null;
  };

  const startSecretum = (event) => {
    event.preventDefault();
    event.stopPropagation();

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSecretumStatus("fractum");
      return;
    }

    secretumTranscriptRef.current = "";
    setSecretumStatus("listening");

    const recognition = new SpeechRecognition();
    recognition.lang = "fr-FR";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setSecretumActive(true);
      window.clearTimeout(secretumTimerRef.current);
      secretumTimerRef.current = window.setTimeout(finishSecretum, 5 * 60 * 1000);
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

      secretumTranscriptRef.current = `${finalText} ${interimText}`.trim();
    };

    recognition.onerror = () => {
      setSecretumActive(false);
      setSecretumStatus("fractum");
    };

    recognition.onend = () => {
      if (secretumActive) finishSecretum();
    };

    secretumRecognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      setSecretumActive(false);
      setSecretumStatus("fractum");
    }
  };

  const stopSecretum = (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (!secretumRecognitionRef.current) return;

    try {
      secretumRecognitionRef.current.stop();
    } catch {
      finishSecretum();
    }
  };

  return (
    <motion.main
      className="fixed inset-0 overflow-y-auto bg-black px-5 pb-40 pt-[max(1.5rem,env(safe-area-inset-top))] text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: FADE_DURATION, ease: "easeInOut" }}
    >
      <h1 className="mt-14 mb-1 text-center text-3xl font-semibold tracking-[0.12em]">Fatum</h1>
      {syncStatus === "error" ? (
        <p className="mb-3 text-center text-[9px] uppercase tracking-[0.18em] text-red-400">Memoria fracta.</p>
      ) : syncStatus === "syncing" ? (
        <p className="mb-3 text-center text-[9px] uppercase tracking-[0.18em] text-white/35">Memoria.</p>
      ) : (
        <p className="mb-3 text-center text-[9px] uppercase tracking-[0.18em] text-white/30">{users.length} socii</p>
      )}
      <div className="sticky top-[max(0.75rem,env(safe-area-inset-top))] z-30 mb-5 flex justify-center px-1">
        <div className="flex h-[28px] items-center justify-center gap-2">
          <button
            type="button"
            className="h-[28px] select-none border border-white bg-white px-2 text-[7px] uppercase tracking-[0.13em] text-black active:scale-95"
            onClick={() => {
              if (users.length < 9) setCreating(true);
            }}
          >
            Novus socius +
          </button>

          <div className="grid h-[28px] grid-cols-2 gap-x-2 gap-y-0 bg-transparent px-1 text-white">
            <div className="flex items-center gap-1 text-[5.5px] uppercase leading-none">
              <img src="/images/fatum/calvaria.png" alt="" className="h-2.5 w-2.5 object-contain [filter:brightness(0)_invert(1)]" />
              <span>Calvaria 50</span>
            </div>
            <div className="flex items-center gap-1 text-[5.5px] uppercase leading-none">
              <img src="/images/fatum/manus.png" alt="" className="h-2.5 w-2.5 object-contain [filter:brightness(0)_invert(1)]" />
              <span>Manus 100</span>
            </div>
            <div className="flex items-center gap-1 text-[5.5px] uppercase leading-none">
              <img src="/images/fatum/maleficium.png" alt="" className="h-2.5 w-2.5 object-contain [filter:brightness(0)_invert(1)]" />
              <span>Maleficium 500</span>
            </div>
            <div className="flex items-center gap-1 text-[5.5px] uppercase leading-none">
              <img src="/images/fatum/oculus.png" alt="" className="h-2.5 w-2.5 object-contain [filter:brightness(0)_invert(1)]" />
              <span>Oculus 1000</span>
            </div>
          </div>
        </div>
      </div>

      {users.length ? (
        <div className="mx-auto grid max-w-[760px] grid-cols-1 gap-4 sm:grid-cols-2">
          {sortedUsers.map((user) => (
            <button
              key={user.id}
              type="button"
              className={[
                "select-none border p-4 text-center active:scale-[0.99]",
                user.id === activeUserId ? "border-white bg-white text-black" : "border-white/28 bg-transparent text-white"
              ].join(" ")}
              onClick={() => selectUser(user.id)}
            >
              <p className="text-sm uppercase tracking-[0.2em]">{user.name}</p>
              <FatumGlyphs score={user.score} invert={user.id !== activeUserId} />
              <p className="mt-3 text-[11px] uppercase tracking-[0.16em] opacity-65">{user.score || 0} pts</p>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex min-h-[45vh] items-center justify-center text-center">
          <p className="text-sm uppercase tracking-[0.2em] text-white/45">Nullus socius.</p>
        </div>
      )}

      {creating ? (
        <motion.div
          className="fixed inset-x-5 top-1/2 z-50 -translate-y-1/2 border border-white bg-black p-5 text-white shadow-2xl"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: FADE_DURATION, ease: "easeInOut" }}
        >
          <input
            className="w-full border border-white/45 bg-black p-4 text-center text-xl outline-none"
            value={nameValue}
            onChange={(event) => setNameValue(event.target.value)}
            placeholder="Nomen"
            maxLength={24}
            autoFocus
          />
          <div className="mt-4 flex justify-center gap-2">
            <button type="button" className="border border-white px-4 py-2 text-[10px] uppercase tracking-[0.16em]" onClick={createUser}>
              Scribere
            </button>
            <button type="button" className="border border-white/35 px-4 py-2 text-[10px] uppercase tracking-[0.16em] text-white/55" onClick={() => setCreating(false)}>
              Claudere
            </button>
          </div>
        </motion.div>
      ) : null}

      {secretumVisible ? (
        <motion.div
          className="fixed inset-x-5 top-1/2 z-50 -translate-y-1/2 border border-white bg-black px-6 py-7 text-center text-white shadow-2xl"
          initial={{ opacity: 0, y: 18, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: FADE_DURATION, ease: "easeInOut" }}
          onClick={() => {
            if (secretumStatus === "sculpted" || secretumStatus === "empty" || secretumStatus === "fractum") {
              closeSecretum();
            }
          }}
        >
          <p className="text-2xl font-semibold tracking-[0.08em]">Secretum committere ?</p>
          <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-white/45">Vox : 5 min max.</p>

          <div className="mt-7 flex items-center justify-center gap-8">
            <button
              type="button"
              className="touch-none"
              onPointerDown={startSecretum}
              onPointerUp={stopSecretum}
              onPointerCancel={stopSecretum}
            >
              <MicrophoneIcon active={secretumActive} />
            </button>

            <button
              type="button"
              className="select-none text-4xl active:scale-95"
              aria-label="Chut"
              onClick={(event) => {
                event.stopPropagation();
                closeSecretum();
              }}
            >
              🤫
            </button>
          </div>

          {secretumStatus === "sculpted" ? (
            <motion.p
              className="mt-6 text-sm uppercase tracking-[0.18em] text-white/66"
              animate={{ opacity: [0.45, 1, 0.45] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            >
              Arcanum sculptum.
            </motion.p>
          ) : null}
          {secretumStatus === "empty" ? (
            <p className="mt-6 text-sm uppercase tracking-[0.18em] text-white/45">Vacuum.</p>
          ) : null}
          {secretumStatus === "fractum" ? (
            <p className="mt-6 text-sm uppercase tracking-[0.18em] text-white/45">Fractum.</p>
          ) : null}
        </motion.div>
      ) : null}

      <div className="fixed bottom-[max(5.6rem,calc(env(safe-area-inset-bottom)+4.4rem))] left-0 right-0 z-30">
        <ActionButtons
          onIterum={onIterum}
          onClaves={onClaves}
          onNoctem={onNoctem}
          onVerbatim={onVerbatim}
          onDuodecim={onDuodecim}
          onBulla={onBulla}
          onArchive={onArchive}
          onFatum={() => {}}
          onSalvatio={onSalvatio}
          active="Fatum"
          compact
        />
      </div>
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
    action: "Sors marcher dix minutes sans regarder ton téléphone.",
    fatum: 57
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
  const hasDrawnRef = useRef(false);

  const handleDrawClick = (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (hasDrawnRef.current) return;

    hasDrawnRef.current = true;
    onDraw();
  };

  return (
    <Background>
      <button
        type="button"
        aria-label="Tirer"
        className="fixed inset-0 z-30 cursor-pointer touch-manipulation select-none"
        style={{
          WebkitUserSelect: "none",
          userSelect: "none",
          WebkitTouchCallout: "none"
        }}
        onClick={handleDrawClick}
      />
    </Background>
  );
}

function getFatumScore(reading, question = "") {
  const raw = Number(reading?.fatum);

  if (Number.isFinite(raw)) {
    return Math.max(0, Math.min(100, Math.round(raw)));
  }

  const source = `${question} ${reading?.oracleSentence || ""} ${reading?.action || ""}`;
  let hash = 0;

  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) % 9973;
  }

  return 3 + (hash % 95);
}

function FatumIndicator({ score }) {
  const radius = 21;
  const circumference = 2 * Math.PI * radius;
  const normalized = Math.max(0, Math.min(100, Number(score) || 0));
  const offset = circumference * (1 - normalized / 100);

  return (
    <motion.div
      className="pointer-events-none fixed left-1/2 top-[14vh] z-30 -translate-x-1/2 text-center text-white"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 0.86, y: 0 }}
      transition={{ duration: 1.2, ease: "easeInOut" }}
    >
      <svg width="54" height="54" viewBox="0 0 54 54" className="mx-auto">
        <circle
          cx="27"
          cy="27"
          r={radius}
          fill="rgba(0,0,0,0.18)"
          stroke="rgba(255,255,255,0.28)"
          strokeWidth="1"
        />
        <circle
          cx="27"
          cy="27"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.92)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 27 27)"
        />
      </svg>
      <p className="mt-1 text-[9px] uppercase tracking-[0.18em] text-white/74">Fatum</p>
      <p className="text-[10px] tracking-[0.12em] text-white/88">{normalized} pts</p>
    </motion.div>
  );
}


const DIVINATIO_DEFAULT_FACE = "/images/fond-graphique.jpg";

function getCardStaticFront() {
  return DIVINATIO_DEFAULT_FACE;
}

function DharmaWheelIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <circle cx="32" cy="32" r="22" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="32" cy="32" r="7" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="32" cy="32" r="29" stroke="currentColor" strokeWidth="1.6" />
      {Array.from({ length: 8 }).map((_, index) => {
        const angle = (Math.PI * 2 * index) / 8;
        const x1 = 32 + Math.cos(angle) * 9;
        const y1 = 32 + Math.sin(angle) * 9;
        const x2 = 32 + Math.cos(angle) * 28;
        const y2 = 32 + Math.sin(angle) * 28;

        return (
          <line
            key={`wheel-spoke-${index}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

function makeReelCards(finalCard, offset = 0) {
  const pool = [...deck];
  const shuffled = pool
    .map((card, index) => ({ card, sort: Math.sin((index + 1) * (offset + 3.17)) }))
    .sort((a, b) => a.sort - b.sort)
    .map((item) => item.card);

  const reel = [];

  for (let index = 0; index < 42; index += 1) {
    reel.push(shuffled[index % shuffled.length]);
  }

  reel.push(finalCard);
  return reel;
}

function DivinatioScreen({ question, onReadingReady, onClaves, onNoctem, onVerbatim, onDuodecim, onBulla, onArchive, onFatum, onSalvatio }) {
  const [reels, setReels] = useState(() => {
    const initialCards = deck.slice(0, 3);
    return initialCards.map((card, index) => ({
      cards: makeReelCards(card, index),
      target: 0,
      finalCard: card,
      stopped: false
    }));
  });
  const [spinning, setSpinning] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [finalCards, setFinalCards] = useState([]);
  const [reading, setReading] = useState(null);
  const [loadingReading, setLoadingReading] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const closeVideoTimerRef = useRef(null);

  const closeSelectedCard = () => {
    window.clearTimeout(closeVideoTimerRef.current);
    setSelectedCard(null);
  };

  useEffect(() => {
    if (!selectedCard) return undefined;

    window.clearTimeout(closeVideoTimerRef.current);
    closeVideoTimerRef.current = window.setTimeout(() => {
      setSelectedCard(null);
    }, 6000);

    return () => window.clearTimeout(closeVideoTimerRef.current);
  }, [selectedCard]);

  const callReadingApi = async (cards) => {
    const activeQuestion = question || "Question silencieuse";
    const fallback = createFallbackReading(cards, activeQuestion);

    setReading(null);
    setLoadingReading(true);

    try {
      const response = await fetch("/api/reading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: activeQuestion,
          cards: cards.map((card, index) => ({
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

      const apiReading = data.reading || fallback;
      setReading(apiReading);
      onReadingReady?.(cards, apiReading, activeQuestion);
    } catch {
      setReading(fallback);
      onReadingReady?.(cards, fallback, activeQuestion);
    } finally {
      setLoadingReading(false);
    }
  };

  const spin = () => {
    if (spinning || hasDrawn) return;

    const picked = [];
    while (picked.length < 3) {
      const card = pickRandomCard(picked.map((item) => item.slug));
      picked.push(card);
    }

    const nextReels = picked.map((card, index) => {
      const cards = makeReelCards(card, index + Date.now());
      return {
        cards,
        target: cards.length - 1,
        finalCard: card,
        stopped: false
      };
    });

    setHasDrawn(true);
    setSpinning(true);
    setFinalCards([]);
    setReading(null);
    setLoadingReading(false);
    setReels(nextReels);

    [5600, 6350, 7000].forEach((delay, index) => {
      window.setTimeout(() => {
        setReels((current) =>
          current.map((reel, reelIndex) =>
            reelIndex === index ? { ...reel, stopped: true } : reel
          )
        );
      }, delay);
    });

    window.setTimeout(() => {
      setFinalCards(picked);
      setSpinning(false);
      callReadingApi(picked);
    }, 7250);
  };

  const displayedReading = reading;

  return (
    <motion.main
      className="fixed inset-0 overflow-hidden bg-white px-4 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))] text-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: FADE_DURATION, ease: "easeInOut" }}
    >
      <ActionButtons
        onIterum={() => {}}
        onClaves={onClaves}
        onNoctem={onNoctem}
        onVerbatim={onVerbatim}
        onDuodecim={onDuodecim}
        onBulla={onBulla}
        onArchive={onArchive}
        onFatum={onFatum}
        onSalvatio={onSalvatio}
        active="Divinatio"
        compact
      />

      <h1 className={["text-center font-semibold tracking-[0.12em]", hasDrawn ? "mt-11 mb-3 text-2xl" : "mt-14 mb-6 text-3xl"].join(" ")}>Divinatio.</h1>

      <div className={["mx-auto grid grid-cols-3 gap-3", hasDrawn ? "max-w-[310px]" : "max-w-[430px]"].join(" ")}>
        {reels.map((reel, index) => {
          const duration = [5.6, 6.35, 7.0][index];
          const targetY = -((reel.target * 100) / reel.cards.length);
          const card = finalCards[index] || reel.finalCard;
          const showStaticFront = !hasDrawn && !spinning;

          return (
            <button
              key={`reel-${index}`}
              type="button"
              className="relative overflow-hidden bg-white active:scale-[0.985]"
              onClick={() => {
                if (card && hasDrawn && !spinning) setSelectedCard(card);
              }}
            >
              <div className="relative aspect-[9/16] w-full overflow-hidden">
                {showStaticFront ? (
                  <img
                    src={getCardStaticFront()}
                    alt={card.name}
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                ) : (
                  <motion.div
                    className="w-full"
                    style={{ height: `${reel.cards.length * 100}%` }}
                    animate={{ y: `${targetY}%` }}
                    transition={{
                      duration,
                      ease: [0.08, 0.82, 0.18, 1]
                    }}
                  >
                    {reel.cards.map((slotCard, cardIndex) => (
                      <img
                        key={`${slotCard.slug || slotCard.name}-${cardIndex}`}
                        src={slotCard.imageFace}
                        alt={slotCard.name}
                        className="w-full object-cover"
                        style={{ height: `${100 / reel.cards.length}%` }}
                        draggable={false}
                      />
                    ))}
                  </motion.div>
                )}

              </div>
            </button>
          );
        })}
      </div>

      <div className={["mx-auto grid grid-cols-3 gap-3", hasDrawn ? "mt-3 max-w-[310px]" : "mt-5 max-w-[430px]"].join(" ")}>
        <button
          type="button"
          className="col-start-2 flex aspect-square w-full select-none items-center justify-center bg-transparent text-black active:scale-95 disabled:opacity-25"
          onClick={spin}
          disabled={spinning || hasDrawn}
          aria-label="Tirer"
        >
          <DharmaWheelIcon />
        </button>
      </div>

      {loadingReading ? (
        <motion.p
          className="mt-1 text-center text-[10px] uppercase tracking-[0.22em] text-black/38"
          animate={{ opacity: [0.35, 0.85, 0.35] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        >
          Oraculum.
        </motion.p>
      ) : null}

      {displayedReading ? (
        <motion.section
          className="mx-auto mt-0 max-w-[430px] bg-white px-4 pb-2 pt-0 text-center"
          initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.85, ease: "easeInOut" }}
        >
          <p className="text-[10px] uppercase tracking-[0.22em] text-black/38">Oraculum.</p>
          <p className="mt-2 text-2xl font-semibold leading-8">{displayedReading.oracleSentence}</p>
          <p className="mt-3 text-sm leading-6 text-black/68">{displayedReading.action}</p>
          <p className="mt-3 text-[10px] uppercase tracking-[0.18em] text-black/38">Fatum {getFatumScore(displayedReading, question)} pts</p>
        </motion.section>
      ) : null}

      {selectedCard ? (
        <motion.div
          className="fixed inset-0 z-50 bg-black"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: FADE_DURATION, ease: "easeInOut" }}
          onClick={closeSelectedCard}
        >
          <video
            src={selectedCard.videoFace}
            poster={selectedCard.imageFace}
            className="h-full w-full object-cover"
            autoPlay
            muted
            playsInline
          />
        </motion.div>
      ) : null}
    </motion.main>
  );
}

function ResultScreen({ reading, question, onShowClaves, onShowNoctem, onShowDuodecim, onShowBulla, onShowArchive, onShowFatum, onShowSalvatio }) {
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

  const fatumScore = getFatumScore(reading, question);
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
      return `${base} whitespace-pre-wrap text-lg font-medium leading-7`;
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
      <FatumIndicator score={fatumScore} />

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
                ? "max-h-[42vh] overflow-y-auto overscroll-contain px-1 [scrollbar-width:none] [-ms-overflow-style:none]"
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
                  onNoctem={onShowNoctem}
                  onVerbatim={() => downloadVerbatimPdf(reading, question)}
                  onDuodecim={onShowDuodecim}
                  onBulla={onShowBulla}
                  onArchive={onShowArchive}
                  onFatum={onShowFatum}
                  onSalvatio={onShowSalvatio}
                />
              </motion.div>
            ) : null}
          </motion.div>
        </section>
      )}
    </motion.main>
  );
}


function isDebugModeEnabled() {
  if (typeof window === "undefined") return false;

  const params = new URLSearchParams(window.location.search);
  const requested = params.has("debug") || params.has("fast");
  const host = window.location.hostname;

  const safeDevHost =
    host.includes("-dev") ||
    host.includes("localhost") ||
    host === "127.0.0.1";

  return requested && safeDevHost;
}

function DebugDock({
  onResult,
  onApi,
  onFatum,
  onArchivum,
  onBulla,
  onClaves,
  onNoctem,
  onDuodecim,
  onSalvatio,
  onReset
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="fixed left-3 top-[max(0.8rem,env(safe-area-inset-top))] z-[100] font-sans">
      <button
        type="button"
        className="select-none border border-white bg-black px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-white"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        debug
      </button>

      {open ? (
        <div className="mt-2 grid w-[132px] grid-cols-2 gap-1 border border-white bg-black/88 p-2 text-white shadow-2xl backdrop-blur-md">
          {[
            ["Result", onResult],
            ["API", onApi],
            ["Fatum", onFatum],
            ["Archivum", onArchivum],
            ["Bulla", onBulla],
            ["Claves", onClaves],
            ["Noctem", onNoctem],
            ["Duodecim", onDuodecim],
            ["Salvatio", onSalvatio],
            ["Reset", onReset]
          ].map(([label, action]) => (
            <button
              key={label}
              type="button"
              className="select-none border border-white/50 px-1 py-1 text-[8px] uppercase tracking-[0.08em] active:scale-95"
              onClick={(event) => {
                event.stopPropagation();
                action();
              }}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
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
  const debugMode = isDebugModeEnabled();

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

  const seedDebugReading = () => {
    const debugCards = deck.slice(0, DRAW_TARGET);
    const debugQuestion =
      question ||
      "Question de test : dois-je rester dans le confort ou faire un vrai mouvement maintenant ?";
    const debugReading = createFallbackReading(debugCards, debugQuestion);

    setQuestion(debugQuestion);
    setDrawnCards(debugCards);
    setCurrentCard(null);
    setReading(debugReading);
    setError(null);
    setRevelationEnded(true);

    return { debugCards, debugQuestion, debugReading };
  };

  const goDebugStage = (nextStage) => {
    seedDebugReading();
    setStage(nextStage);
  };

  const goDevHomeStage = (nextStage) => {
    seedDebugReading();
    setStage(nextStage);
  };

  const jumpToOracleEnd = () => {
    const debugCards = deck.slice(0, DRAW_TARGET);
    const debugQuestion =
      question ||
      "Question de test : faut-il rester dans le confort ou faire un vrai mouvement maintenant ?";
    const debugReading = createFallbackReading(debugCards, debugQuestion);

    setQuestion(debugQuestion);
    setDrawnCards(debugCards);
    setCurrentCard(null);
    setReading(debugReading);
    setError(null);
    setRevelationEnded(true);
    setStage("result");
  };

  const generateDebugApiReading = async () => {
    const { debugCards, debugQuestion } = seedDebugReading();

    setError(null);

    try {
      const response = await fetch("/api/reading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: debugQuestion,
          cards: debugCards.map((card, index) => ({
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

      setReading(data.reading || createFallbackReading(debugCards, debugQuestion));
    } catch (apiError) {
      setError(apiError.message);
      setReading(createFallbackReading(debugCards, debugQuestion));
    }

    setStage("result");
  };

  const debugDock = debugMode ? (
    <DebugDock
      onResult={jumpToOracleEnd}
      onApi={generateDebugApiReading}
      onFatum={() => goDebugStage("fatum")}
      onArchivum={() => goDebugStage("archives")}
      onBulla={() => goDebugStage("bulla")}
      onClaves={() => goDebugStage("claves")}
      onNoctem={() => goDebugStage("noctem")}
      onDuodecim={() => goDebugStage("duodecim")}
      onSalvatio={() => goDebugStage("salvatio")}
      onReset={restart}
    />
  ) : null;

  const withFond = (content) => (
    <>
      <PersistentFond />
      {content}
      {debugDock}
    </>
  );

  if (stage === "divinatio") {
    return (
      <DivinatioScreen
        question={question}
        onReadingReady={(cards, nextReading, nextQuestion) => {
          setQuestion(nextQuestion);
          setDrawnCards(cards);
          setReading(nextReading);
          setError(null);
          setRevelationEnded(true);
        }}
        onClaves={() => setStage("claves")}
        onNoctem={() => setStage("noctem")}
        onVerbatim={() => downloadVerbatimPdf(reading || createFallbackReading(drawnCards, question), question)}
        onDuodecim={() => setStage("duodecim")}
        onBulla={() => setStage("bulla")}
        onArchive={() => setStage("archives")}
        onFatum={() => setStage("fatum")}
        onSalvatio={() => setStage("salvatio")}
      />
    );
  }

  if (stage === "salvatio") {
    return (
      <SalvatioScreen
        onIterum={() => setStage("divinatio")}
        onClaves={() => setStage("claves")}
        onNoctem={() => setStage("noctem")}
        onVerbatim={() => downloadVerbatimPdf(reading || createFallbackReading(drawnCards, question), question)}
        onDuodecim={() => setStage("duodecim")}
        onBulla={() => setStage("bulla")}
        onArchive={() => setStage("archives")}
        onFatum={() => setStage("fatum")}
        onSalvatio={() => setStage("salvatio")}
      />
    );
  }

  if (stage === "fatum") {
    return (
      <FatumScreen
        reading={reading || createFallbackReading(drawnCards, question)}
        question={question}
        onIterum={() => setStage("divinatio")}
        onClaves={() => setStage("claves")}
        onNoctem={() => setStage("noctem")}
        onVerbatim={() => downloadVerbatimPdf(reading || createFallbackReading(drawnCards, question), question)}
        onDuodecim={() => setStage("duodecim")}
        onBulla={() => setStage("bulla")}
        onArchive={() => setStage("archives")}
        onFatum={() => setStage("fatum")}
        onSalvatio={() => setStage("salvatio")}
      />
    );
  }

  if (stage === "archives") {
    return (
      <ArchivesScreen
        onIterum={() => setStage("divinatio")}
        onClaves={() => setStage("claves")}
        onNoctem={() => setStage("noctem")}
        onVerbatim={() => downloadVerbatimPdf(reading || createFallbackReading(drawnCards, question), question)}
        onDuodecim={() => setStage("duodecim")}
        onBulla={() => setStage("bulla")}
        onArchive={() => setStage("archives")}
        onFatum={() => setStage("fatum")}
        onSalvatio={() => setStage("salvatio")}
      />
    );
  }

  if (stage === "claves") {
    return (
      <ClavesScreen
        reading={reading || createFallbackReading(drawnCards, question)}
        question={question}
        onIterum={() => setStage("divinatio")}
        onNoctem={() => setStage("noctem")}
        onVerbatim={() => downloadVerbatimPdf(reading || createFallbackReading(drawnCards, question), question)}
        onDuodecim={() => setStage("duodecim")}
        onBulla={() => setStage("bulla")}
        onArchive={() => setStage("archives")}
        onFatum={() => setStage("fatum")}
        onSalvatio={() => setStage("salvatio")}
      />
    );
  }

  if (stage === "noctem") {
    return (
      <NoctemScreen
        reading={reading || createFallbackReading(drawnCards, question)}
        question={question}
        onIterum={() => setStage("divinatio")}
        onClaves={() => setStage("claves")}
        onVerbatim={() => downloadVerbatimPdf(reading || createFallbackReading(drawnCards, question), question)}
        onDuodecim={() => setStage("duodecim")}
        onBulla={() => setStage("bulla")}
        onArchive={() => setStage("archives")}
        onFatum={() => setStage("fatum")}
        onSalvatio={() => setStage("salvatio")}
      />
    );
  }

  if (stage === "duodecim") {
    return (
      <DuodecimScreen
        reading={reading || createFallbackReading(drawnCards, question)}
        question={question}
        onIterum={() => setStage("divinatio")}
        onClaves={() => setStage("claves")}
        onNoctem={() => setStage("noctem")}
        onVerbatim={() => downloadVerbatimPdf(reading || createFallbackReading(drawnCards, question), question)}
        onBulla={() => setStage("bulla")}
        onFatum={() => setStage("fatum")}
        onSalvatio={() => setStage("salvatio")}
      />
    );
  }

  if (stage === "bulla") {
    return (
      <BullaScreen
        reading={reading || createFallbackReading(drawnCards, question)}
        question={question}
        onIterum={() => setStage("divinatio")}
        onClaves={() => setStage("claves")}
        onNoctem={() => setStage("noctem")}
        onVerbatim={() => downloadVerbatimPdf(reading || createFallbackReading(drawnCards, question), question)}
        onDuodecim={() => setStage("duodecim")}
        onArchive={() => setStage("archives")}
        onFatum={() => setStage("fatum")}
        onSalvatio={() => setStage("salvatio")}
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
          onShowNoctem={() => setStage("noctem")}
          onShowDuodecim={() => setStage("duodecim")}
          onShowBulla={() => setStage("bulla")}
          onShowArchive={() => setStage("archives")}
          onShowFatum={() => setStage("fatum")}
          onShowSalvatio={() => setStage("salvatio")}
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

  if (debugMode) {
    return (
      <DevLatinHome
        onStage={goDevHomeStage}
        onVerbatim={() => {
          const { debugQuestion, debugReading } = seedDebugReading();
          downloadVerbatimPdf(debugReading, debugQuestion);
        }}
      />
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
