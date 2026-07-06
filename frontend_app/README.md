# ZhytoMate — Frontend App

React SPA for Zhytomyr residents — an AI assistant for civic questions, photo-based appeals,
polls, city news, and a profile. Talks **only** to `../backend_app`; never calls `ml-service`
directly (it doesn't hold the internal token that would let it).

## Pages

| Route | Purpose |
|---|---|
| `/assistant` | Home screen — AI chat, a live weather widget, quick-suggestion chips |
| `/chat-history`, `/chat-history/:id` | Browse and continue past conversations |
| `/services` | Menu/hub grid linking to Appeals, Polls, Transport, Contacts, … |
| `/appeals` | Photo-based civic reports (pothole, garbage, lighting, …) with AI-suggested category/description |
| `/polls`, `/polls/:id` | Vote in city surveys, see live tallies |
| `/news`, `/news/:id` | City news feed |
| `/transport`, `/contacts` | Static city service info |
| `/profile` | Name/phone/address/avatar editing, password change, language toggle |
| `/notifications` | Push-style notification feed |
| `/login`, `/register` | Auth |

## Stack

React 19, Vite 7, Tailwind CSS, TanStack Query (all server state), React Router 7,
react-i18next (uk/en). No Redux/Zustand — TanStack Query's cache is the only client-side data
store; component state is local `useState` for everything else.

## Project structure

```
src/
  pages/<Name>/index.jsx    One folder per route. Route-level data fetching + composition.
  components/
    layout/                 Shell, AppHeader (the shared avatar+title header used by 2 pages)
    navigation/              Bottom nav (mobile), side nav (desktop)
    ui/                      Generic building blocks — Icon, Modal, Toast, SearchInput
    widgets/                 Third-party embeds (currently just the sinoptik.ua weather widget)
    routing/                 RequireAuth route guard
  hooks/                     One file per TanStack Query hook — useCurrentUser, useAssistantChat,
                              useConversations, useAppeals, useSurveys, useProfile, …
  lib/
    apiClient.js             fetch wrapper: token storage, refresh-on-401-retry-once, apiUpload()
    formatDate.js
  consts/                    Static copy/fixture data that isn't worth a backend round trip yet
                              (contacts, transport info) — NOT a substitute for real data where
                              real data exists (see Gotchas below)
  i18n/                      uk/en locale JSON + react-i18next setup
```

## Setup & running

No `.env` needed — API calls go through Vite's dev proxy.

```bash
npm install
npm run dev       # :5173, proxies /api/* to http://localhost:3000 (backend_app)
npm run build     # dist/ — served by backend_app in production, not by this dev server
npm run preview   # serve the production build locally for a quick sanity check
```

`backend_app` must be running at `http://localhost:3000` (the proxy target in `vite.config.js`)
for anything past the login screen to work.

## Gotchas

- **The Vite dev proxy target is hardcoded** to `http://localhost:3000` in `vite.config.js`. If
  `backend_app` runs on a different port on your machine, update the proxy target there (or see
  the root `CLAUDE.md` for a documented local port-collision workaround).
- **Third-party widget scripts + React StrictMode:** if you add another embed like the weather
  widget, don't give its DOM-injecting `useEffect` only a cleanup function and assume that's
  StrictMode-safe — see the "Third-party widget script duplicated every value" entry in the root
  `CLAUDE.md`'s Known Issues for why that's not sufficient, and the pattern that is.
- A few pages' "quick suggestion" chips and generic reference info (transport routes, contact
  numbers) are still static fixtures in `consts/` — check the root `CLAUDE.md`'s Active Context
  before assuming any given page is fully wired to real data.
