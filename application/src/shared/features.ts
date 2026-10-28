// Set at build time from MYNOTE_FINANCE, see documentation/software/architecture.md
declare const __FEATURE_FINANCE__: boolean

export const FEATURE_FINANCE: boolean = __FEATURE_FINANCE__
