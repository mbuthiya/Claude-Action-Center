import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { errorResponse } from "@/lib/api-helpers";

export async function GET() {
  try {
    const projects = await db.project.findMany({ orderBy: { name: "asc" } });

    const taskCounts = await db.task.groupBy({
      by: ["project"],
      _count: { id: true },
    });

    const countMap = new Map(
      taskCounts.map((row) => [row.project, row._count.id])
    );

    return Response.json(
      projects.map((p) => ({
        id: p.id,
        name: p.name,
        task_count: countMap.get(p.name) ?? 0,
      }))
    );
  } catch {
    return errorResponse("Failed to retrieve projects", 500);
  }
}

export async function POST(request: NextRequest) {
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

  try {
    const project = await db.project.create({ data: { name: name.trim() } });
    return Response.json(project, { status: 201 });
  } catch (err) {
    if (
      err instanceof Error &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return errorResponse(`Project "${name}" already exists`, 409);
    }
    return errorResponse("Failed to create project", 500);
  }
}
