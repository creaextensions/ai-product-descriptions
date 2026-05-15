# AI Product Descriptions — Shopify Embedded App

A Shopify embedded app built with **Remix** and **Polaris** that uses **Claude** (Anthropic) to generate compelling AI-powered product descriptions.

## Features

- **Single Product Editor** — Generate, preview, and publish descriptions for any product
- **Bulk Generator** — Generate descriptions for multiple products simultaneously  
- **5 Writing Tones** — Professional, Friendly, Luxury, Playful, Minimalist
- **3 Length Options** — Short, Medium, Long
- **9 Languages** — English, Spanish, French, German, Italian, Portuguese, Dutch, Japanese, Chinese
- **Improve Existing** — Rewrite and enhance existing descriptions
- **Live Preview** — See rendered HTML before publishing
- **One-click Publish** — Push descriptions directly to Shopify

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Remix](https://remix.run) v2 |
| Shopify Integration | [@shopify/shopify-app-remix](https://github.com/Shopify/shopify-app-js/tree/main/packages/shopify-app-remix) v3 |
| UI Components | [Polaris](https://polaris.shopify.com) v13 |
| Embedded App Bridge | [@shopify/app-bridge-react](https://github.com/Shopify/app-bridge) v4 |
| AI Model | [Claude claude-sonnet-4-20250514](https://docs.anthropic.com) |
| Build Tool | [Vite](https://vitejs.dev) v5 |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Shopify Partner account](https://partners.shopify.com)
- A Shopify development store
- An [Anthropic API key](https://console.anthropic.com)
- [Shopify CLI](https://shopify.dev/docs/apps/tools/cli) installed globally:
  ```bash
  npm install -g @shopify/cli @shopify/app
  ```

### 1. Clone & Install

```bash
git clone <your-repo>
cd shopify-ai-descriptions
npm install
```

### 2. Create a Shopify App

```bash
shopify app create --name "AI Product Descriptions"
```

Or link an existing app:

```bash
shopify app config link
```

### 3. Configure Environment

Copy the example and fill in your values:

```bash
cp .env.example .env
```

Edit `.env`:
```
SHOPIFY_API_KEY=your_api_key_from_partners_dashboard
SHOPIFY_API_SECRET=your_api_secret
SHOPIFY_APP_URL=https://your-tunnel-url.trycloudflare.com
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
SCOPES=read_products,write_products
```

### 4. Start Development

```bash
shopify app dev
```

This will:
- Start a Cloudflare tunnel
- Update `SHOPIFY_APP_URL` automatically
- Open your development store

---

## Project Structure

```
shopify-ai-descriptions/
├── app/
│   ├── routes/
│   │   ├── app.jsx              # Polaris AppProvider + NavMenu
│   │   ├── app._index.jsx       # Dashboard with stats
│   │   ├── app.products.jsx     # Product list with filters
│   │   ├── app.products.$id.jsx # Individual product editor
│   │   ├── app.bulk.jsx         # Bulk generation
│   │   ├── app.settings.jsx     # Settings + API test
│   │   └── auth.$.jsx           # Shopify OAuth handler
│   ├── ai.server.js             # Claude API integration
│   ├── shopify.server.js        # Shopify app configuration
│   ├── entry.client.jsx         # Client hydration
│   ├── entry.server.jsx         # SSR rendering
│   └── root.jsx                 # HTML shell + Polaris styles
├── shopify.app.toml             # App configuration
├── vite.config.js               # Vite + Remix config
└── .env.example                 # Environment template
```

---

## How It Works

### AI Generation Flow

1. User selects a product from the catalog
2. Chooses tone, length, language, and optional highlights
3. Clicks "Generate Description"
4. The server calls Claude's API with a rich product context prompt
5. Claude returns HTML-formatted product copy
6. The user previews the rendered output
7. One click publishes directly to Shopify via GraphQL Admin API

### Claude Prompt Strategy

The AI prompt includes:
- Product title, vendor, category, tags
- Price and variant information
- Available options (size, color, material)
- Existing description for context
- Explicit tone, length, and language instructions
- Instruction to output clean, HTML-only content

### Session Storage

This demo uses in-memory session storage. For production, replace with a persistent store:

```bash
npm install @shopify/shopify-app-session-storage-prisma
```

---

## Deployment

```bash
shopify app deploy
```

For production hosting, update `shopify.server.js` to use a persistent session storage
(PostgreSQL, Redis, etc.) and set all environment variables in your hosting provider.

---

## API Reference

### `generateProductDescription(product, options)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `tone` | string | `"professional"` | Writing tone |
| `length` | string | `"medium"` | Content length |
| `language` | string | `"English"` | Target language |
| `highlights` | string[] | `[]` | Features to emphasize |

### `generateDescriptionVariants(product, count)`

Generates multiple tone variants for A/B testing.

### `improveProductDescription(product, existingDescription, improvements)`

Rewrites an existing description with specified improvements.

---

