# Bookly CLI (Orbit CLI) — Data Flow Diagrams

## 1. End-to-End: User Keystroke to Terminal Output

Shows every data transformation from the moment the user types to the final rendered output.

```
 ╔══════════════════════════════════════════════════════════════════════════════╗
 ║  TERMINAL (TTY)                                                             ║
 ╚════════════╤═══════════════════════════════════════════════════╤═════════════╝
              │ stdin                                             ▲ stdout
              ▼                                                   │
 ┌────────────────────────┐                          ┌────────────────────────┐
 │  @clack/prompts        │                          │  Terminal Renderer     │
 │  text() / select()     │                          │                        │
 │                        │                          │  chalk    → colors     │
 │  Captures raw string:  │                          │  boxen    → borders    │
 │  "Where is my order    │                          │  marked + marked-      │
 │   ORD-12345?"          │                          │  terminal → markdown   │
 └───────────┬────────────┘                          │  figlet   → banner     │
             │ string                                └────────────▲───────────┘
             ▼                                                    │ rendered string
 ┌────────────────────────┐                          ┌────────────┴───────────┐
 │  ChatService           │                          │  Response Assembly     │
 │  .addMessage(          │                          │                        │
 │    convId,             │                          │  fullResponse built    │
 │    "user",        ─────┼──── stored ────┐         │  from streaming chunks │
 │    "Where is my..."    │                │         │  marked.parse() →      │
 │  )                     │                │         │  terminal markdown     │
 └───────────┬────────────┘                │         └────────────▲───────────┘
             │                             │                      │
             │ also: getMessages()         ▼                      │ fullResponse
             │ pulls all user +    ┌──────────────┐               │ string
             │ assistant messages  │  MemoryStore  │               │
             │ from memory ◄───────│  (singleton)  │               │
             │                     │              │               │
             │ formats them ──┐    │ interactions[]│               │
             │                │    └──────────────┘               │
             ▼                ▼                                    │
 ┌─────────────────────────────────────┐                          │
 │  Build messages array               │                          │
 │                                     │                          │
 │  [                                  │                          │
 │    { role: "system",                │                          │
 │      content: "You are a friendly   │                          │
 │      support agent for Bookly..." },│                          │
 │    { role: "user",                  │                          │
 │      content: "check order" },      │                          │
 │    { role: "assistant",             │                          │
 │      content: "Sure! What's..." },  │                          │
 │    { role: "user",                  │                          │
 │      content: "Where is my order    │                          │
 │       ORD-12345?" }                 │                          │
 │  ]                                  │                          │
 └───────────────┬─────────────────────┘                          │
                 │ messages[]                                      │
                 ▼                                                 │
 ┌─────────────────────────────────────┐                          │
 │  AIService.sendMessage()            │                          │
 │                                     │                          │
 │  streamText({                       │                          │
 │    model ──▶ anthropic provider,    │                          │
 │    messages ──▶ messages[],         │                          │
 │    tools ──▶ {} or enabled tools    │     onChunk(chunk) ──────┘
 │  })                                 │     called per token
 │                                     │
 └───────────────┬─────────────────────┘
                 │ HTTPS POST (streaming)
                 ▼
 ╔═══════════════════════════════════════╗
 ║  Anthropic Claude API                 ║
 ║  model: claude-sonnet-4-5-20250929    ║
 ║                                       ║
 ║  ← streams back SSE token chunks →    ║
 ╚═══════════════════════════════════════╝
```

---

## 2. Authentication & Session Data Flow

Shows how user identity is resolved before any conversation begins.

