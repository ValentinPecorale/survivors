import { SectionFooter } from "./section-footer"
import { HighlightFrame } from "./highlight-gradient"
import { SkullFrame } from "./skull-frame"
import { AboutWho } from "./about-who"
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
  // A section is one tall card: frames stack vertically and the card scrolls through them (see navbar.tsx cardCanScroll).
  return <>
    {!("whatText" in entry) && <section className={`section-intro section-intro--${id}`} aria-label={`${id} introduction`}>
      <h1>{entry.heading}</h1>
      <div className="section-intro-text"><p>{entry.text}</p>{/* 2-column grid: text lives in column 1, column 2 stays empty (Figma 15:146) */}</div>
    </section>}
    {"words" in entry && entry.words.length > 0 && <HighlightFrame id={id} words={entry.words} label={"whatLabel" in entry ? entry.whatLabel : undefined} text={"whatText" in entry ? entry.whatText : undefined} heading={"whatText" in entry ? entry.heading : undefined} intro={"whatText" in entry ? entry.text : undefined} />}
    {"whoText" in entry && <AboutWho label={entry.whoLabel} text={entry.whoText} tag={entry.whoTag} />}
    {"clients" in entry && entry.clients.length > 0 && <SkullFrame id={id} clients={entry.clients} />}
    {id !== "about" && ["Space for ideas", "A closer look", "More to come"].map((heading, index) => (
      <section className="scroll-placeholder" key={heading} aria-label={`${id} placeholder ${index + 1}`}>
        <div className="scroll-placeholder-meta"><span>{id}</span><span>Placeholder · 0{index + 1} / 03</span></div>
        <h2>{heading}.</h2>
        <div className="scroll-placeholder-footer">
          <p>Room for the next part of our story.</p>
          <span>{index < 2 ? "Keep scrolling ↓" : "End of this page"}</span>
        </div>
      </section>
    ))}
    <SectionFooter />
  </>
}
