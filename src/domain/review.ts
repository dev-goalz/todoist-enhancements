import { addDays, startOfDay } from 'date-fns';
import type { CompletedItem, Item, Project } from './types';
import { anytimeItems, bucketOf, isOpen } from './views';
import { estimateOf } from './estimates';
import { dueDate } from './dates';

/**
 * A review is a pass over the things a week quietly accumulates.
 *
 * It invents no new data. Every question it asks is answered from tasks,
 * projects and completions that already exist, which means a review can be
 * abandoned halfway through and has cost nothing, and that nothing it writes
 * back would look unusual in Todoist afterwards. There is no per-project
 * review interval here for that reason: it would have to be stored somewhere,
 * and there is nowhere to store it that Todoist would recognise.
 *
 * The daily pass asks what today is, and takes a few minutes. The weekly pass
 * asks what the week was and what the next one is, and takes longer.
 */

export type ReviewCadence = 'daily' | 'weekly';

export type ReviewStepId =
  /* Daily */
  | 'overdue'
  | 'inbox'
  | 'anytime'
  | 'today'
  /* Weekly */
  | 'done'
  | 'stats'
  | 'slipped'
  | 'unestimated'
  | 'quiet'
  | 'backlog';

/** What a row in a step can be sent to. The drop table does the work. */
export type ReviewAction = 'today' | 'anytime' | 'someday';

export interface ReviewStep {
  id: ReviewStepId;
  /** The tasks this step is asking about. */
  items: Item[];
  /** The projects it is asking about, for the step that asks about projects. */
  projects: Project[];
  /** Tasks finished, for the step that reports rather than asks. */
  completed: CompletedItem[];
  /** What each row can be sent to. Empty when the step only reports. */
  actions: ReviewAction[];
  /** True where the missing thing is an estimate, so the field belongs on the row. */
  estimable: boolean;
  /**
   * True when the step has nothing to settle. It is still shown — being told
   * the inbox is empty is the point of asking — but it is shown as settled.
   */
  clear: boolean;
}

export interface ReviewInput {
  /** Open, top-level tasks. Subtasks answer to their parent. */
  roots: Item[];
  projects: Record<string, Project>;
  /** Completions inside the period under review. */
  completed: CompletedItem[];
  inboxProjectId: string | null;
  now: Date;
  /** How long a project may go untouched before the review mentions it. */
  quietAfterDays: number;
}

const STEPS: Record<ReviewCadence, ReviewStepId[]> = {
  daily: ['overdue', 'inbox', 'anytime', 'today'],
  weekly: ['done', 'stats', 'slipped', 'inbox', 'unestimated', 'quiet', 'backlog'],
};

/** The steps a cadence walks through, in order. */
export const stepsFor = (cadence: ReviewCadence): ReviewStepId[] => STEPS[cadence];

const byDue = (a: Item, b: Item) =>
  (dueDate(a)?.getTime() ?? 0) - (dueDate(b)?.getTime() ?? 0);

/** Tasks sitting in the Inbox: captured, not yet filed anywhere. */
function inboxItems(input: ReviewInput): Item[] {
  const { inboxProjectId } = input;
  return inboxProjectId ? input.roots.filter((i) => i.project_id === inboxProjectId) : [];
}

/**
 * Projects that are open but have gone quiet.
 *
 * A project counts as quiet when it holds work and nothing in it has been
 * finished inside the window. A project with nothing left in it is not quiet,
 * it is done, and the review does not nag about it.
 */
