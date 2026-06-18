import type {
  ClinicalUrgencyLevel,
  QueueCasePayload,
  QueueCaseRecord,
  QueueCaseStatus,
  QueueEventRecord,
  ValidationStatus,
} from "@/lib/queue-models";

type UnknownRecord = Record<string, unknown>;

export interface NormalizedQueueResponse {
  activeQueue: QueueCaseRecord[];
  escalatedCases: QueueCaseRecord[];
  allCases: QueueCaseRecord[];
  summary: {
    activeCount: number;
    escalatedCount: number;
    latestQueueVersion: number | null;
    currentTick: number | null;
  };
}

export interface NormalizedReasoningEventsResponse {
  events: QueueEventRecord[];
}

export interface NormalizedDashboardSummary {
  activeCount: number;
  escalatedCount: number;
  latestQueueVersion: number | null;
  currentTick: number | null;
}

const REASONING_EVENT_TYPES = new Set([
  "clinical_urgency_determined",
  "moderator_decision",
  "placement_applied",
  "case_arrived",
  "case_completed",
  "case_escalated",
  "queue_reordered",
  "rank_changed",
  "human_decision_applied",
]);

const asRecord = (value: unknown): UnknownRecord | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : undefined;

const firstDefined = (record: UnknownRecord | undefined, keys: string[]) => {
  if (!record) return undefined;
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
};

const asString = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  return text ? text : undefined;
};

const asNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const asInteger = (value: unknown): number | undefined => {
  const parsed = asNumber(value);
  return parsed === undefined ? undefined : Math.trunc(parsed);
};

const asBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "y"].includes(normalized)) return true;
    if (["0", "false", "no", "n"].includes(normalized)) return false;
  }
  return undefined;
};

const asStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => asString(item))
      .filter((item): item is string => Boolean(item));
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return asStringArray(parsed);
    } catch {
      return [value];
    }
  }

  return [];
};

const parseMaybeJsonObject = (value: unknown): UnknownRecord => {
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return asRecord(parsed) ?? {};
    } catch {
      return {};
    }
  }

  return asRecord(value) ?? {};
};

const toClinicalUrgency = (value: unknown): ClinicalUrgencyLevel | undefined => {
  const text = asString(value)?.toUpperCase();
  if (text === "CRITICAL" || text === "HIGH" || text === "MEDIUM" || text === "LOW") return text;
  return undefined;
};

const toValidationStatus = (value: unknown, caseId?: string, patientCode?: string): ValidationStatus => {
  const text = asString(value)?.toLowerCase();
  if (text === "valid" || text === "invalid") return text;
  return caseId && patientCode ? "valid" : "invalid";
};

const inferModalityLabel = (payload: UnknownRecord, complaintDescription?: string) => {
  const explicit = asString(
    firstDefined(payload, [
      "modality_label",
      "modalityLabel",
      "ct_type",
      "ctType",
      "scan_label",
      "scanLabel",
    ]),
  );
  if (explicit) return explicit;
  if (complaintDescription) return complaintDescription;
  return "CT review";
};

const inferSummaryText = (payload: UnknownRecord, complaintDescription?: string) => {
  return (
    asString(firstDefined(payload, ["summary_text", "summaryText"])) ??
    complaintDescription ??
    "Clinical summary unavailable."
  );
};

