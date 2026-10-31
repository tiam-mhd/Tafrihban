export function localDateTimeToUtc(value: string, timeZone: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("زمان واردشده معتبر نیست.");
  const [, year, month, day, hour, minute] = match;
  const desired = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  let instant = desired;
  const formatter = new Intl.DateTimeFormat("en-US-u-ca-gregory-nu-latn", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map((part) => [part.type, part.value]));
    const represented = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second),
    );
    const correction = desired - represented;
    instant += correction;
    if (correction === 0) break;
  }

  const resolved = new Date(instant);
  const check = Object.fromEntries(formatter.formatToParts(resolved).map((part) => [part.type, part.value]));
  if (
    Number(check.year) !== Number(year) || Number(check.month) !== Number(month) ||
    Number(check.day) !== Number(day) || Number(check.hour) !== Number(hour) ||
    Number(check.minute) !== Number(minute)
  ) throw new Error("این زمان در منطقهٔ زمانی شعبه وجود ندارد.");
  return resolved;
}

export function formatBranchTime(value: Date | string, timeZone: string): string {
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}
