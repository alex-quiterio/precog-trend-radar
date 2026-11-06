// PRECOG / Trend Radar · Keyboard: 1–9 jump to a channel, [ and ] step through channels, ← and → through
// the channel's topics. Ignored while typing, and with a modifier key held.
import { channels } from '@/channels';
import type { AppContext } from '@/context';

/** What a key press does, or null for nothing (so the browser keeps it). */
export function shortcut(
  { app, actions }: Pick<AppContext, 'app' | 'actions'>,
  e: Pick<KeyboardEvent, 'key' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>,
  target: Element | null,
): (() => void) | null {
  if (e.altKey || e.ctrlKey || e.metaKey) return null;
  if (target?.closest('input, textarea, select, [contenteditable], dialog, .grip')) return null;
  if (/^[1-9]$/.test(e.key) && !e.shiftKey) {
    const c = channels(app)[+e.key - 1];
    return c
      ? () => {
          actions.selectLens(c.lensId);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      : null;
  }
  if (e.key === '[' || e.key === ']') return () => actions.shiftLens(e.key === ']' ? 1 : -1);
  if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.shiftKey && !target?.closest('.table-scroll'))
    return () => actions.shiftTopic(e.key === 'ArrowRight' ? 1 : -1);
  return null;
}
/** Listens for the shortcuts. Returns a function that stops listening. */
export function installShortcuts(ctx: AppContext, doc: Document = document): () => void {
  const onKey = (e: KeyboardEvent) => {
    const run = shortcut(ctx, e, e.target instanceof Element ? e.target : doc.body);
    if (!run) return;
    e.preventDefault();
    run();
  };
  doc.addEventListener('keydown', onKey);
  return () => doc.removeEventListener('keydown', onKey);
}