export const normalizeQueueCasePayload = (
  rawPayload: unknown,
  fallback?: {
    caseId?: string;
    patientCode?: string;
    waitingTicks?: number | null;
    status?: QueueCaseStatus;
  },
): QueueCasePayload => {
  const payload = parseMaybeJsonObject(rawPayload);
  const caseId = asString(firstDefined(payload, ["case_id", "caseId", "triage_code", "triageCode"])) ?? fallback?.caseId;
  const patientCode =
    asString(firstDefined(payload, ["patient_code", "patientCode", "PatientCode"])) ??
    fallback?.patientCode;
  const clinicalUrgency = toClinicalUrgency(firstDefined(payload, ["clinical_urgency", "clinicalUrgency"])) ?? null;
  const waitingTimeMinutes =
    asInteger(firstDefined(payload, ["waiting_time_minutes", "waitingTimeMinutes"])) ?? undefined;
  const complaintDescription =
    asString(
      firstDefined(payload, [
        "chief_complaint_description",
        "chiefComplaintDescription",
        "ChiefComplaintDescription",
      ]),
    ) ?? asString(firstDefined(payload, ["ChiefComplaint", "chief_complaint_code", "chiefComplaintCode"]));

  return {
    caseId,
    patientCode,
    triageCode: asString(firstDefined(payload, ["triage_code", "triageCode"])) ?? caseId,
    age: asInteger(firstDefined(payload, ["age", "age_x"])),
    gender: asString(firstDefined(payload, ["gender", "gender_x"])),
    chiefComplaintCode: asString(
      firstDefined(payload, ["chief_complaint_code", "chiefComplaintCode", "ChiefComplaint"]),
    ),
    chiefComplaintDescription: complaintDescription,
    painGrade: asInteger(firstDefined(payload, ["pain_grade", "painGrade", "PainGrade"])),
    bpSystolic: asInteger(firstDefined(payload, ["bp_systolic", "bpSystolic", "BlooddpressurSystol"])),
    bpDiastolic: asInteger(firstDefined(payload, ["bp_diastolic", "bpDiastolic", "BlooddpressurDiastol"])),
    pulseRate: asInteger(firstDefined(payload, ["pulse_rate", "pulseRate", "PulseRate"])),
    respiratoryRate: asInteger(
      firstDefined(payload, ["respiratory_rate", "respiratoryRate", "RespiratoryRate"]),
    ),
    spo2: asInteger(firstDefined(payload, ["spo2", "O2Saturation"])),
    avpu: asString(firstDefined(payload, ["avpu", "AVPU"])),
    urgencyScore:
      asInteger(firstDefined(payload, ["urgency_score", "urgencyScore"])) ?? 0,
    confidenceLevel: asNumber(firstDefined(payload, ["confidence", "confidence_level", "confidenceLevel"])),
    waitingTimeMinutes,
    missingFields: asStringArray(
      firstDefined(payload, ["missing_fields", "missingFields", "missing_information", "missingInformation"]),
    ),
    validationStatus: toValidationStatus(
      firstDefined(payload, ["validation_status", "validationStatus"]),
      caseId,
      patientCode,
    ),
    forceEscalation: asBoolean(firstDefined(payload, ["force_escalation", "forceEscalation"])),
    clinicalUrgency,
    targetMinutes:
      asInteger(firstDefined(payload, ["target_minutes", "targetMinutes"])) ?? 45,
    recommendedAction:
      asString(firstDefined(payload, ["recommended_action", "recommendedAction"])) ??
      (fallback?.status === "escalated" ? "Await human review" : "Await next queue update"),
    modalityLabel: inferModalityLabel(payload, complaintDescription),
    summaryText: inferSummaryText(payload, complaintDescription),
    deferReason: asString(firstDefined(payload, ["defer_reason", "deferReason"])),
    deferBlockedByCaseId: asString(
      firstDefined(payload, ["defer_blocked_by_case_id", "deferBlockedByCaseId"]),
    ),
    humanDueAt: asString(firstDefined(payload, ["human_due_at", "humanDueAt"])),
  };
};

