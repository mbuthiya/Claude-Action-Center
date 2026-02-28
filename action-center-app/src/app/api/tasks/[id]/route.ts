import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { errorResponse, resolveSnooze, VALID_STATUSES } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

function isPrismaNotFound(err: unknown): boolean {
  return (
    err instanceof Error &&
    "code" in err &&
    (err as { code: string }).code === "P2025"
  );
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  try {
    const task = await db.task.findUnique({ where: { id } });
    if (!task) return errorResponse("Task not found", 404);
    return Response.json(resolveSnooze(task));
  } catch {
    return errorResponse("Failed to retrieve task", 500);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const { title, notes, project, status, due_date, snoozed_until } =
    body as Record<string, string | undefined>;

  if (status !== undefined && !VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
    return errorResponse(
      `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
      400
    );
  }

  if (project) {
    await db.project.upsert({
      where: { name: project },
      update: {},
      create: { name: project },
    });
  }

  try {
    const task = await db.task.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(project !== undefined ? { project } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(due_date !== undefined ? { due_date } : {}),
        ...(snoozed_until !== undefined ? { snoozed_until } : {}),
      },
    });
    return Response.json(resolveSnooze(task));
  } catch (err) {
    if (isPrismaNotFound(err)) return errorResponse("Task not found", 404);
    return errorResponse("Failed to update task", 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  try {
    await db.task.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (err) {
    if (isPrismaNotFound(err)) return errorResponse("Task not found", 404);
    return errorResponse("Failed to delete task", 500);
  }
}