```
 startChat() / startToolChat() / startAgentChat()
       │
       ▼
 getUserFromToken()
       │
       ├──▶ memory.findByRole("auth")
       │         │
       │         ▼
       │    ┌─────────────────────────────────────┐
       │    │ Found prior session?                 │
       │    │                                      │
       │    │  YES → parse JSON → extract:         │
       │    │    { userId, access_token, timestamp }│
       │    │    return { id, token, authenticatedAt}│
       │    │                                      │
       │    │  NO  → create guest:                 │
       │    │    { userId: "guest_1739283...",      │
       │    │      access_token: "guest" }          │
       │    │    memory.add("auth", JSON.stringify) │
       │    │    return { id, token, authenticatedAt}│
       │    └──────────────────────┬──────────────┘
       │                           │
       ▼                           ▼
 initConversation(userId)    stored in memory as:
       │                     { id: 0, role: "auth",
       ▼                       content: '{"userId":"guest_..."}',
 ChatService                   timestamp: 1739283... }
  .getOrCreateConversation()
       │
       ▼
 memory.add("system", JSON.stringify({
   id: "conv_1_1739283...",
   userId: "guest_1739...",
   mode: "chat",
   title: "New chat conversation",
   messages: []
 }))
       │
       ▼
 Returns conversation object → chat loop begins
```

---

## 3. Chat Mode — Complete Request/Response Cycle

Shows one full turn of the conversation loop with actual data shapes.

