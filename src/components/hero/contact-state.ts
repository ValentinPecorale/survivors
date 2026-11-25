import { useSyncExternalStore } from "react"

let visible = false
const listeners = new Set<() => void>()
export function setContactFormVisible(value: boolean) {
  if (visible === value) return
  visible = value
  listeners.forEach(listener => listener())
}
export function useContactFormVisible() {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener) } }, () => visible, () => false)
}
