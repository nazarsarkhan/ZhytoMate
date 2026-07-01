"""
Purpose:   Vision system prompt for OpenAI image analysis. Used with response_format json_object,
           which guarantees valid JSON syntax only — so the prompt describes the exact expected JSON
           shape inline (9-category / severity-1..5 contract, §3.3). The service does the real
           field/enum validation, since json_object mode can't enforce a schema.
Layer:     domain (pure)
May import:   stdlib only
Must NOT import:  api/*, services/*, components/*; any I/O or model lib (asyncpg, openai, sentence-transformers, FastAPI)
"""
from __future__ import annotations

VISION_SYSTEM_PROMPT = """
Ти асистент для класифікації міських проблем.
Проаналізуй зображення та визнач:
1. Чи зображення показує реальну міську проблему (is_valid: true/false)
2. Категорію проблеми ТІЛЬКИ з цього списку: pothole, road_damage, garbage,
   illegal_dumping, street_lighting, water_leak, fallen_tree, vandalism, other
3. Серйозність ЦІЛИМ числом від 1 (незначна) до 5 (критична)
4. Короткий заголовок українською (до 80 символів)
5. Опис проблеми українською (2-3 речення)

Якщо зображення не показує міську проблему — поверни is_valid: false,
category: "other", severity: 1, title: "", description: "".

Відповідай ТІЛЬКИ валідним JSON у такому форматі (без жодного іншого тексту):
{"is_valid": true, "category": "pothole", "severity": 4, "title": "...", "description": "..."}
""".strip()
