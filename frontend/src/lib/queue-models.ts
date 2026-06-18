export type ClinicalUrgencyLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type QueueRiskLevel = "critical" | "moderate" | "stable";
export type QueueCaseStatus = "pending" | "routed" | "reviewed" | "escalated" | "completed";
export type ValidationStatus = "valid" | "invalid";

export interface QueueCasePayload {
  caseId?: string;
  patientCode?: string;
  triageCode?: string;
  age?: number | null;
  gender?: string | null;
  chiefComplaintCode?: string | null;
  chiefComplaintDescription?: string | null;
  painGrade?: number | null;
  bpSystolic?: number | null;
  bpDiastolic?: number | null;
  pulseRate?: number | null;
  respiratoryRate?: number | null;
  spo2?: number | null;
  avpu?: string | null;
  urgencyScore: number;
  confidenceLevel?: number;
  waitingTimeMinutes?: number | null;
  missingFields: string[];
  validationStatus: ValidationStatus;
  forceEscalation?: boolean;
  clinicalUrgency?: ClinicalUrgencyLevel | null;
  targetMinutes?: number;
  recommendedAction?: string;
  modalityLabel?: string;
  summaryText?: string;
  deferReason?: string;
  deferBlockedByCaseId?: string;
  humanDueAt?: string;
}

export interface QueueCaseRecord {
  caseId: string;
  patientCode: string | null;
  status: QueueCaseStatus;
  payload: QueueCasePayload;
  createdAt: string;
  updatedAt: string;
  priorityScore: number | null;
  queuePosition: number | null;
  previousPosition: number | null;
  rankChange: number | null;
  queueVersion: number | null;
  arrivalSeq: number | null;
  enqueueTick: number | null;
  startTick: number | null;
  completionTick: number | null;
  waitingTicks: number | null;
  currentTick: number | null;
  manualPriorityOverride?: number | null;
}

