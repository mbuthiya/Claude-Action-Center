"use client";

import { useEffect, useMemo, useState } from "react";

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

type TabKey = "upcoming" | "scheduled" | "completed" | "unscheduled";

type RowCtx =
  | "overdue"
  | "due-today"
  | "upcoming"
  | "scheduled"
  | "completed"
  | "unscheduled";

// ─── Date helpers ─────────────────────────────────────────────────────────────

function localDate(d: Date = new Date()): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function shiftDays(base: string, n: number): string {
  const [y, m, d] = base.split("-").map(Number);
  return localDate(new Date(y, m - 1, d + n));
}

function parseAsLocal(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// "Feb 25 2026" — no comma before year (section header dates)
function fmtSection(s: string): string {
  return parseAsLocal(s)
    .toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
    .replace(",", "");
}

// "Mar 10, 2025" — with comma (status label dates)
function fmtStatus(s: string): string {
  return parseAsLocal(s).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function datePart(iso: string): string {
  return iso.split("T")[0];
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function HelpIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="w-6 h-6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <circle cx="12" cy="17" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FunnelIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="w-4 h-4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="w-4 h-4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

// ─── Loading spinner ──────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <svg
        className="w-8 h-8 text-[#CD7253] animate-spin"
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
          className="opacity-25"
        />
        <path
          fill="currentColor"
          className="opacity-75"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function Empty({ message }: { message: string }) {
  return (
    <p className="text-center text-sm text-[#C2C0B6] py-12">{message}</p>
  );
}

// ─── Project pill ─────────────────────────────────────────────────────────────

function ProjectPill({ name }: { name: string }) {
  return (
    <span className="inline-block text-xs text-white rounded-full px-4 py-1 bg-[#30302E] mt-2">
      {name}
    </span>
  );
}

// ─── Checkbox ─────────────────────────────────────────────────────────────────

function Checkbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  const [pulsing, setPulsing] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        setPulsing(true);
        onChange();
      }}
      onAnimationEnd={() => setPulsing(false)}
      aria-label={checked ? "Mark as pending" : "Mark as done"}
      className={[
        "shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-colors mt-0.5",
        checked
          ? "bg-[#CD7253]"
          : "border-2 border-white/40 hover:border-white/60",
        pulsing ? "animate-checkbox-pulse" : "",
      ].join(" ")}
    >
      {checked && (
        <svg
          viewBox="0 0 10 8"
          fill="none"
          className="w-3 h-3"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M1 4l2.5 2.5L9 1" />
        </svg>
      )}
    </button>
  );
}

// ─── Task row ─────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  ctx,
  onToggle,
}: {
  task: Task;
  ctx: RowCtx;
  onToggle: (id: string) => void;
}) {
  const done = task.status === "done";

  let label = "";
  let labelClass = "text-[#CD7253]";

  if (ctx === "overdue") {
    label = `Overdue: ${task.due_date ? fmtStatus(task.due_date) : ""}`;
    labelClass = "text-red-400";
  } else if (
    ctx === "due-today" ||
    ctx === "upcoming" ||
    ctx === "scheduled"
  ) {
    label = `Due: ${task.due_date ? fmtStatus(task.due_date) : ""}`;
    labelClass = "text-[#CD7253]";
  } else if (ctx === "completed") {
    label = `Completed: ${fmtStatus(datePart(task.updated_at))}`;
    labelClass = "text-[#C2C0B6]";
  } else {
    label = "Unscheduled";
    labelClass = "text-[#CD7253]";
  }

  return (
    <div
      className={[
        "flex items-start gap-4 py-4 px-2 border-b border-white/10 hover:bg-white/5 cursor-pointer transition-colors",
      ].join(" ")}
    >
      <Checkbox checked={done} onChange={() => onToggle(task.id)} />
      <div className="flex-1 min-w-0">
        <p
          className={[
            "text-sm font-medium text-white leading-snug",
            done ? "line-through" : "",
          ].join(" ")}
        >
          {task.title}
        </p>
        {task.notes && (
          <p className="text-sm text-[#C2C0B6] mt-1 leading-relaxed line-clamp-2">
            {task.notes}
          </p>
        )}
        {task.project && <ProjectPill name={task.project} />}
      </div>
      <span
        className={`shrink-0 text-xs font-semibold mt-0.5 whitespace-nowrap ${labelClass}`}
      >
        {label}
      </span>
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHead({
  title,
  range,
}: {
  title: string;
  range?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-semibold italic text-[#C2C0B6]">{title}</h2>
      {range && (
        <span className="text-sm text-[#C2C0B6] italic">{range}</span>
      )}
    </div>
  );
}

// ─── Tab 1: Upcoming ≤7 days ──────────────────────────────────────────────────

function UpcomingTab({
  tasks,
  onToggle,
  today,
  todayPlus6,
}: {
  tasks: Task[];
  onToggle: (id: string) => void;
  today: string;
  todayPlus6: string;
}) {
  const overdue = tasks.filter(
    (t) => t.status !== "done" && t.due_date !== null && t.due_date < today
  );
  const dueToday = tasks.filter(
    (t) => t.status !== "done" && t.due_date === today
  );
  const upcoming = tasks.filter(
    (t) =>
      t.status !== "done" &&
      t.due_date !== null &&
      t.due_date > today &&
      t.due_date <= todayPlus6
  );

  return (
    <div className="space-y-8">
      {overdue.length > 0 && (
        <section>
          <SectionHead title="Overdue" range={fmtSection(today)} />
          {overdue.map((t) => (
            <TaskRow key={t.id} task={t} ctx="overdue" onToggle={onToggle} />
          ))}
        </section>
      )}

      <section>
        <SectionHead title="Due today" range={fmtSection(today)} />
        {dueToday.length === 0 ? (
          <Empty message="No tasks due today" />
        ) : (
          dueToday.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              ctx="due-today"
              onToggle={onToggle}
            />
          ))
        )}
      </section>

      <section>
        <SectionHead
          title="Upcoming"
          range={`${fmtSection(shiftDays(today, 1))} – ${fmtSection(todayPlus6)}`}
        />
        {upcoming.length === 0 ? (
          <Empty message="No upcoming tasks this week" />
        ) : (
          upcoming.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              ctx="upcoming"
              onToggle={onToggle}
            />
          ))
        )}
      </section>
    </div>
  );
}

