"""
Purpose:   Offline evaluation harness (the 8->10 quality gate). Runs two gold sets against the
           live service: retrieval hit-rate@k (datasets/retrieval_gold.jsonl) and classifier
           routing accuracy (datasets/routing_gold.jsonl); optional LLM-as-judge groundedness
           behind a flag. Pure-Python metrics — no RAGAS/heavy dep. Prints a scorecard and exits
           non-zero when a metric falls below its floor, so CI fails on retrieval/routing
           regression. Run: `python -m eval.run_eval` (or a @slow CI job).
Layer:     script  (composition root for an offline job)
May import:   app.config, app.components/*, app.domain/*, app.pipeline/*, app.protocols, stdlib (json), httpx (to hit the running service) OR the in-process pipelines
Must NOT import:  api routers directly for serving; tests/*. Read-only against the KB.
"""
