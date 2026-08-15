import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api", () => ({
  fetchApi: vi.fn(async (endpoint: string) => {
    const url = endpoint;
    if (url.startsWith("/projects")) {
      return { data: [{ id: 1, name: "DHA Villa" }, { id: 2, name: "Model Town Villa" }] };
    }
    if (url.startsWith("/labour")) {
      return {
        data: [
          { id: 101, name: "Ali", phone: "03001234567", project_name: "DHA Villa" },
          { id: 102, name: "Ali", phone: null, project_name: "Model Town Villa" },
          { id: 103, name: "Bilal", phone: "03009998887", project_name: null },
        ],
      };
    }
    return { data: [] };
  }),
  setAuthToken: vi.fn(),
}));

import { resolveDate, resolveDateTerm, todayStr, parseActionsLocal, formatActionResults, resolveLabourId, resolveClarifiedActions, detectConversation, hasMutations } from "@/lib/actions";

const fmtDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

describe("resolveDate / resolveDateTerm (Case 2, Case 6 fixes)", () => {
  const today = todayStr();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  it("rejects absolute dates — Case 2/Case 6", () => {
    expect(resolveDate("2025-01-01")).toBeNull();
    expect(resolveDate("2026-08-11")).toBeNull();
    expect(resolveDate("next Friday")).toBeNull();
  });

  it("returns null for no known date term", () => {
    expect(resolveDate("random text")).toBeNull();
    expect(resolveDate("")).toBeNull();
  });

  it("returns relative term keyword, not absolute date", () => {
    expect(resolveDate("aaj")).toEqual({ date: "aaj", assumed: "آج کی" });
    expect(resolveDate("kal")).toEqual({ date: "kal", assumed: "کل (پچھلے دن) کی", confidence: "medium" });
    expect(resolveDate("parso")).toEqual({ date: "parso", assumed: "پرسوں کی" });
    expect(resolveDate("narso")).toEqual({ date: "narso", assumed: "نرسو (اگلے دن) کی" });
  });

  it("resolveDateTerm('kal') resolves to yesterday", () => {
    expect(resolveDateTerm("kal")).toBe(fmtDate(yesterday));
  });

  it("resolveDateTerm('aaj') resolves to today", () => {
    expect(resolveDateTerm("aaj")).toBe(today);
  });

  it("resolveDateTerm('parso') resolves to two days ago", () => {
    const d = new Date();
    d.setDate(d.getDate() - 2);
    expect(resolveDateTerm("parso")).toBe(fmtDate(d));
  });

  it("resolveDateTerm('narso') resolves to tomorrow", () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    expect(resolveDateTerm("narso")).toBe(fmtDate(d));
  });

  it("resolveDateTerm returns null for unknown terms — triggers clarification", () => {
    expect(resolveDateTerm("next Friday")).toBeNull();
    expect(resolveDateTerm("2025-01-01")).toBeNull();
    expect(resolveDateTerm("foobar")).toBeNull();
  });

  it("parseActionsLocal omits date field when none mentioned — Case 2", () => {
    const parsed = parseActionsLocal("mark attendance of Bilal as present in DHA Villa");
    const action = parsed?.actions.find((a) => a.type === "mark_attendance");
    expect(action).toBeDefined();
    expect(action?.date).toBeUndefined();
  });

  it("parseActionsLocal stores 'kal' as relative term — Case 6", () => {
    const parsed = parseActionsLocal("mark attendance of Ali as present kal in DHA Villa");
    const action = parsed?.actions.find((a) => a.type === "mark_attendance");
    expect(action).toBeDefined();
    expect(action?.date).toBe("kal");
    expect(resolveDateTerm(action?.date ?? "")).toBe(fmtDate(yesterday));
  });
});

describe("formatActionResults — Case 3 split format", () => {
  it("renders ✅/⚠️ split for mixed success/failure", () => {
    const results = [
      { success: true, text: "Bilal کی حاضری لگائی جائے گی" },
      { success: false, text: "کون سا پروجیکٹ؟ — DHA Villa، Model Town Villa" },
    ];
    const rendered = formatActionResults(results);
    expect(rendered).toContain("✅ یہ ہو گیا");
    expect(rendered).toContain("⚠️ یہ نہیں ہوا");
    expect(rendered).toContain("Bilal کی حاضری لگائی جائے گی");
    expect(rendered).toContain("کون سا پروجیکٹ؟");
  });

  it("renders all ✅ when all succeed", () => {
    const results = [{ success: true, text: "Operation done" }];
    const rendered = formatActionResults(results);
    expect(rendered).toContain("✅ ہو گیا!");
    expect(rendered).toContain("Operation done");
  });

  it("renders all ❌ when all fail", () => {
    const results = [{ success: false, text: "Something went wrong" }];
    const rendered = formatActionResults(results);
    expect(rendered).toContain("❌");
    expect(rendered).toContain("Something went wrong");
  });

  it("returns کچھ نہیں کیا گیا for empty results", () => {
    expect(formatActionResults([])).toBe("کچھ نہیں کیا گیا");
  });
});

