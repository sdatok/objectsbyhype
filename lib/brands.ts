/** Canonical brand list: used in BrandShowcase and admin ProductForm */
export const KNOWN_BRANDS = [
  "Audo Copenhagen",
  "BDDW",
  "Boca do Lobo",
  "Boffi",
  "Cassina",
  "Eichholtz",
  "Fendi Casa",
  "Flos",
  "Fritz Hansen",
  "Herman Miller",
  "Knoll",
  "Ligne Roset",
  "Minotti",
  "Poliform",
  "Roche Bobois",
  "Tom Dixon",
  "USM",
  "Vitra",
  "Zanotta",
].sort((a, b) => a.localeCompare(b));

/** Brands shown in Shop by Brand: curated list plus any active inventory brands. */
export function brandsForShowcase(fromInventory: string[]): string[] {
  const set = new Set<string>([...KNOWN_BRANDS, ...fromInventory]);
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
