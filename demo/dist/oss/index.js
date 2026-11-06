"use strict";
// WebAudio Sync - Open Source Version
// Basic audio synchronization with manual tap sync
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWebAudioSyncOSS = exports.createWebAudioSyncOSS = exports.WebAudioSyncOSSClass = void 0;
const syncManager_1 = require("../core/syncManager");
const browser_1 = require("../utils/browser");
const logger_1 = require("../utils/logger");
class WebAudioSyncOSSClass {
    constructor(options = {}) {
        this.isInitialized = false;
        this.options = {
            ...options,
            config: {
                logLevel: 'info',
                ...options.config,
            },
        };
        this.logger = new logger_1.Logger(this.options.config, 'WebAudioSync-OSS');
        this.syncManager = new syncManager_1.SyncManager({
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
        return browser_1.BrowserUtils.isAudioContextSupported();
    }
    static async hasMicrophoneAccess() {
        return browser_1.BrowserUtils.hasMicrophoneAccess();
    }
}
exports.WebAudioSyncOSSClass = WebAudioSyncOSSClass;
// Create singleton instance
const instance = null;
function createWebAudioSyncOSS(options = {}) {
    return new WebAudioSyncOSSClass(options);
}
exports.createWebAudioSyncOSS = createWebAudioSyncOSS;
function getWebAudioSyncOSS() {
    return instance;
}
exports.getWebAudioSyncOSS = getWebAudioSyncOSS;
exports.default = WebAudioSyncOSSClass;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvb3NzL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSxzQ0FBc0M7QUFDdEMsbURBQW1EOzs7QUFZbkQscURBQXlFO0FBQ3pFLDhDQUFnRDtBQUNoRCw0Q0FBeUM7QUFxRHpDLE1BQWEsb0JBQW9CO0lBTS9CLFlBQWEsVUFBa0MsRUFBRTtRQUZ6QyxrQkFBYSxHQUFZLEtBQUssQ0FBQztRQUdyQyxJQUFJLENBQUMsT0FBTyxHQUFHO1lBQ2IsR0FBRyxPQUFPO1lBQ1YsTUFBTSxFQUFFO2dCQUNOLFFBQVEsRUFBRSxNQUFNO2dCQUNoQixHQUFHLE9BQU8sQ0FBQyxNQUFNO2FBQ2xCO1NBQ0YsQ0FBQztRQUVGLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxlQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztRQUNsRSxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUkseUJBQVcsQ0FBQztZQUNqQyxHQUFHLElBQUksQ0FBQyxPQUFPO1lBQ2YsZUFBZSxFQUFFO2dCQUNmLE9BQU8sRUFBRSxLQUFLLEVBQUUsa0NBQWtDO2dCQUNsRCxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsZUFBZTthQUNoQztTQUNGLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRCxLQUFLLENBQUMsVUFBVTtRQUNkLElBQUksSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO1lBQUEsT0FBTyxJQUFJLENBQUM7UUFBQSxDQUFDO1FBRXRDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLG1DQUFtQyxDQUFDLENBQUM7UUFFdEQsSUFBSSxDQUFDO1lBQ0gsTUFBTSxPQUFPLEdBQUcsTUFBTSxJQUFJLENBQUMsV0FBVyxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBRXBELElBQUksT0FBTyxFQUFFLENBQUM7Z0JBQ1osSUFBSSxDQUFDLGFBQWEsR0FBRyxJ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Y2UgVmVyc2lvblxuLy8gQmFzaWMgYXVkaW8gc3luY2hyb25pemF0aW9uIHdpdGggbWFudWFsIHRhcCBzeW5jXG5cbmltcG9ydCB7XG4gIExhdGVuY3lNZWFzdXJlbWVudCxcbiAgU3luY09wdGlvbnMsXG4gIFN5bmNTdGF0dXMsXG4gIFdlYkF1ZGlvU3luY0NvbmZpZyxcbiAgUHVsc2VDaGVja1Jlc3VsdCxcbiAgU3luY0V2ZW50TGlzdGVuZXIsXG4gIE1hbnVhbFRhcFN5bmNPcHRpb25zLFxuICBUYXBFdmVudCxcbn0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgU3luY01hbmFnZXIsIFN5bmNDYWxpYnJhdGlvblJlc3VsdCB9IGZyb20gJy4uL2NvcmUvc3luY01hbmFnZXInO1xuaW1wb3J0IHsgQnJvd3NlclV0aWxzIH0gZnJvbSAnLi4vdXRpbHMvYnJvd3Nlcic7XG5pbXBvcnQgeyBMb2dnZXIgfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuXG5leHBvcnQgaW50ZXJmYWNlIFdlYkF1ZGlvU3luY09TU09wdGlvbnMgZXh0ZW5kcyBTeW5jT3B0aW9ucyB7XG4gIGNvbmZpZz86IFdlYkF1ZGlvU3luY0NvbmZpZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBXZWJBdWRpb1N5bmNPU1Mge1xuICAvLyBJbml0aWFsaXphdGlvblxuICBpbml0aWFsaXplKCk6IFByb21pc2U8Ym9vbGVhbj47XG5cbiAgLy8gQXVkaW8gY29udGV4dCBhY2Nlc3NcbiAgZ2V0QXVkaW9Db250ZXh0KCk6IEF1ZGlvQ29udGV4dCB8IG51bGw7XG5cbiAgLy8gTWFudWFsIHRhcCBzeW5jIChtYWluIE9TUyBmZWF0dXJlKVxuICBzdGFydE1hbnVhbFRhcFN5bmMob3B0aW9ucz86IE1hbnVhbFRhcFN5bmNPcHRpb25zKTogdm9pZDtcblxuICAvLyBMYXRlbmN5IGRldGVjdGlvblxuICBkZXRlY3RMYXRlbmN5KCk6IFByb21pc2U8TGF0ZW5jeU1lYXN1cmVtZW50PjtcbiAgcGVyZm9ybVB1bHNlQ2hlY2soKTogUHJvbWlzZTxQdWxzZUNoZWNrUmVzdWx0PjtcblxuICAvLyBTeW5jIHN0YXR1c1xuICBnZXRTeW5jU3RhdHVzKCk6IFN5bmNTdGF0dXM7XG4gIGdldEN1cnJlbnRMYXRlbmN5KCk6IG51bWJlcjtcblxuICAvLyBGZWVkIGFuIGV4dGVybmFsbHkgbWVhc3VyZWQgbGF0ZW5jeSAob3duIG1lYXN1cmVtZW50IHBpcGVsaW5lKSBpbnRvIHRoZVxuICAvLyBzeW5jIGVuZ2luZSDigJQgdXBkYXRlcyBjdXJyZW50IGxhdGVuY3kgYW5kIHRoZSBkcmlmdCBoaXN0b3J5XG4gIHVwZGF0ZUxhdGVuY3kobWVhc3VyZW1lbnQ6IExhdGVuY3lNZWFzdXJlbWVudCk6IHZvaWQ7XG5cbiAgLy8gU2V0IHRoZSBiYXNlbGluZSBsYXRlbmN5IHRoYXQgZHJpZnQgaXMgbWVhc3VyZWQgYWdhaW5zdCAocmUtY2FsaWJyYXRlKVxuICBzZXRCYXNlbGluZUxhdGVuY3kobGF0ZW5jeTogbnVtYmVyKTogdm9pZDtcblxuICAvLyBTeW5jIGNvbnRyb2xcbiAgc3RhcnRTeW5jKCk6IFByb21pc2U8Ym9vbGVhbj47XG4gIHN0b3BTeW5jKCk6IFByb21pc2U8dm9pZD47XG5cbiAgLy8gQ2FsaWJyYXRpb25cbiAgY2FsaWJyYXRlKCk6IFByb21pc2U8U3luY0NhbGlicmF0aW9uUmVzdWx0PjtcblxuICAvLyBFdmVudCBoYW5kbGluZ1xuICBhZGRFdmVudExpc3RlbmVyKGxpc3RlbmVyOiBTeW5jRXZlbnRMaXN0ZW5lcik6IHZvaWQ7XG4gIHJlbW92ZUV2ZW50TGlzdGVuZXIobGlzdGVuZXI6IFN5bmNFdmVudExpc3RlbmVyKTogdm9pZDtcblxuICAvLyBDbGVhbnVwXG4gIGRlc3Ryb3koKTogUHJvbWlzZTx2b2lkPjtcblxuICAvLyBWZXJzaW9uIGluZm9cbiAgZ2V0VmVyc2lvbigpOiBzdHJpbmc7XG4gIGdldFRpZXIoKTogJ29zcyc7XG5cbiAgLy8gVXRpbGl0eVxuICBwbGF5VGVzdFRvbmUoZnJlcXVlbmN5PzogbnVtYmVyLCBkdXJhdGlvbj86IG51bWJlcik6IFByb21pc2U8dm9pZD47XG59XG5cbmV4cG9ydCBjbGFzcyBXZWJBdWRpb1N5bmNPU1NDbGFzcyBpbXBsZW1lbnRzIFdlYkF1ZGlvU3luY09TUyB7XG4gIHByaXZhdGUgc3luY01hbmFnZXI6IFN5bmNNYW5hZ2VyO1xuICBwcml2YXRlIG9wdGlvbnM6IFdlYkF1ZGlvU3luY09TU09wdGlvbnM7XG4gIHByaXZhdGUgbG9nZ2VyOiBMb2dnZXI7XG4gIHByaXZhdGUgaXNJbml0aWFsaXplZDogYm9vbGVhbiA9IGZhbHNlO1xuXG4gIGNvbnN0cnVjdG9yIChvcHRpb25zOiBXZWJBdWRpb1N5bmNPU1NPcHRpb25zID0ge30pIHtcbiAgICB0aGlzLm9wdGlvbnMgPSB7XG4gICAgICAuLi5vcHRpb25zLFxuICAgICAgY29uZmlnOiB7XG4gICAgICAgIGxvZ0xldmVsOiAnaW5mbycsXG4gICAgICAgIC4uLm9wdGlvbnMuY29uZmlnLFxuICAgICAgfSxcbiAgICB9O1xuXG4gICAgdGhpcy5sb2dnZXIgPSBuZXcgTG9nZ2VyKHRoaXMub3B0aW9ucy5jb25maWcsICdXZWJBdWRpb1N5bmMtT1NTJyk7XG4gICAgdGhpcy5zeW5jTWFuYWdlciA9IG5ldyBTeW5jTWFuYWdlcih7XG4gICAgICAuLi50aGlzLm9wdGlvbnMsXG4gICAgICBkcmlmdENvcnJlY3Rpb246IHtcbiAgICAgICAgZW5hYmxlZDogZmFsc2UsIC8vIERyaWZ0IGNvcnJlY3Rpb24gaXMgUHJvIGZlYXR1cmVcbiAgICAgICAgLi4udGhpcy5vcHRpb25zLmRyaWZ0Q29ycmVjdGlvbixcbiAgICAgIH0sXG4gICAgfSk7XG4gIH1cblxuICBhc3luYyBpbml0aWFsaXplICgpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICBpZiAodGhpcy5pc0luaXRpYWxpemVkKSB7cmV0dXJuIHRydWU7fVxuXG4gICAgdGhpcy5sb2dnZXIuaW5mbygnSW5pdGlhbGl6aW5nIFdlYkF1ZGlvIFN5bmMgT1NTLi4uJyk7XG5cbiAgICB0cnkge1xuICAgICAgY29uc3Qgc3VjY2VzcyA9IGF3YWl0IHRoaXMuc3luY01hbmFnZXIuaW5pdGlhbGl6ZSgpO1xuXG4gICAgICBpZiAoc3VjY2Vzcykge1xuICAgICAgICB0aGlzLmlzSW5pdGlhbGl6ZWQgPSB0cnVlO1xuICAgICAgICB0aGlzLmxvZ2dlci5pbmZvKCdXZWJBdWRpbyBTeW5jIE9TUyBpbml0aWFsaXplZCBzdWNjZXNzZnVsbHknKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHN1Y2Nlc3M7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHRoaXMubG9nZ2VyLmVycm9yKCdGYWlsZWQgdG8gaW5pdGlhbGl6ZSBXZWJBdWRpbyBTeW5jIE9TUycsIGVycm9yKTtcblxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIGdldEF1ZGlvQ29udGV4dCAoKTogQXVkaW9Db250ZXh0IHwgbnVsbCB7XG4gICAgcmV0dXJuIHRoaXMuc3luY01hbmFnZXIuZ2V0QXVkaW9Db250ZXh0KCk7XG4gIH1cblxuICAvLyBNYW51YWwgdGFwIHN5bmMgLSBNYWluIE9TUyBmZWF0dXJlXG4gIHN0YXJ0TWFudWFsVGFwU3luYyAob3B0aW9uczogTWFudWFsVGFwU3luY09wdGlvbnMgPSB7fSk6IHZvaWQge1xuICAgIGlmICghdGhpcy5pc0luaXRpYWxpemVkKSB7XG4gICAgICB0aGlzLmxvZ2dlci53YXJuKCdXZWJBdWRpbyBTeW5jIG5vdCBpbml0aWFsaXplZC4gQ2FsbCBpbml0aWFsaXplKCkgZmlyc3QuJyk7XG5cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmxvZ2dlci5pbmZvKCdTdGFydGluZyBtYW51YWwgdGFwIHN5bmMgKE9TUyBmZWF0dXJlKScpO1xuXG4gICAgY29uc3Qgb25UYXAgPSBvcHRpb25zLm9uVGFwO1xuXG4gICAgdGhpcy5zeW5jTWFuYWdlci5zdGFydE1hbnVhbFRhcFN5bmMoe1xuICAgICAgcHVsc2VDb3VudDogb3B0aW9ucy5wdWxzZUNvdW50LFxuICAgICAgcHVsc2VJbnRlcnZhbDogb3B0aW9ucy5wdWxzZUludGVydmFsLFxuICAgICAgb25UYXA6IG9uVGFwID8gKHRhcDogVGFwRXZlbnQpOiB2b2lkID0+IHtcbiAgICAgICAgb25UYXAodGFwLnRpbWVzdGFtcCwgdGFwLmV4cGVjdGVkVGltZSk7XG4gICAgICB9IDogdW5kZWZpbmVkLFxuICAgIH0pO1xuICB9XG5cbiAgLy8gTGF0ZW5jeSBkZXRlY3Rpb25cbiAgYXN5bmMgZGV0ZWN0TGF0ZW5jeSAoKTogUHJvbWlzZTxMYXRlbmN5TWVhc3VyZW1lbnQ+IHtcbiAgICBpZiAoIXRoaXMuaXNJbml0aWFsaXplZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdXZWJBdWRpbyBTeW5jIG5vdCBpbml0aWFsaXplZC4gQ2FsbCBpbml0aWFsaXplKCkgZmlyc3QuJyk7XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiBhd2FpdCB0aGlzLnN5bmNNYW5hZ2VyLmRldGVjdExhdGVuY3koKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIC8vIFJldHVybiBhIHByb3BlciBMYXRlbmN5TWVhc3VyZW1lbnQgb2JqZWN0XG4gICAgICByZXR1cm4ge1xuICAgICAgICBvdXRwdXRMYXRlbmN5OiAwLjA1LFxuICAgICAgICBpbnB1dExhdGVuY3k6IDAuMDUsXG4gICAgICAgIHRvdGFsTGF0ZW5jeTogMC4xLFxuICAgICAgICB0aW1lc3RhbXA6IERhdGUubm93KCksXG4gICAgICAgIGNvbmZpZGVuY2U6IDAuMyxcbiAgICAgICAgbWV0aG9kOiAnbmF0aXZlJyxcbiAgICAgIH07XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgcGVyZm9ybVB1bHNlQ2hlY2sgKCk6IFByb21pc2U8UHVsc2VDaGVja1Jlc3VsdD4ge1xuICAgIGlmICghdGhpcy5pc0luaXRpYWxpemVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1dlYkF1ZGlvIFN5bmMgbm90IGluaXRpYWxpemVkLiBDYWxsIGluaXRpYWxpemUoKSBmaXJzdC4nKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5zeW5jTWFuYWdlci5wZXJmb3JtUHVsc2VDaGVjaygpO1xuICB9XG5cbiAgLy8gU3luYyBzdGF0dXNcbiAgZ2V0U3luY1N0YXR1cyAoKTogU3luY1N0YXR1cyB7XG4gICAgaWYgKCF0aGlzLmlzSW5pdGlhbGl6ZWQpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGlzU3luY2VkOiBmYWxzZSxcbiAgICAgICAgY3VycmVudExhdGVuY3k6IDAsXG4gICAgICAgIGRyaWZ0OiAwLFxuICAgICAgICB0aW1lc3RhbXA6IERhdGUubm93KCksXG4gICAgICAgIGxhc3RDaGVjazogRGF0ZS5ub3coKSxcbiAgICAgICAgcXVhbGl0eTogJ3Bvb3InLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5zeW5jTWFuYWdlci5nZXRTeW5jU3RhdHVzKCk7XG4gIH1cblxuICBnZXRDdXJyZW50TGF0ZW5jeSAoKTogbnVtYmVyIHtcbiAgICBpZiAoIXRoaXMuaXNJbml0aWFsaXplZCkge1xuICAgICAgcmV0dXJuIDA7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuc3luY01hbmFnZXIuZ2V0Q3VycmVudExhdGVuY3koKTtcbiAgfVxuXG4gIHVwZGF0ZUxhdGVuY3kgKG1lYXN1cmVtZW50OiBMYXRlbmN5TWVhc3VyZW1lbnQpOiB2b2lkIHtcbiAgICB0aGlzLnN5bmNNYW5hZ2VyLnVwZGF0ZUxhdGVuY3kobWVhc3VyZW1lbnQpO1xuICB9XG5cbiAgc2V0QmFzZWxpbmVMYXRlbmN5IChsYXRlbmN5OiBudW1iZXIpOiB2b2lkIHtcbiAgICB0aGlzLnN5bmNNYW5hZ2VyLnNldEJhc2VsaW5lTGF0ZW5jeShsYXRlbmN5KTtcbiAgfVxuXG4gIC8vIFN5bmMgY29udHJvbFxuICBhc3luYyBzdGFydFN5bmMgKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgIGlmICghdGhpcy5pc0luaXRpYWxpemVkKSB7XG4gICAgICBhd2FpdCB0aGlzLmluaXRpYWxpemUoKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5zeW5jTWFuYWdlci5zdGFydFN5bmMoKTtcbiAgfVxuXG4gIGFzeW5jIHN0b3BTeW5jICgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICByZXR1cm4gdGhpcy5zeW5jTWFuYWdlci5zdG9wU3luYygpO1xuICB9XG5cbiAgLy8gQ2FsaWJyYXRpb25cbiAgYXN5bmMgY2FsaWJyYXRlICgpOiBQcm9taXNlPFN5bmNDYWxpYnJhdGlvblJlc3VsdD4ge1xuICAgIGlmICghdGhpcy5pc0luaXRpYWxpemVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1dlYkF1ZGlvIFN5bmMgbm90IGluaXRpYWxpemVkLiBDYWxsIGluaXRpYWxpemUoKSBmaXJzdC4nKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5zeW5jTWFuYWdlci5jYWxpYnJhdGUoKTtcbiAgfVxuXG4gIC8vIEV2ZW50IGhhbmRsaW5nXG4gIGFkZEV2ZW50TGlzdGVuZXIgKGxpc3RlbmVyOiBTeW5jRXZlbnRMaXN0ZW5lcik6IHZvaWQge1xuICAgIHRoaXMuc3luY01hbmFnZXIuYWRkRXZlbnRMaXN0ZW5lcihsaXN0ZW5lcik7XG4gIH1cblxuICByZW1vdmVFdmVudExpc3RlbmVyIChsaXN0ZW5lcjogU3luY0V2ZW50TGlzdGVuZXIpOiB2b2lkIHtcbiAgICB0aGlzLnN5bmNNYW5hZ2VyLnJlbW92ZUV2ZW50TGlzdGVuZXIobGlzdGVuZXIpO1xuICB9XG5cbiAgLy8gQ2xlYW51cFxuICBhc3luYyBkZXN0cm95ICgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLmlzSW5pdGlhbGl6ZWQgPSBmYWxzZTtcblxuICAgIHJldHVybiB0aGlzLnN5bmNNYW5hZ2VyLmRlc3Ryb3koKTtcbiAgfVxuXG4gIC8vIFZlcnNpb24gaW5mb1xuICBnZXRWZXJzaW9uICgpOiBzdHJpbmcge1xuICAgIHJldHVybiAnMS4wLjInO1xuICB9XG5cbiAgZ2V0VGllciAoKTogJ29zcycge1xuICAgIHJldHVybiAnb3NzJztcbiAgfVxuXG4gIC8vIFV0aWxpdHkgbWV0aG9kc1xuICBhc3luYyBwbGF5VGVzdFRvbmUgKGZyZXF1ZW5jeTogbnVtYmVyID0gMTAwMCwgZHVyYXRpb246IG51bWJlciA9IDAuNSk6IFByb21pc2U8dm9pZD4ge1xuICAgIGlmICghdGhpcy5pc0luaXRpYWxpemVkKSB7XG4gICAgICBhd2FpdCB0aGlzLmluaXRpYWxpemUoKTtcbiAgICB9XG5cbiAgICBjb25zdCBlbmdpbmUgPSB0aGlzLnN5bmNNYW5hZ2VyLmdldEF1ZGlvRW5naW5lKCk7XG5cbiAgICBlbmdpbmUucGxheVRlc3RUb25lKGZyZXF1ZW5jeSwgZHVyYXRpb24pO1xuICB9XG5cbiAgLy8gU3RhdGljIG1ldGhvZHNcbiAgc3RhdGljIGFzeW5jIGlzU3VwcG9ydGVkICgpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICByZXR1cm4gQnJvd3NlclV0aWxzLmlzQXVkaW9Db250ZXh0U3VwcG9ydGVkKCk7XG4gIH1cblxuICBzdGF0aWMgYXN5bmMgaGFzTWljcm9waG9uZUFjY2VzcyAoKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgcmV0dXJuIEJyb3dzZXJVdGlscy5oYXNNaWNyb3Bob25lQWNjZXNzKCk7XG4gIH1cbn1cblxuLy8gQ3JlYXRlIHNpbmdsZXRvbiBpbnN0YW5jZVxuY29uc3QgaW5zdGFuY2U6IFdlYkF1ZGlvU3luY09TU0NsYXNzIHwgbnVsbCA9IG51bGw7XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVXZWJBdWRpb1N5bmNPU1MgKG9wdGlvbnM6IFdlYkF1ZGlvU3luY09TU09wdGlvbnMgPSB7fSk6IFdlYkF1ZGlvU3luY09TUyB7XG4gIHJldHVybiBuZXcgV2ViQXVkaW9TeW5jT1NTQ2xhc3Mob3B0aW9ucyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRXZWJBdWRpb1N5bmNPU1MgKCk6IFdlYkF1ZGlvU3luY09TUyB8IG51bGwge1xuICByZXR1cm4gaW5zdGFuY2U7XG59XG5cbmV4cG9ydCBkZWZhdWx0IFdlYkF1ZGlvU3luY09TU0NsYXNzO1xuIl19