describe("parseActionsLocal — clause splitting and field extraction", () => {
  it("parses simple attendance", () => {
    const r = parseActionsLocal("mark attendance of Bilal as present in DHA Villa");
    expect(r).not.toBeNull();
    expect(r!.actions.length).toBe(1);
    expect(r!.actions[0].type).toBe("mark_attendance");
    expect(r!.actions[0].labourName).toBe("Bilal");
    expect(r!.actions[0].status).toBe("present");
  });

  it("returns null for empty string", () => {
    expect(parseActionsLocal("")).toBeNull();
  });
});

describe("resolveLabourId — Case 5 disambiguation", () => {
  it("returns null id with disambiguated candidates for duplicate names", async () => {
    const r = await resolveLabourId("Ali", { id: null, name: "" });
    expect(r.id).toBeNull();
    expect(r.confidence).toBe("medium");
    expect(r.candidates).toContain("Ali (03001234567)");
    expect(r.candidates).toContain("Ali (Model Town Villa)");
  });

  it("resolves to exact worker when user picks disambiguated candidate", async () => {
    const r = await resolveLabourId("Ali (03001234567)", { id: null, name: "" });
    expect(r.id).toBe(101);
    expect(r.confidence).toBe("high");
      });

  it("resolves to different worker for different suffix", async () => {
    const r = await resolveLabourId("Ali (Model Town Villa)", { id: null, name: "" });
    expect(r.id).toBe(102);
    expect(r.confidence).toBe("high");
  });

  it("resolves unique name directly", async () => {
    const r = await resolveLabourId("Bilal", { id: null, name: "" });
    expect(r.id).toBe(103);
    expect(r.confidence).toBe("high");
  });
});

describe("resolveClarifiedActions — Case 5 follow-up", () => {
  it("passes full disambiguated candidate string as field value", () => {
    const req = {
      entityType: "labour" as const,
      field: "labourName" as const,
      question: "کون سا مزدور؟",
      candidates: ["Ali (03001234567)", "Ali (Model Town Villa)"],
      actions: [{ type: "mark_attendance" as const, projectName: "DHA Villa", labourName: "Ali", status: "present", response: "Ali کی حاضری لگائی جائے گی" }],
      state: { lastProjectId: 1, lastLabourId: null, lastProjectName: "DHA Villa" },
    };
    const resolved = resolveClarifiedActions(req, "Ali (03001234567)");
    expect(resolved).not.toBeNull();
    expect(resolved!.actions[0].labourName).toBe("Ali (03001234567)");
    expect(resolved!.chosen).toBe("Ali");
  });

  it("returns null when answer doesn't match any candidate", () => {
    const req = {
      entityType: "project" as const,
      field: "projectName" as const,
      question: "کون سا پروجیکٹ؟",
      candidates: ["DHA Villa", "Model Town Villa"],
      actions: [{ type: "add_expense" as const, projectName: "خیالی", amount: "500", response: "done" }],
      state: { lastProjectId: null, lastLabourId: null, lastProjectName: null } } as any;
    // @ts-ignore — missing fields are fine for this test
    const resolved = resolveClarifiedActions(req, "Nonexistent Project");
    expect(resolved).toBeNull();
  });
});

