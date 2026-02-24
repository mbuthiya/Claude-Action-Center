import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { errorResponse, resolveSnooze } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const project = searchParams.get("project");
  const status = searchParams.get("status");

  try {
    const tasks = await db.task.findMany({
      where: {
        ...(project ? { project } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { created_at: "desc" },
    });

    return Response.json(tasks.map(resolveSnooze));
  } catch {
    return errorResponse("Failed to retrieve tasks", 500);
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const { title, project, notes, due_date, source } = body as Record<
    string,
    string | undefined
  >;

  if (!title || title.trim() === "") {
    return errorResponse("title is required", 400);
  }
  if (!project || project.trim() === "") {
    return errorResponse("project is required", 400);
  }

  try {
    await db.project.upsert({
      where: { name: project.trim() },
      update: {},
      create: { name: project.trim() },
    });

    const task = await db.task.create({
      data: {
        title: title.trim(),
        project: project.trim(),
        notes: notes ?? null,
        due_date: due_date ?? null,
        source: source === "claude" ? "claude" : "manual",
      },
    });

    return Response.json(task, { status: 201 });
  } catch {
    return errorResponse("Failed to create task", 500);
  }
}
