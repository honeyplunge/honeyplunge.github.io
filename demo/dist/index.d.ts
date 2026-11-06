import { SyncOptions, WebAudioSyncConfig } from './types';
import { WebAudioSyncOSSClass, createWebAudioSyncOSS } from './oss';
import type { WebAudioSyncOSS } from './oss';
export * from './types';
export { WebAudioSyncOSSClass, createWebAudioSyncOSS, getWebAudioSyncOSS, } from './oss';
export type { WebAudioSyncOSS } from './oss';
export { AudioEngine } from './core/audioEngine';
export { LatencyDetector } from './core/latencyDetector';
export { DriftCorrector } from './core/driftCorrector';
export { SyncManager } from './core/syncManager';
export type { SyncCalibrationResult } from './core/syncManager';
export { BrowserUtils } from './utils/browser';
export { MathUtils } from './utils/math';
export { Logger } from './utils/logger';
export interface WebAudioSyncFactoryOptions extends SyncOptions {
    config?: WebAudioSyncConfig;
}
/**
 * Factory function to create a WebAudio Sync OSS instance
 */
export declare function createWebAudioSync(options?: WebAudioSyncFactoryOptions): WebAudioSyncOSS;
/**
 * Check if WebAudio is supported in the current browser
 */
export declare function isSupported(): Promise<boolean>;
/**
 * Check if microphone access is available
 */
export declare function hasMicrophoneAccess(): Promise<boolean>;
/**
 * Get library version
 */
export declare function getVersion(): string;
/**
 * Get available tier features
 */
export declare function getTierFeatures(): Record<string, string[]>;
declare const _default: {
    createWebAudioSync: typeof createWebAudioSync;
    isSupported: typeof isSupported;
    hasMicrophoneAccess: typeof hasMicrophoneAccess;
    getVersion: typeof getVersion;
    getTierFeatures: typeof getTierFeatures;
    WebAudioSyncOSS: typeof WebAudioSyncOSSClass;
    createWebAudioSyncOSS: typeof createWebAudioSyncOSS;
};
export default _default;
