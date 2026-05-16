import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const deck = [
  { number: 1, roman: "I", name: "La Sieste", key: "Renaître de ses cendres", imageFace: "/images/cards/la-sieste.jpg" },
  { number: 2, roman: "II", name: "L’Ex.", key: "Celle qui tourne et se retourne", imageFace: "/images/cards/l-ex.jpg" },
  { number: 3, roman: "III", name: "La Bintang", key: "Tout travail mérite sa bière", imageFace: "/images/cards/la-bintang.jpg" },
  { number: 4, roman: "IV", name: "La Tangente", key: "La prendre ou se laisser prendre", imageFace: "/images/cards/la-tangente.jpg" },
  { number: 5, roman: "V", name: "Le Russe", key: "Bien le choisir ou le voir venir", imageFace: "/images/cards/le-russe.jpg" },
  { number: 6, roman: "VI", name: "La Virée", key: "Sans ordonnance", imageFace: "/images/cards/la-viree.jpg" },
  { number: 7, roman: "VII", name: "L’Huître", key: "L’ouvrir ou la fermer", imageFace: "/images/cards/l-huitre.jpg" },
  { number: 8, roman: "VIII", name: "L’Écran", key: "Il montre ce que l’on regarde", imageFace: "/images/cards/l-ecran.jpg" },
  { number: 9, roman: "IX", name: "L’Excel", key: "Tout le monde ne voit pas le tableau", imageFace: "/images/cards/l-excel.jpg" },
  { number: 10, roman: "X", name: "L’App.", key: "Encore une", imageFace: "/images/cards/l-app.jpg" },
  { number: 11, roman: "XI", name: "L’Excipient", key: "Défait notoire", imageFace: "/images/cards/l-excipient.jpg" },
  { number: 12, roman: "XII", name: "La Loge", key: "Se perdre à l’abri", imageFace: "/images/cards/la-loge.jpg" },
  { number: 13, roman: "XIII", name: "L’Esclave", key: "L’enfer des choses", imageFace: "/images/cards/l-esclave.jpg" },
  { number: 14, roman: "XIV", name: "Le Noah", key: "Saga Africa", imageFace: "/images/cards/le-noah.jpg" },
  { number: 15, roman: "XV", name: "L’Amatrice", key: "Elle te parle d’aventure", imageFace: "/images/cards/l-amatrice.jpg" },
  { number: 16, roman: "XVI", name: "Le Kayak", key: "Fluctuat nec mergitur", imageFace: "/images/cards/le-kayak.jpg" },
  { number: 17, roman: "XVII", name: "Le Connard", key: "Mâle accompagné", imageFace: "/images/cards/le-connard.jpg" },
  { number: 18, roman: "XVIII", name: "De La Sarthe", key: "Habitudes sans modération", imageFace: "/images/cards/de-la-sarthe.jpg" },
  { number: 19, roman: "XIX", name: "La Bambou", key: "Trouver ses cabanes", imageFace: "/images/cards/la-bambou.jpg" },
  { number: 20, roman: "XX", name: "Anophelinae", key: "Il suce ton sang", imageFace: "/images/cards/anophelinae.jpg" },
  { number: 21, roman: "XXI", name: "La Flasque", key: "Le diable l’emporte toujours", imageFace: "/images/cards/la-flasque.jpg" },
  { number: 22, roman: "XXII", name: "La Petite Merde", key: "Majeur en la mineur", imageFace: "/images/cards/la-petite-merde.jpg" },
  { number: 23, roman: "XXIII", name: "La Carte 23", key: "Clé à définir", imageFace: "/images/cards/carte-23.jpg", optional: true }
];

const carouselCards = [...deck, ...deck];

const positions = [
  { label: "Ce qui insiste", detail: "le motif qui revient" },
  { label: "Ce qui dévie", detail: "l’obstacle ou la torsion" },
  { label: "Ce qui tranche", detail: "le geste ou la révélation" }
];

function randomDraw() {
  const playableDeck = deck.filter((card) => !card.optional);
  const copy = [...playableDeck];
  const result = [];
  while (result.length < 3) {
    const index = Math.floor(Math.random() * copy.length);
    result.push(copy.splice(index, 1)[0]);
  }
  return result;
}