export interface QueueEventRecord {
  eventId: string;
  queueVersion: number | null;
  eventType: string;
  caseId: string | null;
  affectedCaseIds: string[];
  simulationTick: number | null;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface QueueCaseViewModel {
  caseId: string;
  patientCode: string;
  displayName: string;
  scanLabel: string;
  summaryText: string;
  waitedMinutes: number | null;
  targetMinutes: number;
  remainingMinutes: number | null;
  clinicalUrgencyScore: number;
  riskLevel: QueueRiskLevel;
  recommendedAction: string;
  statusLabel: string;
  deferReason?: string;
  operationalStage: "scanning" | "in-prep" | "waiting" | "held";
}

export interface EscalatedCaseViewModel {
  caseId: string;
  patientCode: string;
  displayName: string;
  scanLabel: string;
  summaryText: string;
  clinicalUrgency: ClinicalUrgencyLevel | null;
  urgencyScore: number;
  confidenceLevel: number;
  escalationReason: string;
  humanDueAtLabel: string;
  updatedAtLabel: string;
}

export interface EventAffectedMovement {
  caseId: string;
  patientCode: string;
  patientName: string;
  fromRank: number;
  toRank: number;
  reason: string;
}

export interface QueueEventViewModel {
  id: string;
  caseId: string | null;
  timestamp: Date;
  eventType: string;
  title: string;
  compactFactors: string[];
  compactChanges: string[];
  why: string[];
  effect: string[];
  queueState: string[];
  patientCode?: string;
  patientName?: string;
  affectedMovements?: EventAffectedMovement[];
}

const seedBaseTime = "2026-06-18T09:00:00.000Z";

export const seedQueueCaseRecords: QueueCaseRecord[] = [
  {
    caseId: "13960219002",
    patientCode: "9608664.0",
    status: "reviewed",
    createdAt: "2026-06-18T08:12:00.000Z",
    updatedAt: "2026-06-18T08:58:00.000Z",
    priorityScore: 15.2,
    queuePosition: 1,
    previousPosition: 2,
    rankChange: 1,
    queueVersion: 101,
    arrivalSeq: 15,
    enqueueTick: 50,
    startTick: 51,
    completionTick: null,
    waitingTicks: 46,
    currentTick: 96,
    payload: {
      caseId: "13960219002",
      patientCode: "9608664.0",
      triageCode: "13960219002",
      age: 30,
      gender: "Male",
      chiefComplaintCode: "T79.9",
      chiefComplaintDescription: "Trauma assessment",
      painGrade: 3,
      spo2: 97,
      avpu: "A",
      urgencyScore: 4,
      confidenceLevel: 0.92,
      waitingTimeMinutes: 46,
      missingFields: [],
      validationStatus: "valid",
      clinicalUrgency: "HIGH" as ClinicalUrgencyLevel,
      targetMinutes: 60,
      recommendedAction: "Prepare for immediate scan",
      modalityLabel: "CT trauma protocol",
      summaryText: "Trauma review with moderate pain and active queue pressure.",
    },
  },
  {
    caseId: "13960219003",
    patientCode: "9608665.0",
    status: "pending",
    createdAt: "2026-06-18T08:18:00.000Z",
    updatedAt: "2026-06-18T08:58:00.000Z",
    priorityScore: 13.8,
    queuePosition: 2,
    previousPosition: 1,
    rankChange: -1,
    queueVersion: 101,
    arrivalSeq: 16,
    enqueueTick: 56,
    startTick: null,
    completionTick: null,
    waitingTicks: 38,
    currentTick: 94,
    payload: {
      caseId: "13960219003",
      patientCode: "9608665.0",
      triageCode: "13960219003",
      age: 33,
      gender: "Female",
      chiefComplaintCode: "R55",
      chiefComplaintDescription: "Syncope / collapse",
      painGrade: 1,
      spo2: 95,
      avpu: "A",
      urgencyScore: 6,
      confidenceLevel: 0.88,
      waitingTimeMinutes: 38,
      missingFields: [],
      validationStatus: "valid",
      clinicalUrgency: "HIGH" as ClinicalUrgencyLevel,
      targetMinutes: 55,
      recommendedAction: "Move into prep lane after current scanner release",
      modalityLabel: "CT head assessment",
      summaryText: "Collapse workup with elevated urgency score and short target window.",
    },
  },
  {
    caseId: "13960219004",
    patientCode: "9608666.0",
    status: "pending",
    createdAt: "2026-06-18T08:27:00.000Z",
    updatedAt: "2026-06-18T08:58:00.000Z",
    priorityScore: 10.4,
    queuePosition: 3,
    previousPosition: 3,
    rankChange: 0,
    queueVersion: 101,
    arrivalSeq: 17,
    enqueueTick: 61,
    startTick: null,
    completionTick: null,
    waitingTicks: 29,
    currentTick: 90,
    payload: {
      caseId: "13960219004",
      patientCode: "9608666.0",
      triageCode: "13960219004",
      age: 46,
      gender: "Male",
      chiefComplaintCode: "S39.83XA",
      chiefComplaintDescription: "Abdominal wall injury",
      painGrade: 3,
      spo2: 95,
      avpu: "A",
      urgencyScore: 3,
      confidenceLevel: 0.9,
      waitingTimeMinutes: 29,
      missingFields: [],
      validationStatus: "valid",
      clinicalUrgency: "MEDIUM" as ClinicalUrgencyLevel,
      targetMinutes: 45,
      recommendedAction: "Hold in waiting bay and monitor queue changes",
      modalityLabel: "CT abdomen / pelvis",
      summaryText: "Trauma-adjacent abdominal complaint with stable vitals.",
    },
  },
  {
    caseId: "13960219007",
    patientCode: "9608669.0",
    status: "pending",
    createdAt: "2026-06-18T08:39:00.000Z",
    updatedAt: "2026-06-18T08:58:00.000Z",
    priorityScore: 8.9,
    queuePosition: 4,
    previousPosition: 4,
    rankChange: 0,
    queueVersion: 101,
    arrivalSeq: 18,
    enqueueTick: 69,
    startTick: null,
    completionTick: null,
    waitingTicks: 22,
    currentTick: 91,
    payload: {
      caseId: "13960219007",
      patientCode: "9608669.0",
      triageCode: "13960219007",
      age: 58,
      gender: "Female",
      chiefComplaintCode: "R07.9",
      chiefComplaintDescription: "Chest pain",
      painGrade: 5,
      spo2: 94,
      avpu: "A",
      urgencyScore: 4,
      confidenceLevel: 0.86,
      waitingTimeMinutes: 22,
      missingFields: [],
      validationStatus: "valid",
      clinicalUrgency: "MEDIUM" as ClinicalUrgencyLevel,
      targetMinutes: 50,
      recommendedAction: "Monitor closely for target drift",
      modalityLabel: "CT chest",
      summaryText: "Chest pain case with borderline oxygen saturation.",
    },
  },
  {
    caseId: "13960219008",
    patientCode: "9608670.0",
    status: "pending",
    createdAt: "2026-06-18T08:45:00.000Z",
    updatedAt: "2026-06-18T08:58:00.000Z",
    priorityScore: 6.2,
    queuePosition: 5,
    previousPosition: 5,
    rankChange: 0,
    queueVersion: 101,
    arrivalSeq: 19,
    enqueueTick: 74,
    startTick: null,
    completionTick: null,
    waitingTicks: 16,
    currentTick: 90,
    payload: {
      caseId: "13960219008",
      patientCode: "9608670.0",
      triageCode: "13960219008",
      age: 42,
      gender: "Male",
      chiefComplaintCode: "N23",
      chiefComplaintDescription: "Renal colic",
      painGrade: 7,
      spo2: 98,
      avpu: "A",
      urgencyScore: 2,
      confidenceLevel: 0.91,
      waitingTimeMinutes: 16,
      missingFields: [],
      validationStatus: "valid",
      clinicalUrgency: "LOW" as ClinicalUrgencyLevel,
      targetMinutes: 40,
      recommendedAction: "Routine queue progression",
      modalityLabel: "CT KUB",
      summaryText: "Painful but stable presentation awaiting routine CT slot.",
    },
  },
  {
    caseId: "13960219009",
    patientCode: "9608671.0",
    status: "escalated",
    createdAt: "2026-06-18T08:21:00.000Z",
    updatedAt: "2026-06-18T08:52:00.000Z",
    priorityScore: null,
    queuePosition: null,
    previousPosition: 2,
    rankChange: null,
    queueVersion: 100,
    arrivalSeq: 14,
    enqueueTick: 48,
    startTick: null,
    completionTick: null,
    waitingTicks: 41,
    currentTick: 89,
    payload: {
      caseId: "13960219009",
      patientCode: "9608671.0",
      triageCode: "13960219009",
      age: 71,
      gender: "Female",
      chiefComplaintCode: "R41.82",
      chiefComplaintDescription: "Altered mental status",
      painGrade: 0,
      spo2: 92,
      avpu: "V",
      urgencyScore: 8,
      confidenceLevel: 0.63,
      waitingTimeMinutes: 41,
      missingFields: ["bp_systolic"],
      validationStatus: "valid",
      forceEscalation: true,
      clinicalUrgency: "HIGH" as ClinicalUrgencyLevel,
      targetMinutes: 35,
      recommendedAction: "Await human review before placement",
      modalityLabel: "CT head urgent review",
      summaryText: "Escalated due to altered mental status and incomplete physiologic context.",
      humanDueAt: "2026-06-18T09:12:00.000Z",
    },
  },
  {
    caseId: "13960219010",
    patientCode: "9608672.0",
    status: "escalated",
    createdAt: "2026-06-18T08:33:00.000Z",
    updatedAt: "2026-06-18T08:56:00.000Z",
    priorityScore: null,
    queuePosition: null,
    previousPosition: 4,
    rankChange: null,
    queueVersion: 100,
    arrivalSeq: 20,
    enqueueTick: 63,
    startTick: null,
    completionTick: null,
    waitingTicks: 27,
    currentTick: 90,
    payload: {
      caseId: "13960219010",
      patientCode: "9608672.0",
      triageCode: "13960219010",
      age: 64,
      gender: "Male",
      chiefComplaintCode: "R29.818",
      chiefComplaintDescription: "Acute neurologic deficit",
      painGrade: 2,
      spo2: 93,
      avpu: "A",
      urgencyScore: 7,
      confidenceLevel: 0.58,
      waitingTimeMinutes: 27,
      missingFields: ["respiratory_rate"],
      validationStatus: "valid",
      clinicalUrgency: "HIGH" as ClinicalUrgencyLevel,
      targetMinutes: 32,
      recommendedAction: "Hold for attending confirmation",
      modalityLabel: "CT stroke pathway",
      summaryText: "Escalated while the team confirms stroke pathway placement.",
      humanDueAt: "2026-06-18T09:18:00.000Z",
    },
  },
];

export const seedQueueEvents: QueueEventRecord[] = [
  {
    eventId: "evt-init",
    queueVersion: 101,
    eventType: "queue_recomputed",
    caseId: null,
    affectedCaseIds: ["13960219002", "13960219003", "13960219004", "13960219007", "13960219008"],
    simulationTick: 96,
    details: {
      title: "Active queue recomputed",
      compactFactors: ["5 active cases", "2 escalated cases waiting for review", "Single CT scanner online"],
      compactChanges: ["Queue positions refreshed from backend-aligned seed data"],
      why: [
        "Queue state mirrors backend snapshot fields",
        "Rank order prioritises target windows before lower-acuity work",
      ],
      effect: ["Baseline queue order established for the simulation start"],
      queueState: ["Queue version: 101", "Simulation tick: 96"],
    },
    createdAt: seedBaseTime,
  },
  {
    eventId: "evt-escalation-1",
    queueVersion: 100,
    eventType: "case_escalated",
    caseId: "13960219009",
    affectedCaseIds: ["13960219009"],
    simulationTick: 89,
    details: {
      title: "Case escalated for human review",
      compactFactors: ["Altered mental status", "Missing blood pressure context"],
      compactChanges: ["13960219009 removed from active queue placement"],
      why: [
        "Moderator confidence fell below autonomous placement threshold",
        "Human review requested because key physiologic context is incomplete",
      ],
      effect: ["Case held outside active queue until review decision"],
      queueState: ["Queue version: 100", "Human review status: pending"],
      patientCode: "9608671.0",
      patientName: "Case 13960219009",
    },
    createdAt: "2026-06-18T08:52:00.000Z",
  },
  {
    eventId: "evt-escalation-2",
    queueVersion: 100,
    eventType: "case_escalated",
    caseId: "13960219010",
    affectedCaseIds: ["13960219010"],
    simulationTick: 90,
    details: {
      title: "Second escalation awaiting attending confirmation",
      compactFactors: ["Acute neurologic deficit", "Stroke pathway review pending"],
      compactChanges: ["13960219010 held for human confirmation"],
      why: [
        "Neurologic presentation may require manual stroke-pathway prioritisation",
        "Confidence and missing-field profile triggered escalation",
      ],
      effect: ["Case held outside active queue until manual review"],
      queueState: ["Queue version: 100", "Escalated queue count: 2"],
      patientCode: "9608672.0",
      patientName: "Case 13960219010",
    },
    createdAt: "2026-06-18T08:56:00.000Z",
  },
];

export const demandForecast = [
  { window: "Now", demand: 5 },
  { window: "+1h", demand: 7 },
  { window: "+2h", demand: 9 },
  { window: "+3h", demand: 8 },
  { window: "+4h", demand: 6 },
  { window: "+5h", demand: 10 },
  { window: "+6h", demand: 11 },
  { window: "+7h", demand: 9 },
];

export const congestionForecast = [
  { time: "now", queue: 5 },
  { time: "+15m", queue: 6 },
  { time: "+30m", queue: 7 },
  { time: "+45m", queue: 6 },
  { time: "+60m", queue: 5 },
];

export const complianceTrend = [
  { day: "Mon", high: 96, medium: 88 },
  { day: "Tue", high: 95, medium: 90 },
  { day: "Wed", high: 97, medium: 87 },
  { day: "Thu", high: 94, medium: 89 },
  { day: "Fri", high: 98, medium: 91 },
  { day: "Sat", high: 93, medium: 86 },
  { day: "Sun", high: 92, medium: 85 },
];

export const throughputByHour = [
  { hour: "08", scans: 4 },
  { hour: "09", scans: 6 },
  { hour: "10", scans: 5 },
  { hour: "11", scans: 7 },
  { hour: "12", scans: 6 },
  { hour: "13", scans: 8 },
  { hour: "14", scans: 9 },
  { hour: "15", scans: 7 },
];

export const isActiveQueueStatus = (status: QueueCaseStatus) =>
  status === "pending" || status === "routed" || status === "reviewed";

export const getTargetMinutes = (record: QueueCaseRecord) => record.payload.targetMinutes ?? 45;

export const getWaitingMinutes = (record: QueueCaseRecord): number | null => {
  const createdAt = new Date(record.createdAt).getTime();
  const now = new Date().getTime();
  const elapsedMs = now - createdAt;
  const elapsedMinutes = Math.floor(elapsedMs / 60000);
  return Math.max(0, elapsedMinutes);
};

export const getRemainingMinutes = (record: QueueCaseRecord): number | null => {
  const waited = getWaitingMinutes(record);
  if (waited === null) return null;
  return getTargetMinutes(record) - waited;
};

export const deriveRiskLevel = (record: QueueCaseRecord): QueueRiskLevel => {
  const remaining = getRemainingMinutes(record);
  if (remaining === null) return "stable";
  if (remaining <= 10) return "critical";
  if (remaining <= 25) return "moderate";
  return "stable";
};

export const getDisplayName = (record: QueueCaseRecord) => `Case ${record.caseId}`;

export const deriveQueueCaseViewModel = (record: QueueCaseRecord): QueueCaseViewModel => {
  const queuePosition = record.queuePosition ?? 0;
  const riskLevel = deriveRiskLevel(record);

  return {
    caseId: record.caseId,
    patientCode: record.patientCode ?? "Unknown patient",
    displayName: getDisplayName(record),
    scanLabel: record.payload.modalityLabel ?? "CT review",
    summaryText:
      record.payload.summaryText ??
      record.payload.chiefComplaintDescription ??
      "Clinical summary unavailable.",
    waitedMinutes: getWaitingMinutes(record),
    targetMinutes: getTargetMinutes(record),
    remainingMinutes: getRemainingMinutes(record),
    clinicalUrgencyScore: record.payload.urgencyScore,
    riskLevel,
    recommendedAction: record.payload.recommendedAction ?? "Await next queue recompute",
    statusLabel: record.status,
    deferReason: record.payload.deferReason,
    operationalStage:
      record.status === "escalated"
        ? "held"
        : queuePosition === 1
          ? "scanning"
          : queuePosition === 2
            ? "in-prep"
            : "waiting",
  };
};

export const deriveEscalatedCaseViewModel = (
  record: QueueCaseRecord,
): EscalatedCaseViewModel => ({
  caseId: record.caseId,
  patientCode: record.patientCode ?? "Unknown patient",
  displayName: getDisplayName(record),
  scanLabel: record.payload.modalityLabel ?? "CT review",
  summaryText:
    record.payload.summaryText ??
    record.payload.chiefComplaintDescription ??
    "Awaiting escalation summary.",
  clinicalUrgency: record.payload.clinicalUrgency ?? null,
  urgencyScore: record.payload.urgencyScore,
  confidenceLevel: record.payload.confidenceLevel ?? 0.5,
  escalationReason:
    record.payload.forceEscalation || record.payload.missingFields.length > 0
      ? "Manual review required before queue placement"
      : "Escalated by queue policy",
  humanDueAtLabel: formatMockTimestamp(record.payload.humanDueAt ?? record.updatedAt),
  updatedAtLabel: formatMockTimestamp(record.updatedAt),
});

export const clinicalUrgencyPercent = (record: QueueCaseRecord): number => {
  const raw = record.priorityScore ?? record.payload.urgencyScore ?? 0;
  return Math.max(8, Math.min(99, Math.round(raw * 6)));
};

export const priorityScorePercent = clinicalUrgencyPercent;

export const isOverTarget = (record: QueueCaseRecord) => {
  const remaining = getRemainingMinutes(record);
  return remaining !== null && remaining <= 0;
};

export const formatMockTimestamp = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const asStringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const asAffectedMovements = (value: unknown): EventAffectedMovement[] | undefined =>
  Array.isArray(value)
    ? value.filter((item): item is EventAffectedMovement => {
        if (!item || typeof item !== "object") return false;
        const movement = item as Partial<EventAffectedMovement>;
        return typeof movement.caseId === "string" && typeof movement.patientName === "string";
      })
    : undefined;

const formatConfidence = (value: unknown) => {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(numeric)) return undefined;
  return `${Math.round(numeric * 100)}% confidence`;
};

