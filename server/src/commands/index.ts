import { completionHandlers } from './completion';
import type { Handler } from './context';
import { itemHandlers } from './items';
import { labelHandlers } from './labels';
import { projectHandlers } from './projects';

/** The sync commands the app sends. Anything else is answered as unknown. */
export const HANDLERS: Record<string, Handler> = {
  ...itemHandlers,
  ...completionHandlers,
  ...projectHandlers,
  ...labelHandlers,
};
