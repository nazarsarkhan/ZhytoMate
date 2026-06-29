"""
Purpose:   Swap ports (ABCs) for the expensive/external resources: Embedder, Retriever, Generator, VisionGenerator. Services/pipelines depend on these, not concretes — lets pgvector and the hosted LLM be swapped without touching orchestration. Retriever.retrieve(query_text, query_vec, filters, k) takes BOTH text (lexical leg) and vector (dense leg) for hybrid search.
Layer:     protocols  (leaf, like config — imported widely, imports nothing internal but schemas/domain types)
May import:   stdlib (abc, typing), domain/* types, schemas/common
Must NOT import:  api/*, services/*, components/*, pipeline/*; any I/O or model lib (asyncpg, google-genai, sentence-transformers, FastAPI)
"""
