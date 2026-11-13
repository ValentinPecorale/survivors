import { SHORTCUT_KEYS } from "./shortcuts"
import about from "@/content/sections/about.json"
import services from "@/content/sections/services.json"
import work from "@/content/sections/work.json"

const content = { about, services, work }

export const sections = [
  { id: "about", label: "About", key: SHORTCUT_KEYS[1], title: "The studio" },
  { id: "services", label: "Services", key: SHORTCUT_KEYS[2], title: "Our services" },
  { id: "work", label: "Work", key: SHORTCUT_KEYS[3], title: "Selected work" },
] as const

export type SectionId = (typeof sections)[number]["id"]
export const sectionFromPath = (path: string) => sections.find(s => `/${s.id}` === path)?.id

/** Shared by the route pages and the cards retained during an outgoing slide. */
export function SectionContent({ id }: { id: SectionId }) {
  const entry = content[id]
  return <section className="section-intro" aria-label={`${id} introduction`}>
    <h1>{entry.heading}</h1>
    <div className="section-intro-text">{entry.text}</div>
  </section>
}
