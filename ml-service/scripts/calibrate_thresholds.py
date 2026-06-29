"""
Purpose:   Offline tool (NOT served): calibrate SIM_GATE / SIM_HIGH on the seeded KB. Loads labelled known-relevant + known-irrelevant query sets, embeds + runs DENSE retrieval against the live pool, records top-1 cosine similarity for each, prints the two distributions and the separation point, and emits suggested SIM_GATE (just above the irrelevant cluster) / SIM_HIGH (confident band). Turns SYSTEM_DESIGN §2.7's caveat into a runnable, pre-demo closed loop. Run manually: `python -m scripts.calibrate_thresholds`.
Layer:     script  (composition root for an offline job — may wire concrete components, like main.py)
May import:   app.config, app.components/* (embedder, repository), app.domain/*, stdlib
Must NOT import:  api/*; tests/*. Never writes to the DB (read-only calibration).
"""
