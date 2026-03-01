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

// ─── Reschedule tooltip ───────────────────────────────────────────────────────

function RescheduleTooltip({
  currentDate,
  labelText,
  buttonText,
  onReschedule,
}: {
  currentDate: string | null;
  labelText: string;
  buttonText: string;
  onReschedule: (newDate: string) => void;
}) {
  const [newDate, setNewDate] = useState(currentDate ?? "");

  return (
    <div
      className="absolute left-[calc(100%+8px)] top-0 z-50 rounded-xl flex flex-col gap-4"
      style={{
        width: 328,
        backgroundColor: "#262624",
        padding: "24px 16px",
        boxShadow: "0 0 20px rgba(255,255,255,0.08)",
      }}
    >
      <div className="flex flex-col gap-2">
        <label style={{ fontSize: 14, color: "#ffffff" }}>
          {labelText}
        </label>
        <input
          type="date"
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
          className="w-full rounded-lg px-3 py-2 outline-none border border-white/10"
          style={{
            backgroundColor: "#30302E",
            color: "#ffffff",
            fontSize: 16,
            colorScheme: "dark",
          }}
        />
      </div>
      <button
        onClick={() => {
          if (newDate) onReschedule(newDate);
        }}
        className="w-full py-3 rounded-full text-white transition-opacity hover:opacity-90 cursor-pointer"
        style={{ backgroundColor: "#CD7253", fontSize: 16, fontWeight: 500 }}
      >
        {buttonText}
      </button>
    </div>
  );
}

// ─── Reschedule toast ─────────────────────────────────────────────────────────

function RescheduleToast({ message }: { message: string }) {
  return (
    <div
      className="fixed top-6 right-6 z-50 text-white text-sm rounded-lg animate-fade-in"
      style={{
        backgroundColor: "#30302E",
        padding: "8px 24px",
      }}
    >
      {message}
    </div>
  );
}

// ─── Task row ─────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  ctx,
  onToggle,
  onReschedule,
  onReopen,
}: {
  task: Task;
  ctx: RowCtx;
  onToggle: (id: string) => void;
  onReschedule: (id: string, newDate: string) => void;
  onReopen?: (id: string, newDate: string) => void;
}) {
  const done = task.status === "done";
  const [tooltipOpen, setTooltipOpen] = useState(false);

  function handleCheckboxClick() {
    if (done && onReopen) {
      setTooltipOpen(true);
    } else {
      onToggle(task.id);
    }
  }

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

  const canReschedule = ctx !== "completed";

  return (
    <div
      className={[
        "flex items-start gap-4 py-4 px-2 hover:bg-white/10 hover:rounded-lg cursor-pointer transition-all",
      ].join(" ")}
    >
      <Checkbox checked={done} onChange={handleCheckboxClick} />
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

      {/* Due date label — clickable to open reschedule tooltip */}
      <div className="relative shrink-0 mt-0.5">
        <span
          className={`text-xs font-semibold whitespace-nowrap ${labelClass} ${canReschedule ? "cursor-pointer" : ""}`}
          onClick={canReschedule ? () => setTooltipOpen(true) : undefined}
        >
          {label}
        </span>

        {tooltipOpen && (
          <>
            {/* Invisible backdrop to close tooltip on outside click */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setTooltipOpen(false)}
            />
            {done ? (
              <RescheduleTooltip
                currentDate={task.due_date}
                labelText="Set new due date"
                buttonText="Reopen task"
                onReschedule={(newDate) => {
                  onReopen!(task.id, newDate);
                  setTooltipOpen(false);
                }}
              />
            ) : (
              <RescheduleTooltip
                currentDate={task.due_date}
                labelText={ctx === "unscheduled" ? "Set due date" : "Update due date"}
                buttonText={ctx === "unscheduled" ? "Schedule task" : "Reschedule task"}
                onReschedule={(newDate) => {
                  onReschedule(task.id, newDate);
                  setTooltipOpen(false);
                }}
              />
            )}
          </>
        )}
      </div>
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
  onReschedule,
  today,
  todayPlus6,
}: {
  tasks: Task[];
  onToggle: (id: string) => void;
  onReschedule: (id: string, newDate: string) => void;
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
            <TaskRow
              key={t.id}
              task={t}
              ctx="overdue"
              onToggle={onToggle}
              onReschedule={onReschedule}
            />
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
              onReschedule={onReschedule}
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
              onReschedule={onReschedule}
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
  onReschedule,
  todayPlus7,
}: {
  tasks: Task[];
  onToggle: (id: string) => void;
  onReschedule: (id: string, newDate: string) => void;
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
          className="flex items-center gap-2 text-sm text-[#C2C0B6] hover:text-white transition-colors cursor-pointer"
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
            onReschedule={onReschedule}
          />
        ))
      )}
    </div>
  );
}

