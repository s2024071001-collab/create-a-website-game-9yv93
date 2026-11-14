## Platform sign-in

Published apps use make.omg.dev sign-in. Use `useAuth().signIn()` from
`@omg-dev/sdk`, or `<VibesLogin>` with `<VibesAuthProvider>`. Read the app user
with `useUser()`. The platform signs the person into each app separately.
Never build an email-code, magic-link, password, passkey, or OAuth sign-in
form. Never call auth bridge sign-in routes or create a session store.
Preview uses the verified creator identity. Test visitor sign-in on a published
app that you own. Keep app hosts outside the platform trusted-origin list.

# Design system — non-negotiable

This app ships a locked design system (shadcn/ui, Tailwind v4, and the theme in `src/theme.css`).
Follow these rules on every UI change.

## Colors: semantic tokens only

Tailwind's default palette is **removed** (see the lock block in
`src/index.css`). `bg-indigo-600`, `text-zinc-400`, `border-slate-700`, etc.
compile to **nothing** — if a color class has no visible effect, this is why.

- Use: `bg-background`, `bg-card`, `bg-primary`, `bg-secondary`, `bg-muted`,
  `bg-accent`, `bg-destructive`, `text-foreground`, `text-muted-foreground`,
  `border-border`, `ring-ring` (+ their `-foreground` pairs, opacity works:
  `bg-primary/15`).
- Colors, fonts and corners live in `src/theme.css`. Change them only with
  the `set_theme` tool (a style, a color, and optionally a font, corners and
  mode: Light, Dark, or Auto to follow the device).
  The person can change them too, with the Design panel next to the preview.
  Never hand-edit `src/theme.css` or add token values to `src/index.css`.
- Don't force the `.dark` class or invent a dark theme unless the user asks;
  the theme already handles light/dark. For a dark app, use mode Dark or the
  Night style.

## Components: use `src/components/ui/` before writing anything

The full inventory is pre-installed — **never hand-roll one of these with
divs** (no div-built tab bars, toggles, sliders, dropdowns, modals):

`tabs` `dialog` `sheet` `popover` `tooltip` `dropdown-menu` `select` `input`
`textarea` `label` `checkbox` `radio-group` `switch` `slider` `toggle-group`
`badge` `separator` `skeleton` `progress` `avatar` `scroll-area` `accordion`
— plus the vendored delight primitives: `button`, `card`, `bottom-nav`,
`otp-input`, `animated-number`, `animated-text`, `scroll-affordance`,
`transitions` (`.vui-t-*` motion), `sound`.

- Import via the alias: `import { Tabs, TabsList } from "@/components/ui/tabs"`.
- Missing a component? `yes n | bunx --bun shadcn@latest add <name>`
  (answer No to overwrite prompts — the vendored primitives must survive).
- Never hand-edit files in `src/components/ui/`.
- Motion: use `transitions.tsx` / `.vui-*` classes and the `animated-*`
  primitives; don't write bespoke keyframe animations for patterns they cover.

## Routing: files in `src/routes/`

This app uses TanStack Router with file-based routing. A second screen means a
second file — **not** a `useState` view-switcher inside `App.tsx`.

```tsx
// src/routes/pricing.tsx  →  /pricing
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/pricing")({ component: Pricing })

function Pricing() { return <main>...</main> }
```

- `src/App.tsx` is the `/` route's component — keep the home view there.
- Params: `posts.$postId.tsx` → `/posts/$postId`, read via `Route.useParams()`.
- Navigate with `<Link to="/pricing">` from `@tanstack/react-router`. A raw
  `<a href>` full-reloads the page and drops app state.
- `src/routeTree.gen.ts` is generated from `src/routes/` — never edit it.
- Static routes are prerendered to static HTML at build time, so real URLs are
  cheap SEO. Param routes fall back to the SPA shell.

## The first version comes first

- A new user is watching and waiting. Show a first working screen within about
  3 minutes, then keep improving it.
- As soon as the dev server answers, call `omg_expose_port` for port 5173 so
  the user gets a preview card. Do not wait until the app is finished.
- The component list above is the summary. Do not read the files in
  `src/components/ui/` one by one; open one only for a prop you cannot guess.
- Do not investigate lint or type errors that were already in the scaffold.
  Fix only the errors your change causes.
- For a mobile app that should open on a phone, call `omg_create_project` with
  `template: "expo"` and build there instead of in this web project.

## Test value and verification scope

- Add a test only for a concrete user outcome or executable contract. State
  the failure it must catch before writing it.
- Protect saved work, authentication, permissions, billing, and usable releases.
- Never add or recreate tests that freeze ordinary button labels, headings,
  marketing copy, CSS classes, component names, or JSX snippets.
- Test behavior. Do not grep source text to assert implementation details.
- Verify billing amounts, required disclosures, and accessible operation
  through their contracts. Do not pin incidental wording or markup.
- Do not add tests for trivial presentation edits, duplicate contract tests,
  tests that mirror implementation, or tests that always pass.
- Remove obsolete assertions when a feature is retired. Keep useful behavior
  coverage when removing presentation assertions.
- Run checks for changed source and affected consumers. Include shared
  dependencies and build inputs. Selecting only changed test files is
  insufficient. Keep the ordinary release path small.

## Environment

- Project dir `/home/user/project`, package manager **bun**.
- Dev server is already running on 5173 with HMR — never start another.
- Read `.agents/skills/vibes-create-app` at the start of a new build and the
  `shadcn` skill before composing components.
