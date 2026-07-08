# StackDraft AI

> Describe your project in plain English. Get architecture diagrams, Terraform code, and cost estimates — instantly.

---

## Screenshots

![Architecture diagram — interactive Excalidraw canvas with cloud service nodes](public/assets/Project%20Screenshots/architecture-diagram.png)

![New project modal — describe your requirements, choose a cloud provider and budget](public/assets/Project%20Screenshots/new-project-modal.png)

![Terraform output — ready-to-deploy HCL with syntax highlighting](public/assets/Project%20Screenshots/terraform-output.png)

---

## Overview

StackDraft AI is a browser-based tool that uses Google Gemini to turn plain-English project ideas into cloud architecture proposals. Whether you're building a URL shortener, a to-do list API, an email analyser, or any starter project — just describe it and get an interactive diagram, deployable Terraform code, and a monthly cost estimate.

Perfect for freshers, students, and hobbyists who want to learn cloud architecture hands-on.

Supports **GCP**, **AWS**, and **Azure**.

---

## Features

| | |
|---|---|
| **AI-generated diagrams** | Three architecture proposals per request, ranked by fit |
| **Multi-cloud** | GCP · AWS · Azure  switch with one click |
| **Interactive canvas** | Excalidraw-powered diagrams you can edit in the browser |
| **Terraform output** | Ready-to-deploy HCL with syntax highlighting |
| **Cost estimates** | Monthly USD estimates per proposal |
| **Budget constraints** | Set a budget ceiling and let the AI adapt |
| **Monitoring toggle** | Include or exclude cloud-native observability services |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| UI | Mantine UI v7 |
| Diagramming | Excalidraw + Mermaid.js |
| AI | Google Gemini 2.5 Flash (`@google/generative-ai`) |
| Hosting | Firebase Hosting *(optional)* |

---

## System Architecture

![System Architecture  StackDraft AI](public/assets/Project%20Screenshots/system-architecture.png)

The application follows a **client-side AI pipeline** architecture with no backend server:

| Layer | Components | Role |
|:------|:-----------|:-----|
| **Google Cloud** | Gemini 2.5 Flash · Firebase Hosting | AI model for generating proposals; CDN for static deployment |
| **Frontend App** | React 18 · Vite · TypeScript · Mantine v7 · Tabler Icons | SPA core handles user input, state, and renders all views |
| **Diagram Engine** | Mermaid.js → Excalidraw | Parses AI-generated Mermaid syntax into interactive, editable canvas diagrams |
| **Code Output** | Terraform · Prism.js | Renders deployable HCL with syntax highlighting, copy, and download |
| **SVG Icon Mapper** | Custom mapping layer | Converts generic service names to provider-specific icons (20+ per cloud) |
| **Target Providers** | GCP · AWS · Azure | Multi-cloud support switch providers and get native service mappings |

> **Key design decision:** The Gemini API key is bundled client-side via `VITE_GEMINI_API_KEY` for zero-backend simplicity. Suitable for personal and demo use.

---

## Quick Start

**Prerequisites:** Node.js v18+, a [Gemini API key](https://aistudio.google.com/app/apikey)

```bash
# 1. Clone and install
git clone https://github.com/m0hitd/AI-Enterprise-Architect
cd cloud-architect-ai
npm install

# 2. Configure environment
cp .env.example .env.local
# → Open .env.local and set VITE_GEMINI_API_KEY

# 3. Run
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). That's it, no Firebase required to run locally.

---

## How It Works

1. **Describe** your project idea in plain English
2. **Set constraints** cloud provider, budget, observability preferences
3. **Generate**  Gemini returns three ranked architecture proposals
4. **Explore**  switch between proposals, pan and zoom the diagram
5. **Export**  copy the Terraform code and deploy

---

## Deployment

Firebase Hosting is optional and only needed to publish the app publicly.

```bash
npm run build
firebase deploy
```

For a step-by-step walkthrough see [FIREBASE_SETUP.md](./FIREBASE_SETUP.md).  
For a progress tracker see [SETUP_CHECKLIST.md](./SETUP_CHECKLIST.md).

---

## License

MIT — see [LICENSE](./LICENSE).
