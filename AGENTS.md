# Guidance for agents working in this repository

## Audience and communication

The people interacting with BMad in this project are primarily product owners,
product managers, and UX/UI designers. Assume product and design expertise, but
do not assume software development or command-line experience.

- Use clear, everyday language in messages, questions, progress updates, and
  handoffs. Simplify technical phrases and details to fit this audience. When a
  technical term is necessary, explain it briefly when first used.
- Explain technical decisions through their effect on the product, user
  experience, time, cost, and practical trade-offs. Recommend a sensible option
  and explain why; provide enough context for any decision the user must make.
- Keep implementation details in technical artifacts where needed for accuracy.
  In user-facing messages, focus on what changed, what it means, and what the
  person should do next. Provide deeper technical detail when requested.

## Helping people run and preview the project

Do not assume users know how to install dependencies, start a development
environment, or use a terminal.

- When a local preview is needed and tools and permissions allow it, perform
  the setup and start the development environment for the user. Check the
  project's own instructions and reuse an existing running environment when
  appropriate.
- Verify that the preview is reachable before saying it is ready. Share the
  exact clickable local URL and briefly explain what the user can try there.
  Mention any relevant limitation, such as the preview only remaining available
  while the local process is running.
- If you cannot complete setup or start the environment, explain the specific
  obstacle in plain language. Give understandable, numbered steps for only the
  actions the user needs to perform: where to click or open an application,
  what to paste or enter, and what success should look like. Explain where to
  enter commands and provide them ready to copy when commands are necessary.
- Avoid vague handoffs such as "run the dev server" or "configure your env."
  Help resolve errors and continue the setup when able, rather than leaving the
  user to infer the next steps.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
