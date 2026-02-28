import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { errorResponse } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

const UNCATEGORISED = "Uncategorised";

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const { name } = body as Record<string, string | undefined>;

  if (!name || name.trim() === "") {
    return errorResponse("name is required", 400);
  }

  const existing = await db.project.findUnique({ where: { id } });
  if (!existing) return errorResponse("Project not found", 404);

  try {
    const [project] = await db.$transaction([
      db.project.update({ where: { id }, data: { name: name.trim() } }),
      db.task.updateMany({
        where: { project: existing.name },
        data: { project: name.trim() },
      }),
    ]);

    return Response.json(project);
  } catch (err) {
    if (
      err instanceof Error &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return errorResponse(`Project name "${name}" already exists`, 409);
    }
    return errorResponse("Failed to rename project", 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  const project = await db.project.findUnique({ where: { id } });
  if (!project) return errorResponse("Project not found", 404);

  try {
    await db.project.upsert({
      where: { name: UNCATEGORISED },
      update: {},
      create: { name: UNCATEGORISED },
    });

    await db.$transaction([
      db.task.updateMany({
        where: { project: project.name },
        data: { project: UNCATEGORISED },
      }),
      db.project.delete({ where: { id } }),
    ]);

    return new Response(null, { status: 204 });
  } catch {
    return errorResponse("Failed to delete project", 500);
  }
}
