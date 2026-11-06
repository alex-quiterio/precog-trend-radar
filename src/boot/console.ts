// PRECOG / Trend Radar · Public hooks: add your own trend source from the browser console or a <script>,
// e.g. PRECOG.registerAdapter({ id, label, fetch }) (see docs/ADDING-SOURCES.md).
import { looksLikePerson } from '@core/guard';
import { ADAPTERS, registerAdapter } from '@sources/registry';

declare global {
  interface Window {
    PRECOG: unknown;
  }
}
export function exposeConsoleHooks(): void {
  window.PRECOG = { registerAdapter, adapters: ADAPTERS, looksLikePerson };
}
