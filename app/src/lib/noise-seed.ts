/** Convert birthdate + region into a stable integer seed for p5's noiseSeed(). */
export function seedFromDOB(birthdate: string, regionId: string): number {
  const [y, m, d] = birthdate.split("-").map(Number);
  const datePart = y * 10000 + m * 100 + d;
  const regionOffset =
    regionId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) * 7919;
  return datePart + regionOffset;
}
