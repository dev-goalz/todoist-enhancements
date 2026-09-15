import { newId } from '../ids';
import type { Project, Section } from '../wire';
import {
  CommandError, invalidArgument, liveItems, nextOrder, optionalBoolean, optionalNumber, optionalString,
  requireName, requireProject, requireSection, type Args, type CommandContext, type Handler,
} from './context';
import { deleteItemTree } from './items';

function applyProjectFields(project: Project, args: Args): Project {
  const next: Project = { ...project };
  if (args.name !== undefined) next.name = requireName(args);
  const description = optionalString(args, 'description');
  if (description !== undefined) next.description = description;
  const color = optionalString(args, 'color');
  if (color !== undefined) next.color = color;
  const viewStyle = optionalString(args, 'view_style');
  if (viewStyle !== undefined) next.view_style = viewStyle;
  const favourite = optionalBoolean(args, 'is_favorite');
  if (favourite !== undefined) next.is_favorite = favourite;
  const collapsed = optionalBoolean(args, 'collapsed');
  if (collapsed !== undefined) next.collapsed = collapsed;
  const order = optionalNumber(args, 'child_order');
  if (order !== undefined) next.child_order = order;
  return next;
}

const projectAdd: Handler = async (ctx, args, tempId) => {
  requireName(args);
  const parentId = args.parent_id ? (await requireProject(ctx, args.parent_id)).id : null;
  const siblings = (await ctx.repo.list<Project>(ctx.userId, 'projects'))
    .filter((p) => !p.is_deleted && p.parent_id === parentId);

  const project = applyProjectFields({
    id: newId(),
    name: '',
    description: '',
    color: 'charcoal',
    parent_id: parentId,
    child_order: nextOrder(siblings.map((p) => p.child_order)),
    is_archived: false,
    is_deleted: false,
    is_favorite: false,
    inbox_project: false,
    view_style: 'list',
    workspace_id: null,
    is_folder: false,
    collapsed: false,
  }, args);

  await ctx.repo.put(ctx.userId, 'projects', project, ctx.rev);
  await ctx.mapTempId(tempId, project.id);
};

const projectUpdate: Handler = async (ctx, args) => {
  const project = await requireProject(ctx, args.id);
  await ctx.repo.put(ctx.userId, 'projects', applyProjectFields(project, args), ctx.rev);
};

const projectReorder: Handler = async (ctx, args) => {
  if (!Array.isArray(args.projects)) throw invalidArgument('projects');
  for (const entry of args.projects as unknown[]) {
    const { id, child_order: order } = (entry ?? {}) as { id?: unknown; child_order?: unknown };
    if (typeof order !== 'number' || !Number.isFinite(order)) throw invalidArgument('projects');
    const project = await requireProject(ctx, id);
    await ctx.repo.put(ctx.userId, 'projects', { ...project, child_order: order }, ctx.rev);
  }
};

/** A project and every project nested below it. */
async function projectTree(ctx: CommandContext, root: Project): Promise<Project[]> {
  const live = (await ctx.repo.list<Project>(ctx.userId, 'projects')).filter((p) => !p.is_deleted);
  const tree = [root];
  for (let i = 0; i < tree.length; i++) {
    tree.push(...live.filter((p) => p.parent_id === tree[i].id));
  }
  return tree;
}

async function requireOwnProject(ctx: CommandContext, id: unknown): Promise<Project> {
  const project = await requireProject(ctx, id);
  // Todoist does not let the Inbox be archived or deleted either.
  if (project.inbox_project) throw new CommandError(22, 'The Inbox cannot be archived or deleted');
  return project;
}

/** Archived projects, with their subprojects, keep their tasks but drop out of view. */
const projectArchive: Handler = async (ctx, args) => {
  for (const project of await projectTree(ctx, await requireOwnProject(ctx, args.id))) {
    await ctx.repo.put(ctx.userId, 'projects', { ...project, is_archived: true }, ctx.rev);
  }
};

/** Deleting a project takes its subprojects, sections and tasks with it. */
const projectDelete: Handler = async (ctx, args) => {
  const tree = await projectTree(ctx, await requireOwnProject(ctx, args.id));
  const ids = new Set(tree.map((p) => p.id));
  for (const item of await liveItems(ctx)) {
    if (ids.has(item.project_id)) await ctx.repo.put(ctx.userId, 'items', { ...item, is_deleted: true, updated_at: ctx.now }, ctx.rev);
  }
  for (const section of await ctx.repo.list<Section>(ctx.userId, 'sections')) {
    if (!section.is_deleted && ids.has(section.project_id)) {
      await ctx.repo.put(ctx.userId, 'sections', { ...section, is_deleted: true }, ctx.rev);
    }
  }
  for (const project of tree) {
    await ctx.repo.put(ctx.userId, 'projects', { ...project, is_deleted: true }, ctx.rev);
  }
};

function applySectionFields(section: Section, args: Args): Section {
  const next: Section = { ...section };
  // The app creates a section with an empty name and has the user type it in place.
  const name = optionalString(args, 'name');
  if (name !== undefined) next.name = name;
  const description = optionalString(args, 'description');
  if (description !== undefined) next.description = description;
  const order = optionalNumber(args, 'section_order');
  if (order !== undefined) next.section_order = order;
  const collapsed = optionalBoolean(args, 'collapsed');
  if (collapsed !== undefined) next.collapsed = collapsed;
  return next;
}

const sectionAdd: Handler = async (ctx, args, tempId) => {
  if (typeof args.name !== 'string') throw invalidArgument('name');
  const project = await requireProject(ctx, args.project_id);
  const siblings = (await ctx.repo.list<Section>(ctx.userId, 'sections'))
    .filter((s) => !s.is_deleted && s.project_id === project.id);

  const section = applySectionFields({
    id: newId(),
    project_id: project.id,
    name: '',
    description: '',
    section_order: nextOrder(siblings.map((s) => s.section_order)),
    is_archived: false,
    is_deleted: false,
    collapsed: false,
  }, args);

  await ctx.repo.put(ctx.userId, 'sections', section, ctx.rev);
  await ctx.mapTempId(tempId, section.id);
};

const sectionUpdate: Handler = async (ctx, args) => {
  const section = await requireSection(ctx, args.id);
  await ctx.repo.put(ctx.userId, 'sections', applySectionFields(section, args), ctx.rev);
};

/** As in Todoist, the tasks still in a section go with it. */
const sectionDelete: Handler = async (ctx, args) => {
  const section = await requireSection(ctx, args.id);
  for (const item of await liveItems(ctx)) {
    if (item.section_id !== section.id || item.parent_id) continue;
    const current = await ctx.repo.get<typeof item>(ctx.userId, 'items', item.id);
    if (current && !current.is_deleted) await deleteItemTree(ctx, current);
  }
  await ctx.repo.put(ctx.userId, 'sections', { ...section, is_deleted: true }, ctx.rev);
};

export const projectHandlers: Record<string, Handler> = {
  project_add: projectAdd,
  project_update: projectUpdate,
  project_reorder: projectReorder,
  project_archive: projectArchive,
  project_delete: projectDelete,
  section_add: sectionAdd,
  section_update: sectionUpdate,
  section_delete: sectionDelete,
};
