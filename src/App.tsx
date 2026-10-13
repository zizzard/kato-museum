import { useEffect, useMemo, useState } from "react";
import CraftCard from "./CraftCard";
import type { Craft, Dataset, Finish, Sort } from "./types";

const PAGE_SIZE = 60;

const SORT_OPTIONS: { value: Sort; label: string }[] = [
  { value: "float_asc", label: "Lowest float" },
  { value: "float_desc", label: "Highest float" },
  { value: "updated_desc", label: "Recently updated" },
  { value: "updated_asc", label: "Least recently updated" },
];

interface Filters {
  finish: Finish;
  team: string | null;
  query: string;
  sort: Sort;
  page: number;
}

const DEFAULT_FILTERS: Filters = {
  finish: "holo",
  team: null,
  query: "",
  sort: "float_asc",
  page: 1,
};

function readFilters(): Filters {
  const params = new URLSearchParams(window.location.search);
  const sort = params.get("sort") as Sort | null;
  const page = Number.parseInt(params.get("page") ?? "", 10);
  return {
    finish: params.get("finish") === "paper" ? "paper" : "holo",
    team: params.get("team"),
    query: params.get("q") ?? "",
    sort: SORT_OPTIONS.some((o) => o.value === sort) ? sort! : "float_asc",
    page: page > 0 ? page : 1,
  };
}

function writeFilters(filters: Filters) {
  const params = new URLSearchParams();
  if (filters.finish !== "holo") params.set("finish", filters.finish);
  if (filters.team) params.set("team", filters.team);
  if (filters.query) params.set("q", filters.query);
  if (filters.sort !== "float_asc") params.set("sort", filters.sort);
  if (filters.page > 1) params.set("page", String(filters.page));
  const search = params.toString();
  window.history.replaceState(null, "", search ? `?${search}` : window.location.pathname);
}

const datasetCache = new Map<Finish, Promise<Dataset>>();

function loadDataset(finish: Finish): Promise<Dataset> {
  let promise = datasetCache.get(finish);
  if (!promise) {
    promise = fetch(`${import.meta.env.BASE_URL}data/${finish}.json`).then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<Dataset>;
    });
    promise.catch(() => datasetCache.delete(finish));
    datasetCache.set(finish, promise);
  }
  return promise;
}

function updatedTime(craft: Craft): number {
  const time = craft.updated ? Date.parse(craft.updated) : Number.NaN;
  return Number.isNaN(time) ? 0 : time;
}

function sortCrafts(crafts: Craft[], sort: Sort): Craft[] {
  const float = (c: Craft) => c.float ?? Number.POSITIVE_INFINITY;
  return [...crafts].sort((a, b) => {
    switch (sort) {
      case "float_desc":
        return (b.float ?? -1) - (a.float ?? -1);
      case "updated_desc":
        return updatedTime(b) - updatedTime(a);
      case "updated_asc":
        return updatedTime(a) - updatedTime(b);
      default:
        return float(a) - float(b);
    }
  });
}

