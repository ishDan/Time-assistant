import type { CommuteMatrix, Location } from '@/types'

export function canonicalKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

/** Directional commute minutes from A → B. Currently symmetric (undirected storage). */
export function getCommuteMinutes(matrix: CommuteMatrix, fromId: string, toId: string): number {
  if (fromId === toId) return 0
  return matrix[canonicalKey(fromId, toId)] ?? 0
}

export function setCommuteMinutes(
  matrix: CommuteMatrix,
  a: string,
  b: string,
  minutes: number
): CommuteMatrix {
  if (a === b) return matrix
  return { ...matrix, [canonicalKey(a, b)]: Math.max(0, minutes) }
}

export function removeLocationFromMatrix(
  matrix: CommuteMatrix,
  locationId: string
): CommuteMatrix {
  const next: CommuteMatrix = {}
  for (const [key, minutes] of Object.entries(matrix)) {
    const [a, b] = key.split('|')
    if (a !== locationId && b !== locationId) next[key] = minutes
  }
  return next
}

export function getLocationName(locations: Location[], id: string): string {
  return locations.find((l) => l.id === id)?.name ?? 'Unknown'
}

export function getLocationIcon(locations: Location[], id: string): string {
  return locations.find((l) => l.id === id)?.icon ?? '📍'
}

/**
 * Return all non-duplicate pairs of location ids (for matrix editors).
 * Pairs are produced in canonical order.
 */
export function allLocationPairs(locations: Location[]): Array<{ a: string; b: string }> {
  const pairs: Array<{ a: string; b: string }> = []
  for (let i = 0; i < locations.length; i++) {
    for (let j = i + 1; j < locations.length; j++) {
      pairs.push({ a: locations[i]!.id, b: locations[j]!.id })
    }
  }
  return pairs
}
