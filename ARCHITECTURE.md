# Bookly CLI (Orbit CLI) — Architecture Diagram

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          bookly-cli                                 │
│                                                                     │
│  ┌───────────────────────────────┐  ┌────────────────────────────┐  │
│  │         server/               │  │         client/            │  │
│  │    (Node.js CLI + API)        │  │    (Next.js Dashboard)     │  │
│  └───────────────────────────────┘  └────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## Server Architecture — Full Module Graph

```
                          ┌──────────────────┐
                          │    User (TTY)     │
                          └────────┬─────────┘
                                   │  $ node src/cli/main.js
                                   ▼
                       ┌───────────────────────┐
                       │    cli/main.js         │
                       │  ─────────────────     │
                       │  • figlet banner       │
                       │  • Commander program   │
                       │  • registers "wakeup"  │
                       └───────────┬───────────┘
                                   │  program.addCommand(wakeUp)
                                   ▼
                   ┌───────────────────────────────┐
                   │  cli/commands/ai/wakeUp.js     │
                   │  ─────────────────────────     │
                   │  @clack/prompts select() →     │
                   │  "Chat" | "Tool" | "Agent"     │
                   └──────┬────────┬────────┬──────┘
                          │        │        │
            ┌─────────────┘        │        └─────────────┐
            ▼                      ▼                      ▼
  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐
  │  Mode 1: CHAT    │  │  Mode 2: TOOL    │  │  Mode 3: AGENT       │
  │  chat-with-ai.js │  │  chat-with-ai-   │  │  chat-with-ai-       │
  │                  │  │  tool.js          │  │  agent.js            │
  └────────┬─────────┘  └────────┬─────────┘  └──────────┬───────────┘
           │                     │                        │
           ▼                     ▼                        ▼
  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐
  │  Sub-select:     │  │  Multi-select    │  │  text() prompt:      │
  │  • Order Check   │  │  tools to enable │  │  "Describe app..."   │
  │  • Refund        │  │  via @clack      │  │                      │
  │  • General       │  │                  │  │  ┌─ confirm() ──┐    │
  │                  │  │  ┌────────────┐  │  │  │ Build more?  │    │
  │  System prompt   │  │  │tool.config │  │  │  └──────────────┘    │
  │  per mode        │  │  │  .js       │  │  │                      │
  └────────┬─────────┘  │  └─────┬──────┘  │  └──────────┬───────────┘
           │            │        │         │             │
           │            │        ▼         │             │
           │            │  ┌───────────┐   │             │
           │            │  │ Enabled   │   │             │
           │            │  │ Tools:    │   │             │
           │            │  │• order_   │   │             │
           │            │  │  lookup   │   │             │
           │            │  │• process_ │   │             │
           │            │  │  refund   │   │             │
           │            │  │• search_  │   │             │
           │            │  │  faq      │   │             │
           │            │  └─────┬─────┘   │             │
           │            │        │         │             │
           ▼            ▼        ▼         │             ▼
  ┌─────────────────────────────────────┐  │  ┌──────────────────────┐
  │       cli/ai/anthropic-service.js   │  │  │  config/agent.       │
  │       ───────────────────────────   │  │  │  config.js           │
  │                                     │  │  │  ──────────────      │
  │  class AIService                    │  │  │  Zod schema:         │
  │  ┌───────────────────────────────┐  │  │  │  ApplicationSchema   │
  │  │ sendMessage(msgs, onChunk,   │  │  │  │  { folderName,       │
  │  │   tools?, onToolCall?)       │  │  │  │    description,      │
  │  │   → streamText()             │◄─┘  │  │    files[],          │
  │  │   → streaming chunks         │     │  │    setupCommands[] } │
  │  │   → toolCalls + toolResults  │     │  │                      │
  │  ├───────────────────────────────┤     │  │  generateApplication │
  │  │ getMessage(msgs, tools?)     │     │  │  () → writes files   │
  │  │   → non-streaming wrapper    │     │  │  to disk             │
  │  ├───────────────────────────────┤     │  └──────────┬───────────┘
  │  │ generateStructured(schema,   │     │             │
  │  │   prompt)                    │◄────┼─────────────┘
  │  │   → generateObject()         │     │
  │  └───────────────┬───────────────┘     │
  │                  │                     │
  └──────────────────┼─────────────────────┘
                     │
                     ▼
          ┌──────────────────────┐
          │ config/anthropic.    │
          │ config.js            │
          │ ──────────────────   │
          │ claudeApiKey: env    │
          │ model: claude-       │
          │  sonnet-4-5-20250929 │
          └──────────┬───────────┘
                     │
                     ▼
          ┌──────────────────────┐
          │  Anthropic Claude    │
          │  API (External)      │
          │  via @ai-sdk/        │
          │  anthropic           │
          └──────────────────────┘
```