export default function App() {
  const [filters, setFilters] = useState<Filters>(readFilters);
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => writeFilters(filters), [filters]);

  useEffect(() => {
    let cancelled = false;
    setDataset(null);
    setError(null);
    loadDataset(filters.finish).then(
      (data) => !cancelled && setDataset(data),
      (err: Error) => !cancelled && setError(err.message),
    );
    return () => {
      cancelled = true;
    };
  }, [filters.finish]);

  const update = (patch: Partial<Filters>) =>
    setFilters((prev) => ({ ...prev, page: 1, ...patch }));

  const results = useMemo(() => {
    if (!dataset) return [];
    const query = filters.query.trim().toLowerCase();
    const matching = dataset.crafts.filter((craft) => {
      if (filters.team && craft.team !== filters.team) return false;
      if (!query) return true;
      return [craft.title, craft.wear, craft.seed, craft.statTrak ? "stattrak" : ""]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
    return sortCrafts(matching, filters.sort);
  }, [dataset, filters.team, filters.query, filters.sort]);

  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const page = Math.min(filters.page, totalPages);
  const pageCrafts = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const teamsById = useMemo(
    () => new Map(dataset?.teams.map((t) => [t.id, t]) ?? []),
    [dataset],
  );

  const goToPage = (next: number) => {
    setFilters((prev) => ({ ...prev, page: next }));
    window.scrollTo({ top: 0 });
  };

  const isFiltered = filters.team !== null || filters.query !== "" || filters.finish !== "holo";

  return (
    <div className="layout">
      <aside className="sidebar">
        <section className="filter-section">
          <h3 className="filter-title">Search</h3>
          <input
            className="filter-input"
            type="search"
            placeholder="Weapon or skin"
            value={filters.query}
            onChange={(e) => update({ query: e.target.value })}
          />
        </section>

        <section className="filter-section">
          <h3 className="filter-title">Finish</h3>
          <div className="segmented">
            {(["holo", "paper"] as const).map((finish) => (
              <button
                key={finish}
                type="button"
                className={`chip${filters.finish === finish ? " chip--active" : ""}`}
                onClick={() => update({ finish })}
              >
                {finish === "holo" ? "Holo" : "Paper"}
              </button>
            ))}
          </div>
        </section>

        <section className="filter-section">
          <h3 className="filter-title">Sticker</h3>
          <button
            type="button"
            className={`chip chip--wide${filters.team === null ? " chip--active" : ""}`}
            onClick={() => update({ team: null })}
          >
            All
          </button>
          <div className="team-grid">
            {dataset?.teams.map((team) => (
              <button
                key={team.id}
                type="button"
                title={team.label}
                aria-label={team.label}
                aria-pressed={filters.team === team.id}
                className={`team-button${filters.team === team.id ? " team-button--active" : ""}`}
                onClick={() => update({ team: filters.team === team.id ? null : team.id })}
              >
                {team.image ? <img src={team.image} alt="" /> : team.label}
              </button>
            ))}
          </div>
        </section>

        <button
          type="button"
          className="chip chip--wide reset"
          disabled={!isFiltered}
          onClick={() => setFilters({ ...DEFAULT_FILTERS, sort: filters.sort })}
        >
          Reset all filters
        </button>
      </aside>

      <main className="content">
        <div className="toolbar">
          <select
            className="sort-select"
            value={filters.sort}
            onChange={(e) => update({ sort: e.target.value as Sort })}
            aria-label="Sort"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {error ? (
          <p className="notice">Couldn't load the museum ({error}). Try refreshing.</p>
        ) : !dataset ? (
          <p className="notice">Loading…</p>
        ) : pageCrafts.length === 0 ? (
          <p className="notice">No crafts match these filters.</p>
        ) : (
          <div className="grid">
            {pageCrafts.map((craft, index) => (
              <CraftCard
                key={`${craft.rank}-${craft.title}-${craft.seed}-${index}`}
                craft={craft}
                teamLabel={teamsById.get(craft.team)?.label ?? craft.team}
                stickerImages={dataset.stickerImages}
              />
            ))}
          </div>
        )}

        {dataset && results.length > 0 ? (
          <nav className="pagination" aria-label="Pages">
            <button
              type="button"
              className="page-button"
              disabled={page <= 1}
              onClick={() => goToPage(page - 1)}
            >
              Previous
            </button>
            <span className="page-status">
              Page {page} of {totalPages} ({results.length.toLocaleString()} crafts)
            </span>
            <button
              type="button"
              className="page-button"
              disabled={page >= totalPages}
              onClick={() => goToPage(page + 1)}
            >
              Next
            </button>
          </nav>
        ) : null}

        {dataset ? (
          <footer className="footer">
            Data from{" "}
            <a href="https://skinsales.gg/museum" target="_blank" rel="noopener noreferrer">
              skinsales.gg
            </a>{" "}
            · updated {new Date(dataset.generated_at).toLocaleDateString()}
          </footer>
        ) : null}
      </main>
    </div>
  );
}
