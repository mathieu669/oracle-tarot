export const positions = [
  { id: "insists", label: "Ce qui insiste", detail: "Le motif qui revient", meaning: "Ce qui pèse déjà, ce qui revient, ce qui demande à être regardé." },
  { id: "deviates", label: "Ce qui dévie", detail: "L’obstacle ou la torsion", meaning: "La fuite, le malentendu, le détour, l’endroit où la situation se déforme." },
  { id: "cuts", label: "Ce qui tranche", detail: "Le geste ou la révélation", meaning: "Le geste juste, la phrase à entendre, le point de bascule symbolique." }
];

const cover = "/images/cards/fond-graphique.jpg";

export const deck = [
  [1, "I", "La Sieste", "la-sieste", "Renaître de ses cendres", ["repos", "épuisement", "renaissance", "repli"], "Évoque le retrait nécessaire, la récupération profonde, l’art de disparaître un moment pour revenir autrement."],
  [2, "II", "L’Ex.", "l-ex", "Celle qui tourne et se retourne", ["retour", "boucle", "ancien lien"], "Parle du retour du passé, des cycles affectifs, de ce qui revient sans être résolu."],
  [3, "III", "La Mutzig", "la-mutzig", "Tout travail mérite sa bière", ["récompense", "relâchement", "plaisir"], "Évoque la détente méritée, la récompense après l’effort, mais aussi le glissement vers l’habitude."],
  [4, "IV", "La Tangente", "la-tangente", "La prendre ou se laisser prendre", ["fuite", "déviation", "emprise"], "Parle de l’évitement, de la fuite stratégique, ou du fait d’être rattrapé par ce qu’on voulait contourner."],
  [5, "V", "Le Russe", "le-russe", "Bien le choisir ou le voir venir", ["danger", "pari", "explosion"], "Évoque le risque, la menace mal anticipée, le mauvais choix, ou l’impact inévitable."],
  [6, "VI", "La Virée", "la-viree", "Sans ordonnance", ["errance", "excès", "improvisation"], "Parle d’échappée, d’errance, d’excès non cadré, de déplacement qui désorganise."],
  [7, "VII", "L’Huître", "l-huitre", "L’ouvrir ou la fermer", ["secret", "fermeture", "réserve"], "Évoque le dilemme entre se protéger et se livrer, garder pour soi ou s’exposer."],
  [8, "VIII", "L’Écran", "l-ecran", "Il montre ce que l’on regarde", ["projection", "image", "filtre"], "Parle de médiation, de projection, de perception filtrée, d’image qui obéit au regard."],
  [9, "IX", "L’Excel", "l-excel", "Tout le monde ne voit pas le tableau", ["structure", "système", "vision d’ensemble"], "Évoque l’organisation, la logique, les données, mais aussi l’angle mort de ceux qui ne voient qu’une cellule."],
  [10, "X", "L’App.", "l-app", "Encore une", ["répétition", "compulsion", "addiction"], "Parle de la boucle, du réflexe, de l’appel répétitif, du geste qui recommence."],
  [11, "XI", "L’Excipient", "l-excipient", "Défait notoire", ["support toxique", "dissolution", "défaite"], "Évoque ce qui enrobe, facilite ou masque, mais finit par dissoudre, affaiblir ou ruiner."],
  [12, "XII", "La Loge", "la-loge", "Se perdre à l’abri", ["refuge", "isolement", "égarement"], "Parle du refuge qui protège autant qu’il coupe du monde, du confort qui peut devenir dérive."],
  [13, "XIII", "L’Esclave", "l-esclave", "L’enfer des choses", ["servitude", "automatisme", "domesticité", "aliénation"], "Évoque la domination silencieuse des objets, des routines et des systèmes qui travaillent à notre place mais finissent par nous tenir."],
  [14, "XIV", "Le Noah", "le-noah", "Saga Africa", ["vitalité", "charisme", "rayonnement"], "Parle d’énergie solaire, de style, de popularité, de corps en scène, mais aussi d’image publique."],
  [15, "XV", "L’Amatrice", "l-amatrice", "Elle te parle d’aventure", ["désir", "aventure", "jeu", "projection"], "Évoque l’appel du romanesque, la séduction d’une promesse, l’envie de croire à une aventure peut-être plus belle que réelle."],
  [16, "XVI", "Le Kayak", "le-kayak", "Fluctuat nec mergitur", ["navigation", "résilience", "équilibre"], "Parle d’instabilité maîtrisée, de traversée, de survie, de maintien à flot dans une situation mouvante."],
  [17, "XVII", "Le Connard", "le-connard", "Mâle accompagné", ["ego", "masculinité", "toxique"], "Évoque le narcissisme, la domination, la bêtise assurée d’elle-même, ou la présence encombrante d’un type d’homme."],
  [18, "XVIII", "De La Sarthe", "de-la-sarthe", "Habitudes sans modération", ["routine", "plaisir", "habitude"], "Parle d’habitudes installées, de plaisirs répétés, de confort qui tourne à l’excès."],
  [19, "XIX", "La Bambou", "la-bambou", "Trouver ses cabanes", ["tribu", "abri", "collectif"], "Évoque les liens de groupe, les abris provisoires, les refuges humains, les arrangements communautaires."],
  [20, "XX", "Anophelinae", "anophelinae", "Il suce ton sang", ["parasite", "ponction", "épuisement"], "Parle de ce qui vide, pompe, parasite ou profite d’une énergie sans jamais la rendre."],
  [21, "XXI", "La Flasque", "la-flasque", "Le diable l’emporte toujours", ["tentation", "vice", "perte de contrôle"], "Évoque la tentation, l’auto-sabotage, le penchant qui gagne quand la volonté baisse."],
  [22, "XXII", "La Petite Merde", "la-petite-merde", "Majeur en la mineur", ["contrariété", "dissonance", "petitesse", "orgueil"], "Évoque le détail mesquin qui prend trop de place, la contrariété mineure jouée comme une tragédie majeure, ou le petit affront qui révèle une grande susceptibilité."],
  [23, "XXIII", "L’Oasis", "l-oasis", "Il n’y a pas de mirage sans soif", ["mirage", "soulagement", "désir", "répit"], "Évoque le répit qui attire, la promesse de fraîcheur, le lieu sauveur — réel ou fantasmé — que l’on invente pour tenir encore un peu."]
].map(([number, roman, name, slug, key, tags, promptHint]) => ({
  number,
  roman,
  name,
  slug,
  key,
  tags,
  promptHint,
  imageFace: `/images/cards/${slug}.${slug === "l-oasis" ? "png" : "jpg"}`,
  videoFace: `/videos/cards/${slug}.mp4`,
  imageCover: cover
}));
