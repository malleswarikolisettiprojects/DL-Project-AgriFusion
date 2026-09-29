/**
 * Area unit conversion utilities for Indian Agriculture (Acres <-> Hectares)
 * 1 Hectare = 2.47105 Acres
 * 1 Acre = 0.404686 Hectares
 */

export const ACRE_TO_HA_RATIO = 0.404686;
export const HA_TO_ACRE_RATIO = 2.47105;

export function acresToHa(acres: number): number {
  if (isNaN(acres) || acres <= 0) return 0;
  return Number((acres * ACRE_TO_HA_RATIO).toFixed(3));
}

export function haToAcres(ha: number): number {
  if (isNaN(ha) || ha <= 0) return 0;
  return Number((ha * HA_TO_ACRE_RATIO).toFixed(2));
}

export function formatArea(ha: number): { acres: number; ha: number; display: string } {
  const safeHa = isNaN(ha) || ha <= 0 ? 1 : ha;
  const acres = Number((safeHa * HA_TO_ACRE_RATIO).toFixed(2));
  return {
    acres,
    ha: safeHa,
    display: `${acres} Acres (${safeHa} Ha)`,
  };
}
