# Oracle Tarot

Application web React + Express permettant de tirer trois cartes d’un oracle original et de générer une lecture avec l’API OpenAI.

## Structure du projet

```txt
oracle-tarot/
  package.json
  server.js
  vite.config.js
  index.html
  .gitignore
  .env.example
  README.md
  src/
    App.jsx
    cards.js
    index.css
    main.jsx
  public/
    images/
      cards/
        fond-graphique.jpg
        la-sieste.jpg
        l-ex.jpg
        la-bintang.jpg
        la-tangente.jpg
        le-russe.jpg
        la-viree.jpg
        l-huitre.jpg
        l-ecran.jpg
        l-excel.jpg
        l-app.jpg
        l-excipient.jpg
        la-loge.jpg
        l-esclave.jpg
        le-noah.jpg
        l-amatrice.jpg
        le-kayak.jpg
        le-connard.jpg
        de-la-sarthe.jpg
        la-bambou.jpg
        anophelinae.jpg
        la-flasque.jpg
        la-petite-merde.jpg
```

## Installation locale

```bash
npm install
```

Créer ensuite un fichier `.env` à la racine, sur le modèle de `.env.example` :

```bash
OPENAI_API_KEY=sk-votre-cle-api-ici
OPENAI_MODEL=gpt-4.1-mini
NODE_ENV=development
```

Lancer l’application en local :

```bash
npm run dev
```

Le frontend Vite tourne sur :

```txt
http://localhost:5173
```

Le backend Express tourne sur :

```txt
http://localhost:3000
```

## Déploiement Render

Créer un service Render de type **Web Service**.

Paramètres :

```txt
Build Command: npm install && npm run build
Start Command: npm start
```

Variables d’environnement à ajouter dans Render :

```txt
OPENAI_API_KEY = votre clé API OpenAI
OPENAI_MODEL = gpt-4.1-mini
NODE_ENV = production
```

Ne jamais mettre la clé API dans GitHub.
