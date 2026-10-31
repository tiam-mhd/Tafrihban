import { z } from "zod";

export const inspectionEventSchema = z.object({
  clientEventId: z.string().uuid(),
  schemaVersion: z.literal(1),
  organizationId: z.string().uuid(),
  branchId: z.string().uuid(),
  equipmentId: z.string().uuid(),
  scheduleId: z.string().uuid().nullable().optional(),
  checklistVersionId: z.string().uuid(),
  localEventTime: z.string().datetime({ offset: true }),
  notes: z.string().max(4000).optional().default(""),
  answers: z.array(z.object({
    questionId: z.string().uuid(),
    answer: z.enum(["pass", "fail", "na"]),
    notes: z.string().max(2000).optional().default(""),
  })).min(1).max(100),
});

export type InspectionEvent = z.infer<typeof inspectionEventSchema>;