// ─── Date filter tooltip ─────────────────────────────────────────────────────

function DateFilterTooltip({ onApply }: { onApply: (date: string) => void }) {
  const [selectedDate, setSelectedDate] = useState("");

  return (
    <div
      className="absolute left-[calc(100%+8px)] top-0 z-50 rounded-xl flex flex-col gap-4"
      style={{
        width: 328,
        backgroundColor: "#262624",
        padding: "24px 16px",
        boxShadow: "0 0 20px rgba(255,255,255,0.08)",
      }}
    >
      <div className="flex flex-col gap-2">
        <label style={{ fontSize: 14, color: "#ffffff" }}>
          Filter by date
        </label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-full rounded-lg px-3 py-2 outline-none border border-white/10"
          style={{
            backgroundColor: "#30302E",
            color: "#ffffff",
            fontSize: 16,
            colorScheme: "dark",
          }}
        />
      </div>
      <button
        onClick={() => { if (selectedDate) onApply(selectedDate); }}
        className="w-full py-3 rounded-full text-white transition-opacity hover:opacity-90 cursor-pointer"
        style={{ backgroundColor: "#CD7253", fontSize: 16, fontWeight: 500 }}
      >
        Apply filter
      </button>
    </div>
  );
}

// ─── Tab 3: Completed ─────────────────────────────────────────────────────────

function CompletedTab({
  tasks,
  onToggle,
  onReschedule,
  onReopen,
}: {
  tasks: Task[];
  onToggle: (id: string) => void;
  onReschedule: (id: string, newDate: string) => void;
  onReopen: (id: string, newDate: string) => void;
}) {
  const [dateFilter, setDateFilter] = useState("");
  const [filterTooltipOpen, setFilterTooltipOpen] = useState(false);

  const completedAll = tasks.filter((t) => t.status === "done");
  const filtered = dateFilter
    ? completedAll.filter((t) => datePart(t.updated_at) === dateFilter)
    : completedAll;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold italic text-[#C2C0B6]">Completed</h2>
        <div className="relative flex items-center">
          {dateFilter ? (
            <button
              onClick={() => setDateFilter("")}
              className="flex items-center gap-1.5 text-sm font-semibold text-[#CD7253] hover:opacity-80 transition-opacity cursor-pointer"
            >
              {fmtStatus(dateFilter)}
              <span className="text-base leading-none">✕</span>
            </button>
          ) : (
            <button
              onClick={() => setFilterTooltipOpen(true)}
              className="flex items-center gap-2 text-sm text-[#C2C0B6] hover:text-white transition-colors cursor-pointer"
            >
              <CalendarIcon />
              <span>Select date</span>
            </button>
          )}
          {filterTooltipOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setFilterTooltipOpen(false)}
              />
              <DateFilterTooltip
                onApply={(date) => {
                  setDateFilter(date);
                  setFilterTooltipOpen(false);
                }}
              />
            </>
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
            onReschedule={onReschedule}
            onReopen={onReopen}
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
  onReschedule,
}: {
  tasks: Task[];
  onToggle: (id: string) => void;
  onReschedule: (id: string, newDate: string) => void;
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
            onReschedule={onReschedule}
          />
        ))
      )}
    </div>
  );
}

// ─── Activity heatmap ─────────────────────────────────────────────────────────

const HEATMAP_DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const HEATMAP_MIN_YEAR = 2026;
const HEATMAP_MIN_MONTH = 2;

function getActivityColor(count: number): string {
  if (count === 0) return "#30302E";
  if (count < 5) return "rgba(205, 114, 83, 0.2)";
  if (count < 10) return "rgba(205, 114, 83, 0.6)";
  return "#CD7253";
}

