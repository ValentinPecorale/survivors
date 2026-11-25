"use client"

import { useContactFormVisible } from "./contact-state"

export function ContactForm() {
  const visible = useContactFormVisible()
  return (
    <div className="sky-contact" data-visible={visible} aria-hidden={!visible} inert={!visible}>
      <form className="sky-contact-form" onSubmit={event => {
        event.preventDefault()
        const fields = new FormData(event.currentTarget)
        const name = String(fields.get("name") ?? "").trim()
        const company = String(fields.get("company") ?? "").trim()
        const email = String(fields.get("email") ?? "").trim()
        const service = String(fields.get("service") ?? "website")
        if (!name || !company || !email) return
        const subject = encodeURIComponent(`A signal from ${name} at ${company}`)
        const body = encodeURIComponent(`Hello, it’s ${name} from ${company}.\nOur ${service} is in trouble.\nSend help to ${email}.`)
        window.location.href = `mailto:pecoralev@gmail.com?subject=${subject}&body=${body}`
      }}>
        <p className="sky-contact-label">Call a survivor</p>
        <div className="sky-contact-copy">
          <div className="sky-contact-line"><span>Hello, it’s</span><input aria-label="Your name" name="name" placeholder="your name" autoComplete="name" required /><span>from</span><input aria-label="Company" name="company" placeholder="company" autoComplete="organization" required /><span>.</span></div>
          <div className="sky-contact-line"><span>Our</span><select aria-label="What needs help" name="service" defaultValue="website"><option value="website">website ↓</option><option value="brand">brand</option><option value="interior">interior</option><option value="photo studio">photo studio</option></select><span>is in trouble.</span></div>
          <div className="sky-contact-line"><span>Send help to</span><input className="sky-contact-email" aria-label="Your email" name="email" type="email" placeholder="you@company.com" autoComplete="email" required /></div>
        </div>
        <button className="sky-contact-submit" type="submit">Send a signal</button>
      </form>
    </div>
  )
}
