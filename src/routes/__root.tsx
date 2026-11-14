import { createRootRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router"
import { BookOpen, Map as MapIcon, Timer } from "lucide-react"
import { BottomNav } from "@/components/ui/bottom-nav"
import { SettingsSheet } from "@/components/SettingsSheet"
import { useSettings } from "@/lib/store"

// The shell every page renders inside: a top bar, the page, and the bottom
// tabs. Learning settings (font, text size) are applied here so every page
// follows them.

const tabs = [
  { id: "/", label: "Island", Icon: MapIcon },
  { id: "/lessons", label: "Lessons", Icon: BookOpen },
  { id: "/focus", label: "Focus", Icon: Timer },
] as const

function RootLayout() {
  const settings = useSettings()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const active = tabs.find((t) => t.id === pathname)?.id ?? "/"

  return (
    <div
      className="flex min-h-svh flex-col bg-background text-foreground"
      style={{
        fontFamily: settings.dyslexiaFont ? "'Lexend', system-ui, sans-serif" : undefined,
        fontSize: settings.largeText ? "19px" : undefined,
        letterSpacing: settings.dyslexiaFont ? "0.03em" : undefined,
        lineHeight: settings.dyslexiaFont ? 1.7 : undefined,
      }}
    >
      <header className="flex items-center justify-between gap-3 border-b-2 border-border bg-background px-4 py-3">
        <h1
          className="text-[11px] leading-tight text-primary sm:text-xs"
          style={{ fontFamily: "'Press Start 2P', monospace" }}
        >
          Study Island
        </h1>
        <SettingsSheet />
      </header>

      <div className="flex flex-1 flex-col">
        <Outlet />
      </div>

      <BottomNav
        tabs={tabs}
        active={active}
        onSelect={(to) => navigate({ to })}
      />
    </div>
  )
}

export const Route = createRootRoute({
  component: RootLayout,
})
