const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
const arabicDigits = "٠١٢٣٤٥٦٧٨٩";

function normalizeDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (digit) => {
    const persianIndex = persianDigits.indexOf(digit);
    if (persianIndex >= 0) return String(persianIndex);
    return String(arabicDigits.indexOf(digit));
  });
}

export function normalizeIranianMobile(value: string): string | null {
  const input = normalizeDigits(value).trim().replace(/[\s().-]/g, "");
  let nationalNumber: string;
  if (input.startsWith("+98")) nationalNumber = input.slice(3);
  else if (input.startsWith("0098")) nationalNumber = input.slice(4);
  else if (input.startsWith("98")) nationalNumber = input.slice(2);
  else if (input.startsWith("0")) nationalNumber = input.slice(1);
  else nationalNumber = input;
  if (!/^9[0-9]{9}$/.test(nationalNumber)) return null;
  return "+98" + nationalNumber;
}

export function isIranianE164(value: string): boolean {
  return /^\+989[0-9]{9}$/.test(value);
}

export function toParsGreenMobile(value: string): string {
  if (!isIranianE164(value)) throw new Error("Unsupported operational mobile number");
  return "0" + value.slice(3);
}
