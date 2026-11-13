import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import KeystaticApp from '../keystatic'

export default function CmsPage() {
  // Local storage requires a writable checkout. Never expose its API on Vercel.
  if (process.env.NODE_ENV === 'production') notFound()
  return <Suspense fallback={<p>Loading editor…</p>}><KeystaticApp /></Suspense>
}
