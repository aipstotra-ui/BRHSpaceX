export interface NoaaKpRow {
  time: string;
  kp: number;
}

const SLOTS = ["00-03UT", "03-06UT", "06-09UT", "09-12UT", "12-15UT", "15-18UT", "18-21UT", "21-00UT"];

/** SCENARIO from NOAA SWPC 3-day forecast. The Kp table is used directly. */
export function importNoaaKp(text: string): NoaaKpRow[] {
  const header = text.match(/Oct\s+(\d{2})\s+Oct\s+(\d{2})\s+Oct\s+(\d{2})\s+(\d{4})/);
  const year = header ? Number(header[4]) : 2026;
  const days = header ? [Number(header[1]), Number(header[2]), Number(header[3])] : [3, 4, 5];
  const rows: NoaaKpRow[] = [];
  for (const slot of SLOTS) {
    const line = text.split("\n").find((item) => item.trimStart().startsWith(slot));
    if (!line) {
      continue;
    }
    const numbers = line.match(/\d+\.\d+/g) ?? [];
    numbers.slice(0, 3).forEach((value, index) => {
      const hour = Number(slot.slice(0, 2));
      const day = days[index] ?? days[0];
      rows.push({
        time: new Date(Date.UTC(year, 9, day, hour)).toISOString(),
        kp: Number(value),
      });
    });
  }
  return rows;
}
