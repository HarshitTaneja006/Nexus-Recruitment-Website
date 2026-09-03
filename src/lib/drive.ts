/**
 * Recruitment drive-level constants.
 * The drive closes at this instant (IST). After that the form locks.
 */
export const DRIVE = {
  id: "recruitments-2026",
  label: "RECRUITMENTS '26",
  cycle: "A.Y. 2026–27",
  // 24 Sep 2026, 23:59 IST
  deadlineISO: "2026-09-24T23:59:59+05:30",
  node: "VIT-CHENNAI",
  coordinates: "12.9066° N, 80.0406° E",
} as const;

export const DRIVE_DEADLINE = new Date(DRIVE.deadlineISO);

export function isDriveOpen(now = new Date()): boolean {
  return now < DRIVE_DEADLINE;
}

export function daysUntilDeadline(now = new Date()): number {
  return Math.max(
    0,
    Math.ceil((DRIVE_DEADLINE.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  );
}
