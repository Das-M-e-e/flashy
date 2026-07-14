# Flashy flashcards skill

An Agent Skill that instructs an LLM to turn study material into flashcards in
Flashy's native import format. Give it to your LLM, attach your lecture notes or
past exams (or just name a topic), and it produces a JSON file you import into a
Flashy deck.

## How to use it

- **Claude Code / Claude Agent SDK:** drop the `flashy-flashcards/` folder into
  your skills directory (e.g. `.claude/skills/`). It activates automatically
  when you ask to make Flashy flashcards.
- **claude.ai / Claude Desktop:** upload `SKILL.md` (or the zipped folder) as a
  skill / project knowledge.
- **Any other LLM (ChatGPT, Gemini, …):** paste the contents of `SKILL.md` into
  the conversation as instructions, then attach your files or name a topic.

Then in Flashy: open (or create) a deck → **Importieren / Import** → select the
generated `.json` file.

See [`SKILL.md`](SKILL.md) for the full format specification.