function quietProjects(input: ReviewInput): Project[] {
  const cutoff = startOfDay(addDays(input.now, -input.quietAfterDays)).getTime();

  const touched = new Set<string>();
  for (const done of input.completed) {
    if (new Date(done.completed_at).getTime() >= cutoff) touched.add(done.project_id);
  }

  const open = new Set(input.roots.map((i) => i.project_id));

  return Object.values(input.projects)
    .filter((project) =>
      !project.is_archived &&
      !project.is_deleted &&
      !project.is_folder &&
      !project.inbox_project &&
      open.has(project.id) &&
      !touched.has(project.id))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The tasks a step is about, before it is decided whether that is nothing. */
function contentOf(
  id: ReviewStepId,
  input: ReviewInput,
): Pick<ReviewStep, 'items' | 'projects' | 'completed'> {
  const empty = { items: [] as Item[], projects: [] as Project[], completed: [] as CompletedItem[] };
  const { roots, now } = input;

  switch (id) {
    case 'overdue':
    case 'slipped':
      return { ...empty, items: roots.filter((i) => bucketOf(i, now) === 'overdue').sort(byDue) };

    case 'inbox':
      return { ...empty, items: inboxItems(input) };

    case 'anytime':
      return { ...empty, items: anytimeItems(roots, now) };

    case 'today':
      return { ...empty, items: roots.filter((i) => bucketOf(i, now) === 'today').sort(byDue) };

    case 'done':
      return {
        ...empty,
        completed: [...input.completed].sort(
          (a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime(),
        ),
      };

    case 'unestimated':
      /* Only the week being planned. An estimate on something six months out
         is a guess about a guess, and the review will ask again nearer the time. */
      return {
        ...empty,
        items: roots.filter((i) => {
          const bucket = bucketOf(i, now);
          const inPlay = bucket === 'overdue' || bucket === 'today' || bucket === 'anytime';
          return inPlay && estimateOf(i) === null;
        }),
      };

    case 'quiet':
      return { ...empty, projects: quietProjects(input) };

    case 'backlog':
      return { ...empty, items: roots.filter((i) => bucketOf(i, now) === 'someday') };

    case 'stats':
      /* The figures are read from the same completions the first step lists,
         so the two can never disagree about the week they describe. */
      return { ...empty, completed: input.completed };

    default:
      return empty;
  }
}

/** What each step lets you do to a row. A step that only reports offers nothing. */
const ACTIONS: Record<ReviewStepId, ReviewAction[]> = {
  overdue: ['today', 'anytime', 'someday'],
  slipped: ['today', 'anytime', 'someday'],
  inbox: ['today', 'anytime', 'someday'],
  anytime: ['today', 'someday'],
  /* The backlog offers all three and marks the one the task is already in, so
     leaving it where it is reads as a choice rather than as not answering. */
  backlog: ['today', 'anytime', 'someday'],
  unestimated: [],
  today: [],
  done: [],
  stats: [],
  quiet: [],
};

/** The step where the thing missing is an estimate, not a destination. */
const ESTIMABLE: ReviewStepId[] = ['unestimated'];

/**
 * Steps that only report.
 *
 * Everything else asks for something — a destination, a number, or a tick —
 * so it carries a count until it is empty. Today asks for ticks, which is why
 * it is not in here even though it offers no destinations.
 */
const REPORT_ONLY: ReviewStepId[] = ['done', 'stats', 'quiet'];

/** Builds every step of a review, in order. */
export function buildReview(cadence: ReviewCadence, input: ReviewInput): ReviewStep[] {
  return stepsFor(cadence).map((id) => {
    const content = contentOf(id, input);
    const nothing =
      content.items.length === 0 &&
      content.projects.length === 0 &&
      content.completed.length === 0;

    const estimable = ESTIMABLE.includes(id);
    return {
      id,
      ...content,
      actions: ACTIONS[id],
      estimable,
      /* A step that only reports is never "to settle": there is nothing to do
         about it, so it reads as settled whatever it contains. The backlog is
         the same — reading it is the point, and a backlog is not a problem. */
      clear: nothing || REPORT_ONLY.includes(id) || id === 'backlog',
    };
  });
}

/** How many steps still have something to settle. */
export const outstanding = (steps: ReviewStep[]): number =>
  steps.filter((step) => !step.clear).length;

/** Everything still open, as one selection, for the final tally. */
export function openItems(items: Item[]): Item[] {
  return items.filter(isOpen);
}
