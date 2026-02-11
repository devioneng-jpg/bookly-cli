# Bookly CLI - Project Rating

## Overall Score: 2.0 / 5.0 (Early-Stage Prototype)

---

## Category Scores

| Category              | Score | Weight | Notes                                          |
|-----------------------|-------|--------|-------------------------------------------------|
| Code Organization     | 3/5   | 15%    | Good separation of concerns, modular structure  |
| Code Quality          | 2.5/5 | 15%    | Consistent error handling, but no type safety   |
| Testing               | 0/5   | 20%    | No tests whatsoever                             |
| Documentation         | 1/5   | 10%    | README is empty, minimal code comments          |
| Dependencies          | 2/5   | 10%    | Several unused packages (Prisma, CORS)          |
| CI/CD & Tooling       | 0/5   | 10%    | No linter, formatter, or CI pipeline            |
| Data Persistence      | 0/5   | 10%    | In-memory only; data lost on restart            |
| Production Readiness  | 1/5   | 10%    | Not deployable in current state                 |

---

## What the Project Does

Bookly is an AI-powered customer support CLI agent for an online bookstore. It uses the Anthropic Claude API (via Vercel AI SDK) to provide three chat modes:

1. **Basic Chat** - General customer support conversation
2. **Tool-Calling** - AI with access to order lookup, refund processing, and FAQ tools
3. **Agent Mode** - Full application scaffolding generation

The CLI features a polished terminal UI with ASCII art banners, color-coded output, markdown rendering, and interactive prompts.

---

## Strengths

- **Clean modular architecture** - Config, service, and UI layers are well-separated across files with single responsibilities.
- **Solid error handling** - Try-catch patterns are applied consistently throughout the codebase (38 instances).
- **Good UX for a CLI** - Rich terminal experience with chalk, figlet, boxen, spinners, and markdown rendering.
- **Modern JavaScript** - ES modules, async/await, destructuring used throughout.
- **AI SDK integration** - Proper use of the Vercel AI SDK for streaming, tool calling, and structured output.

---

## Critical Issues

### 1. Data Isolation Bug (HIGH)
`ChatService.getMessages()` accepts a `conversationId` parameter but ignores it, returning messages from **all** conversations. This is a correctness bug that would surface immediately in multi-conversation use.

**File:** `server/src/service/chat.service.js`

### 2. No Test Coverage (HIGH)
Zero test files, no test runner configured, no test scripts in `package.json`. Critical paths like API integration, conversation management, tool execution, and message formatting are entirely untested.

### 3. Empty README (MEDIUM)
The README contains only a heading (`# bookly-cli`). There are no setup instructions, feature descriptions, environment variable documentation, or usage examples.

### 4. In-Memory Storage Only (MEDIUM)
All conversations are stored in a plain JavaScript array. Data is lost on every restart. Prisma is listed as a dependency but is completely unused, suggesting planned but unfinished database integration.

### 5. Tools Never Enabled (MEDIUM)
All tools in `tool.config.js` are initialized with `enabled: false`. The tool selection UI exists but the tools are never actually wired up for use.

### 6. Unused Dependencies (LOW-MEDIUM)
`@prisma/client`, `prisma`, and `cors` are installed but never imported or used. `nodemon` is referenced in scripts but not listed as a dependency. This adds unnecessary bloat and increases the security surface.

---

## Recommendations (Priority Order)

1. **Add tests** - Set up Vitest or Jest; write unit tests for `ChatService`, `AIService`, and tool configs. Add integration tests for chat flows.
2. **Fix the data isolation bug** - Filter messages by `conversationId` in `getMessages()`.
3. **Write the README** - Include installation steps, environment variables (`CLAUDE_ANTHROPIC_API_KEY`, `CLAUDE_MODEL`), usage instructions, and feature overview.
4. **Implement database persistence** - Either use the already-installed Prisma or remove it. Design a schema for conversations and messages.
5. **Remove unused dependencies** - Drop `@prisma/client`, `prisma`, `cors` if not needed. Add `nodemon` as a dev dependency.
6. **Add linting and formatting** - Set up ESLint and Prettier with a shared config.
7. **Set up CI** - Add a GitHub Actions workflow for lint + test on PRs.
8. **Enable tool functionality** - Wire up the tool enable/disable flow so tool-calling mode actually works.
9. **Consider TypeScript** - Would catch the data isolation bug and many others at compile time.
10. **Add structured logging** - Replace the 38 `console.log` statements with a proper logger (e.g., pino) that supports log levels.

---

## Summary

Bookly CLI demonstrates a solid architectural vision and a polished user-facing terminal experience. The separation of concerns across config, service, and UI layers is well done for a project at this stage. However, the complete absence of tests, documentation, persistence, and CI/CD means it is firmly in prototype territory. The data isolation bug and unused dependencies suggest the project was built quickly without review. Addressing the test coverage and persistence gaps would be the highest-impact next steps to move this toward a usable product.
