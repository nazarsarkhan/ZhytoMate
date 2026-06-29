"""
Purpose:   Pipeline package: the R2RAG orchestration sub-layer between the service router and the components. Exposes RAGPipeline (ABC), SimpleRAGPipeline, AgentRAGPipeline. Pipelines compose the injected ports (Embedder/Retriever/Generator) + pure domain helpers; they never import each other or the service that selects them.
Layer:     pipeline
May import:   pipeline/* siblings (base), protocols, domain/*, schemas/*, app.config (types)
Must NOT import:  api/*, services/*; concrete components/*; FastAPI/Starlette, asyncpg, google-genai, sentence-transformers (reach resources via injected ports)
"""
