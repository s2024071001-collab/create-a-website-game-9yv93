import { Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { setSetting, useSettings, type Settings } from "@/lib/store"

// Learning-support options. Each one is a plain on/off choice, saved on this
// device, and applied across the whole site.
const options: { key: keyof Settings; title: string; help: string }[] = [
  {
    key: "dyslexiaFont",
    title: "Dyslexia-friendly font",
    help: "Lexend type with wider spacing, easier to track across a line.",
  },
  {
    key: "largeText",
    title: "Larger text",
    help: "Bigger letters everywhere on the site.",
  },
  {
    key: "readAloud",
    title: "Read questions aloud",
    help: "Questions are spoken as they appear. You can always tap Read aloud.",
  },
  {
    key: "calmMode",
    title: "Calm mode",
    help: "Slower camera and no floating motion on the island.",
  },
]

export function SettingsSheet() {
  const settings = useSettings()
  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button variant="outline" size="sm" aria-label="Learning settings">
            <Settings2 className="size-4" />
            Settings
          </Button>
        }
      />
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Learning settings</SheetTitle>
          <SheetDescription>Change how the site looks and feels. Saved on this device.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-5 px-4 pb-6">
          {options.map(({ key, title, help }) => {
            const id = `setting-${key}`
            return (
              <div key={key} className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <Label htmlFor={id} className="text-sm font-medium">
                    {title}
                  </Label>
                  <p className="text-xs text-muted-foreground leading-relaxed">{help}</p>
                </div>
                <Switch
                  id={id}
                  checked={settings[key]}
                  onCheckedChange={(v) => setSetting(key, v)}
                />
              </div>
            )
          })}
        </div>
      </SheetContent>
    </Sheet>
  )
}
