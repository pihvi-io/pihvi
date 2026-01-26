# Huijari - Suomalainen Moninpeli Huijauspeli

Huijari on Fibbage-tyylinen moninpeli, jossa pelaajat yrittavat huijata toisiaan keksimalla uskottavia vale-vastauksia suomalaisiin trivia-kysymyksiin.

## Pelaaminen

### Saannot

1. **Kysymysvaihe**: Naet kysymyksen, jossa on tyhja kohta. Keksi uskottava vale-vastaus!
2. **Anestysvaihe**: Naat kaikkien vastaukset (mukaan lukien oikean). Aanesta, mika on mielestasi oikea!
3. **Pisteytys**:
   - **1000 pistetta** oikeasta vastauksesta
   - **500 pistetta** jokaisesta pelaajasta, jonka huijasit valitsemaan sinun vale-vastauksesi

### Pelin kulku

- 2-8 pelaajaa per huone
- 8 kierrosta per peli
- 60 sekuntia aikaa vastata
- 30 sekuntia aikaa aanestaa

## Asennus

```bash
# Kloonaa repo
git clone <repo-url>
cd huijari

# Asenna riippuvuudet
npm install

# Kaynnista palvelin
npm start
```

Peli kaynnistyy osoitteessa `http://localhost:3000`

## Kehitys

```bash
# Kaynnista kehitystilassa (auto-reload)
npm run dev
```

## Teknologiat

- **Backend**: Node.js, Express, Socket.io
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Reaaliaikainen kommunikaatio**: WebSockets (Socket.io)

## Projektin rakenne

```
huijari/
├── server.js          # Backend-palvelin ja pelilogiikka
├── questions.json     # Suomalaiset trivia-kysymykset
├── package.json       # Projektin riippuvuudet
├── public/
│   ├── index.html     # Pelin HTML-sivu
│   ├── style.css      # Tyylit
│   └── game.js        # Frontend-pelilogiikka
└── README.md
```

## Kysymysten lisaaminen

Lisaa uusia kysymyksia `questions.json`-tiedostoon seuraavassa muodossa:

```json
{
  "question": "Suomen suurin kaupunki on _____.",
  "answer": "Helsinki",
  "category": "Maantieto"
}
```

## Lisenssi

MIT