## Data Layer — Memory & Chat Service

```
  chat-with-ai.js ──┐
  chat-with-ai-     │
    tool.js ─────────┼──▶ service/chat.service.js
  chat-with-ai-     │     ──────────────────────
    agent.js ───────┘     │ createConversation()
                          │ getOrCreateConversation()
                          │ addMessage()
                          │ getMessages()
                          │ formatMessagesForAI()
                          │ updateTitle()
                          │ getUserConversations()
                          └──────────┬──────────
                                     │
                                     ▼
                          ┌──────────────────────┐
                          │  memory.js            │
                          │  (Singleton)          │
                          │  ──────────────────   │
                          │  class MemoryStore    │
                          │  ┌──────────────────┐ │
                          │  │ interactions: [] │ │
                          │  └──────────────────┘ │
                          │  • add(role, content)  │
                          │  • getAll()            │
                          │  • getRecent(n)        │
                          │  • findByRole(role)    │
                          │  • clear()             │
                          │                        │
                          │  Roles stored:         │
                          │  "auth"    → sessions  │
                          │  "system"  → convos    │
                          │  "user"    → messages   │
                          │  "assistant"→ replies   │
                          └────────────────────────┘
```

## Tool Calling Flow (Mode 2)

```
  User message
       │
       ▼
  ┌────────────────┐     ┌──────────────────────┐
  │ chat-with-ai-  │────▶│ AIService.           │
  │ tool.js        │     │ sendMessage(          │
  │                │     │   messages,           │
  │ getToolAI      │     │   onChunk,            │
  │ Response()     │     │   tools ◄─ enabled,   │
  └────────────────┘     │   onToolCall)         │
                         └──────────┬───────────┘
                                    │
                   ┌────────────────┼────────────────┐
                   │   streamText() with maxSteps: 5 │
                   │                                 │
                   │  Claude decides to call tool ──▶│
                   │    ┌────────────────────────┐   │
                   │    │ tool.config.js          │   │
                   │    │ execute() handler runs  │   │
                   │    │ returns mock data       │   │
                   │    └────────────────────────┘   │
                   │                                 │
                   │  Tool result fed back to model  │
                   │  Model generates final response │
                   └─────────────────────────────────┘
                                    │
                                    ▼
                         ┌──────────────────┐
                         │ Terminal output:  │
                         │ • Tool Call box   │
                         │ • Tool Result box │
                         │ • Markdown reply  │
                         └──────────────────┘
```

## Agent Mode Flow (Mode 3)

```
  User: "Build a todo app with React"
       │
       ▼
  ┌──────────────────┐      ┌──────────────────────────┐
  │ chat-with-ai-    │─────▶│ agent.config.js           │
  │ agent.js         │      │ generateApplication()     │
  │                  │      └────────────┬──────────────┘
  └──────────────────┘                   │
                                         ▼
                              ┌──────────────────────┐
                              │ AIService.            │
                              │ generateStructured(   │
                              │   ApplicationSchema,  │
                              │   prompt)             │
                              └──────────┬───────────┘
                                         │
                                         ▼
                              ┌──────────────────────┐
                              │ Claude returns:       │
                              │ {                     │
                              │   folderName,         │
                              │   description,        │
                              │   files: [            │
                              │     { path, content } │
                              │   ],                  │
                              │   setupCommands       │
                              │ }                     │
                              └──────────┬───────────┘
                                         │
                                         ▼
                              ┌──────────────────────┐
                              │ fs.writeFile() for    │
                              │ each file → disk      │
                              │                       │
                              │ Created at:           │
                              │ ./folderName/         │
                              │   ├── package.json    │
                              │   ├── src/            │
                              │   └── ...             │
                              └──────────────────────┘
```

