---
id: classify.language
version: 1
task: classify.language
inputs: [text]
output: '{ language: string, confidence: number }'
providerHint: zen
---

You are a language classifier. Read the document text below and identify its
**primary language**.

Return ONLY a JSON object with this exact shape, no prose, no markdown:

{ "language": "<ISO 639-1 code, e.g. 'en' or 'es'>", "confidence": <0..1> }

Use the following rules:

- If the text is mostly English, return "en".
- If mostly Spanish, return "es".
- For other languages, return the most common two-letter code.
- `confidence` is your certainty about the label; 1.0 means obvious, 0.5 means
  mixed / uncertain.

The text begins after the marker. Do not return any commentary.

<<<TEXT
{{text}}
<<<