const asOptionalString = (value: unknown) => (typeof value === "string" && value.trim() ? value : undefined);

const buildReviewEventViewModel = (event: QueueEventRecord): QueueEventViewModel => {
  const reasoningSummary = asOptionalString(event.details.reasoning_summary) ?? "Review reasoning unavailable.";
  const clinicalUrgency = asOptionalString(event.details.clinical_urgency);
  const confidence = formatConfidence(event.details.confidence);
  const redFlags = asStringList(event.details.red_flags);
  const missingInformation = asStringList(event.details.missing_information);

  const urgencyLabel = clinicalUrgency
    ? clinicalUrgency.charAt(0) + clinicalUrgency.slice(1).toLowerCase() + " urgency"
    : "Urgency assessed";

  return {
    id: event.eventId,
    caseId: event.caseId,
    timestamp: new Date(event.createdAt),
    eventType: event.eventType,
    title: urgencyLabel,
    compactFactors: [
      confidence ?? "",
      ...redFlags.slice(0, 2).map((flag) => flag.replace(/_/g, " ")),
    ].filter(Boolean),
    compactChanges: [reasoningSummary],
    why: [
      reasoningSummary,
      ...redFlags.map((flag) => `Red flag: ${flag.replace(/_/g, " ")}`),
      ...missingInformation.map((field) => `Missing info: ${field.replace(/_/g, " ")}`),
    ],
    effect: ["Sent to placement queue"],
    queueState: [],
    patientCode:
      typeof event.details.patientCode === "string"
        ? event.details.patientCode
        : typeof event.details.patient_code === "string"
          ? event.details.patient_code
          : undefined,
    patientName:
      typeof event.details.patientName === "string"
        ? event.details.patientName
        : event.caseId
          ? `Case ${event.caseId}`
          : undefined,
    affectedMovements: undefined,
  };
};

