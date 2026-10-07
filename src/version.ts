declare const __APP_VERSION__: string;
declare const __BUILD_TIME__: string;

// Dynamically injected via Vite define at build/start time
export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'v2.6.0';
export const BUILD_TIME = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : 'dev';
export const FULL_VERSION_STRING = `${APP_VERSION} (Build ${BUILD_TIME})`;
