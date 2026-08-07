# @lorem-gibson/mcp-server

A local MCP server exposing Lorem Gibson text generation and the
Playwright sanitizer as tools, registered machine-wide (user scope) so
any project's Claude Code session can reach them — no per-project
install needed. Separate from Microsoft's official `@playwright/mcp`
server (also registered on this machine): this one manages its own
headless Chromium instance rather than extending that one, since
`@playwright/mcp` is a third-party package we don't control the source
of.

## Registration

Already registered on this machine:

```sh
claude mcp add lorem-gibson -s user -- node "C:\dev\lorem-gibson-generator\packages\mcp-server\bin\server.js"
```

`claude mcp get lorem-gibson` to check status; `claude mcp remove
lorem-gibson -s user` to remove. Only takes effect in *new* Claude Code
sessions — the tool list is fixed at session start.

## Tools

- **`generate_text`** — `{ kind: word|sentence|paragraph|title|slug, count?, seed? }`. Same output as the `lorem-gibson` CLI.
- **`screenshot_sanitized`** — `{ url, fullPage?, waitFor?, seed?, includeProperNouns?, exclude?, include?, images? }`. Navigates, sanitizes the page (text always; images when `images: true`), returns the screenshot as image content plus a caption.
- **`sanitize_html`** — `{ html, seed?, includeProperNouns?, exclude?, include?, images? }`. Loads raw HTML into a headless page, sanitizes it, returns the resulting HTML — no URL or screenshot needed, useful for sanitizing a fragment you already have in hand.

All three options shapes mirror `@lorem-gibson/playwright-sanitizer`'s
`sanitizePage` options — see that package's README for what each one
does.

The server launches one headless Chromium instance lazily on first use
and keeps it alive across calls in the same session for speed; it closes
on `SIGINT`/`SIGTERM`.