const placementActionLabel = (action: string | undefined): string => {
  switch (action) {
    case "go_to_top": return "Moved to top of queue";
    case "go_to_bottom": return "Placed at end of queue";
    case "insert_before": return "Inserted before anchor case";
    case "insert_after": return "Inserted after anchor case";
    case "hold_and_escalate": return "Held for human review";
    default: return action ? action.replace(/_/g, " ") : "Placement decided";
  }
};

const buildModeratorEventViewModel = (event: QueueEventRecord): QueueEventViewModel => {
  const reasonSummary =
    asOptionalString(event.details.reason_summary) ?? "Placement reasoning unavailable.";
  const placementAction = asOptionalString(event.details.placement_action);
  const comparisonCount =
    typeof event.details.comparison_count === "number"
      ? `Compared against ${event.details.comparison_count} other ${event.details.comparison_count === 1 ? "case" : "cases"}`
      : undefined;
  const needsHumanReview = event.details.needs_human_review === true;

  const title = needsHumanReview
    ? "Flagged for human review"
    : placementActionLabel(placementAction);

  return {
    id: event.eventId,
    caseId: event.caseId,
    timestamp: new Date(event.createdAt),
    eventType: event.eventType,
    title,
    compactFactors: [],
    compactChanges: [reasonSummary],
    why: [reasonSummary, comparisonCount ?? ""].filter(Boolean),
    effect: needsHumanReview ? ["Removed from active queue", "Awaiting human decision"] : [],
    queueState: [],
    patientCode:
      typeof event.details.patientCode === "string"
        ? event.details.patientCode
        : typeof event.details.patient_code === "string"
          ? event.details.patient_code
          : undefined,
    patientName:
      typeof event.details.patientName === "string"
        ? event.details.patientName
        : event.caseId
          ? `Case ${event.caseId}`
          : undefined,
    affectedMovements: undefined,
  };
};

