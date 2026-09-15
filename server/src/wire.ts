/**
 * The shapes the server sends and receives.
 *
 * Resource types come straight from the frontend's own definitions, so the
 * server and the app cannot disagree about what a task looks like.
 */
import type {
  Collaborator, CompletedItem, Item, Label, Note, Project, Reminder, Section,
  TodoistDeadline, TodoistDue, TodoistDuration, TodoistUser, Workspace,
} from '../../src/domain/types';

export type {
  Collaborator, CompletedItem, Item, Label, Note, Project, Reminder, Section,
  TodoistDeadline, TodoistDue, TodoistDuration, TodoistUser, Workspace,
};

export type ResourceType =
  | 'items' | 'projects' | 'sections' | 'labels' | 'notes'
  | 'reminders' | 'collaborators' | 'workspaces';

export const RESOURCE_TYPES: readonly ResourceType[] = [
  'items', 'projects', 'sections', 'labels', 'notes',
  'reminders', 'collaborators', 'workspaces',
];

export type CommandStatus = 'ok' | { error_code: number; error: string };

export interface WireCommand {
  type: string;
  uuid: string;
  args: Record<string, unknown>;
  temp_id?: string;
}

export interface SyncResponse {
  sync_token: string;
  full_sync: boolean;
  items?: Item[];
  projects?: Project[];
  sections?: Section[];
  labels?: Label[];
  notes?: Note[];
  reminders?: Reminder[];
  collaborators?: Collaborator[];
  workspaces?: Workspace[];
  user?: TodoistUser;
  temp_id_mapping?: Record<string, string>;
  sync_status?: Record<string, CommandStatus>;
}
