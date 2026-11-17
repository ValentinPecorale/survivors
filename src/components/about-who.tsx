import Image from "next/image"

/** About, third frame (Figma 104:718): three photos across the top, then label · paragraph · closing line on the 6 / 3 / 3 grid. */
export function AboutWho({ label, text, tag }: { label: string; text: string; tag: string }) {
  return (
    <section className="about-who" aria-label="who we are">
      <div className="about-who-photos" aria-hidden="true">
        {[0, 1, 2].map(i => <div key={i} className="about-who-photo"><Image src="/images/about-photo.webp" alt="" fill sizes="(max-width: 700px) 100vw, 33vw" /></div>)}
      </div>
      <div className="about-who-text">
        <h2>{label}</h2>
        <p>{text}</p>
        <p>{tag}</p>
      </div>
    </section>
  )
}
