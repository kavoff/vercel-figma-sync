// Generate unique key from text value
export function makeKey(value: string): string {
  const base = value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_а-яё]/gi, "") // Support Cyrillic
    .slice(0, 40)

  const hash = Math.abs(hashCode(value)).toString(36).slice(0, 4)
  return `${base || "text"}_${hash}`
}

function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return hash
}