export interface NarrativeItem {
  id: string;
  timestamp: Date;
  headline: string;
  subheadline?: string;
  bullets: string[];
  rankChange?: string;
  tone: "info" | "critical" | "stable" | "neutral";
}

const resolvePatientLabel = (caseId: string | null, caseRecords?: QueueCaseRecord[]): string => {
  if (!caseId) return "Unknown case";
  const rec = caseRecords?.find((r) => r.caseId === caseId);
  return rec?.patientCode ? `Case ${caseId} (${rec.patientCode})` : `Case ${caseId}`;
};

export const deriveNarrativeItems = (
  events: QueueEventRecord[],
  caseRecords: QueueCaseRecord[],
): NarrativeItem[] => {
  const sorted = [...events].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const filtered = sorted.filter((event, index) => {
    if (event.eventType === "case_completed" && event.caseId) {
      const completedCaseId = event.caseId;
      const nextEvent = sorted[index + 1];
      if (
        nextEvent &&
        nextEvent.eventType === "placement_applied" &&
        nextEvent.caseId &&
        nextEvent.caseId !== completedCaseId &&
        typeof nextEvent.details.from_rank === "number" &&
        nextEvent.details.from_rank === 1
      ) {
        return false;
      }
    }
    return true;
  });

  return filtered.map((event): NarrativeItem => {
    const patient = resolvePatientLabel(event.caseId, caseRecords);
    const timestamp = new Date(event.createdAt);

    if (event.eventType === "case_arrived") {
      const pos = typeof event.details.queue_position === "number" ? event.details.queue_position : null;
      const source = asOptionalString(event.details.source);
      const notes = asOptionalString(event.details.human_review_notes);
      const isHumanReturn = source === "human_review_return";
      return {
        id: event.eventId,
        timestamp,
        headline: isHumanReturn ? `${patient} rejoined the queue after human review` : `${patient} joined the queue`,
        subheadline: pos != null ? `Entered at position #${pos}` : undefined,
        bullets: notes ? [notes] : [],
        tone: "info",
      };
    }

    if (event.eventType === "human_decision_applied") {
      const decision = asOptionalString(event.details.decision)?.replace(/_/g, " ");
      const notes = asOptionalString(event.details.notes);
      const outcome = asOptionalString(event.details.outcome);
      const headline =
        outcome === "returned_to_review"
          ? `${patient} returned to review by human decision`
          : `${patient} approved by human decision`;
      return {
        id: event.eventId,
        timestamp,
        headline,
        subheadline: decision ? `Decision: ${decision}` : undefined,
        bullets: notes ? [notes] : [],
        tone: outcome === "returned_to_review" ? "info" : "stable",
      };
    }

    if (event.eventType === "placement_applied" || event.eventType === "queue_reordered") {
      const action = typeof event.details.placement_action === "string" ? event.details.placement_action : null;
      const reason = typeof event.details.decision_payload === "object" && event.details.decision_payload !== null
        ? (event.details.decision_payload as Record<string, unknown>).reason_summary
        : null;
      const fromRank = typeof event.details.from_rank === "number" ? event.details.from_rank : null;
      const toRank = typeof event.details.applied_position === "number" ? event.details.applied_position : null;
      const isTop = action === "go_to_top";
      const isBottom = action === "go_to_bottom";
      const headline = isTop
        ? `${patient} moved to top of queue`
        : isBottom
          ? `${patient} placed at end of queue`
          : `${patient} placed in queue`;
      const rankLabel = fromRank != null && toRank != null
        ? `#${fromRank} → #${toRank}`
        : toRank != null
          ? `→ #${toRank}`
          : null;
      const bullets: string[] = [];
      if (typeof reason === "string" && reason) bullets.push(reason);
      return {
        id: event.eventId,
        timestamp,
        headline,
        subheadline: rankLabel ?? undefined,
        rankChange: rankLabel ?? undefined,
        bullets,
        tone: "info",
      };
    }

    if (event.eventType === "case_completed") {
      return {
        id: event.eventId,
        timestamp,
        headline: `Scan completed: ${patient}`,
        bullets: ["Scanner cycle finished", "Machine available for next-ranked patient"],
        tone: "stable",
      };
    }

    if (event.eventType === "case_escalated") {
      return {
        id: event.eventId,
        timestamp,
        headline: `${patient} escalated for human review`,
        bullets: ["Removed from active queue", "Awaiting human decision"],
        tone: "critical",
      };
    }

    if (event.eventType === "clinical_urgency_determined") {
      const urgency = asOptionalString(event.details.clinical_urgency);
      const confidence = formatConfidence(event.details.confidence);
      const flags = asStringList(event.details.red_flags);
      const summary = asOptionalString(event.details.reasoning_summary);
      const urgencyLabel = urgency
        ? urgency.charAt(0) + urgency.slice(1).toLowerCase()
        : null;
      const bullets: string[] = [];
      if (confidence) bullets.push(confidence);
      flags.slice(0, 3).forEach((f) => bullets.push(`Red flag: ${f.replace(/_/g, " ")}`));
      if (summary) bullets.push(summary);
      return {
        id: event.eventId,
        timestamp,
        headline: urgencyLabel
          ? `${patient} assessed — ${urgencyLabel} urgency`
          : `${patient} assessed`,
        bullets,
        tone: urgency === "CRITICAL" ? "critical" : urgency === "HIGH" ? "critical" : "info",
      };
    }

    if (event.eventType === "moderator_decision") {
      const action = asOptionalString(event.details.placement_action);
      const summary = asOptionalString(event.details.reason_summary);
      const needsHumanReview = event.details.needs_human_review === true;
      const headline = needsHumanReview
        ? `${patient} flagged for human review`
        : action === "go_to_top"
          ? `${patient} moved to top of queue`
          : action === "go_to_bottom"
            ? `${patient} placed at end of queue`
            : `${patient} placed in queue`;
      const bullets: string[] = [];
      if (summary) bullets.push(summary);
      return {
        id: event.eventId,
        timestamp,
        headline,
        bullets,
        tone: needsHumanReview ? "critical" : "info",
      };
    }

    if (event.eventType === "rank_changed") {
      const prevRank = typeof event.details.previous_rank === "number" ? event.details.previous_rank : null;
      const newRank = typeof event.details.queue_rank === "number" ? event.details.queue_rank : null;
      const reason = asOptionalString(event.details.reason);
      const moved = prevRank != null && newRank != null;
      const movedUp = moved && newRank < prevRank;
      const rankLabel = moved ? `#${prevRank} → #${newRank}` : newRank != null ? `→ #${newRank}` : "position changed";
      return {
        id: event.eventId,
        timestamp,
        headline: `${patient} ${movedUp ? "moved up" : moved ? "moved down" : "repositioned"} in queue`,
        subheadline: rankLabel,
        bullets: reason ? [reason.replace(/_/g, " ")] : [],
        rankChange: rankLabel,
        tone: movedUp ? "stable" : "info",
      };
    }

    return {
      id: event.eventId,
      timestamp,
      headline: event.eventType.replaceAll("_", " "),
      bullets: [],
      tone: "neutral",
    };
  });
};

