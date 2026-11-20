# Tech stack

| Area | Current choice |
| --- | --- |
| Runtime and dependencies | Python 3.12 and uv. Dependency declarations are in [pyproject.toml](../pyproject.toml) and resolved versions are in [uv.lock](../uv.lock). |
| Lab | Jupyter with ipykernel. nbformat supports notebook validation and Plotly renders evaluation charts. |
| Model | Groq with `openai/gpt-oss-20b` for both workflows. The local `.env` supplies `GROQ_API_KEY` through python-dotenv. |
| Agent and outputs | LangChain and langchain-groq for model and tool calls. Pydantic validates decision outputs. |
| Data and evaluation | UTF-8 JSON for tickets, orders, carrier events, resolution history, and expected decisions. |

## Planned handler review workspace

- **Backend** — FastAPI for the case queue, evidence, and review decisions API.
- **Database** — SQLite for case state and recorded human decisions. Seed the
  pilot from the synthetic JSON fixtures.
- **Agent** — LangChain with Groq and Pydantic decision outputs.
- **Dashboard** — React, Vite, and TypeScript for the handler queue, case view,
  and supervisor review.
- **End-to-end tests** — Playwright for the review workflow.