export const normalizeQueueCaseRecord = (rawCase: unknown): QueueCaseRecord => {
  const record = asRecord(rawCase) ?? {};
  const caseId =
    asString(firstDefined(record, ["case_id", "caseId"])) ??
    asString(firstDefined(asRecord(record.payload), ["case_id", "caseId", "triage_code", "triageCode"])) ??
    "unknown-case";
  const patientCode =
    asString(firstDefined(record, ["patient_code", "patientCode"])) ??
    asString(firstDefined(asRecord(record.payload), ["patient_code", "patientCode", "PatientCode"])) ??
    null;
  const queuePosition =
    asInteger(firstDefined(record, ["queue_position", "queuePosition", "queue_rank", "queueRank"])) ?? null;
  const previousPosition =
    asInteger(firstDefined(record, ["previous_position", "previousPosition", "previous_rank", "previousRank"])) ??
    null;
  const currentTick =
    asInteger(firstDefined(record, ["current_tick", "currentTick"])) ??
    asInteger(firstDefined(record, ["simulation_tick", "simulationTick"])) ??
    null;
  const enqueueTick =
    asInteger(firstDefined(record, ["enqueue_tick", "enqueueTick"])) ?? null;
  const waitingTicks =
    asInteger(firstDefined(record, ["waiting_ticks", "waitingTicks"])) ??
    (currentTick != null && enqueueTick != null ? Math.max(0, currentTick - enqueueTick) : null);
  const status =
    (asString(firstDefined(record, ["status"])) as QueueCaseStatus | undefined) ?? "pending";

  const payload = normalizeQueueCasePayload(firstDefined(record, ["payload", "case_payload", "casePayload"]), {
    caseId,
    patientCode: patientCode ?? undefined,
    waitingTicks,
    status,
  });

  return {
    caseId,
    patientCode,
    status,
    payload,
    createdAt: asString(firstDefined(record, ["created_at", "createdAt"])) ?? new Date().toISOString(),
    updatedAt: asString(firstDefined(record, ["updated_at", "updatedAt"])) ?? new Date().toISOString(),
    priorityScore: asNumber(firstDefined(record, ["priority_score", "priorityScore"])) ?? null,
    queuePosition,
    previousPosition,
    rankChange: asInteger(firstDefined(record, ["rank_change", "rankChange"])) ?? null,
    queueVersion: asInteger(firstDefined(record, ["queue_version", "queueVersion"])) ?? null,
    arrivalSeq: asInteger(firstDefined(record, ["arrival_seq", "arrivalSeq"])) ?? null,
    enqueueTick,
    startTick: asInteger(firstDefined(record, ["start_tick", "startTick"])) ?? null,
    completionTick: asInteger(firstDefined(record, ["completion_tick", "completionTick"])) ?? null,
    waitingTicks,
    currentTick,
    manualPriorityOverride:
      asNumber(firstDefined(record, ["manual_priority_override", "manualPriorityOverride"])) ?? null,
  };
};

const sortQueueCases = (cases: QueueCaseRecord[]) =>
  [...cases].sort((a, b) => {
    const aPosition = a.queuePosition ?? Number.MAX_SAFE_INTEGER;
    const bPosition = b.queuePosition ?? Number.MAX_SAFE_INTEGER;
    if (aPosition !== bPosition) return aPosition - bPosition;
    return a.caseId.localeCompare(b.caseId);
  });

export const normalizeQueueResponse = (rawResponse: unknown): NormalizedQueueResponse => {
  const response = asRecord(rawResponse) ?? {};
  const queueCandidates = [
    firstDefined(response, ["queue", "active_queue", "activeQueue", "cases", "items"]),
    rawResponse,
  ];
  const escalatedCandidates = [
    firstDefined(response, ["escalated_cases", "escalatedCases"]),
  ];

  const collectCases = (candidate: unknown) =>
    Array.isArray(candidate) ? candidate.map((item) => normalizeQueueCaseRecord(item)) : [];

  const queueCases = queueCandidates.flatMap(collectCases);
  const explicitEscalated = escalatedCandidates.flatMap(collectCases);

  const caseMap = new Map<string, QueueCaseRecord>();
  for (const item of [...queueCases, ...explicitEscalated]) {
    caseMap.set(item.caseId, item);
  }

  const allCases = [...caseMap.values()];
  const activeQueue = sortQueueCases(
    allCases.filter((item) => item.status === "pending" || item.status === "routed" || item.status === "reviewed"),
  );
  const escalatedCases = allCases.filter((item) => item.status === "escalated");
  const queueVersionCandidates = allCases
    .map((item) => item.queueVersion)
    .filter((value): value is number => typeof value === "number");
  const currentTickCandidates = allCases
    .map((item) => item.currentTick)
    .filter((value): value is number => typeof value === "number");

  return {
    activeQueue,
    escalatedCases,
    allCases,
    summary: {
      activeCount: activeQueue.length,
      escalatedCount: escalatedCases.length,
      latestQueueVersion:
        queueVersionCandidates.length > 0 ? Math.max(...queueVersionCandidates) : null,
      currentTick: currentTickCandidates.length > 0 ? Math.max(...currentTickCandidates) : null,
    },
  };
};

