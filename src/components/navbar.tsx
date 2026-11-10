const links = [
  { href: "#work", label: "Work" },
  { href: "#studio", label: "Studio" },
  { href: "#contact", label: "Contact" },
]

/**
 * Fixed, transparent bar over the hero. Rung 1 (CSS only): no JS, no scroll
 * logic yet. Wordmark left, links right, 56px tall.
 */
export function Navbar() {
  return (
    <header className="site-nav">
      <a href="/" className="site-nav-brand" aria-label="Survivors, home">Survivors</a>
      <nav aria-label="Primary">
        <ul>
          {links.map(link => (
            <li key={link.href}><a href={link.href}>{link.label}</a></li>
          ))}
        </ul>
      </nav>
    </header>
  )
}