```
 ┌─ CHAT LOOP (while true) ──────────────────────────────────────────────────┐
 │                                                                            │
 │  ① USER INPUT                                                             │
 │  ─────────────                                                             │
 │  text({ message: "Your message" })                                        │
 │       │                                                                    │
 │       │  userInput = "What's your shipping policy?"                        │
 │       ▼                                                                    │
 │  ② PERSIST TO MEMORY                                                      │
 │  ───────────────────                                                       │
 │  saveMessage(convId, "user", "What's your shipping policy?")              │
 │       │                                                                    │
 │       │  memory.add("user", "What's your shipping policy?")               │
 │       │  → { id: 3, role: "user", content: "What's...", ts: ... }         │
 │       ▼                                                                    │
 │  ③ LOAD FULL HISTORY                                                      │
 │  ────────────────────                                                      │
 │  chatService.getMessages(convId)                                          │
 │       │                                                                    │
 │       │  memory.getAll()                                                   │
 │       │    .filter(e => e.role === "user" || e.role === "assistant")       │
 │       │                                                                    │
 │       │  Returns: [                                                        │
 │       │    { role: "user", content: "What's your shipping policy?" }      │
 │       │  ]                                                                 │
 │       ▼                                                                    │
 │  ④ FORMAT FOR CLAUDE                                                      │
 │  ────────────────────                                                      │
 │  chatService.formatMessagesForAI(dbMessages)                              │
 │       │                                                                    │
 │       │  Prepend system prompt:                                            │
 │       │  [                                                                 │
 │       │    { role: "system", content: "You are a friendly customer        │
 │       │      support agent for Bookly. Help the customer with             │
 │       │      general questions about shipping policies..." },             │
 │       │    { role: "user", content: "What's your shipping policy?" }      │
 │       │  ]                                                                 │
 │       ▼                                                                    │
 │  ⑤ STREAM TO CLAUDE API                                                   │
 │  ───────────────────────                                                   │
 │  aiService.sendMessage(messages, onChunk)                                 │
 │       │                                                                    │
 │       │  ┌─ streamText() ────────────────────────────────┐                │
 │       │  │                                                │                │
 │       │  │  HTTPS POST → api.anthropic.com/v1/messages   │                │
 │       │  │  Body: { model, messages, stream: true }       │                │
 │       │  │                                                │                │
 │       │  │  ◄── SSE chunks ──┐                            │                │
 │       │  │  "We"             │                            │                │
 │       │  │  " offer"         │  each chunk fires          │                │
 │       │  │  " free"          │  onChunk(chunk)            │                │
 │       │  │  " standard"      │  fullResponse += chunk     │                │
 │       │  │  " shipping..."   │                            │                │
 │       │  │                   │                            │                │
 │       │  │  Returns: {                                    │                │
 │       │  │    content: "We offer free standard...",       │                │
 │       │  │    finishReason: "end_turn",                   │                │
 │       │  │    usage: { promptTokens, completionTokens }   │                │
 │       │  │  }                                             │                │
 │       │  └────────────────────────────────────────────────┘                │
 │       ▼                                                                    │
 │  ⑥ RENDER & SAVE                                                          │
 │  ────────────────                                                          │
 │  marked.parse(fullResponse) → terminal-formatted markdown                 │
 │  console.log(renderedMarkdown) → user sees answer                         │
 │                                                                            │
 │  saveMessage(convId, "assistant", "We offer free standard...")             │
 │  memory.add("assistant", "We offer free standard...")                     │
 │       │                                                                    │
 │       │  ⑦ TITLE UPDATE (first message only)                              │
 │       │  ─────────────────────────────────────                             │
 │       │  if messageCount === 1:                                            │
 │       │    chatService.updateTitle(convId, "What's your shipping poli...") │
 │       │    → mutates the "system" entry in memory                          │
 │       ▼                                                                    │
 │  ◄─── loop back to ① ────                                                 │
 └────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Tool Calling Mode — Multi-Step Data Flow

Shows how data bounces between Claude and local tool executors.

```
 User: "Can you look up order ORD-12345 and tell me when it arrives?"
       │
       ▼
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │  STEP 1: User selects tools                                                 │
 │                                                                              │
 │  multiselect() → user picks: ["order_lookup", "search_faq"]                │
 │       │                                                                      │
 │       ▼                                                                      │
 │  enableTools(["order_lookup", "search_faq"])                                │
 │  → availableTools[0].enabled = true  (order_lookup)                         │
 │  → availableTools[2].enabled = true  (search_faq)                           │
 │                                                                              │
 │  getEnabledTools() builds:                                                  │
 │  {                                                                           │
 │    order_lookup: tool({ parameters: z.object({ orderNumber: z.string() }),  │
 │                         execute: async ({ orderNumber }) => ... }),          │
 │    search_faq:   tool({ parameters: z.object({ query: z.string() }),        │
 │                         execute: async ({ query }) => ... })                 │
 │  }                                                                           │
 └──────────────────────────────────────────────────────────────────────────────┘
       │
       ▼
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │  STEP 2: Send to Claude with tools (maxSteps: 5)                            │
 │                                                                              │
 │  streamText({                                                                │
 │    model: anthropic("claude-sonnet-4-5-20250929"),                           │
 │    messages: [ system prompt, ...history, user message ],                    │
 │    tools: { order_lookup: ..., search_faq: ... },                           │
 │    maxSteps: 5                                                               │
 │  })                                                                          │
 └──────────┬───────────────────────────────────────────────────────────────────┘
            │
            ▼
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │  STEP 3: Claude decides to call a tool                                      │
 │                                                                              │
 │  Claude returns tool_use:                                                    │
 │  {                                                                           │
 │    toolName: "order_lookup",                                                │
 │    args: { orderNumber: "ORD-12345" }                                       │
 │  }                                                                           │
 │       │                                                                      │
 │       │  onToolCall fires → boxen renders:                                  │
 │       │  ╭─ Tool Call ──────────────────────╮                                │
 │       │  │ Tool: order_lookup               │                                │
 │       │  │ Args: { orderNumber: "ORD-12345"}│                                │
 │       │  ╰──────────────────────────────────╯                                │
 │       ▼                                                                      │
 │  STEP 4: Vercel AI SDK auto-executes the tool locally                       │
 │                                                                              │
 │  execute({ orderNumber: "ORD-12345" })                                      │
 │       │                                                                      │
 │       │  Looks up mock data:                                                │
 │       │  mockOrders["ORD-12345"] →                                          │
 │       ▼                                                                      │
 │  Tool returns:                                                               │
 │  {                                                                           │
 │    found: true,                                                              │
 │    orderNumber: "ORD-12345",                                                │
 │    status: "Shipped",                                                        │
 │    items: ["The Great Gatsby", "To Kill a Mockingbird"],                    │
 │    tracking: "TRK-98765",                                                   │
 │    estimatedDelivery: "2026-02-15"                                          │
 │  }                                                                           │
 │       │                                                                      │
 │       │  boxen renders:                                                     │
 │       │  ╭─ Tool Result ────────────────────╮                                │
 │       │  │ { found: true, status: "Shipped",│                                │
 │       │  │   tracking: "TRK-98765", ... }   │                                │
 │       │  ╰──────────────────────────────────╯                                │
 │       ▼                                                                      │
 │  STEP 5: Tool result sent back to Claude (automatic — within maxSteps)      │
 │                                                                              │
 │  Claude sees the order data → generates final natural language response:    │
 │  "Your order ORD-12345 has been shipped! It contains The Great Gatsby       │
 │   and To Kill a Mockingbird. Your tracking number is TRK-98765 and          │
 │   estimated delivery is February 15, 2026."                                 │
 │       │                                                                      │
 │       │  Streamed back via onChunk → fullResponse                           │
 │       ▼                                                                      │
 │  marked.parse(fullResponse) → rendered to terminal                          │
 └──────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Agent Mode — Structured Generation to Filesystem

