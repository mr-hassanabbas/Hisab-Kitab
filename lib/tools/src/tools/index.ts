import { ToolRegistry } from "./tool-registry.js";
import { markAttendanceTool, getAttendanceTool } from "./attendance-tools.js";
import { addExpenseTool, getExpensesTool } from "./expense-tools.js";
import { createWorkerTool, getWorkerInfoTool } from "./worker-tools.js";
import { createProjectTool, getProjectInfoTool, assignWorkerTool } from "./project-tools.js";
import { calculatePaymentTool } from "./payment-tools.js";

/**
 * Create and configure the tool registry with all available tools
 */
export function createToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  // Register attendance tools
  registry.registerTool(markAttendanceTool);
  registry.registerTool(getAttendanceTool);

  // Register expense tools
  registry.registerTool(addExpenseTool);
  registry.registerTool(getExpensesTool);

  // Register worker tools
  registry.registerTool(createWorkerTool);
  registry.registerTool(getWorkerInfoTool);

  // Register project tools
  registry.registerTool(createProjectTool);
  registry.registerTool(getProjectInfoTool);
  registry.registerTool(assignWorkerTool);

  // Register payment tools
  registry.registerTool(calculatePaymentTool);

  return registry;
}

/**
 * Export individual tools for direct access
 */
export {
  markAttendanceTool,
  getAttendanceTool,
  addExpenseTool,
  getExpensesTool,
  createWorkerTool,
  getWorkerInfoTool,
  createProjectTool,
  getProjectInfoTool,
  assignWorkerTool,
  calculatePaymentTool
};