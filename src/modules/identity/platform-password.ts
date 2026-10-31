import { z } from "zod";

const platformPasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(14).max(128),
  confirmation: z.string().min(1).max(128),
}).refine((value) => value.newPassword === value.confirmation, { path: ["confirmation"] })
  .refine((value) => value.currentPassword !== value.newPassword, { path: ["newPassword"] });

export function parsePlatformPasswordInput(input: {
  currentPassword: unknown;
  newPassword: unknown;
  confirmation: unknown;
}) {
  return platformPasswordSchema.safeParse(input);
}
