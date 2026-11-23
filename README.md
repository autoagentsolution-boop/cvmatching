# CV Matching — CV Fit Scoring Assistant

**A local-first prototype for comparing a CV with a job description, identifying evidence gaps, and making more informed application decisions.**

`Personal project` · `MVP` · `Local-first` · `HTML / CSS / JavaScript` · `Heuristic scoring` · `AI-assisted development`

> **Project status:** Working browser-based MVP. The current matching engine is rule-based, not an LLM-powered evaluator or a commercial ATS. The scores are directional indicators, not predictions of hiring outcomes.

## Why I built it

As a Data Engineering professional exploring practical AI applications, I wanted a tool that could answer more useful questions than *“Does my CV contain the right keywords?”*

- How well does my CV describe the experience a role actually requires?
- Which requirements are missing from the CV, even when I have relevant experience?
- Which gaps reflect genuine skills I still need to develop?
- Is this a strong-fit role, or would my application need better positioning?

I used AI-assisted development to turn that workflow into a local application and iteratively refine its logic and interface. **The focus is honest positioning, not inventing qualifications to increase a score.**

## What the MVP does

| Capability | Description |
| --- | --- |
| **JD and CV comparison** | Accepts pasted job descriptions and CV text for side-by-side assessment. |
| **Optional experience profile** | Adds genuine experience that may not be visible in the CV and separates it from CV wording. |
| **Overall fit score** | Generates an indicative score from 0–100 with adjustable *Balanced*, *Strict*, and *Friendly* modes. |
| **Multiple score dimensions** | Reviews must-have requirements, technical skills, production/domain experience, CV evidence, seniority/leadership, and business communication. |
| **Role-aware assessment** | Auto-detects or manually selects a role family, including Data Engineer, Data Platform, Data Engineer Manager, Project/Delivery/Operations Lead, and Solution Architect/Pre-sales. |
| **Requirement coverage** | Highlights strong matches, partial matches, missing categories, and weak evidence for must-have requirements. |
| **CV improvement suggestions** | Recommends where to add clearer, truthful evidence and measurable project outcomes. |
| **Report output** | Supports copying or downloading a Markdown analysis report and downloading an HTML page snapshot. |

### Example workflow

1. **Paste a job description** and optionally record its source URL.
2. **Paste your CV**, then add an optional profile of real experience not fully reflected in the CV.
3. **Choose a role family and scoring strictness**, or leave role detection on automatic.
4. **Run the analysis** to review fit, requirement coverage, potential gaps, and recommendations.
5. **Refine the CV using truthful evidence** and export a Markdown report for reference.

**Typical flow:** `Job description + CV + optional real experience → keyword/requirement analysis → weighted scoring → gap analysis → recommendations → Markdown report`

## What makes the approach different

A missing keyword in a CV is not always a missing skill. The tool estimates both:

- **CV visibility:** How clearly the written CV reflects relevant requirements.
- **Experience/profile coverage:** What the candidate's supplied CV *and additional real-experience profile* indicate.

This distinction is useful for identifying **documentation gaps versus genuine experience gaps**. It is still based on self-supplied text and keyword heuristics; the tool does not independently validate experience.

## How it works

The current implementation is a single-page application built with **HTML, CSS, and JavaScript**. It runs locally in a browser without a backend or database.

- Uses curated skill and keyword categories to compare job requirements with supplied CV/profile text.
- Extracts candidate must-have requirements from job-description text and estimates textual coverage.
- Selects priority categories based on the detected or chosen role family.
- Combines six scored dimensions with predefined weights to calculate an indicative fit score.
- Produces a breakdown, missing/partial categories, guidance, and a structured Markdown report.

**Runtime AI clarification:** The current MVP does **not** call an LLM, use embeddings, or query an external AI service to calculate the match. AI tools were used to support the *development process*; the application's matching itself is heuristic.

## Technology and design decisions

| Area | Current approach |
| --- | --- |
| Frontend | HTML, CSS, vanilla JavaScript |
| Execution | Local browser; no application backend |
| Comparison | Keyword/category matching and rule-based requirement extraction |
| Scoring | Role-aware weighted heuristics |
| Input | Paste text; TXT uploads; DOCX parsing through a browser-loaded library |
| Output | On-screen scorecards, coverage analysis, Markdown download, HTML page snapshot |
| Privacy model | The matching runs in the browser; no app backend receives CV data. An internet connection may be needed to load the DOCX parsing library. |

## Screenshots and demo

*Add screenshots from the running application before publishing:*

- **Input workspace** — JD, CV, optional real-experience profile, and role settings.
- **Fit score** — overall score and six-dimension breakdown.
- **Gap analysis** — matched, partial, and missing requirements.
- **Markdown report** — exported analysis and actionable recommendations.

Suggested folder: `assets/screenshots/`. Use sample or anonymized CVs and job descriptions; do not publish personal contact details or confidential information.

## Limitations and responsible use

- **Not a hiring prediction or official ATS score.** It is a self-assessment aid.
- **Rule-based rather than semantic understanding.** Synonyms, context, negation, and complex requirements may be misclassified.
- **Keyword evidence is not proof of competency.** Scores depend on the quality and truthfulness of user-provided text.
- **No automatic job URL fetching.** The URL field stores a reference; the JD must be entered separately.
- **PDF upload is not implemented in this MVP.** Use copy/paste instead. TXT works directly; DOCX parsing requires a browser-loaded dependency.
- **No persistent database, accounts, or multi-user workflow** in the current prototype.
- **The HTML snapshot is a page export**, not a verified portable copy of all analysis inputs or data.

**Ethical guardrail:** Add tools, accomplishments, or experience to a CV only when they are accurate and defensible in an interview.

## Potential next steps

These are ideas for future versions, **not current MVP features**:

- More robust document ingestion and structured CV/JD parsing.
- Evidence-based, explainable semantic matching with an optional local AI model.
- Comparison across several roles and job descriptions.
- Better handling of missing context, synonyms, and requirement criticality.
- Optional integration with a separate, curated local job-data pipeline.

## My role and learning journey

**Problem owner · Workflow designer · AI-assisted developer · Tester**

My contribution has focused on identifying the problem, defining comparison and scoring requirements, structuring the end-to-end workflow, using AI coding assistants to accelerate prototyping, reviewing outputs, and refining the experience through testing and iteration.

This project represents my broader interest in **combining Data Engineering experience, practical problem-solving, and AI-assisted development to build useful tools**.

---

**Portfolio note:** This repository may be used as a public project showcase while the implementation remains private. Descriptions above refer to the inspected browser MVP, not to unverified future functionality.