## Client Architecture (Next.js Dashboard)

```
  client/
  ├── app/
  │   ├── layout.tsx ────────────── Root layout (fonts, metadata)
  │   ├── page.tsx ──────────────── Home page (single Button)
  │   └── globals.css ───────────── Tailwind v4 theme vars
  │
  ├── components/ui/ ────────────── 40+ shadcn/Radix components
  │   ├── button.tsx                ┌──────────────────────────┐
  │   ├── dialog.tsx                │ Built with:              │
  │   ├── form.tsx                  │ • Radix UI primitives    │
  │   ├── input.tsx                 │ • class-variance-auth.   │
  │   ├── table.tsx                 │ • tailwind-merge         │
  │   ├── chart.tsx (recharts)      │ • React 19              │
  │   ├── command.tsx (cmdk)        └──────────────────────────┘
  │   ├── calendar.tsx
  │   ├── carousel.tsx
  │   ├── sidebar.tsx
  │   ├── drawer.tsx (vaul)
  │   └── ... (30+ more)
  │
  ├── hooks/ ────────────────────── Custom React hooks
  ├── lib/utils.ts ──────────────── cn() helper (clsx + twMerge)
  └── public/ ───────────────────── Static assets
```

## Complete Dependency Map

```
┌──────────── SERVER DEPENDENCIES ──────────────────────────────────┐
│                                                                    │
│  AI / LLM                      CLI UI                             │
│  ─────────                     ──────                             │
│  @ai-sdk/anthropic ──┐         commander ────── arg parsing       │
│  ai (Vercel AI SDK) ─┤         @clack/prompts ─ select, text,    │
│  zod ────────────────┘           multiselect, confirm             │
│                                chalk ──────────── colors          │
│  Server                        figlet ─────────── ASCII banner    │
│  ──────                        boxen ──────────── boxed output    │
│  express ──── /health          yocto-spinner ──── spinners        │
│  cors                          marked ─────────── markdown →      │
│  dotenv                        marked-terminal ── terminal render │
│                                                                    │
│  Data (configured)                                                │
│  ────                                                             │
│  @prisma/client                                                   │
│  prisma                                                           │
└────────────────────────────────────────────────────────────────────┘

┌──────────── CLIENT DEPENDENCIES ──────────────────────────────────┐
│                                                                    │
│  Framework              UI Components          Utilities           │
│  ─────────              ─────────────          ─────────           │
│  next 16.1.6            radix-ui               date-fns            │
│  react 19.2.3           cmdk                   clsx                │
│  react-dom              vaul                   tailwind-merge      │
│  typescript 5           sonner                 class-variance-auth │
│                         input-otp              zod                 │
│  Styling                lucide-react           react-hook-form     │
│  ───────                embla-carousel-react   @hookform/resolvers │
│  tailwindcss 4          react-day-picker                           │
│  @tailwindcss/postcss   react-resizable-panels                     │
│  tw-animate-css         recharts                                   │
│  next-themes            @base-ui/react                             │
│                         shadcn                                     │
└────────────────────────────────────────────────────────────────────┘
```

## NPM Scripts (Entry Points)

```
server/
  npm run cli ──────▶ node src/cli/main.js     (CLI interface)
  npm run dev ──────▶ nodemon src/index.js     (Express dev server)
  npm run start ────▶ node src/index.js        (Express prod server)

client/
  npm run dev ──────▶ next dev                 (Next.js dev server)
  npm run build ────▶ next build               (Production build)
  npm run start ────▶ next start               (Production server)
  npm run lint ─────▶ eslint                   (Lint check)
```