const buildRankChangedViewModel = (event: QueueEventRecord): QueueEventViewModel => {
  const prevRank = typeof event.details.previous_rank === "number" ? event.details.previous_rank : null;
  const newRank = typeof event.details.queue_rank === "number" ? event.details.queue_rank : null;
  const reason = asOptionalString(event.details.reason);
  const moved = prevRank != null && newRank != null;
  const movedUp = moved && newRank < prevRank;
  const rankLabel = moved ? `#${prevRank} → #${newRank}` : newRank != null ? `→ #${newRank}` : null;

  return {
    id: event.eventId,
    caseId: event.caseId,
    timestamp: new Date(event.createdAt),
    eventType: event.eventType,
    title: movedUp ? "Moved up in queue" : moved ? "Moved down in queue" : "Position updated",
    compactFactors: rankLabel ? [rankLabel] : [],
    compactChanges: reason ? [reason.replace(/_/g, " ")] : [],
    why: reason ? [reason.replace(/_/g, " ")] : [],
    effect: rankLabel ? [rankLabel] : [],
    queueState: [],
    patientCode:
      typeof event.details.patientCode === "string"
        ? event.details.patientCode
        : typeof event.details.patient_code === "string"
          ? event.details.patient_code
          : undefined,
    patientName: event.caseId ? `Case ${event.caseId}` : undefined,
    affectedMovements: undefined,
  };
};

