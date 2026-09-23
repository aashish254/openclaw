import type { DatabaseSync } from "node:sqlite";
import { listRegistryWorktreesInDatabase } from "../agents/worktrees/registry-read.kernel.js";
import { readWorktreeRunLeaseStateInDatabase } from "../agents/worktrees/run-lease-owner.js";
import { getFleetCellInDatabase, listFleetCellsInDatabase } from "../fleet/registry.kernel.js";
import type {
  OpenClawStateReadCommand,
  OpenClawStateReadResult,
} from "./openclaw-state-read.types.js";

export function readStateRegistryCommand(
  db: DatabaseSync,
  command: Extract<
    OpenClawStateReadCommand,
    { type: "worktrees.cleanupState" | "fleet.list" | "fleet.get" }
  >,
): OpenClawStateReadResult {
  if (command.type === "worktrees.cleanupState") {
    return {
      type: command.type,
      records: listRegistryWorktreesInDatabase(db),
      leases: readWorktreeRunLeaseStateInDatabase(db),
    };
  }
  return command.type === "fleet.list"
    ? { type: command.type, cells: listFleetCellsInDatabase(db) }
    : { type: command.type, cell: getFleetCellInDatabase(db, command.tenantId) };
}
