import { describe, it, expect } from "vitest";
import { PermissionSystem } from "./permission-system";

describe("PermissionSystem", () => {
  let permissionSystem: PermissionSystem;

  beforeEach(() => {
    permissionSystem = new PermissionSystem();
  });

  describe("hasPermission", () => {
    it("should allow admin all permissions", () => {
      expect(permissionSystem.hasPermission("admin", "attendance:write")).toBe(true);
      expect(permissionSystem.hasPermission("admin", "ai:configure")).toBe(true);
    });

    it("should allow owner most permissions except AI configuration", () => {
      expect(permissionSystem.hasPermission("owner", "attendance:write")).toBe(true);
      expect(permissionSystem.hasPermission("owner", "ai:use")).toBe(true);
      expect(permissionSystem.hasPermission("owner", "ai:configure")).toBe(false);
    });

    it("should allow manager business operation permissions", () => {
      expect(permissionSystem.hasPermission("manager", "attendance:write")).toBe(true);
      expect(permissionSystem.hasPermission("manager", "expenses:write")).toBe(true);
      expect(permissionSystem.hasPermission("manager", "ai:use")).toBe(true);
      expect(permissionSystem.hasPermission("manager", "ai:configure")).toBe(false);
    });

    it("should allow worker read-only permissions", () => {
      expect(permissionSystem.hasPermission("worker", "attendance:read")).toBe(true);
      expect(permissionSystem.hasPermission("worker", "attendance:write")).toBe(false);
      expect(permissionSystem.hasPermission("worker", "ai:use")).toBe(false);
    });

    it("should deny unknown roles", () => {
      expect(permissionSystem.hasPermission("unknown", "attendance:read")).toBe(false);
    });
  });

  describe("hasPermissions", () => {
    it("should allow when user has all required permissions", () => {
      const result = permissionSystem.hasPermissions("admin", ["attendance:read", "attendance:write"]);
      expect(result.allowed).toBe(true);
    });

    it("should deny when user is missing permissions", () => {
      const result = permissionSystem.hasPermissions("worker", ["attendance:read", "attendance:write"]);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Missing permissions");
    });

    it("should deny when role is unknown", () => {
      const result = permissionSystem.hasPermissions("unknown", ["attendance:read"]);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Role");
    });
  });

  describe("checkToolPermissions", () => {
    it("should allow mark_attendance for admin", () => {
      const result = permissionSystem.checkToolPermissions("mark_attendance", ["attendance:write"], "admin");
      expect(result.allowed).toBe(true);
    });

    it("should allow mark_attendance for manager", () => {
      const result = permissionSystem.checkToolPermissions("mark_attendance", ["attendance:write"], "manager");
      expect(result.allowed).toBe(true);
    });

    it("should deny mark_attendance for worker", () => {
      const result = permissionSystem.checkToolPermissions("mark_attendance", ["attendance:write"], "worker");
      expect(result.allowed).toBe(false);
    });

    it("should handle unknown tool names", () => {
      const result = permissionSystem.checkToolPermissions("unknown_tool", [], "admin");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("not mapped");
    });
  });

  describe("getRole", () => {
    it("should return role details for known role", () => {
      const role = permissionSystem.getRole("admin");
      expect(role).toBeDefined();
      expect(role?.name).toBe("admin");
      expect(role?.permissions.length).toBeGreaterThan(0);
    });

    it("should return undefined for unknown role", () => {
      const role = permissionSystem.getRole("unknown");
      expect(role).toBeUndefined();
    });
  });

  describe("getAllRoles", () => {
    it("should return all defined roles", () => {
      const roles = permissionSystem.getAllRoles();
      expect(roles.length).toBe(4);
      expect(roles.map(r => r.name)).toContain("admin");
      expect(roles.map(r => r.name)).toContain("owner");
      expect(roles.map(r => r.name)).toContain("manager");
      expect(roles.map(r => r.name)).toContain("worker");
    });
  });

  describe("getAllPermissions", () => {
    it("should return all defined permissions", () => {
      const permissions = permissionSystem.getAllPermissions();
      expect(permissions.length).toBeGreaterThan(15);
      expect(permissions.map(p => p.name)).toContain("attendance:read");
      expect(permissions.map(p => p.name)).toContain("ai:use");
    });
  });
});