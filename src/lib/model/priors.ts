// Hardcoded demand priors for a Greenwich Ave shopping district.
// Indexed [dayOfWeek 0=Sun..6=Sat][hour 0..23]. Filled in Step 3.
export const HOUR_DOW_PRIORS: number[][] = Array.from({ length: 7 }, () =>
  Array(24).fill(0),
);
