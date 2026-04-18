# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Includes a terminal-style chat app with Firebase backend.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: Firebase Firestore (messages)
- **Auth**: Firebase Google Auth
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite (terminal-chat artifact)

## Artifacts

### terminal-chat (React + Vite)
- **Path**: `artifacts/terminal-chat/`
- **Preview**: `/` (root)
- **Design**: Terminal/CMD aesthetic — black background, green monospace text
- **Auth**: Firebase Google Sign-In
- **Database**: Firebase Firestore (messages collection)
- **Language**: Arabic / English / French via `LanguageContext` (localStorage persisted, RTL support for Arabic)

### api-server (Express)
- **Path**: `artifacts/api-server/`
- **Preview**: `/api`
- **Purpose**: Web Push notifications (VAPID), link preview (future)

## Firestore Data Model

### rooms/{roomId}
- `name`, `type` (group/dm), `members[]`, `createdBy`, `createdAt`, `lastMessage`, `lastMessageAt`
- `description?` — channel description
- `pinnedMessageId?` — pinned message reference
- `archived?` — boolean, archived channels hidden from main list

### rooms/{roomId}/messages/{msgId}
- `text`, `imageUrl?`, `uid`, `displayName`, `photoURL`, `createdAt`, `type`
- `readBy[]` — array of UIDs who have read the message
- `reactions?` — map of emoji → uid[]
- `replyTo?` — `{ id, text, displayName, imageUrl? }`
- `edited?` — boolean, marked true after editing
- `deletedAt?` — timestamp, set on soft delete

### users/{uid}
- `displayName`, `photoURL`, `email`, `bio`, `statusText`
- `status` (online/offline), `lastSeen`, `joinedAt`
- `bookmarks?` — map of msgId → { roomId, msgId, text, ts }

## Features Implemented

### Messaging
- Send text and images (via ImgBB)
- Reply to messages (swipe gesture on mobile, reply button)
- Edit own messages (inline edit with pencil UI)
- Delete own messages (soft delete with "message deleted" placeholder)
- Emoji reactions via long-press action sheet (6 quick emojis)
- @mention detection and highlighting (own mentions highlighted)
- Link preview in messages (microlink.io API)
- Message bookmarks (saved to Firestore user doc)

### Channels / Rooms
- Group channels and Direct Messages
- Pin a message per channel (banner shown at top)
- Archive channels (hidden in collapsible section, can unarchive)
- Delete channel (group creator only)
- Members list modal with admin actions
- Channel admin can: kick members, add members, edit channel name/description
- Per-room message search with highlight
- Global search across all rooms (by name, description, last message)

### Users
- Custom status text per user (shown in sidebar and chat header)
- Online/offline status with live indicator
- Profile modal with bio, photo upload
- Push notifications (web-push with VAPID)
- Typing indicators

### UX
- 3 languages: Arabic (RTL), English, French
- Sound effects (message received / sent)
- Swipe-to-reply on mobile
- Read receipts (✓ sent, ✓✓ read) for DMs
- Long-press action sheet: react + reply + edit + pin + bookmark + delete

## Hooks

- `useMessages(roomId)` — subscribe to messages, send/edit/delete/react/markRead
- `useRooms()` — subscribe to rooms, create/delete/archive/pin/kick/updateRoom
- `useUsers()` — subscribe to all users with computed online status + statusText
- `useTyping(roomId)` — typing indicator management
- `useUnread()` — unread room tracking

## Key Components

- `ChatArea.tsx` — main chat interface with all message features
- `ConversationList.tsx` — sidebar with channels/DMs/users tabs, global search, archived section
- `MembersModal.tsx` — channel members list with admin kick/edit actions
- `GlobalSearch.tsx` — cross-room search modal
- `LinkPreview.tsx` — URL preview card (microlink.io)
- `SettingsModal.tsx` — profile edit, custom status, language, sounds