const parseAffectedCaseIds = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => asString(item)).filter((item): item is string => Boolean(item));
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return parseAffectedCaseIds(parsed);
    } catch {
      return [];
    }
  }

  return [];
};

export const normalizeQueueEventRecord = (rawEvent: unknown, index = 0): QueueEventRecord => {
  const event = asRecord(rawEvent) ?? {};
  const details = parseMaybeJsonObject(firstDefined(event, ["details", "detail"]));
  const eventType = asString(firstDefined(event, ["event_type", "eventType"])) ?? "unknown_event";
  const caseId = asString(firstDefined(event, ["case_id", "caseId"])) ?? null;
  const createdAt = asString(firstDefined(event, ["created_at", "createdAt"])) ?? new Date().toISOString();
  const fallbackEventId = [eventType, caseId ?? "none", createdAt, index].join(":");

  return {
    eventId: asString(firstDefined(event, ["event_id", "eventId"])) ?? fallbackEventId,
    queueVersion: asInteger(firstDefined(event, ["queue_version", "queueVersion"])) ?? null,
    eventType,
    caseId,
    affectedCaseIds: parseAffectedCaseIds(firstDefined(event, ["affected_case_ids", "affectedCaseIds"])),
    simulationTick: asInteger(firstDefined(event, ["simulation_tick", "simulationTick"])) ?? null,
    details,
    createdAt,
  };
};

export const normalizeReasoningEventsResponse = (rawResponse: unknown): NormalizedReasoningEventsResponse => {
  const response = asRecord(rawResponse) ?? {};
  const candidates = [
    firstDefined(response, ["events", "items", "queue_events", "queueEvents"]),
    rawResponse,
  ];

  const events = candidates
    .flatMap((candidate) =>
      Array.isArray(candidate)
        ? candidate.map((item, index) => normalizeQueueEventRecord(item, index))
        : [],
    )
    .filter((event) => REASONING_EVENT_TYPES.has(event.eventType))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return { events };
};

export const normalizeDashboardSummaryResponse = (rawResponse: unknown): NormalizedDashboardSummary => {
  const queueSummary = normalizeQueueResponse(rawResponse).summary;
  const response = asRecord(rawResponse) ?? {};

  return {
    activeCount: asInteger(firstDefined(response, ["active_count", "activeCount"])) ?? queueSummary.activeCount,
    escalatedCount:
      asInteger(firstDefined(response, ["escalated_count", "escalatedCount"])) ?? queueSummary.escalatedCount,
    latestQueueVersion:
      asInteger(firstDefined(response, ["latest_queue_version", "latestQueueVersion"])) ??
      queueSummary.latestQueueVersion,
    currentTick:
      asInteger(firstDefined(response, ["current_tick", "currentTick"])) ?? queueSummary.currentTick,
  };
};

export const backendPathFromFrontendApiPath = (pathname: string) => {
  switch (pathname) {
    case "/api/queue":
      return "/queue";
    case "/api/reasoning-events":
      return "/reasoning-events";
    case "/api/dashboard-summary":
      return "/dashboard-summary";
    case "/api/human-decisions":
      return "/human-decisions";
    case "/api/simulation/run":
      return "/simulation/run";
    case "/api/simulation/status":
      return "/simulation/status";
    case "/api/simulation/stop":
      return "/simulation/stop";
    case "/api/simulation/reset":
      return "/simulation/reset";
    case "/api/simulation/speed":
      return "/simulation/speed";
    default:
      return null;
  }
};