const buildPlacementAppliedViewModel = (event: QueueEventRecord): QueueEventViewModel => {
  const placementAction = asOptionalString(event.details.placement_action);
  const appliedPosition = typeof event.details.applied_position === "number" ? event.details.applied_position : null;
  const fromRank = typeof event.details.from_rank === "number" ? event.details.from_rank : null;
  const decisionPayload = event.details.decision_payload as Record<string, unknown> | null | undefined;
  const reasonSummary = decisionPayload
    ? asOptionalString(decisionPayload.reason_summary)
    : undefined;

  const moved = fromRank != null && appliedPosition != null;
  const rankLabel = moved
    ? `#${fromRank} → #${appliedPosition}`
    : appliedPosition != null
      ? `→ #${appliedPosition}`
      : null;

  const title = placementActionLabel(placementAction);

  return {
    id: event.eventId,
    caseId: event.caseId,
    timestamp: new Date(event.createdAt),
    eventType: event.eventType,
    title,
    compactFactors: rankLabel ? [rankLabel] : [],
    compactChanges: reasonSummary ? [reasonSummary] : [],
    why: reasonSummary ? [reasonSummary] : [],
    effect: rankLabel ? [rankLabel] : [],
    queueState: [],
    patientCode:
      typeof event.details.patientCode === "string"
        ? event.details.patientCode
        : typeof event.details.patient_code === "string"
          ? event.details.patient_code
          : undefined,
    patientName: event.caseId ? `Case ${event.caseId}` : undefined,
    affectedMovements: undefined,
  };
};

