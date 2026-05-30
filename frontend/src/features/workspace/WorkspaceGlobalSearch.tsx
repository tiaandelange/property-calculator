import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { Search } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { searchWorkspace } from "../../services/workspaceSearchSupabase";
import { queryKeys } from "../../lib/queryKeys";
import { useWorkspaceId } from "../queries/useWorkspaceId";
import { WORKSPACE_SEARCH_KIND_LABELS, type WorkspaceSearchHit } from "./workspaceSearchTypes";

function useDebouncedValue(value: string, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function SearchHitCard({ hit, onSelect }: { hit: WorkspaceSearchHit; onSelect: () => void }) {
  return (
    <Link to={hit.route} className="pg-workspace-search-hit" onClick={onSelect}>
      <span className="pg-workspace-search-hit__kind">{WORKSPACE_SEARCH_KIND_LABELS[hit.kind] ?? hit.kind}</span>
      <span className="pg-workspace-search-hit__title">{hit.title}</span>
      {hit.subtitle ? <span className="pg-workspace-search-hit__subtitle">{hit.subtitle}</span> : null}
    </Link>
  );
}

export function WorkspaceGlobalSearch({ className }: { className?: string }) {
  const listId = useId();
  const navigate = useNavigate();
  const workspaceId = useWorkspaceId();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(query, 250);
  const trimmed = debouncedQuery.trim();

  const searchQuery = useQuery({
    queryKey: workspaceId ? queryKeys.workspaceSearch(workspaceId, trimmed) : ["workspace-search", "anonymous", trimmed],
    queryFn: () => searchWorkspace(trimmed),
    enabled: Boolean(workspaceId && trimmed.length >= 2),
    staleTime: 30_000
  });

  const hits = searchQuery.data ?? [];
  const showDropdown = open && trimmed.length >= 2;

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const grouped = useMemo(() => {
    const map = new Map<string, WorkspaceSearchHit[]>();
    for (const hit of hits) {
      const bucket = map.get(hit.kind) ?? [];
      bucket.push(hit);
      map.set(hit.kind, bucket);
    }
    return map;
  }, [hits]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) {
      navigate("/owned-properties/my-properties");
      setOpen(false);
      return;
    }
    if (hits[0]) {
      navigate(hits[0].route);
      setOpen(false);
      setQuery("");
      return;
    }
    navigate(`/owned-properties/my-properties?q=${encodeURIComponent(q)}`);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className={["pg-workspace-global-search", className].filter(Boolean).join(" ")}>
      <form className="pg-dashboard-shell-search" onSubmit={onSubmit} role="search">
        <Search size={18} className="pg-dashboard-shell-search-icon" aria-hidden />
        <input
          ref={inputRef}
          type="search"
          className="pg-dashboard-shell-search-input"
          placeholder="Search properties, tenants, invoices…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          aria-label="Search workspace"
          aria-expanded={showDropdown}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
        />
      </form>
      {showDropdown ? (
        <div id={listId} className="pg-workspace-global-search-results pg-workspace-card" role="listbox" aria-label="Search results">
          {searchQuery.isFetching ? <div className="pg-workspace-global-search-empty pg-muted">Searching…</div> : null}
          {!searchQuery.isFetching && hits.length === 0 ? (
            <div className="pg-workspace-global-search-empty pg-muted">No matches for “{trimmed}”.</div>
          ) : null}
          {!searchQuery.isFetching && hits.length > 0
            ? Array.from(grouped.entries()).map(([kind, rows]) => (
                <div key={kind} className="pg-workspace-global-search-group">
                  <div className="pg-workspace-global-search-group-label">
                    {WORKSPACE_SEARCH_KIND_LABELS[kind as WorkspaceSearchHit["kind"]] ?? kind}
                  </div>
                  <div className="pg-workspace-global-search-group-list">
                    {rows.map((hit) => (
                      <SearchHitCard
                        key={`${hit.kind}-${hit.id}`}
                        hit={hit}
                        onSelect={() => {
                          setOpen(false);
                          setQuery("");
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))
            : null}
        </div>
      ) : null}
    </div>
  );
}
