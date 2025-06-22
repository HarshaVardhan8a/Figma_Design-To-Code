# 🎨 Figma Design‑To‑Code

Turn your Figma designs into clean, functional front‑end code with just a few clicks!

This is a React-based web interface that allows users to input a **Figma Design Key**, select a preferred frontend framework (HTML/CSS, React, Vue.js, or Angular), and receive code output using backend APIs. It simplifies the handoff between design and development by generating clean, ready-to-use code.

---

## 🌟 Key Features

- 🔑 **Enter Figma Design Key** – Connect your Figma file by simply pasting the design key
- 🌐 **Supports multiple frontend frameworks:**
  - HTML + CSS (static pages)
  - React.js (interactive apps)
  - Vue.js (progressive apps)
  - Angular (full SPAs)
- ⚙️ **Auto-generated code** – using integrated backend APIs
- 💻 **Developer-focused UI** – minimal interface, fast code preview
- 🔒 **Environment-safe setup** – uses `.env` to securely store sensitive API keys

---

## 📚 Tech Stack Overview

| Component     | Technology                          |
|---------------|--------------------------------------|
| Frontend      | React.js, HTML, CSS                 |
| API Layer     | Figma API, Custom Code Gen API      |
| Hosting (optional) | Vercel / Netlify              |
| Version Control | Git + GitHub                     |

---

## 🧠 How It Works

1. User enters a valid **Figma design key**
2. User selects one of the available code output formats (HTML, React, Vue, Angular)
3. Frontend sends a request to the backend API
4. The backend uses Figma API to parse the design file
5. Parsed layout and styling are converted to code
6. Generated code is returned to the frontend and displayed in the browser

---

## 🚀 Setup Instructions

### 🔧 Prerequisites

- Node.js (v14 or higher)
- npm
- Git

---

### 📥 Clone and Install

```bash
git clone https://github.com/HarshaVardhan8a/Figma_Design-To-Code.git
cd Figma_Design-To-Code
npm install