export const deriveQueueEventViewModel = (event: QueueEventRecord): QueueEventViewModel => {
  if (event.eventType === "clinical_urgency_determined") {
    return buildReviewEventViewModel(event);
  }

  if (event.eventType === "moderator_decision") {
    return buildModeratorEventViewModel(event);
  }

  if (event.eventType === "rank_changed") {
    return buildRankChangedViewModel(event);
  }

  if (event.eventType === "placement_applied") {
    return buildPlacementAppliedViewModel(event);
  }

  return {
    id: event.eventId,
    caseId: event.caseId,
    timestamp: new Date(event.createdAt),
    eventType: event.eventType,
    title:
      typeof event.details.title === "string"
        ? event.details.title
        : event.eventType.replaceAll("_", " "),
    compactFactors: asStringList(event.details.compactFactors),
    compactChanges: asStringList(event.details.compactChanges),
    why: asStringList(event.details.why),
    effect: asStringList(event.details.effect),
    queueState: asStringList(event.details.queueState),
    patientCode:
      typeof event.details.patientCode === "string"
        ? event.details.patientCode
        : typeof event.details.patient_code === "string"
          ? event.details.patient_code
          : undefined,
    patientName:
      typeof event.details.patientName === "string"
        ? event.details.patientName
        : event.caseId
          ? `Case ${event.caseId}`
          : undefined,
    affectedMovements: asAffectedMovements(event.details.affectedMovements),
  };
};