describe("Conversation detection (offline, no Gemini)", () => {
  it("CONV-1: 'hello' → greet action", () => {
    const r = parseActionsLocal("hello");
    expect(r).not.toBeNull();
    expect(r!.actions[0].type).toBe("greet");
    expect(r!.actions[0].response).toContain("Marenii");
  });

  it("CONV-2: 'Assalam o Alaikum' → greet action", () => {
    const r = parseActionsLocal("Assalam o Alaikum");
    expect(r).not.toBeNull();
    expect(r!.actions[0].type).toBe("greet");
  });

  it("CONV-3: 'tumhara naam kya hai' → answer action", () => {
    const r = parseActionsLocal("tumhara naam kya hai");
    expect(r).not.toBeNull();
    expect(r!.actions[0].type).toBe("answer");
    expect(r!.actions[0].response).toContain("Marenii");
  });

  it("CONV-4: 'kya haal hai' → answer action", () => {
    const r = parseActionsLocal("kya haal hai");
    expect(r).not.toBeNull();
    expect(r!.actions[0].type).toBe("answer");
  });

  it("CONV-5: 'shukriya' → smalltalk action", () => {
    const r = parseActionsLocal("shukriya");
    expect(r).not.toBeNull();
    expect(r!.actions[0].type).toBe("smalltalk");
  });

  it("CONV-6: 'khuda hafiz' → smalltalk action", () => {
    const r = parseActionsLocal("khuda hafiz");
    expect(r).not.toBeNull();
    expect(r!.actions[0].type).toBe("smalltalk");
  });

  it("CONV-7: 'ye app kya hai' → explain_app action", () => {
    const r = parseActionsLocal("ye app kya hai");
    expect(r).not.toBeNull();
    expect(r!.actions[0].type).toBe("explain_app");
    expect(r!.actions[0].response).toContain("Hisab Kitab");
  });

  it("CONV-8: 'madad karo' → explain_app action", () => {
    const r = parseActionsLocal("madad karo");
    expect(r).not.toBeNull();
    expect(r!.actions[0].type).toBe("explain_app");
  });

  it("CONV-9: 'what can you do' → explain_app action", () => {
    const r = parseActionsLocal("what can you do");
    expect(r).not.toBeNull();
    expect(r!.actions[0].type).toBe("explain_app");
  });

  it("CMD-1: 'attendance' → navigate to /attendance", () => {
    const r = parseActionsLocal("attendance");
    expect(r).not.toBeNull();
    expect(r!.actions[0].type).toBe("navigate");
    expect(r!.actions[0].page).toBe("/attendance");
  });

  it("CMD-2: 'attendance lagao' → navigate to /attendance", () => {
    const r = parseActionsLocal("attendance lagao");
    expect(r).not.toBeNull();
    expect(r!.actions[0].type).toBe("navigate");
    expect(r!.actions[0].page).toBe("/attendance");
  });

  it("CMD-3: 'hazri' → navigate to /attendance", () => {
    const r = parseActionsLocal("hazri");
    expect(r).not.toBeNull();
    expect(r!.actions[0].type).toBe("navigate");
    expect(r!.actions[0].page).toBe("/attendance");
  });

  it("CMD-4: 'projects dikhao' → navigate to /projects", () => {
    const r = parseActionsLocal("projects dikhao");
    expect(r).not.toBeNull();
    expect(r!.actions[0].type).toBe("navigate");
    expect(r!.actions[0].page).toBe("/projects");
  });

  it("CMD-5: 'report chahiye' → navigate to /reports", () => {
    const r = parseActionsLocal("report chahiye");
    expect(r).not.toBeNull();
    expect(r!.actions[0].type).toBe("navigate");
    expect(r!.actions[0].page).toBe("/reports");
  });

  it("MIXED-1: 'hello, mujhe attendance chahiye' → greet + navigate", () => {
    const r = parseActionsLocal("hello, mujhe attendance chahiye");
    expect(r).not.toBeNull();
    expect(r!.complete).toBe(true);
    const types = r!.actions.map(a => a.type);
    expect(types).toContain("greet");
    expect(types).toContain("navigate");
  });

  it("UR-1: 'حاضری لگاؤ' → navigate to /attendance", () => {
    const r = parseActionsLocal("حاضری لگاؤ");
    expect(r).not.toBeNull();
    expect(r!.actions[0].type).toBe("navigate");
    expect(r!.actions[0].page).toBe("/attendance");
  });

  it("UR-2: 'پروجیکٹس دکھاؤ' → navigate to /projects", () => {
    const r = parseActionsLocal("پروجیکٹس دکھاؤ");
    expect(r).not.toBeNull();
    expect(r!.actions[0].type).toBe("navigate");
    expect(r!.actions[0].page).toBe("/projects");
  });

  it("UR-3: 'رپورٹ چاہئے' → navigate to /reports", () => {
    const r = parseActionsLocal("رپورٹ چاہئے");
    expect(r).not.toBeNull();
    expect(r!.actions[0].type).toBe("navigate");
    expect(r!.actions[0].page).toBe("/reports");
  });

  it("UR-5: 'مدد کرو' → explain_app action", () => {
    const r = parseActionsLocal("مدد کرو");
    expect(r).not.toBeNull();
    expect(r!.actions[0].type).toBe("explain_app");
  });

  it("hasMutations: returns false for conversation-only actions", () => {
    expect(hasMutations([{ type: "greet", response: "hi" }])).toBe(false);
    expect(hasMutations([{ type: "respond", response: "ok" }])).toBe(false);
    expect(hasMutations([{ type: "explain_app", response: "explain" }])).toBe(false);
  });

  it("hasMutations: returns true for action commands", () => {
    expect(hasMutations([{ type: "navigate", page: "/attendance", response: "" }])).toBe(false);
    expect(hasMutations([{ type: "mark_attendance", labourName: "Ahmed", status: "present", response: "" }])).toBe(true);
  });
});
