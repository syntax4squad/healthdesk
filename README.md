# SwasthyaSaathi AI

A working prototype for **SIH25049 — AI-Driven Public Health Chatbot for Disease
Awareness** (Government of Odisha). Built as a real Flask server (not a static
page) with a SQLite database, user accounts, a RAG pipeline over a verified
disease knowledge base, a rule-based safety/emergency layer, a symptom
risk-awareness guide, a misinformation checker, and an admin analytics
dashboard — following the modules laid out in the hackathon blueprint.

> **Core principle carried through the whole app:** Public health awareness ≠
> medical diagnosis. The system never claims to diagnose, prescribe, or
> replace a doctor.


### Chat behavior
The chat assistant accepts broad health and medical questions. The verified knowledge base is used as supporting context when relevant, but a missing KB topic does not cause a refusal; the configured Groq model may use its general medical knowledge. Unrelated requests (for example coding or entertainment questions) are declined. Emergency, crisis, and unsafe-request protections remain active. Health answers include a general-information/medical-professional disclaimer.

## What's implemented

| Blueprint module | Implementation |
|---|---|
| Module 1 — AI Health Assistant | `/api/chat` — safety filter → intent → RAG retrieval → LLM (Groq) → output safety → response |
| Module 2 — Symptom risk-awareness guide | `/api/risk-assessment` — rule-based GREEN/YELLOW/RED classifier, non-diagnostic |
| Module 3 — Disease knowledge base | `knowledge_base.py` — 10 diseases (Dengue, Malaria, TB, COVID-19, Cholera, Typhoid, Influenza, Japanese encephalitis, Hepatitis, Chikungunya) with overview/symptoms/warning signs/transmission/prevention/myths/facts/source |
| Module 4 — RAG | `rag.py` — TF-IDF vector retrieval (scikit-learn) over the knowledge base, feeding grounded context into the LLM prompt instead of `Question → LLM → Answer` |
| Module 5 — Multilingual | English / Hindi / Odia selector; language is passed to the LLM system prompt |
| Module 7 — Misinformation checker | `/api/misinformation` — fuzzy-matches a claim against known myths/facts |
| Module 8 — Emergency escalation | `safety.py` — regex-based emergency & crisis detection that **overrides** the normal chatbot flow before the LLM is even called |
| Module 9 — Public health dashboard | `/admin` — anonymized, aggregated analytics (no free-text content stored in analytics events) |
| Module 11 — Safety architecture | Input safety filter and output safety checks live **outside** the LLM call, so the model can't be prompted around them |
| User accounts | Simple email/phone + password registration and login (Werkzeug password hashing, Flask session cookies) |
| Guest mode | Anyone can chat without registering; guest messages are processed but never written to the database |
| Admin | Separate `/admin` login using `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env` |

## Tech stack actually used

- **Backend:** Flask + Flask-SQLAlchemy (SQLite)
- **Auth:** Werkzeug password hashing + server-side sessions
- **AI:** [Groq](https://console.groq.com) free-tier LLM API (`llama-3.3-70b-versatile` by default) via the official `groq` Python SDK
- **RAG:** scikit-learn TF-IDF + cosine similarity (no external vector DB needed for a 10-disease prototype)
- **Frontend:** Server-rendered Jinja templates + vanilla JS/CSS (no build step)
- **Secrets:** `.env` file (loaded with `python-dotenv`), never committed (see `.gitignore`)

## Project structure

```
swasthyasaathi/
├── app.py                 # Flask app: routes, auth, chat pipeline, admin API
├── config.py               # Loads .env into a Config object
├── models.py                # SQLAlchemy models: User, Conversation, Message, AnalyticsEvent
├── knowledge_base.py        # Verified disease knowledge base (Module 3)
├── rag.py                   # TF-IDF retrieval layer (Module 4)
├── safety.py                 # Emergency detection, risk assessment, misinformation checker, output safety
├── ai_client.py               # Groq LLM wrapper + system prompt (Module 10)
├── templates/                # index.html, login.html, register.html, admin_login.html, admin.html
├── static/                   # style.css, app.js
├── requirements.txt
├── .env.example              # Copy to .env and fill in
└── instance/                 # SQLite DB gets created here at runtime
```

## Setup

```bash
cd swasthyasaathi
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# then edit .env:
#   - set SECRET_KEY (python -c "import secrets; print(secrets.token_hex(32))")
#   - set GROQ_API_KEY (free key: https://console.groq.com/keys)
#   - set ADMIN_EMAIL / ADMIN_PASSWORD to whatever you want the admin login to be

python app.py
```

Visit `http://localhost:5000`.

- **Without a `GROQ_API_KEY`**, the chatbot still works — it falls back to
  returning the raw verified knowledge-base context it retrieved, so you can
  demo retrieval end-to-end for free before wiring up an API key.
- **With a `GROQ_API_KEY`** set, `/api/chat` calls Groq's free-tier LLM to
  turn that retrieved context into a natural, grounded answer.
- Visit `http://localhost:5000/admin` and log in with `ADMIN_EMAIL` /
  `ADMIN_PASSWORD` from `.env` to see the aggregated analytics dashboard.

## Notable design decisions / what's simplified for a prototype

- **RAG uses TF-IDF, not embeddings + FAISS/Chroma.** For a ~10-disease
  knowledge base this retrieves accurately, runs offline, and needs no paid
  embeddings API — but the retrieval interface (`rag.retrieve(query)`) is
  written so it could be swapped for a real vector DB later without touching
  the chat pipeline.
- **Voice input/output, full multilingual translation of the UI shell, and
  true ML-based intent classification are not implemented** — the blueprint
  marks these as optional/"nice to have," and the prototype focuses on the
  "must have" list (chatbot, RAG, safety layer, non-diagnostic risk guidance,
  clean UI) plus the "should have" items (multilingual chat responses,
  misinformation checker, source display, disease library).
- **Emergency/crisis/unsafe detection is regex/keyword-based**, not an ML
  classifier — deliberately, so it's fast, free, fully auditable, and cannot
  be bypassed by adversarial prompting of the LLM (it runs *before* the LLM
  is called).
- **Analytics events store no free-text or user identifiers** — only
  category, disease topic, language, risk level, and guest/registered flag —
  so the admin dashboard stays "anonymized and aggregated," as the blueprint
  requires.

## Security notes for going beyond a hackathon prototype

- Rotate `SECRET_KEY` and `ADMIN_PASSWORD` before any real deployment; the
  values in `.env` are prototype placeholders only.
- Add rate limiting and CSRF protection before exposing this publicly.
- Consider a proper vector DB (FAISS/Chroma) and a larger, clinician-reviewed
  knowledge base before treating any output as more than an awareness demo.
