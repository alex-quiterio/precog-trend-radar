/// <reference types="vite/client" />
import type { fmtVal, fmtPct, fmtTime, fmtTick, fmtAxis, ago, changeLabel, nf0, nf1 } from './core/format';
import type { arrowOf, levelOf } from './core/stats';

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<object, object, unknown>;
  export default component;
}

// Formatting helpers registered on app.config.globalProperties in main.ts, usable in every template.
declare module 'vue' {
  interface ComponentCustomProperties {
    fmtVal: typeof fmtVal;
    fmtPct: typeof fmtPct;
    fmtTime: typeof fmtTime;
    fmtTick: typeof fmtTick;
    fmtAxis: typeof fmtAxis;
    ago: typeof ago;
    changeLabel: typeof changeLabel;
    nf0: typeof nf0;
    nf1: typeof nf1;
    arrowOf: typeof arrowOf;
    levelOf: typeof levelOf;
  }
}
export {};
