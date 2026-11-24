import { HighlightFrame } from "./highlight-gradient"
import { AboutWho } from "./about-who"
import { LogoMarquee } from "./logo-marquee"
import { FeaturedProjects } from "./featured-projects"
import { SiteFooter } from "./site-footer"
import { SHORTCUT_KEYS } from "./shortcuts"
import about from "@/content/sections/about.json"

/**
 * The cards the engine stacks, in scroll order. There is one: Services, About and Work are places inside the About card, and the footer is its end,
 * so scrolling stops there. Learnings is parked: to bring it back, add { id: "learnings", title: "Learnings" } here, render <LearningsPage {...learnings} />
 * for it in SectionContent, restore the route file src/app/(site)/learnings/page.tsx and its footer link.
 */
export const sections = [
  { id: "about", title: "The studio" },
] as const

export type SectionId = (typeof sections)[number]["id"]
export const sectionFromPath = (path: string) => sections.find(s => `/${s.id}` === path)?.id

/** Navbar buttons. `anchor` is a `data-anchor` inside the card: the button opens the card (if needed) and scrolls there, all on one page. */
export const navItems = [
  { id: "about", label: "About", key: SHORTCUT_KEYS[1], card: "about", anchor: "about" },
  { id: "services", label: "Services", key: SHORTCUT_KEYS[2], card: "about", anchor: "services" },
  { id: "work", label: "Work", key: SHORTCUT_KEYS[3], card: "about", anchor: "work" },
] as const satisfies readonly { id: string; label: string; key: string; card: SectionId; anchor?: string }[]

/** A zero-height marker: the navbar scrolls the card so the marker sits at its top edge. */
const Anchor = ({ name }: { name: string }) => <div data-anchor={name} aria-hidden="true" style={{ height: 0 }} />

/** Shared by the route pages and the cards retained during an outgoing slide. */
export function SectionContent({ id }: { id: SectionId }) {
  // One tall card: frames stack vertically and the card scrolls through them (see navbar.tsx).
  return <>
    <Anchor name="services" />
    {about.words.length > 0 && <HighlightFrame id={id} words={about.words} label={about.whatLabel} text={about.whatText} heading={about.heading} intro={about.text} />}
    {<LogoMarquee logos={about.logos} label={about.logosLabel} />}
    <Anchor name="about" />
    <AboutWho label={about.whoLabel} text={about.whoText} tag={about.whoTag} />
    <Anchor name="work" />
    <FeaturedProjects projects={about.projects} title={about.projectsTitle} intro={about.projectsText} />
    {/* Hidden for now: the skull "clients" frame (<SkullFrame id={id} clients={about.clients} />) and the footer (<SectionFooter />). Components and content are untouched. */}
    <SiteFooter />
  </>
}
