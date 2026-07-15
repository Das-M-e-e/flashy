# Flashy

Flashy is a local-first flashcard app for studying with spaced repetition. Your
cards live on your own computer; you can optionally keep them in sync across your
devices through your **own private GitHub repository**. Flashy also has an AI mode
that turns your decks into full practice exams and grades them for you.

## Installing

1. Download the latest **`Flashy Setup <version>.exe`** from the
   [Releases](../../releases) page and run it (you can choose the install folder
   and get a desktop shortcut). A portable **`Flashy <version>.exe`** that runs
   without installing is also provided.
2. The app isn't code-signed, so Windows SmartScreen may warn on first launch —
   choose *More info → Run anyway*.

## Getting started

1. Create a **project** (a subject, e.g. "Spanish" or "Computer Science").
2. Add one or more **decks** to it (topics or chapters).
3. Add **cards** to a deck, or import them from a file.
4. Hit **Study** on a deck — or study a whole project's decks shuffled.

## Card types

Pick a type when you add or edit a card:

- **Basic** – front/back, self-graded; optionally quizzed in both directions.
- **Type the answer** – you type it and it's checked (extra accepted variants can
  be stored); on near-misses you still get the final say with "Mark correct".
- **Multiple choice** – single or multiple correct options, graded automatically.
- **True / False** – judge a statement.
- **Cloze** – fill in the blanks, Anki-compatible `{{c1::…}}`; in the editor you
  select text and click "Insert blank".

## Markdown & media

Every text field understands Markdown — headings, lists, emphasis, code blocks,
tables, links, images and **audio** — with an **Edit | Preview** toggle per field.

Insert media with "Insert image" / "Insert audio", or paste an image from the
clipboard. Media is stored as a **separate file** (addressed by content hash),
not embedded in the card — this deduplicates automatically, keeps the sync file
small, and uploads each file to your repo only once. External image URLs
(`![](https://…)`) work too. Raw HTML is deliberately shown as text, not
rendered, so an imported card can never run a script.

## Studying: confidence-based spaced repetition

Instead of scheduling by clock time, Flashy spaces cards by **confidence**: each
correct answer raises a card's level and each wrong answer lowers it, so
lower-confidence cards come back around sooner. Decks and projects show a mastery
bar and a percentage, so you can see at a glance what's still new, being learned,
known, or fully mastered.

## AI practice exams

Turn your decks into a realistic written exam that the AI creates and grades.

1. Open **Create exam** on a deck or project.
2. Configure it: which topics/cards to include, the mix of direct recall vs.
   transfer/application questions, the answer format (free text, multiple choice,
   or a mix with an adjustable ratio), the duration, the total points (optionally
   per topic), and the language.
3. The AI generates the exam. When it's ready you **start** it and a timer begins.
4. Work through it page by page (cover sheet + one task per page). Answers save
   automatically. When time runs out you get a short grace period to finish your
   sentence, then input locks and you submit.
5. The AI grades it: points per task, a corrected view with the expected answers,
   and short feedback on which topics are solid and which need work.

Graded exams are kept in the **exam history** (and synced). An exam that's
currently in progress stays only on the device where you started it.

### Setting up AI

AI features stay off until you connect a language model under **AI settings**
(spark icon, top right). Use any OpenAI-compatible endpoint with your own API key,
or **GitHub Models** with a GitHub token. Your key is stored only on your computer
and is never synced.

Flashy is otherwise fully local. Once AI is enabled, the content of the cards
being quizzed is sent to the provider you chose — nothing more.

### Make cards with your own AI

From AI settings you can also download the **flashcard skill** — a small
instruction file you hand to your LLM (Claude, ChatGPT, …). Attach your lecture
notes or past exams (or just name a topic) and the LLM produces a file you import
straight into a deck.

## Import & export

**Import** reads several formats automatically: Flashy's own format, generic JSON,
Anki text export (incl. Cloze), and plain CSV/TSV.

**Export** a deck or a whole project to:

- **Flashy (native)** – lossless, incl. types, progress and media (ZIP).
- **Generic JSON** – tool-neutral, media as a ZIP.
- **Anki (text + media)** – importable file (Basic + Cloze); media in a ZIP for
  Anki's media folder.
- **Quizlet** / **generic CSV** – simple pairs or a table for other apps.

Under "Advanced" you can filter which **card types** are exported and — for
CSV/JSON — add extra **columns** (e.g. confidence, correct/incorrect counts).

## Sync across devices

Flashy syncs through **your own** private GitHub repository, so your cards,
progress, media and exam history stay in step across computers — without both
devices being online at once. Every push is a commit, so you also get a version
history and a backup.

**Set up:**

1. Create a (preferably private) repo on GitHub.
2. Create a Personal Access Token with write access to repository contents — a
   classic token with the `repo` scope, or a fine-grained token with
   *Contents: Read and write*.
3. In Flashy, click the sync indicator (top right), paste the token and choose
   "Check token & load repos".
4. Pick the repo from the dropdown (the branch is pre-filled) and save.
5. On your other device, select the same repo.

Flashy syncs on start, on a set interval (default 5 min), on quit, and on demand.
If both sides changed since the last common state, it never merges blindly — a
dialog shows both versions (device, timestamp, counts), marks the newer one, and
you choose which wins. The token is stored only locally and never leaves your
machine.

If you used Flashy from the terminal before, this is also how you bring that data
into the desktop app: point sync at the same repo.

## Appearance, language & your data

Toggle light/dark theme and switch the interface between English and German from
the top bar. Your cards and settings are stored in your user profile, so app
updates don't touch them — and nothing leaves your machine unless you turn on
sync (your GitHub repo) or AI (your chosen provider).

## For developers

Flashy is an npm workspace: an Express + SQLite server (`server/`), a React
client (`client/`), and an Electron wrapper (`desktop/`). See
[desktop/README.md](desktop/README.md) for building the desktop app and cutting
releases.
