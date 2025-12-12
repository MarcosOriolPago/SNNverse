// src/custom.d.ts

declare module '*.svg' {
  import * as React from 'react';

  // This line validates the named import { ReactComponent }
  export const ReactComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement> & { title?: string }>;

  // This line validates the default import
  const src: string;
  export default src;
}