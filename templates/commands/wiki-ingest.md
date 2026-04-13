---
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
description: Scan raw/ folder for unprocessed files and ingest them into the wiki as structured pages
argument-hint: [client-name]
---

# SE: Wiki Ingest

Scans `raw/` for unprocessed files (markdown, PDF, text, HTML), extracts key concepts,
and creates or updates structured wiki pages. Maintains `wiki/index.md` and `wiki/log.md`.
Moves processed files to `raw/processed/` when done.

## Variables

CLIENT: $ARGUMENTS
RAW_DIR: raw
WIKI_DIR: wiki
PROCESSED_DIR: raw/processed

## Instructions

- If CLIENT is provided: scope the wiki to `clients/CLIENT/wiki/` and `clients/CLIENT/raw/`
- If CLIENT is empty: use the project-level `wiki/` and `raw/` directories at repo root
- Never delete raw files — move to `raw/processed/` after ingestion
- One concept per wiki page — split multi-concept documents into multiple pages
- Check if a page already exists before creating — update instead of duplicate
- Cross-reference expertise.yaml when CLIENT is set
- SECRETS FILTER: NEVER include secrets in wiki pages. Scan every raw file for: eyJ (JWT), Bearer, client_secret, password=, api_key, _TOKEN=, _SECRET=, Authorization:. Redact matches with [REDACTED]. If a raw file is primarily secrets (like a .env), skip it entirely.

---

## Step 1: Scan raw/ for Unprocessed Files

```bash
ls -1 RAW_DIR/ 2>/dev/null | grep -v "^processed$"
```

Collect all files with extensions: `.md`, `.txt`, `.html`, `.htm`, `.pdf`

If no files found: report "No files to process in RAW_DIR/" and exit.

For each file, note:
- Filename and extension
- File size (skip empty files)
- Last modified date

---

## Step 2: Ensure Wiki Structure Exists

Check that these directories exist, create if missing:

```bash
mkdir -p WIKI_DIR/platform WIKI_DIR/clients WIKI_DIR/patterns WIKI_DIR/decisions WIKI_DIR/people PROCESSED_DIR
```

Check if `WIKI_DIR/index.md` exists. If not, create it with this skeleton:

```markdown
# Wiki Index

| Page | Category | Summary |
|------|----------|---------|
```

Check if `WIKI_DIR/log.md` exists. If not, create it with this skeleton:

```markdown
# Ingest Log

| Date | Source File | Pages Created | Pages Updated |
|------|-------------|---------------|---------------|
```

---

## Step 3: Process Each File

For each unprocessed file in `raw/`:

### 3a. Read the Content

Read the file fully. For HTML files, mentally strip tags and focus on text content.
For PDF files, read as text. If the file is unreadable, skip it and note in the log.

### 3b. Extract Key Information

Identify from the content:

**Concepts** — what platform features, patterns, or behaviors does this document describe?
**People** — names, roles, contact info, team assignments
**Clients** — any client or tenant references
**Decisions** — architectural or design decisions with stated rationale
**Patterns** — reusable flow structures, error handling approaches, API usage patterns
**Issues/Bugs** — known problems, workarounds, gotchas

### 3c. Determine Category and Target Pages

Map each concept to a wiki category:

| Concept Type | Wiki Category | Directory |
|---|---|---|
| Platform API behavior, node behavior, env var gotchas | platform | `wiki/platform/` |
| Client-specific knowledge, tenant state, project notes | clients | `wiki/clients/` (or `clients/CLIENT/wiki/clients/`) |
| Reusable flow/architecture patterns | patterns | `wiki/patterns/` |
| Architectural or design decisions with rationale | decisions | `wiki/decisions/` |
| Team members, roles, contacts | people | `wiki/people/` |

If a source file contains multiple distinct concepts, create a separate page for each.

### 3d. Check for Existing Pages

Before creating a page, glob for existing pages with similar names:

```bash
ls WIKI_DIR/CATEGORY/ 2>/dev/null
```

If a page covering the same concept exists: update it (merge new information, do not duplicate).
If no page exists: create a new one.

### 3e. Write or Update Each Wiki Page

**Page filename:** kebab-case of the concept name, `.md` extension.
Example: `native-object-reserved-names.md`, `cbp-status-mapping.md`

**Page format:**

```markdown
# Page Title

#tag1 #tag2 #category

One-sentence summary of this page.

## Content

[Concise wiki content — facts, patterns, gotchas. Not documentation. Keep it dense.]

## Related

- [[related-page-name]]
- [[another-related-page]]

---
Source: raw/source-filename.ext | Ingested: YYYY-MM-DD
```

**Tagging rules:**
- Always include the category as a tag: `#platform`, `#clients`, `#patterns`, `#decisions`, `#people`
- Add topic tags: `#api`, `#flow`, `#agent`, `#error-handling`, `#auth`, `#deployment`, etc.
- If CLIENT is set and the content is client-specific, add `#CLIENT`
- Tags go on line 2, space-separated

