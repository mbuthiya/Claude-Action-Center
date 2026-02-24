"use client";

import { useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Task = {
  id: string;
  title: string;
  notes: string | null;
  project: string;
  status: string;
  due_date: string | null;
  snoozed_until: string | null;
  source: string;
  created_at: string;
  updated_at: string;
};

type Project = {
  id: string;
  name: string;
  task_count: number;
};

type Tab = "today" | "scheduled" | "completed";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().split("T")[0];
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function bucketTasks(tasks: Task[]) {
  const t = today();
  return {
    todayTasks: tasks.filter(
      (task) => task.status !== "done" && task.due_date !== null && task.due_date <= t
    ),
    scheduledTasks: tasks.filter(
      (task) =>
        task.status !== "done" &&
        (task.due_date === null || task.due_date > t)
    ),
    completedTasks: tasks.filter((task) => task.status === "done"),
  };
}

// ─── Checkbox ─────────────────────────────────────────────────────────────────

function Checkbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
        checked
          ? "bg-zinc-900 border-zinc-900"
          : "border-zinc-300 hover:border-zinc-500"
      }`}
      aria-label={checked ? "Mark as pending" : "Mark as done"}
    >
      {checked && (
        <svg
          viewBox="0 0 10 8"
          fill="none"
          className="w-2.5 h-2.5"
          stroke="white"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M1 4l2.5 2.5L9 1" />
        </svg>
      )}
    </button>
  );
}

// ─── Task Item ────────────────────────────────────────────────────────────────

function TaskItem({
  task,
  dateLabel,
  onCheck,
}: {
  task: Task;
  dateLabel: string;
  onCheck: (id: string) => void;
}) {
  const done = task.status === "done";

  return (
    <div className="flex items-start gap-2 py-3 border-b border-zinc-100 last:border-0">
      <Checkbox checked={done} onChange={() => onCheck(task.id)} />
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium leading-snug ${
            done ? "text-zinc-400 line-through" : "text-zinc-900"
          }`}
        >
          {task.title}
        </p>
        {task.notes && (
          <p className="text-xs text-zinc-400 mt-0.5 whitespace-pre-wrap leading-relaxed">
            {task.notes}
          </p>
        )}
        <p className="text-xs text-zinc-400 mt-0.5">{task.project}</p>
      </div>
      {dateLabel && (
        <span className="shrink-0 text-xs text-zinc-400 mt-0.5 ml-2">
          {dateLabel}
        </span>
      )}
    </div>
  );
}

// ─── Task List ────────────────────────────────────────────────────────────────

function TaskList({
  tasks,
  tab,
  onCheck,
}: {
  tasks: Task[];
  tab: Tab;
  onCheck: (id: string) => void;
}) {
  const emptyMessages: Record<Tab, string> = {
    today: "Nothing due today",
    scheduled: "No upcoming tasks",
    completed: "No completed tasks yet",
  };

  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-zinc-400">
        {emptyMessages[tab]}
      </div>
    );
  }

  return (
    <div>
      {tasks.map((task) => {
        let dateLabel = "";
        if (tab === "today" || tab === "scheduled") {
          dateLabel = formatDate(task.due_date);
        } else {
          dateLabel = formatDate(task.updated_at);
        }
        return (
          <TaskItem
            key={task.id}
            task={task}
            dateLabel={dateLabel}
            onCheck={onCheck}
          />
        );
      })}
    </div>
  );
}

// ─── Create Modal ─────────────────────────────────────────────────────────────

function CreateModal({
  projects,
  onClose,
  onCreated,
}: {
  projects: Project[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [project, setProject] = useState("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required"); return; }
    if (!project.trim()) { setError("Project is required"); return; }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          project: project.trim(),
          notes: notes.trim() || undefined,
          due_date: dueDate || undefined,
          source: "manual",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Something went wrong");
        return;
      }

      onCreated();
      onClose();
    } catch {
      setError("Could not reach the server");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-zinc-900">New task</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">
              Task <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs doing?"
              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">
              Project <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              list="projects-list"
              value={project}
              onChange={(e) => setProject(e.target.value)}
              placeholder="Which project?"
              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
            />
            <datalist id="projects-list">
              {projects.map((p) => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any context or links?"
              rows={3}
              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">
              Due date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? "Saving…" : "Save task"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "scheduled", label: "Scheduled" },
  { key: "completed", label: "Completed" },
];

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("today");
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  async function fetchAll() {
    const [tasksRes, projectsRes] = await Promise.all([
      fetch("/api/tasks"),
      fetch("/api/projects"),
    ]);
    if (tasksRes.ok) setTasks(await tasksRes.json());
    if (projectsRes.ok) setProjects(await projectsRes.json());
    setLoading(false);
  }

  useEffect(() => { fetchAll(); }, []);

  async function handleCheck(id: string) {
    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: "done" } : t))
    );

    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    });

    if (!res.ok) {
      // Revert on failure
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status: "pending" } : t))
      );
    }
  }

  const { todayTasks, scheduledTasks, completedTasks } = bucketTasks(tasks);

  const tabTasks: Record<Tab, Task[]> = {
    today: todayTasks,
    scheduled: scheduledTasks,
    completed: completedTasks,
  };

  const counts: Record<Tab, number> = {
    today: todayTasks.length,
    scheduled: scheduledTasks.length,
    completed: completedTasks.length,
  };

  return (
    <div className="min-h-screen bg-white font-sans">
      <div className="max-w-xl mx-auto px-4">

        {/* Header */}
        <div className="pt-12 pb-6">
          <h1 className="text-2xl font-semibold text-zinc-900">Action Center</h1>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-100">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === key
                  ? "border-zinc-900 text-zinc-900"
                  : "border-transparent text-zinc-400 hover:text-zinc-600"
              }`}
            >
              {label}
              {counts[key] > 0 && (
                <span
                  className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                    activeTab === key
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-100 text-zinc-500"
                  }`}
                >
                  {counts[key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Task list */}
        <div className="py-2">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-zinc-400">
              Loading…
            </div>
          ) : (
            <TaskList
              tasks={tabTasks[activeTab]}
              tab={activeTab}
              onCheck={handleCheck}
            />
          )}
        </div>

      </div>

      {/* FAB */}
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-zinc-900 text-white rounded-full shadow-lg hover:bg-zinc-700 flex items-center justify-center transition-colors"
        aria-label="Add task"
      >
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {/* Modal */}
      {modalOpen && (
        <CreateModal
          projects={projects}
          onClose={() => setModalOpen(false)}
          onCreated={fetchAll}
        />
      )}
    </div>
  );
}
