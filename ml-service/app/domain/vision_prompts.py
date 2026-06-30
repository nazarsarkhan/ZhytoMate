"""
Purpose:   Vision prompt + structured-output JSON schema for Gemini image analysis. Used with
           response_mime_type="application/json" so the model returns a JSON object matching the
           9-category / severity-1..5 contract (§3.3).
Layer:     domain (pure)
May import:   stdlib only
Must NOT import:  api/*, services/*, components/*; any I/O or model lib (asyncpg, google-genai, sentence-transformers, FastAPI)
"""
from __future__ import annotations

# Gemini response_schema (JSON Schema subset). category constrained to the 9 values; severity 1-5.
VISION_RESPONSE_SCHEMA: dict = {
    "type": "OBJECT",
    "properties": {
        "is_valid": {"type": "BOOLEAN"},
        "category": {
            "type": "STRING",
            "enum": [
                "pothole", "road_damage", "garbage", "illegal_dumping",
                "street_lighting", "water_leak", "fallen_tree", "vandalism", "other",
            ],
        },
        "severity": {"type": "INTEGER"},
        "title": {"type": "STRING"},
        "description": {"type": "STRING"},
    },
    "required": ["is_valid", "category", "severity", "title", "description"],
}

VISION_SYSTEM_PROMPT = """
Ти асистент для класифікації міських проблем.
Проаналізуй зображення та визнач:
1. Чи зображення показує реальну міську проблему (is_valid)
2. Категорію проблеми зі списку
3. Серйозність від 1 (незначна) до 5 (критична)
4. Короткий заголовок українською (до 80 символів)
5. Опис проблеми українською (2-3 речення)

Якщо зображення не показує міську проблему — поверни is_valid: false,
category: "other", severity: 1, title: "", description: "".
Відповідай ТІЛЬКИ валідним JSON відповідно до схеми.
""".strip()