function CardBack() {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[1.35rem] border-[6px] border-stone-50 bg-black shadow-2xl">
      <img
        src="/images/cards/fond-graphique.jpg"
        alt="Dos de carte"
        className="h-full w-full object-cover"
      />
    </div>
  );
}

function CardFace({ card }) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[1.35rem] border-[6px] border-stone-50 bg-black shadow-2xl">
      <img
        src={card.imageFace}
        alt={card.name}
        className="h-full w-full object-cover"
        onError={(event) => {
          event.currentTarget.src = "/images/cards/fond-graphique.jpg";
        }}
      />
    </div>
  );
}

function DiagonalCarousel() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2.5rem] opacity-70">
      <div className="absolute left-[-18%] top-[-18%] h-[140%] w-[145%] rotate-[-12deg]">
        <motion.div
          className="flex w-max gap-5"
          animate={{ x: [0, -1750] }}
          transition={{ duration: 48, repeat: Infinity, ease: "linear" }}
        >
          {carouselCards.map((card, index) => (
            <motion.div
              key={`${card.name}-${index}`}
              className="aspect-[2/3.25] w-[118px] shrink-0 rotate-[6deg] md:w-[150px]"
              initial={{ y: index % 2 === 0 ? 0 : 36 }}
              animate={{ y: index % 2 === 0 ? [0, 18, 0] : [36, 18, 36] }}
              transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: (index % 7) * 0.2 }}
            >
              <CardFace card={card} />
            </motion.div>
          ))}
        </motion.div>
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-[#090806] via-[#090806]/55 to-[#090806]" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#090806] via-transparent to-[#090806]" />
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
      <div className="mx-auto aspect-[2/3.25] w-full max-w-[230px] [perspective:1000px]">
        <motion.div
          className="relative h-full w-full [transform-style:preserve-3d]"
          animate={{ rotateY: revealed ? 180 : 0 }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
        >
          <div className="absolute inset-0 [backface-visibility:hidden]"><CardBack /></div>
          <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]"><CardFace card={card} /></div>
        </motion.div>
      </div>
    </motion.div>
  );
}