Shows how a text description becomes files on disk.

```
 User: "Build a todo app with React and Tailwind"
       │
       ▼
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │  STEP 1: Build the prompt                                                   │
 │                                                                              │
 │  prompt = `Generate a complete application based on this description:        │
 │  "Build a todo app with React and Tailwind".                                │
 │  Include all necessary files with complete content...`                      │
 └──────────┬───────────────────────────────────────────────────────────────────┘
            │
            ▼
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │  STEP 2: Structured generation with Zod schema                              │
 │                                                                              │
 │  generateObject({                                                            │
 │    model: anthropic("claude-sonnet-4-5-20250929"),                           │
 │    schema: ApplicationSchema,  ◄── Zod enforces shape                       │
 │    prompt: prompt                                                            │
 │  })                                                                          │
 │       │                                                                      │
 │       │  ApplicationSchema = z.object({                                     │
 │       │    folderName:    z.string(),     // "react-todo-app"               │
 │       │    description:   z.string(),     // "A todo app with..."           │
 │       │    files:         z.array(z.object({                                │
 │       │      path:    z.string(),         // "src/App.jsx"                  │
 │       │      content: z.string()          // "import React from..."         │
 │       │    })),                                                              │
 │       │    setupCommands: z.array(z.string())  // ["npm install", ...]      │
 │       │  })                                                                  │
 │       ▼                                                                      │
 │  Claude returns validated object:                                            │
 │  {                                                                           │
 │    folderName: "react-todo-app",                                            │
 │    description: "A React + Tailwind todo application",                      │
 │    files: [                                                                  │
 │      { path: "package.json",      content: "{ \"name\": \"react..." },     │
 │      { path: "src/App.jsx",       content: "import React from..." },       │
 │      { path: "src/index.css",     content: "@tailwind base;..." },         │
 │      { path: "tailwind.config.js",content: "module.exports..." },          │
 │      { path: "README.md",         content: "# React Todo App..." }         │
 │    ],                                                                        │
 │    setupCommands: ["cd react-todo-app", "npm install", "npm run dev"]       │
 │  }                                                                           │
 └──────────┬───────────────────────────────────────────────────────────────────┘
            │
            ▼
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │  STEP 3: Write files to disk                                                │
 │                                                                              │
 │  for each file in result.files:                                             │
 │    fs.mkdir(dirname, { recursive: true })                                   │
 │    fs.writeFile(join(cwd, folderName, file.path), file.content)             │
 │                                                                              │
 │  Produces on filesystem:                                                     │
 │                                                                              │
 │  ./react-todo-app/                                                          │
 │  ├── package.json          ◄── written from files[0].content                │
 │  ├── README.md             ◄── written from files[4].content                │
 │  ├── tailwind.config.js    ◄── written from files[3].content                │
 │  └── src/                                                                    │
 │      ├── App.jsx           ◄── written from files[1].content                │
 │      └── index.css         ◄── written from files[2].content                │
 └──────────┬───────────────────────────────────────────────────────────────────┘
            │
            ▼
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │  STEP 4: Display summary                                                    │
 │                                                                              │
 │  boxen renders:                                                              │
 │  ╭─────────── Generated Application ────────────╮                            │
 │  │ Project: react-todo-app                       │                            │
 │  │ Description: A React + Tailwind todo app      │                            │
 │  │ Location: /home/user/react-todo-app           │                            │
 │  │ Files: 5                                      │                            │
 │  │                                               │                            │
 │  │ Setup commands:                               │                            │
 │  │   $ cd react-todo-app                         │                            │
 │  │   $ npm install                               │                            │
 │  │   $ npm run dev                               │                            │
 │  ╰───────────────────────────────────────────────╯                            │
 │                                                                              │
 │  confirm("Would you like to generate another application?")                 │
 │    YES → loop back     NO → exit                                            │
 └──────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Memory Store — Internal Data Structure

Shows the shape of the `interactions[]` array at runtime after a typical session.

```
 memory.interactions = [
 ┌────┬────────────┬──────────────────────────────────────────────┬──────────────┐
 │ id │ role       │ content                                      │ timestamp    │
 ├────┼────────────┼──────────────────────────────────────────────┼──────────────┤
 │  0 │ "auth"     │ '{"userId":"guest_1739283...","access_token" │ 1739283000   │
 │    │            │   :"guest","timestamp":1739283000}'          │              │
 ├────┼────────────┼──────────────────────────────────────────────┼──────────────┤
 │  1 │ "system"   │ '{"id":"conv_1_1739283...","userId":         │ 1739283001   │
 │    │            │   "guest_1739283...","mode":"tool",           │              │
 │    │            │   "title":"Where is order ORD..."}'          │              │
 ├────┼────────────┼──────────────────────────────────────────────┼──────────────┤
 │  2 │ "user"     │ "Where is my order ORD-12345?"              │ 1739283010   │
 ├────┼────────────┼──────────────────────────────────────────────┼──────────────┤
 │  3 │ "assistant"│ "Your order ORD-12345 has been shipped!..." │ 1739283015   │
 ├────┼────────────┼──────────────────────────────────────────────┼──────────────┤
 │  4 │ "user"     │ "Can I get a refund?"                       │ 1739283030   │
 ├────┼────────────┼──────────────────────────────────────────────┼──────────────┤
 │  5 │ "assistant"│ "I'd be happy to help with a refund..."     │ 1739283035   │
 └────┴────────────┴──────────────────────────────────────────────┴──────────────┘

 Query patterns:
 ───────────────
 findByRole("auth")      → [ entry 0 ]         → session/identity
 findByRole("system")    → [ entry 1 ]         → conversation metadata
 getAll().filter(user|assistant) → [ 2,3,4,5 ] → message history for Claude
 getRecent(2)            → [ 4, 5 ]            → last N interactions
 ]
```

---

## 7. Express Server — Minimal HTTP Layer

```
 Browser / HTTP client
       │
       │  GET /health
       ▼
 ┌──────────────┐       ┌──────────────┐
 │  Express 5   │──────▶│  res: "OK"   │
 │  port: $PORT │       │  status: 200 │
 └──────────────┘       └──────────────┘

 Note: The Express server is a placeholder.
 All business logic currently lives in the CLI path.
 The client (Next.js) and server (Express) are not
 yet wired together — they run independently.
```
