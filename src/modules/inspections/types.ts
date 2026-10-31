export type InspectionAnswerInput = {
  questionId: string;
  answer: "pass" | "fail" | "na";
  notes: string;
};

export type InspectionEventInput = {
  clientEventId: string;
  schemaVersion: 1;
  organizationId: string;
  branchId: string;
  equipmentId: string;
  scheduleId?: string | null;
  checklistVersionId: string;
  localEventTime: string;
  notes: string;
  answers: InspectionAnswerInput[];
};