// ─── Tab 2: Scheduled >7 days ─────────────────────────────────────────────────

function ScheduledTab({
  tasks,
  onToggle,
  todayPlus7,
}: {
  tasks: Task[];
  onToggle: (id: string) => void;
  todayPlus7: string;
}) {
  const [sort, setSort] = useState<"closest" | "furthest">("closest");

  const scheduled = useMemo(() => {
    const filtered = tasks.filter(
      (t) =>
        t.status !== "done" &&
        t.due_date !== null &&
        t.due_date > todayPlus7
    );
    return [...filtered].sort((a, b) => {
      const da = a.due_date ?? "";
      const db = b.due_date ?? "";
      return sort === "closest"
        ? da.localeCompare(db)
        : db.localeCompare(da);
    });
  }, [tasks, sort, todayPlus7]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold italic text-[#C2C0B6]">Scheduled</h2>
        <button
          onClick={() =>
            setSort((s) => (s === "closest" ? "furthest" : "closest"))
          }
          className="flex items-center gap-2 text-sm text-[#C2C0B6] hover:text-white transition-colors"
        >
          <FunnelIcon />
          <span>
            Sort due date: {sort === "closest" ? "Closest" : "Furthest"}
          </span>
        </button>
      </div>
      {scheduled.length === 0 ? (
        <Empty message="No scheduled tasks beyond 7 days" />
      ) : (
        scheduled.map((t) => (
          <TaskRow
            key={t.id}
            task={t}
            ctx="scheduled"
            onToggle={onToggle}
          />
        ))
      )}
    </div>
  );
}

// ─── Tab 3: Completed ─────────────────────────────────────────────────────────

function CompletedTab({
  tasks,
  onToggle,
}: {
  tasks: Task[];
  onToggle: (id: string) => void;
}) {
  const [dateFilter, setDateFilter] = useState("");

  const completedAll = tasks.filter((t) => t.status === "done");
  const filtered = dateFilter
    ? completedAll.filter((t) => datePart(t.updated_at) === dateFilter)
    : completedAll;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold italic text-[#C2C0B6]">Completed</h2>
        <div className="flex items-center">
          {dateFilter ? (
            <button
              onClick={() => setDateFilter("")}
              className="flex items-center gap-1.5 text-sm font-semibold text-[#CD7253] hover:opacity-80 transition-opacity"
            >
              {fmtStatus(dateFilter)}
              <span className="text-base leading-none">✕</span>
            </button>
          ) : (
            <label className="flex items-center gap-2 text-sm text-[#C2C0B6] hover:text-white cursor-pointer transition-colors">
              <CalendarIcon />
              <span>Select date</span>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="sr-only"
              />
            </label>
          )}
        </div>
      </div>
      {filtered.length === 0 ? (
        <Empty
          message={
            dateFilter
              ? "No tasks completed on this date"
              : "No completed tasks"
          }
        />
      ) : (
        filtered.map((t) => (
          <TaskRow
            key={t.id}
            task={t}
            ctx="completed"
            onToggle={onToggle}
          />
        ))
      )}
    </div>
  );
}

// ─── Tab 4: Unscheduled ───────────────────────────────────────────────────────

function UnscheduledTab({
  tasks,
  onToggle,
}: {
  tasks: Task[];
  onToggle: (id: string) => void;
}) {
  const unscheduled = tasks.filter(
    (t) => t.status !== "done" && !t.due_date
  );

  return (
    <div>
      <h2 className="text-lg font-semibold italic text-[#C2C0B6] mb-4">
        Unscheduled
      </h2>
      {unscheduled.length === 0 ? (
        <Empty message="All tasks have due dates set ✓" />
      ) : (
        unscheduled.map((t) => (
          <TaskRow
            key={t.id}
            task={t}
            ctx="unscheduled"
            onToggle={onToggle}
          />
        ))
      )}
    </div>
  );
}

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS: { key: TabKey; label: string }[] = [
  { key: "upcoming", label: "Upcoming ≤7 days" },
  { key: "scheduled", label: "Scheduled >7 days" },
  { key: "completed", label: "Completed" },
  { key: "unscheduled", label: "Unscheduled" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("upcoming");
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const today = useMemo(() => localDate(), []);
  const todayPlus6 = useMemo(() => shiftDays(today, 6), [today]);
  const todayPlus7 = useMemo(() => shiftDays(today, 7), [today]);

  async function fetchAll() {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch("/api/tasks");
      if (!res.ok) throw new Error("Failed to fetch");
      setTasks(await res.json());
    } catch {
      setFetchError("Could not load tasks. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleToggle(id: string) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    const newStatus = task.status === "done" ? "pending" : "done";

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, status: newStatus, updated_at: new Date().toISOString() }
          : t
      )
    );

    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const updated: Task = await res.json();
        setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
      } else {
        // Revert
        setTasks((prev) => prev.map((t) => (t.id === id ? task : t)));
      }
    } catch {
      // Revert on network error
      setTasks((prev) => prev.map((t) => (t.id === id ? task : t)));
    }
  }

  return (
    <div className="min-h-screen bg-[#262624] p-10">

      {/* ── Header — full width ── */}
      <div className="flex items-start justify-between pb-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-white">
            Claude Action Center
          </h1>
          <p className="text-base text-[#C2C0B6]">
            Manage your action items across multiple Claude code projects
          </p>
        </div>
        <div className="flex items-center gap-2 text-[#CD7253] shrink-0 ml-8 mt-1">
          <HelpIcon />
          <span className="text-base font-semibold whitespace-nowrap">
            How does it work
          </span>
        </div>
      </div>

      {/* ── Constrained content area ── */}
      <div className="w-1/2">

        {/* ── Tab navigation ── */}
        <div className="border-b border-white/10">
          <div className="flex w-full">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={[
                  "flex-1 text-center py-3 text-base font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap cursor-pointer",
                  activeTab === key
                    ? "text-[#CD7253] border-[#CD7253]"
                    : "text-[#C2C0B6] border-transparent hover:text-white",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab content ── */}
        <div className="mt-8">
          {loading ? (
            <Spinner />
          ) : fetchError ? (
            <div className="flex flex-col items-center gap-4 py-12">
              <p className="text-sm text-[#C2C0B6]">{fetchError}</p>
              <button
                onClick={fetchAll}
                className="text-sm font-semibold text-[#CD7253] hover:underline"
              >
                Try again
              </button>
            </div>
          ) : (
            <div key={activeTab} className="animate-fade-in">
              {activeTab === "upcoming" && (
                <UpcomingTab
                  tasks={tasks}
                  onToggle={handleToggle}
                  today={today}
                  todayPlus6={todayPlus6}
                />
              )}
              {activeTab === "scheduled" && (
                <ScheduledTab
                  tasks={tasks}
                  onToggle={handleToggle}
                  todayPlus7={todayPlus7}
                />
              )}
              {activeTab === "completed" && (
                <CompletedTab tasks={tasks} onToggle={handleToggle} />
              )}
              {activeTab === "unscheduled" && (
                <UnscheduledTab tasks={tasks} onToggle={handleToggle} />
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
