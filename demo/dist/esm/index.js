// WebAudio Sync - Open Source Edition
// Public entry point: OSS features only (no Pro code in this package)
import { WebAudioSyncOSSClass, createWebAudioSyncOSS } from './oss/index.js';
// Export types
export * from './types/index.js';
// Export OSS version
export { WebAudioSyncOSSClass, createWebAudioSyncOSS, getWebAudioSyncOSS, } from './oss/index.js';
// Export core components
export { AudioEngine } from './core/audioEngine.js';
export { LatencyDetector } from './core/latencyDetector.js';
export { DriftCorrector } from './core/driftCorrector.js';
export { SyncManager } from './core/syncManager.js';
// Export utilities
export { BrowserUtils } from './utils/browser.js';
export { MathUtils } from './utils/math.js';
export { Logger } from './utils/logger.js';
/**
 * Factory function to create a WebAudio Sync OSS instance
 */
export function createWebAudioSync(options = {}) {
    return createWebAudioSyncOSS(options);
}
/**
 * Check if WebAudio is supported in the current browser
 */
export async function isSupported() {
    return window.AudioContext !== undefined ||
        window.webkitAudioContext !== undefined;
}
/**
 * Check if microphone access is available
 */
export async function hasMicrophoneAccess() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Get library version
 */
export function getVersion() {
    return '1.0.2';
}
/**
 * Get available tier features
 */
export function getTierFeatures() {
    return {
        oss: [
            'Manual tap sync',
            'Pulse check latency measurement',
            'Native browser latency detection',
            'Basic audio synchronization',
        ],
    };
}
// Default export
export default {
    createWebAudioSync,
    isSupported,
    hasMicrophoneAccess,
    getVersion,
    getTierFeatures,
    WebAudioSyncOSS: WebAudioSyncOSSClass,
    createWebAudioSyncOSS,
};
