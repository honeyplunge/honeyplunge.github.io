// WebAudio Sync - Open Source Version
// Basic audio synchronization with manual tap sync
import { SyncManager } from '../core/syncManager.js';
import { BrowserUtils } from '../utils/browser.js';
import { Logger } from '../utils/logger.js';
export class WebAudioSyncOSSClass {
    constructor(options = {}) {
        this.isInitialized = false;
        this.options = {
            ...options,
            config: {
                logLevel: 'info',
                ...options.config,
            },
        };
        this.logger = new Logger(this.options.config, 'WebAudioSync-OSS');
        this.syncManager = new SyncManager({
            ...this.options,
            driftCorrection: {
                enabled: false, // Drift correction is Pro feature
                ...this.options.driftCorrection,
            },
        });
    }
    async initialize() {
        if (this.isInitialized) {
            return true;
        }
        this.logger.info('Initializing WebAudio Sync OSS...');
        try {
            const success = await this.syncManager.initialize();
            if (success) {
                this.isInitialized = true;
                this.logger.info('WebAudio Sync OSS initialized successfully');
            }
            return success;
        }
        catch (error) {
            this.logger.error('Failed to initialize WebAudio Sync OSS', error);
            return false;
        }
    }
    getAudioContext() {
        return this.syncManager.getAudioContext();
    }
    // Manual tap sync - Main OSS feature
    startManualTapSync(options = {}) {
        if (!this.isInitialized) {
            this.logger.warn('WebAudio Sync not initialized. Call initialize() first.');
            return;
        }
        this.logger.info('Starting manual tap sync (OSS feature)');
        const onTap = options.onTap;
        this.syncManager.startManualTapSync({
            pulseCount: options.pulseCount,
            pulseInterval: options.pulseInterval,
            onTap: onTap ? (tap) => {
                onTap(tap.timestamp, tap.expectedTime);
            } : undefined,
        });
    }
    // Latency detection
    async detectLatency() {
        if (!this.isInitialized) {
            throw new Error('WebAudio Sync not initialized. Call initialize() first.');
        }
        try {
            return await this.syncManager.detectLatency();
        }
        catch {
            // Return a proper LatencyMeasurement object
            return {
                outputLatency: 0.05,
                inputLatency: 0.05,
                totalLatency: 0.1,
                timestamp: Date.now(),
                confidence: 0.3,
                method: 'native',
            };
        }
    }
    async performPulseCheck() {
        if (!this.isInitialized) {
            throw new Error('WebAudio Sync not initialized. Call initialize() first.');
        }
        return this.syncManager.performPulseCheck();
    }
    // Sync status
    getSyncStatus() {
        if (!this.isInitialized) {
            return {
                isSynced: false,
                currentLatency: 0,
                drift: 0,
                timestamp: Date.now(),
                lastCheck: Date.now(),
                quality: 'poor',
            };
        }
        return this.syncManager.getSyncStatus();
    }
    getCurrentLatency() {
        if (!this.isInitialized) {
            return 0;
        }
        return this.syncManager.getCurrentLatency();
    }
    updateLatency(measurement) {
        this.syncManager.updateLatency(measurement);
    }
    setBaselineLatency(latency) {
        this.syncManager.setBaselineLatency(latency);
    }
    // Sync control
    async startSync() {
        if (!this.isInitialized) {
            await this.initialize();
        }
        return this.syncManager.startSync();
    }
    async stopSync() {
        return this.syncManager.stopSync();
    }
    // Calibration
    async calibrate() {
        if (!this.isInitialized) {
            throw new Error('WebAudio Sync not initialized. Call initialize() first.');
        }
        return this.syncManager.calibrate();
    }
    // Event handling
    addEventListener(listener) {
        this.syncManager.addEventListener(listener);
    }
    removeEventListener(listener) {
        this.syncManager.removeEventListener(listener);
    }
    // Cleanup
    async destroy() {
        this.isInitialized = false;
        return this.syncManager.destroy();
    }
    // Version info
    getVersion() {
        return '1.0.2';
    }
    getTier() {
        return 'oss';
    }
    // Utility methods
    async playTestTone(frequency = 1000, duration = 0.5) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        const engine = this.syncManager.getAudioEngine();
        engine.playTestTone(frequency, duration);
    }
    // Static methods
    static async isSupported() {
        return BrowserUtils.isAudioContextSupported();
    }
    static async hasMicrophoneAccess() {
        return BrowserUtils.hasMicrophoneAccess();
    }
}
// Create singleton instance
const instance = null;
export function createWebAudioSyncOSS(options = {}) {
    return new WebAudioSyncOSSClass(options);
}
export function getWebAudioSyncOSS() {
    return instance;
}
export default WebAudioSyncOSSClass;
