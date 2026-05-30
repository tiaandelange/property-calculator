import { describe, expect, it } from "vitest";
import { addDaysYmd, applyLeaseLifecycleSqlFilter, hasLeaseSearchQuery, localYmd } from "./leaseDirectoryFilterUtils";

describe("leaseDirectoryFilterUtils", () => {
  it("formats local YMD and adds days", () => {
    expect(localYmd(new Date("2026-05-30T12:00:00"))).toBe("2026-05-30");
    expect(addDaysYmd("2026-05-30", 30)).toBe("2026-06-29");
  });

  it("detects search queries", () => {
    expect(hasLeaseSearchQuery("")).toBe(false);
    expect(hasLeaseSearchQuery("  jane ")).toBe(true);
  });

  it("chains lifecycle SQL filters", () => {
    const calls: string[] = [];
    const query = {
      in: (col: string, vals: string[]) => {
        calls.push(`in:${col}:${vals.join(",")}`);
        return query;
      },
      not: (col: string, op: string, val: string) => {
        calls.push(`not:${col}:${op}:${val}`);
        return query;
      },
      eq: (col: string, val: string) => {
        calls.push(`eq:${col}:${val}`);
        return query;
      },
      lt: (col: string, val: string) => {
        calls.push(`lt:${col}:${val}`);
        return query;
      },
      gte: (col: string, val: string) => {
        calls.push(`gte:${col}:${val}`);
        return query;
      },
      lte: (col: string, val: string) => {
        calls.push(`lte:${col}:${val}`);
        return query;
      },
      or: (expr: string) => {
        calls.push(`or:${expr}`);
        return query;
      }
    };
    applyLeaseLifecycleSqlFilter(query, "expired", "2026-05-30");
    expect(calls[0]).toBe("in:status:EXPIRED,TERMINATED,CANCELLED");
  });
});
