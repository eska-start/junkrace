declare module 'next' {
  export type NextConfig = Record<string, any>;
  export type Metadata = import('next/dist/lib/metadata/types/metadata-interface').Metadata;
  export type Viewport = import('next/dist/lib/metadata/types/extra-types').Viewport;
  export namespace MetadataRoute {
    export type Manifest = import('next/dist/lib/metadata/types/manifest-types').Manifest;
  }
  const next: any;
  export default next;
}

declare module 'next/types.js' {
  export type ResolvingMetadata = Promise<any>;
  export type ResolvingViewport = Promise<any>;
}

declare module 'next/server' {
  export * from 'next/dist/server/web/exports/index';
}

declare module 'next/server.js' {
  export * from 'next/dist/server/web/exports/index';
}
