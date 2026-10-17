/** A search box value as a case-insensitive "contains" pattern, with regex characters escaped. */
export function containsPattern(query: string): RegExp {
  return new RegExp(query.trim().slice(0, 60).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}