**Wiki link rules:**
- Link to related pages using `[[page-name]]` (filename without `.md`)
- Link to people pages when names appear: `[[john-doe]]`
- Link to platform pages when platform concepts are referenced
- Add links in the Related section and inline in the content where natural

**Platform-level content:**
- If the content would be useful to an SE on any engagement (not just this client), tag `#platform`
- Examples: API endpoint quirks, node behavior, auth patterns, deployment gotchas

**Cross-reference expertise.yaml (when CLIENT is set):**
- Read `clients/CLIENT/expertise.yaml` to check: does this knowledge already exist there?
- If the wiki page contains something missing from expertise.yaml's `implementation_patterns:` or `known_issues:`, note it (do not auto-edit expertise.yaml — that is `/improve`'s job)

---

## Step 4: Update wiki/index.md

After processing all files, update `WIKI_DIR/index.md`.

For each new page created, add one row to the index table:

```
| [[page-name]] | category | One-line summary of what this page covers |
```

For updated pages, check if they already have a row — if so, update the summary if it changed.

Keep the table sorted by category, then page name.

---

## Step 5: Append to wiki/log.md

Append one row per source file processed:

```
| YYYY-MM-DD | source-filename.ext | N created | N updated |
```

Use today's date. If a file was skipped (unreadable or empty), log it with `0 created | 0 updated | SKIPPED`.

---

## Step 6: Move Processed Files

For each successfully processed file, move it to `raw/processed/`:

```bash
mv RAW_DIR/filename PROCESSED_DIR/filename
```

If the move fails, warn but do not retry — leave the file in place.

---

## Step 7: Self-Learn — Detect and Feed Expertise

Wiki-ingest is not just a wiki tool — it closes the self-learn loop by feeding observations
back into expertise.yaml for any relevant app or client.

### 7a. Discover Relevant Expertise Files

Scan all existing apps and clients for expertise.yaml:

```bash
ls clients/*/expertise.yaml apps/*/expertise.yaml tools/*/expertise.yaml 2>/dev/null | grep -v _templates
```

Build a lookup: `{name} → {path to expertise.yaml}`.

### 7b. Match Ingested Content to Apps/Clients

For each raw file processed, check if its content references any known app or client:
- Direct name matches (e.g., file mentions "site-builder", "demo-corp", "spotcircuit")
- Keyword matches from expertise.yaml fields (repo names, framework names, domain names)
- If CLIENT was passed as an argument, always include that expertise file

Also check: does the content describe a system/tool/project that has NO expertise file?
If so, note it as an **unowned observation** — candidate for a new app or client entry.

### 7c. Extract Observations from Ingested Content

For each raw file, extract actionable observations — things that would be valuable in an
expertise.yaml. Look for:

- **Bugs/broken features** — "X is broken", "doesn't work", status issues
- **Architecture patterns** — how components connect, data flow, key design choices
- **API gotchas** — rate limits, auth quirks, endpoint behavior
- **Known issues** — workarounds, things that need fixing
- **State changes** — what's deployed, what's pending, what's blocked
- **Key files/paths** — important files that an SE would need to find
- **Config/settings** — hardcoded values, env vars, credentials needed

Format each as a one-line observation string, prefixed with the source file:

```
"[raw/filename.md] Observation text here"
```

### 7d. Append Observations to Expertise Files

For each matched expertise.yaml, append the relevant observations to its
`unvalidated_observations:` section. Read the file, append, write back, validate YAML.

```bash
python3 -c "import yaml; yaml.safe_load(open('PATH/expertise.yaml'))"
```

Rules:
- Never overwrite existing observations — append only
- Never promote observations directly — that is `/improve`'s job
- If an observation is already captured in the main expertise sections, skip it
- Keep observations concise (one line each)
- Update `last_updated:` in the meta/top-level section to today's date

### 7e. Handle Unowned Observations

If observations were extracted that don't match any existing app/client:

1. Group them by the system/project they describe
2. For each group, check if a directory should be created:
   - Does it describe an internal tool? → candidate for `apps/{name}/`
   - Does it describe a client engagement? → candidate for `clients/{name}/`
3. Do NOT auto-create — list them in the report as "Unowned observations"
   with a suggestion: `Run /create {name} or manually create apps/{name}/app.yaml`

---

## Step 8: Report

```
Wiki Ingest Complete

Source files processed: {N}
  Pages created: {N}
  Pages updated: {N}
  Files skipped: {N}

Pages created:
  - wiki/platform/page-name.md
  - wiki/patterns/page-name.md

Pages updated:
  - wiki/decisions/page-name.md

Self-learn:
  Observations appended: {N total}
    - apps/{name}/expertise.yaml: {N observations}
    - clients/{name}/expertise.yaml: {N observations}

  Unowned observations (no expertise.yaml found):
    - "{observation}" → suggested: apps/{name}/ or clients/{name}/
    - Run /create {name} to scaffold, then /improve {name} to validate

Files moved to raw/processed/:
  - filename.ext

Next steps:
  - Run /improve {name} for each expertise.yaml that received observations
```
