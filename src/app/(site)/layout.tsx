import { Navbar } from "@/components/navbar"
import { Hero } from "@/components/hero/hero"

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <>
    <main><Hero /></main>
    <Navbar>{children}</Navbar>
  </>
}