function ActivityHeatmap({ tasks }: { tasks: Task[] }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const completions = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of tasks) {
      if (t.status === "done") {
        const day = datePart(t.updated_at);
        map[day] = (map[day] ?? 0) + 1;
      }
    }
    return map;
  }, [tasks]);

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();

  const nowNow = new Date();
  const atMin = year === HEATMAP_MIN_YEAR && month === HEATMAP_MIN_MONTH;
  const atMax = year === nowNow.getFullYear() && month === nowNow.getMonth() + 1;

  function goPrev() {
    if (atMin) return;
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  }

  function goNext() {
    if (atMax) return;
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  }

  const monthLabel = new Date(year, month - 1).toLocaleString("en-US", { month: "long" });

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div>
      <p className="text-xs font-semibold text-[#C2C0B6] uppercase tracking-widest mb-5">
        Activity
      </p>

      {/* Month/year navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={goPrev}
          disabled={atMin}
          className={`text-xl leading-none transition-colors ${atMin ? "text-white/20 cursor-default" : "text-[#C2C0B6] hover:text-white cursor-pointer"}`}
        >
          ‹
        </button>
        <span className="text-sm font-semibold text-[#C2C0B6]">
          {monthLabel} {year}
        </span>
        <button
          onClick={goNext}
          disabled={atMax}
          className={`text-xl leading-none transition-colors ${atMax ? "text-white/20 cursor-default" : "text-[#C2C0B6] hover:text-white cursor-pointer"}`}
        >
          ›
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {HEATMAP_DAY_LABELS.map((d, i) => (
          <div key={i} className="text-[10px] text-white/30 text-center">
            {d}
          </div>
        ))}
      </div>

      {/* Day squares */}
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const count = completions[dateStr] ?? 0;
          return (
            <div
              key={i}
              className="w-8 h-8 rounded-sm flex items-center justify-center"
              title={`${dateStr}: ${count} task${count !== 1 ? "s" : ""} completed`}
              style={{ backgroundColor: getActivityColor(count) }}
            >
              <span className="text-[10px] text-white/50">{d}</span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 mt-4">
        <span className="text-[10px] text-white/30">Less</span>
        {[0, 2, 6, 11].map((v, i) => (
          <div
            key={i}
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: getActivityColor(v) }}
          />
        ))}
        <span className="text-[10px] text-white/30">More</span>
      </div>
    </div>
  );
}

// ─── How it works modal ───────────────────────────────────────────────────────

function HowItWorksModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Panel */}
      <div
        className="relative w-full max-w-lg rounded-2xl overflow-y-auto max-h-[90vh]"
        style={{ backgroundColor: "#1E1E1C", padding: "32px 28px" }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white/60 hover:bg-white/20 transition-colors cursor-pointer text-lg leading-none"
        >
          ×
        </button>

        <h2 className="text-xl font-semibold text-white mb-1">
          How it works
        </h2>
        <p className="text-sm text-[#C2C0B6] mb-8">
          Claude Action Center connects your Claude Code conversations to a visual task manager.
        </p>

        {/* Step 1 */}
        <div className="mb-7">
          <div className="flex items-center gap-3 mb-3">
            <span className="w-7 h-7 rounded-full bg-[#CD7253] flex items-center justify-center text-white text-xs font-bold shrink-0">
              1
            </span>
            <h3 className="text-base font-semibold text-white">
              Add tasks from Claude Code
            </h3>
          </div>
          <p className="text-sm text-[#C2C0B6] leading-relaxed mb-3 ml-10">
            While working in any Claude Code project, ask Claude to add a task. Claude will generate a clear title, meaningful notes, and confirm a due date before saving.
          </p>
          <div
            className="ml-10 rounded-lg px-4 py-3 text-sm font-mono text-[#C2C0B6]"
            style={{ backgroundColor: "#30302E" }}
          >
            <span className="text-[#CD7253]">You: </span>
            <span className="text-white/80">&quot;Add a task to investigate the onboarding drop-off bug&quot;</span>
            <br />
            <span className="text-[#CD7253]">Claude: </span>
            <span className="text-white/60">Confirms title, notes, due date → saves to Action Center</span>
          </div>
        </div>

        {/* Step 2 */}
        <div className="mb-7">
          <div className="flex items-center gap-3 mb-3">
            <span className="w-7 h-7 rounded-full bg-[#CD7253] flex items-center justify-center text-white text-xs font-bold shrink-0">
              2
            </span>
            <h3 className="text-base font-semibold text-white">
              Manage tasks visually here
            </h3>
          </div>
          <p className="text-sm text-[#C2C0B6] leading-relaxed ml-10 mb-3">
            The Action Center organises your tasks across four views:
          </p>
          <div className="ml-10 flex flex-col gap-2.5">
            {[
              { label: "Upcoming ≤7 days", desc: "Overdue, due today, and tasks due within the week — your daily focus." },
              { label: "Scheduled >7 days", desc: "Everything planned further out. Sort by closest or furthest due date." },
              { label: "Completed", desc: "All finished tasks. Filter by completion date to review any day." },
              { label: "Unscheduled", desc: "Tasks without a due date. Click the label to schedule them quickly." },
            ].map(({ label, desc }) => (
              <div key={label} className="flex gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-[#CD7253] mt-2 shrink-0" />
                <p className="text-sm text-[#C2C0B6] leading-relaxed">
                  <span className="text-white font-medium">{label}</span> — {desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Step 3 */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="w-7 h-7 rounded-full bg-[#CD7253] flex items-center justify-center text-white text-xs font-bold shrink-0">
              3
            </span>
            <h3 className="text-base font-semibold text-white">
              Quick actions on every task
            </h3>
          </div>
          <div className="ml-10 flex flex-col gap-2.5">
            {[
              { action: "Check the circle", desc: "Mark a task done. A completion is recorded on the activity heatmap." },
              { action: "Click the due date", desc: "Open a reschedule picker to move the task to any date." },
              { action: "Click a completed task's circle", desc: "Reopen it with a new due date — it lands back in the right tab." },
              { action: "Click Unscheduled", desc: "Set a due date inline so the task moves into your scheduled views." },
            ].map(({ action, desc }) => (
              <div key={action} className="flex gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-[#CD7253] mt-2 shrink-0" />
                <p className="text-sm text-[#C2C0B6] leading-relaxed">
                  <span className="text-white font-medium">{action}</span> — {desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-full text-white font-semibold text-sm cursor-pointer hover:opacity-90 transition-opacity"
          style={{ backgroundColor: "#CD7253" }}
        >
          Got it
        </button>
      </div>
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
  const [toast, setToast] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

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

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, [toast]);

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

  async function handleReopen(id: string, newDate: string) {
    // Optimistic update: mark as pending with new due date
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, status: "pending", due_date: newDate, updated_at: new Date().toISOString() }
          : t
      )
    );
    setToast("Task reopened and rescheduled");

    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pending", due_date: newDate }),
      });
      if (res.ok) {
        const updated: Task = await res.json();
        setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
      }
    } catch {
      // Keep optimistic state; toast already shown
    }
  }

  async function handleReschedule(id: string, newDate: string) {
    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, due_date: newDate } : t))
    );
    setToast("Task rescheduled");

    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ due_date: newDate }),
      });
      if (res.ok) {
        const updated: Task = await res.json();
        setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
      }
    } catch {
      // Keep optimistic state; toast already shown
    }
  }

  return (
    <div className="min-h-screen bg-[#262624] p-10">

      {toast && <RescheduleToast message={toast} />}
      {showHelp && <HowItWorksModal onClose={() => setShowHelp(false)} />}

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
        <button
          onClick={() => setShowHelp(true)}
          className="flex items-center gap-2 text-[#CD7253] shrink-0 ml-8 mt-1 cursor-pointer hover:opacity-80 transition-opacity"
        >
          <HelpIcon />
          <span className="text-base font-semibold whitespace-nowrap">
            How does it work
          </span>
        </button>
      </div>

      {/* ── Main content area ── */}
      <div className="flex items-start gap-16">

        <div className="w-1/2 shrink-0">

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
                  onReschedule={handleReschedule}
                  today={today}
                  todayPlus6={todayPlus6}
                />
              )}
              {activeTab === "scheduled" && (
                <ScheduledTab
                  tasks={tasks}
                  onToggle={handleToggle}
                  onReschedule={handleReschedule}
                  todayPlus7={todayPlus7}
                />
              )}
              {activeTab === "completed" && (
                <CompletedTab
                  tasks={tasks}
                  onToggle={handleToggle}
                  onReschedule={handleReschedule}
                  onReopen={handleReopen}
                />
              )}
              {activeTab === "unscheduled" && (
                <UnscheduledTab
                  tasks={tasks}
                  onToggle={handleToggle}
                  onReschedule={handleReschedule}
                />
              )}
            </div>
          )}
        </div>

        </div>

        {/* ── Activity heatmap ── */}
        <div className="ml-auto pt-14 w-[400px] shrink-0">
          <ActivityHeatmap tasks={tasks} />
        </div>

      </div>
    </div>
  );
}
