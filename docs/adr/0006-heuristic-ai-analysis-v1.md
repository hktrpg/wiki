# Heuristic AI Analysis for Event Drafts

v1 ships a local heuristic analyzer (`chronicle-ai`) that extracts candidate Event Drafts from free text (HK place names, years, haunt keywords) without calling an external LLM. Drafts still require human approval. A real provider can replace this behind the same `analyzeText` mutation and `aiMeta.provider` field later.