function Reading({ cards, question }) {
  if (!cards.length) return null;
  const [a, b, c] = cards;
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-10 rounded-[2rem] border border-stone-700/80 bg-stone-950/75 p-6 shadow-2xl backdrop-blur"
    >
      <div className="mb-6 flex flex-col gap-2 border-b border-stone-800 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-stone-500">lecture générée</p>
          <h2 className="mt-2 font-serif text-3xl font-black text-stone-50">La fuite a laissé des traces</h2>
        </div>
        <p className="max-w-md text-sm italic text-stone-400">{question || "Question silencieuse"}</p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {cards.map((card, index) => (
          <div key={card.name} className="rounded-2xl border border-stone-800 bg-black/40 p-4">
            <p className="text-xs uppercase tracking-[0.25em] text-stone-500">{positions[index].label}</p>
            <h3 className="mt-2 font-serif text-xl font-bold text-stone-100">{card.name}</h3>
            <p className="mt-1 text-sm text-stone-400">{card.key}</p>
            <p className="mt-4 text-sm leading-6 text-stone-300">
              {index === 0 && "La première carte ne prédit pas : elle insiste. Elle pose le doigt sur ce qui revient, parfois avec l’élégance douteuse d’une habitude que l’on déguise en destin."}
              {index === 1 && "La deuxième carte dévie la trajectoire. Elle signale l’endroit où vous faites semblant d’avancer alors que vous négociez encore avec votre propre détour."}
              {index === 2 && "La troisième carte tranche sans forcément consoler. Elle montre le geste à faire, ou du moins l’excuse qu’il faudra cesser d’entretenir."}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-2xl border border-stone-800 bg-black/35 p-5">
          <p className="text-xs uppercase tracking-[0.25em] text-stone-500">lecture croisée</p>
          <p className="mt-3 leading-7 text-stone-300">
            {a.name}, {b.name} et {c.name} composent une scène où le problème n’est pas seulement ce qui arrive, mais la manière dont vous l’arrangez pour qu’il continue. L’oracle ne vous demande pas de croire : il vous demande de regarder la petite mécanique qui tourne déjà.
          </p>
        </div>
        <div className="rounded-2xl border border-stone-800 bg-stone-100 p-5 text-black">
          <p className="text-xs uppercase tracking-[0.25em] text-stone-500">phrase-oracle</p>
          <p className="mt-3 font-serif text-xl font-black leading-7">Ce n’est pas le signe qui vous poursuit ; c’est l’habitude de lui ouvrir la porte.</p>
        </div>
      </div>
    </motion.section>
  );
}

export default function OraclePreview() {
  const initial = useMemo(() => [deck[0], deck[14], deck[12]], []);
  const [cards, setCards] = useState(initial);
  const [revealed, setRevealed] = useState(true);
  const [question, setQuestion] = useState("Que dois-je comprendre de ce qui revient en ce moment ?");
  const [loading, setLoading] = useState(false);

  const draw = () => {
    setRevealed(false);
    setLoading(true);
    setTimeout(() => {
      setCards(randomDraw());
      setLoading(false);
      setRevealed(true);
    }, 650);
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#090806] px-5 py-6 text-stone-100 md:px-10 md:py-10">
      <div className="pointer-events-none fixed inset-0 opacity-40">
        <div className="absolute -left-32 top-16 h-72 w-[45rem] rotate-[-18deg] rounded-full bg-stone-200/10 blur-3xl" />
        <div className="absolute right-[-10rem] top-60 h-80 w-[50rem] rotate-[22deg] rounded-full bg-red-900/20 blur-3xl" />
        <div className="absolute bottom-[-8rem] left-1/4 h-72 w-[45rem] rounded-full bg-stone-100/10 blur-3xl" />
      </div>

      <section className="relative mx-auto max-w-7xl">
        <header className="relative grid min-h-[620px] gap-6 overflow-hidden rounded-[2.5rem] border border-stone-800 bg-black/45 p-6 shadow-2xl backdrop-blur md:grid-cols-[1.05fr_0.95fr] md:p-8">
          <DiagonalCarousel />
          <div className="relative z-10 flex flex-col justify-between gap-8">
            <div>
              <p className="mb-4 text-xs uppercase tracking-[0.45em] text-stone-500">Oracle original</p>
              <h1 className="max-w-2xl font-serif text-5xl font-black leading-[0.95] text-stone-50 md:text-7xl">
                Tirez trois cartes. Laissez-les mal répondre.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-stone-300">
                Une interface de tirage pour un oracle contemporain, ironique et sibyllin. Le set complet traverse l’écran en carrousel diagonal ; les cartes se révèlent ensuite dans le tirage.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Votre question"
                className="h-12 rounded-full border border-stone-700 bg-stone-950/90 px-5 text-sm text-stone-100 outline-none placeholder:text-stone-600 focus:border-stone-300"
              />
              <button
                onClick={draw}
                className="h-12 rounded-full bg-stone-100 px-7 text-sm font-bold uppercase tracking-[0.18em] text-black transition hover:bg-white active:scale-[0.99]"
              >
                {loading ? "Tirage…" : "Tirer"}
              </button>
            </div>
          </div>

          <div className="relative z-10 hidden items-end justify-end md:flex">
            <div className="max-w-sm rounded-[2rem] border border-stone-700 bg-black/65 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.35em] text-stone-500">deck complet</p>
              <p className="mt-3 font-serif text-4xl font-black text-stone-50">23 visuels</p>
              <p className="mt-3 text-sm leading-6 text-stone-400">
                Le carrousel affiche tous les rectos disponibles. Si le fichier <span className="font-mono">carte-23.jpg</span> manque encore, le dos commun est utilisé en secours.
              </p>
            </div>
          </div>
        </header>

        <section className="relative mt-10 rounded-[2.5rem] border border-stone-800 bg-black/35 p-5 shadow-2xl backdrop-blur md:p-8">
          <div className="mb-8 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-stone-500">tirage en 3 cartes</p>
              <h2 className="mt-2 font-serif text-3xl font-black text-stone-50">Ce qui insiste / Ce qui dévie / Ce qui tranche</h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-stone-400">
              Aperçu fonctionnel : le texte ci-dessous simule la réponse API. En production, il sera généré par ChatGPT à partir des cartes, de leurs clés et de votre question.
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

        <Reading cards={cards} question={question} />
      </section>
    </main>
  );
}
