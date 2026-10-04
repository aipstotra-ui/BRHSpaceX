export interface DonkiCme {
  speed?: number;
  time21_5?: string;
}

/** DONKI CME analysis does not supply Bz or density. The user still enters those. */
export function importDonki(cme: DonkiCme): { cmeSpeedKmS?: number; arrivalTime?: string } {
  return {
    cmeSpeedKmS: cme.speed,
    arrivalTime: cme.time21_5,
  };
}
