"use client";

interface HeaderProps {
  filter: "all" | "sun" | "shade";
  onFilterChange: (filter: "all" | "sun" | "shade") => void;
  sunCount: number;
  totalCount: number;
}

export default function Header({
  filter,
  onFilterChange,
  sunCount,
  totalCount,
}: HeaderProps) {
  return (
    <div className="absolute top-0 left-0 right-0 z-[1000] pointer-events-none">
      <div className="flex items-start justify-between p-4">
        {/* Logo & stats */}
        <div className="pointer-events-auto bg-white/95 backdrop-blur-md rounded-2xl shadow-lg px-5 py-3">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Soldryck
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {sunCount} av {totalCount} har sol just nu
          </p>
        </div>

        {/* Filter buttons */}
        <div className="pointer-events-auto bg-white/95 backdrop-blur-md rounded-2xl shadow-lg p-1.5 flex gap-1">
          {(["all", "sun", "shade"] as const).map((f) => (
            <button
              key={f}
              onClick={() => onFilterChange(f)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                filter === f
                  ? f === "sun"
                    ? "bg-amber-500 text-white"
                    : f === "shade"
                    ? "bg-slate-500 text-white"
                    : "bg-slate-900 text-white"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              {f === "all" ? "Alla" : f === "sun" ? "Sol" : "Skugga"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
