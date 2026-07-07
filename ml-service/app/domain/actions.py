"""
Purpose:   KNOWN_ACTIONS is the single source of truth for action names the assistant's OPSEC/
           conversational classification call (pipeline/base.check_query_safety) can recognize as
           an action_intent. Each entry maps an action name to a short natural-language trigger
           description interpolated into the classification prompt (domain/prompts.py). ml-service
           deliberately knows ONLY the name and trigger phrasing here — never the action's slot
           schema or what executing it does; that's backend_app's job (see the design spec). Adding
           a new action means adding an entry here AND updating backend_app's action registry to
           match, by convention (no shared source of truth across the two services/languages).
Layer:     domain (pure — no I/O, no model libs)
May import:   stdlib only
Must NOT import:  api/*, services/*, components/*, pipeline/*; asyncpg, openai, FastAPI
"""
from __future__ import annotations

KNOWN_ACTIONS: dict[str, str] = {
    "create_appeal": (
        "користувач ЯВНО просить створити, подати чи оформити звернення, скаргу або заявку "
        "про міську проблему (яма, сміття, вуличне освітлення, комунальна аварія тощо)"
    ),
}
