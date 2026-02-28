export function errorResponse(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

export const VALID_STATUSES = [
  "pending",
  "in_progress",
  "done",
  "snoozed",
] as const;

export type TaskStatus = (typeof VALID_STATUSES)[number];

export function resolveSnooze<T extends {
  status: string;
  snoozed_until: string | null;
}>(task: T): T {
  if (
    task.status === "snoozed" &&
    task.snoozed_until !== null &&
    task.snoozed_until < new Date().toISOString().split("T")[0]
  ) {
    return { ...task, status: "pending" };
  }
  return task;
}
