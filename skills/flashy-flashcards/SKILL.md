---
name: flashy-flashcards
description: >-
  Create spaced-repetition flashcards in Flashy's native import format
  (flashy-deck JSON) from attached documents (lecture notes, slides, past
  exams) or, if none are provided, from researched material. Always prefer
  attached files over research. Use whenever the user wants to make Flashy
  flashcards or a Flashy deck. Works with Claude and any other LLM.
---

# Flashy flashcards

Turn study material into a deck of flashcards that imports directly into
[Flashy](https://github.com), a local spaced-repetition app. You output **one
JSON file** in Flashy's native `flashy-deck` format; the user imports it into a
deck via **Deck → Importieren / Import**.

## Workflow

1. **Determine the source.**
   - **If the user attached files** (lecture scripts, slides, notes, past
     exams, textbooks): base the cards **strictly on those files**. This
     ALWAYS takes priority. Do not invent facts beyond the material; your job
     is to cover what the documents teach, faithfully and comprehensively.
   - **If no files are attached**: research the topic and build accurate cards
     from reliable knowledge. State clearly that you worked from general
     knowledge rather than the user's material.
   - **If both** files and a topic are given: use the files as the primary
     source and only supplement with research if the user explicitly asks.

2. **Decide scope.** Ask the user for the topic/chapters and roughly how many
   cards only if it is unclear. Otherwise cover the material at a sensible
   density (typically one card per distinct fact, term, or relationship).

3. **Write the cards** following the guidelines below and the format spec.

4. **Output exactly one JSON file** (valid UTF-8 JSON, no comments, no trailing
   commas) named after the deck, e.g. `thermodynamics-ch3.json`. If your
   environment cannot write files, print the JSON in a single fenced code block
   so the user can save it.

5. **Tell the user how to import**: in Flashy, open the target deck (create one
   first if needed), click **Importieren / Import**, and select the JSON file.
   The `deck.name` field is informational — cards are added to whichever deck
   the user imports into.

## Output format

Wrap the cards in the `flashy-deck` envelope:

```json
{
  "format": "flashy-deck",
  "formatVersion": 1,
  "deck": { "name": "Thermodynamics — Chapter 3" },
  "cards": [ /* card objects, see below */ ]
}
```

Every card object needs at least `type` and `front`. Front/back and option text
support **Markdown** (GitHub-flavored: **bold**, *italic*, lists, `code`,
tables) and **LaTeX math** via KaTeX: inline `$x^2$`, block `$$\int f\,dx$$`.
Do **not** embed images — those are managed inside Flashy, not through import.
Write card content in the **same language as the source material** (e.g.
German notes → German cards).

### Card types

**1. `basic` — front/back**
The default. Set `bidirectional: true` when the pair makes sense both ways
(term ⇄ definition, vocabulary); `false` for one-directional facts.
`bidirectional` only applies to `basic` cards.
```json
{ "type": "basic", "front": "What is entropy?", "back": "A measure of the disorder or unavailable energy in a system.", "bidirectional": false }
```

**2. `type_answer` — the user types the answer**
`back` is the primary correct answer. Put alternative accepted spellings in
`data.answers`.
```json
{ "type": "type_answer", "front": "Chemical symbol for sodium?", "back": "Na", "data": { "answers": ["natrium"] } }
```

**3. `choice` — multiple choice**
`data.options` is a list of `{ "text": "...", "correct": true|false }`. Set
`data.multi: true` if more than one option is correct. Use `back` for an
optional explanation shown after answering. Prefer plausible distractors.
```json
{
  "type": "choice",
  "front": "Which layers belong to the OSI model's lower half?",
  "back": "Physical, Data Link, Network and Transport are layers 1–4.",
  "data": {
    "multi": true,
    "options": [
      { "text": "Physical", "correct": true },
      { "text": "Data Link", "correct": true },
      { "text": "Session", "correct": false },
      { "text": "Presentation", "correct": false }
    ]
  }
}
```

**4. `truefalse` — statement is true or false**
`front` is a statement; `data.answer` is `true` if the statement is correct.
`back` is an optional explanation.
```json
{ "type": "truefalse", "front": "Water boils at 100 °C at sea-level pressure.", "back": "True at 1 atm; the boiling point drops at higher altitude.", "data": { "answer": true } }
```

**5. `cloze` — fill in the blank**
Hide text in `front` with `{{c1::hidden}}`. Number multiple blanks
`{{c1::…}}`, `{{c2::…}}`. Add an optional hint with `{{c1::hidden::hint}}`.
```json
{ "type": "cloze", "front": "The {{c1::mitochondria}} are the powerhouse of the {{c2::cell}}.", "back": "" }
```

## How to choose a card type

- Term ⇄ definition, vocabulary, translations → `basic` (`bidirectional: true`).
- A fact recalled in one direction only → `basic` (`bidirectional: false`).
- Definitions and key terms embedded in a sentence → `cloze`.
- Short factual answers worth actively recalling → `type_answer`.
- Concept checks with distractors, or when the source itself is an MC exam →
  `choice`.
- Verifying a claim / common misconception → `truefalse`.

Favor `basic`, `cloze` and `type_answer` for real recall; use `choice` and
`truefalse` in moderation.

## Writing good flashcards

- **Atomic:** one fact, term, or idea per card. Split compound facts.
- **Precise:** unambiguous questions with a single clearly correct answer.
- **Minimal:** the answer is the shortest phrase that is still complete.
- **Understanding over verbatim:** rephrase into clean Q/A; don't copy long
  passages. But keep the source's terminology and definitions faithful.
- **Context in the question:** each card must stand alone without the document.
- **No trivia padding:** skip page numbers, figure captions, and filler.
- **Comprehensive from files:** when working from attachments, aim to cover the
  examinable content, not just a few highlights.

## Full example

```json
{
  "format": "flashy-deck",
  "formatVersion": 1,
  "deck": { "name": "Application Security — Basics" },
  "cards": [
    { "type": "basic", "front": "Vulnerability (security)", "back": "A flaw that can be exploited to violate confidentiality, integrity or availability.", "bidirectional": true },
    { "type": "cloze", "front": "The three core protection goals (CIA) are {{c1::confidentiality}}, {{c2::integrity}} and {{c3::availability}}.", "back": "" },
    { "type": "type_answer", "front": "What does CVE stand for?", "back": "Common Vulnerabilities and Exposures", "data": { "answers": ["common vulnerabilities & exposures"] } },
    { "type": "truefalse", "front": "A CWE identifies one specific, individual known vulnerability.", "back": "False — a CWE describes a type/category of weakness; a CVE identifies a single concrete vulnerability.", "data": { "answer": false } }
  ]
}
```
