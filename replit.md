# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Includes a terminal-style chat app with Firebase backend.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM (for future use), Firebase Firestore (messages)
- **Auth**: Firebase Google Auth
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite (terminal-chat artifact)

## Artifacts

### terminal-chat (React + Vite)
- **Path**: `artifacts/terminal-chat/`
- **Preview**: `/` (root)
- **Design**: Terminal/CMD aesthetic — black background, green monospace text
- **Auth**: Firebase Google Sign-In
- **Database**: Firebase Firestore (messages collection)
- **Deploy**: Vercel-ready with `vercel.json` (functions + rewrites config)
- **Language**: Arabic/English via `LanguageContext` (localStorage persisted, RTL support)
- **Settings**: SettingsModal with account editing (name, photo, bio) and preferences (language, sound toggle)
- **Swipe to reply**: Touch swipe left/right on messages to trigger reply (like Instagram)
- **No native context menu**: `onContextMenu` prevented on messages, only in-app reaction picker shows

### Firebase Config
- **Project**: `chat-6d518`
- **Config**: embedded in `artifacts/terminal-chat/src/lib/firebase.ts`
- **Collections**: `messages` (text, uid, displayName, photoURL, createdAt)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/terminal-chat run dev` — run frontend locally

## Vercel Deployment

To deploy `terminal-chat` to Vercel:
1. Root directory: `artifacts/terminal-chat`
2. Build command: `pnpm run build`
3. Output directory: `dist/public`

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
