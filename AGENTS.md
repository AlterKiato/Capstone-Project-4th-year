<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->


# ThesiSHS AI Development Rules

## Project

ThesiSHS AI is an AI-powered multi-platform
research management and evaluation system
for Senior High School.

## Architecture

Use:

UI
↓
Server Actions
↓
Zod Validation
↓
Services
↓
Repositories
↓
Drizzle ORM
↓
PostgreSQL

## Roles

ADMIN
ADVISER
STUDENT
PANEL

## Important ownership rules

- Advisers create and manage research groups.
- Students belong to adviser-managed research groups.
- Students create their own research projects.
- Students submit research.
- Advisers review submissions and provide feedback.
- Admin provides system-wide oversight.

## Panel

Panel Evaluation is currently excluded from
active development.

Do not implement the Panel Evaluation module
unless explicitly instructed.

## AI

The system's primary AI features are:

1. AI Chatbot Guide
2. AI Summarization

AI is assistive and must not replace teacher/adviser
evaluation.

## Development rules

- Inspect existing code before modifying it.
- Follow existing architecture and naming conventions.
- Do not introduce a new library without asking.
- Do not redesign the database unnecessarily.
- Do not modify unrelated files.
- Run npm run build after significant changes.
- Explain errors before making large architectural changes.
- Prefer small, incremental changes.