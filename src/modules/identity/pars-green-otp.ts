import { z } from "zod";
import { toParsGreenMobile } from "./iranian-phone";

export const PARSGREEN_OTP_ENDPOINT = "https://sms.parsgreen.ir/Apiv2/Message/SendOtp";

const responseSchema = z.object({
  R_Success: z.boolean(),
});

export class ParsGreenOtpError extends Error {
  constructor() {
    super("ParsGreen OTP delivery failed");
    this.name = "ParsGreenOtpError";
  }
}

export async function sendParsGreenOtp(
  phoneNumber: string,
  code: string,
  apiToken = process.env.PARSGREEN_API_TOKEN,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const token = apiToken?.trim();
  if (!token) throw new Error("PARSGREEN_API_TOKEN is not configured");
  if (!/^[0-9]{6}$/.test(code)) throw new Error("Invalid operational OTP code");

  let response: Response;
  try {
    response = await fetcher(PARSGREEN_OTP_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: "basic apikey:" + token,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        Mobile: toParsGreenMobile(phoneNumber),
        SmsCode: code,
        TemplateId: 0,
        AddName: true,
      }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
  } catch {
    throw new ParsGreenOtpError();
  }

  if (!response.ok) throw new ParsGreenOtpError();

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ParsGreenOtpError();
  }
  const parsed = responseSchema.safeParse(payload);
  if (!parsed.success || !parsed.data.R_Success) throw new ParsGreenOtpError();
}
