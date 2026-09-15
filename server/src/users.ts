import { hashToken, newId, newToken } from './ids';
import { hashPassword } from './passwords';
import type { Repo } from './repo';
import type { Project, TodoistUser } from './wire';

export interface NewUserInput {
  email: string;
  fullName: string;
  timezone: string;
  /** 1 = Monday .. 7 = Sunday. */
  startDay?: number;
  lang?: string;
  /** Without one the account can only be used with its token. */
  password?: string;
}

/** The offset of an IANA timezone right now, in the shape Todoist's `tz_info` uses. */
export function tzInfo(timezone: string, at = new Date()): TodoistUser['tz_info'] {
  // Throws a RangeError for an unknown zone, which is what a caller wants.
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'longOffset' })
    .formatToParts(at);
  const name = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
  const sign = match?.[1] === '-' ? -1 : 1;
  return {
    timezone,
    hours: match ? sign * Number(match[2]) : 0,
    minutes: match ? sign * Number(match[3]) : 0,
    is_dst: 0,
  };
}

/** Creates a user with an empty Inbox. The token is returned once and never stored. */
export async function createUser(
  repo: Repo,
  input: NewUserInput,
): Promise<{ user: TodoistUser; token: string }> {
  const startDay = input.startDay ?? 1;
  if (!Number.isInteger(startDay) || startDay < 1 || startDay > 7) {
    throw new RangeError('startDay must be 1 (Monday) to 7 (Sunday)');
  }

  const token = newToken();
  const inbox: Project = {
    id: newId(),
    name: 'Inbox',
    description: '',
    color: 'charcoal',
    parent_id: null,
    child_order: 0,
    is_archived: false,
    is_deleted: false,
    is_favorite: false,
    inbox_project: true,
    view_style: 'list',
    workspace_id: null,
    is_folder: false,
    collapsed: false,
  };
  const user: TodoistUser = {
    id: newId(),
    email: input.email,
    full_name: input.fullName,
    inbox_project_id: inbox.id,
    tz_info: tzInfo(input.timezone),
    start_day: startDay,
    lang: input.lang ?? 'en',
    premium_status: 'not_premium',
    is_premium: false,
    image_id: null,
    avatar_big: null,
    karma: null,
    karma_trend: null,
  };

  const passwordHash = input.password === undefined ? null : await hashPassword(input.password);

  await repo.transaction(async (trx) => {
    await trx.insertUser(user.id, hashToken(token), user, passwordHash);
    const rev = await trx.bumpRev(user.id);
    await trx.put(user.id, 'projects', inbox, rev);
    await trx.setUserData(user.id, user, rev);
  });

  return { user, token };
}
