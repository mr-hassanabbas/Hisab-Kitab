export interface Permission {
  name: string;
  description: string;
  resource: string;
  action: string;
}

export interface Role {
  name: string;
  permissions: string[];
  description: string;
}

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  requiredPermissions?: string[];
}

/**
 * Permission System for role-based access control
 */
export class PermissionSystem {
  private permissions: Map<string, Permission> = new Map();
  private roles: Map<string, Role> = new Map();

  constructor() {
    this.initializePermissions();
    this.initializeRoles();
  }

  /**
   * Initialize available permissions
   */
  private initializePermissions(): void {
    // Attendance permissions
    this.addPermission({
      name: "attendance:read",
      description: "Read attendance records",
      resource: "attendance",
      action: "read"
    });
    this.addPermission({
      name: "attendance:write",
      description: "Create or modify attendance records",
      resource: "attendance",
      action: "write"
    });
    this.addPermission({
      name: "attendance:delete",
      description: "Delete attendance records",
      resource: "attendance",
      action: "delete"
    });

    // Expense permissions
    this.addPermission({
      name: "expenses:read",
      description: "Read expense records",
      resource: "expenses",
      action: "read"
    });
    this.addPermission({
      name: "expenses:write",
      description: "Create or modify expense records",
      resource: "expenses",
      action: "write"
    });
    this.addPermission({
      name: "expenses:delete",
      description: "Delete expense records",
      resource: "expenses",
      action: "delete"
    });

    // Worker permissions
    this.addPermission({
      name: "workers:read",
      description: "Read worker information",
      resource: "workers",
      action: "read"
    });
    this.addPermission({
      name: "workers:write",
      description: "Create or modify worker records",
      resource: "workers",
      action: "write"
    });
    this.addPermission({
      name: "workers:delete",
      description: "Delete worker records",
      resource: "workers",
      action: "delete"
    });

    // Project permissions
    this.addPermission({
      name: "projects:read",
      description: "Read project information",
      resource: "projects",
      action: "read"
    });
    this.addPermission({
      name: "projects:write",
      description: "Create or modify project records",
      resource: "projects",
      action: "write"
    });
    this.addPermission({
      name: "projects:delete",
      description: "Delete project records",
      resource: "projects",
      action: "delete"
    });

    // Payment permissions
    this.addPermission({
      name: "payments:read",
      description: "Read payment information",
      resource: "payments",
      action: "read"
    });
    this.addPermission({
      name: "payments:write",
      description: "Create or modify payment records",
      resource: "payments",
      action: "write"
    });

    // AI permissions
    this.addPermission({
      name: "ai:use",
      description: "Use AI voice assistant",
      resource: "ai",
      action: "use"
    });
    this.addPermission({
      name: "ai:configure",
      description: "Configure AI settings",
      resource: "ai",
      action: "configure"
    });
  }

  /**
   * Initialize roles with permissions
   */
  private initializeRoles(): void {
    // Admin role - all permissions
    this.addRole({
      name: "admin",
      permissions: Array.from(this.permissions.keys()),
      description: "Full system access"
    });

    // Owner role - all except AI configuration
    this.addRole({
      name: "owner",
      permissions: Array.from(this.permissions.keys()).filter(p => p !== "ai:configure"),
      description: "Owner access (all except AI configuration)"
    });

    // Manager role - business operations
    this.addRole({
      name: "manager",
      permissions: [
        "attendance:read",
        "attendance:write",
        "expenses:read",
        "expenses:write",
        "workers:read",
        "workers:write",
        "projects:read",
        "projects:write",
        "payments:read",
        "payments:write",
        "ai:use"
      ],
      description: "Manager access (business operations)"
    });

    // Worker role - read-only and basic operations
    this.addRole({
      name: "worker",
      permissions: [
        "attendance:read",
        "expenses:read",
        "workers:read",
        "projects:read",
        "payments:read"
      ],
      description: "Worker access (read-only)"
    });
  }

  /**
   * Add a permission
   */
  addPermission(permission: Permission): void {
    this.permissions.set(permission.name, permission);
  }

  /**
   * Add a role
   */
  addRole(role: Role): void {
    this.roles.set(role.name, role);
  }

  /**
   * Check if user has permission
   */
  hasPermission(userRole: string, permission: string): boolean {
    const role = this.roles.get(userRole);
    if (!role) {
      return false;
    }
    return role.permissions.includes(permission);
  }

  /**
   * Check if user has all required permissions
   */
  hasPermissions(userRole: string, requiredPermissions: string[]): PermissionCheckResult {
    const role = this.roles.get(userRole);
    if (!role) {
      return {
        allowed: false,
        reason: `Role "${userRole}" not found`,
        requiredPermissions
      };
    }

    const missingPermissions = requiredPermissions.filter(
      perm => !role.permissions.includes(perm)
    );

    if (missingPermissions.length > 0) {
      return {
        allowed: false,
        reason: `Missing permissions: ${missingPermissions.join(", ")}`,
        requiredPermissions
      };
    }

    return { allowed: true };
  }

  /**
   * Check tool permissions
   */
  checkToolPermissions(toolName: string, toolPermissions: string[], userRole: string): PermissionCheckResult {
    // Map tool names to permissions
    const toolPermissionMap: Record<string, string> = {
      "mark_attendance": "attendance:write",
      "get_attendance": "attendance:read",
      "add_expense": "expenses:write",
      "get_expenses": "expenses:read",
      "create_worker": "workers:write",
      "get_worker_info": "workers:read",
      "create_project": "projects:write",
      "get_project_info": "projects:read",
      "assign_worker": "projects:write",
      "calculate_payment": "payments:read"
    };

    const requiredPermission = toolPermissionMap[toolName];
    if (!requiredPermission) {
      return {
        allowed: false,
        reason: `Tool "${toolName}" not mapped to permission`
      };
    }

    return this.hasPermissions(userRole, [requiredPermission]);
  }

  /**
   * Get role by name
   */
  getRole(roleName: string): Role | undefined {
    return this.roles.get(roleName);
  }

  /**
   * Get all roles
   */
  getAllRoles(): Role[] {
    return Array.from(this.roles.values());
  }

  /**
   * Get all permissions
   */
  getAllPermissions(): Permission[] {
    return Array.from(this.permissions.values());
  }
}