"use strict";
// Main Sync Manager for WebAudio Sync
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncManager = void 0;
const audioEngine_1 = require("./audioEngine");
const latencyDetector_1 = require("./latencyDetector");
const driftCorrector_1 = require("./driftCorrector");
const logger_1 = require("../utils/logger");
class SyncManager {
    constructor(options = {}) {
        this._isSyncing = false;
        this._isCalibrating = false;
        this.currentLatency = 0;
        this.baselineLatency = 0;
        this.currentDrift = 0;
        this.syncOffset = 0;
        this.eventListeners = new Set();
        this.calibrationTimeout = null;
        this.options = {
            pulseCheck: { duration: 2, frequency: 4, volume: 0.5, threshold: 0.1, maxRetries: 3 },
            driftCorrection: { enabled: true, predictionWindow: 10, correctionStrength: 0.5, maxCorrection: 0.1, historySize: 100 },
            config: {},
            ...options,
        };
        this.config = { ...this.options.config };
        this.logger = new logger_1.Logger(this.config, 'SyncManager');
        this.audioEngine = new audioEngine_1.AudioEngine();
        this.latencyDetector = new latencyDetector_1.LatencyDetector(this.audioEngine, {
            pulseCheck: this.options.pulseCheck,
            useNativeLatency: true,
            calibrationRounds: 3,
            onLatencyUpdate: this.handleLatencyUpdate.bind(this),
            onError: this.handleError.bind(this),
        });
        this.driftCorrector = new driftCorrector_1.DriftCorrector(this.options.driftCorrection);
    }
    isSyncing() { return this._isSyncing; }
    isCalibrating() { return this._isCalibrating; }
    async initialize() {
        try {
            const success = await this.audioEngine.initialize();
            if (!success) {
                this.logger.error('Failed to initialize AudioEngine');
                return false;
            }
            logger_1.Logger.configure(this.config);
            this.logger.info('SyncManager initialized successfully');
            return true;
        }
        catch (error) {
            this.logger.error('Failed to initialize SyncManager', error);
            return false;
        }
    }
    getAudioContext() {
        return this.audioEngine.getContext();
    }
    getAudioEngine() {
        return this.audioEngine;
    }
    async startSync() {
        if (this._isSyncing) {
            this.logger.warn('Sync already in progress');
            return true;
        }
        this.logger.info('Starting audio synchronization...');
        this._isSyncing = true;
        try {
            if (!this.audioEngine.getContext()) {
                const initSuccess = await this.audioEngine.initialize();
                if (!initSuccess) {
                    this._isSyncing = false;
                    return false;
                }
            }
            this.latencyDetector.start();
            if (this.options.driftCorrection?.enabled !== false) {
                this.driftCorrector.start();
            }
            this.logger.info('Audio synchronization started');
            return true;
        }
        catch (error) {
            this.logger.error('Failed to start sync', error);
            this._isSyncing = false;
            return false;
        }
    }
    async stopSync() {
        if (!this._isSyncing) {
            this.logger.warn('Sync not in progress');
            return;
        }
        this.logger.info('Stopping audio synchronization...');
        this._isSyncing = false;
        try {
            this.latencyDetector.stop();
            this.driftCorrector.stop();
            this.logger.info('Audio synchronization stopped');
        }
        catch (error) {
            this.logger.error('Failed to stop sync', error);
        }
    }
    startManualTapSync(options = {}) {
        this.logger.info('Starting manual tap sync', options);
        this.latencyDetector.startManualTapSync({ pulseCount: options.pulseCount, pulseInterval: options.pulseInterval, onTap: options.onTap });
    }
    async detectLatency() {
        // Don't require sync to be started for latency detection
        // This allows tests to call detectLatency directly
        try {
            const result = await this.latencyDetector.detectLatency();
            return result;
        }
        catch {
            // Fall back to current latency if detection fails
            const fallback = this.getCurrentLatency();
            if (typeof fallback === 'number') {
                return {
                    outputLatency: fallback / 2,
                    inputLatency: fallback / 2,
                    totalLatency: fallback,
                    timestamp: Date.now(),
                    confidence: 0.3,
                    method: 'native',
                };
            }
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
        return this.latencyDetector.performPulseCheck();
    }
    async calibrate() {
        if (this._isCalibrating) {
            this.logger.warn('Calibration already in progress');
            return { success: false, latency: this.currentLatency, measurements: [], confidence: 0 };
        }
        this._isCalibrating = true;
        this.logger.info('Starting calibration...');
        try {
            const result = await this.latencyDetector.calibrate();
            if (result?.success) {
                const measurement = {
                    outputLatency: result.outputLatency ?? 0,
                    inputLatency: result.inputLatency ?? 0,
                    totalLatency: result.latency,
                    timestamp: result.timestamp,
                    confidence: result.confidence,
                    method: 'pulse',
                };
                // Calibration defines the baseline; drift of the calibration sample
                // itself is zero by definition
                this.baselineLatency = result.latency;
                this.driftCorrector.addMeasurement(measurement, this.baselineLatency);
                this.currentLatency = result.latency;
            }
            this.logger.info('Calibration completed', { success: result?.success, latency: result?.latency });
            return {
                success: result?.success ?? false,
                latency: result?.latency ?? this.currentLatency,
                outputLatency: result?.outputLatency ?? 0,
                measurements: result?.measurements ?? [],
                confidence: result?.confidence ?? 0,
                method: result?.method,
            };
        }
        catch (error) {
            this.logger.error('Calibration failed', error);
            return { success: false, latency: this.currentLatency, measurements: [], confidence: 0 };
        }
        finally {
            this._isCalibrating = false;
        }
    }
    applyDriftCorrection() {
        if (this.options.driftCorrection?.enabled !== false) {
            const correction = this.driftCorrector.applyCorrection();
            if (correction) {
                this.syncOffset = correction.correction;
                this.currentDrift = correction.correction;
                this.emitEvent('drift:correction', correction);
                return correction;
            }
        }
        return null;
    }
    getDriftTrend() { return this.driftCorrector.getDriftTrend(); }
    getCurrentDrift() { return this.currentDrift; }
    getSyncStatus() {
        const drift = this.driftCorrector.getCurrentDrift();
        const latency = this.currentLatency;
        const timestamp = Date.now();
        let quality = 'excellent';
        const absDrift = Math.abs(drift);
        if (absDrift < 0.005) {
            quality = 'excellent';
        }
        else if (absDrift < 0.015) {
            quality = 'good';
        }
        else if (absDrift < 0.03) {
            quality = 'fair';
        }
        else {
            quality = 'poor';
        }
        return { isSynced: absDrift < 0.05, currentLatency: latency, drift, timestamp, lastCheck: timestamp, quality };
    }
    getCurrentLatency() { return this.currentLatency; }
    /**
     * Set the baseline latency that drift is measured against.
     * Called by calibrate(); exposed so integrators can re-baseline after
     * intentionally changing the output device.
     */
    setBaselineLatency(latency) {
        this.baselineLatency = latency;
    }
    addEventListener(listener) { this.eventListeners.add(listener); }
    removeEventListener(listener) { this.eventListeners.delete(listener); }
    emitEvent(type, data) {
        const event = { type, data, timestamp: Date.now() };
        this.eventListeners.forEach(listener => {
            try {
                listener(event);
            }
            catch (error) {
                this.logger.error('Error in event listener', error);
            }
        });
    }
    handleLatencyUpdate(measurement) {
        // Drift is the deviation from the calibrated baseline, not from the
        // previous sample — otherwise a steadily growing latency would show
        // zero trend
        if (this.baselineLatency === 0) {
            this.baselineLatency = measurement.totalLatency;
        }
        this.driftCorrector.addMeasurement(measurement, this.baselineLatency);
        this.currentLatency = measurement.totalLatency;
        this.emitEvent('latency:update', measurement);
        if (this.options.onLatencyUpdate) {
            this.options.onLatencyUpdate(measurement);
        }
    }
    /**
     * Feed an externally produced latency measurement (e.g. Pro acoustic
     * loopback) into the sync manager: updates the current latency and the
     * drift history (drift = measured - baseline).
     */
    updateLatency(measurement) {
        this.handleLatencyUpdate(measurement);
    }
    handleError(error) {
        this.emitEvent('error', error);
        if (this.options.onError) {
            this.options.onError(error);
        }
    }
    async destroy() {
        this.logger.info('Destroying SyncManager...');
        try {
            await this.stopSync();
            if (this.calibrationTimeout) {
                clearTimeout(this.calibrationTimeout);
                this.calibrationTimeout = null;
            }
            this.eventListeners.clear();
            await this.audioEngine.close();
            this.latencyDetector.cleanup();
            this.driftCorrector.reset();
            this._isSyncing = false;
            this._isCalibrating = false;
            this.currentLatency = 0;
            this.currentDrift = 0;
            this.syncOffset = 0;
            this.logger.info('SyncManager destroyed');
        }
        catch (error) {
            this.logger.error('Failed to destroy SyncManager', error);
        }
    }
}
exports.SyncManager = SyncManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3luY01hbmFnZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvY29yZS9zeW5jTWFuYWdlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsc0NBQXNDOzs7QUFhdEMsK0NBQTRDO0FBQzVDLHVEQUE4RTtBQUM5RSxxREFBbUU7QUFDbkUsNENBQXlDO0FBZXpDLE1BQWEsV0FBVztJQWdCdEIsWUFBYSxVQUE4QixFQUFFO1FBVHJDLGVBQVUsR0FBWSxLQUFLLENBQUM7UUFDNUIsbUJBQWMsR0FBWSxLQUFLLENBQUM7UUFDaEMsbUJBQWMsR0FBVyxDQUFDLENBQUM7UUFDM0Isb0JBQWUsR0FBVyxDQUFDLENBQUM7UUFDNUIsaUJBQVksR0FBVyxDQUFDLENBQUM7UUFDekIsZUFBVSxHQUFXLENBQUMsQ0FBQztRQUN2QixtQkFBYyxHQUEyQixJQUFJLEdBQUcsRUFBRSxDQUFDO1FBQ25ELHVCQUFrQixHQUFrQixJQUFJLENBQUM7UUFHL0MsSUFBSSxDQUFDLE9BQU8sR0FBRztZQUNiLFVBQVUsRUFBRSxFQUFFLFFBQVEsRUFBRSxDQUFDLEVBQUUsU0FBUyxFQUFFLENBQUMsRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFFLFNBQVMsRUFBRSxHQUFHLEVBQUUsVUFBVSxFQUFFLENBQUMsRUFBRTtZQUNyRixlQUFlLEVBQUUsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLGdCQUFnQixFQUFFLEVBQUUsRUFBRSxrQkFBa0IsRUFBRSxHQUFHLEVBQUUsYUFBYSxFQUFFLEdBQUcsRUFBRSxXQUFXLEVBQUUsR0FBRyxFQUFFO1lBQ3ZILE1BQU0sRUFBRSxFQUFFO1lBQ1YsR0FBRyxPQUFPO1NBQ1gsQ0FBQztRQUNGLElBQUksQ0FBQyxNQUFNLEdBQUcsRUFBRSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDekMsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLGVBQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFF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QUFJLENBQUMsVUFBVSxHQUFHLENBQUMsQ0FBQztZQUMxSCxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDO1FBQzVDLENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2YsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsK0JBQStCLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDNUQsQ0FBQztJQUNILENBQUM7Q0FDRjtBQTVURCxrQ0E0VEMiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBNYWluIFN5bmMgTWFuYWdlciBmb3IgV2ViQXVkaW8gU3luY1xuXG5pbXBvcnQge1xuICBMYXRlbmN5TWVhc3VyZW1lbnQsXG4gIFN5bmNPcHRpb25zLFxuICBTeW5jU3RhdHVzLFxuICBUYXBFdmVudCxcbiAgU3luY0V2ZW50LFxuICBTeW5jRXZlbnRMaXN0ZW5lcixcbiAgU3luY0V2ZW50VHlwZSxcbiAgV2ViQXVkaW9TeW5jQ29uZmlnLFxuICBQdWxzZUNoZWNrUmVzdWx0LFxufSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBBdWRpb0VuZ2luZSB9IGZyb20gJy4vYXVkaW9FbmdpbmUnO1xuaW1wb3J0IHsgTGF0ZW5jeURldGVjdG9yLCBMYXRlbmN5Q2FsaWJyYXRpb25SZXN1bHQgfSBmcm9tICcuL2xhdGVuY3lEZXRlY3Rvcic7XG5pbXBvcnQgeyBEcmlmdENvcnJlY3RvciwgRHJpZnRDb3JyZWN0aW9uIH0gZnJvbSAnLi9kcmlmdENvcnJlY3Rvcic7XG5pbXBvcnQgeyBMb2dnZXIgfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuXG5leHBvcnQgaW50ZXJmYWNlIFN5bmNNYW5hZ2VyT3B0aW9ucyBleHRlbmRzIFN5bmNPcHRpb25zIHtcbiAgY29uZmlnPzogV2ViQXVkaW9TeW5jQ29uZmlnO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFN5bmNDYWxpYnJhdGlvblJlc3VsdCB7XG4gIHN1Y2Nlc3M6IGJvb2xlYW47XG4gIGxhdGVuY3k6IG51bWJlcjtcbiAgb3V0cHV0TGF0ZW5jeT86IG51bWJlcjtcbiAgbWVhc3VyZW1lbnRzOiBMYXRlbmN5TWVhc3VyZW1lbnRbXTtcbiAgY29uZmlkZW5jZTogbnVtYmVyO1xuICBtZXRob2Q/OiBMYXRlbmN5TWVhc3VyZW1lbnRbJ21ldGhvZCddO1xufVxuXG5leHBvcnQgY2xhc3MgU3luY01hbmFnZXIge1xuICBwcml2YXRlIGF1ZGlvRW5naW5lOiBBdWRpb0VuZ2luZTtcbiAgcHJpdmF0ZSBsYXRlbmN5RGV0ZWN0b3I6IExhdGVuY3lEZXRlY3RvcjtcbiAgcHJpdmF0ZSBkcmlmdENvcnJlY3RvcjogRHJpZnRDb3JyZWN0b3I7XG4gIHByaXZhdGUgb3B0aW9uczogU3luY01hbmFnZXJPcHRpb25zO1xuICBwcml2YXRlIGNvbmZpZzogV2ViQXVkaW9TeW5jQ29uZmlnO1xuICBwcml2YXRlIGxvZ2dlcjogTG9nZ2VyO1xuICBwcml2YXRlIF9pc1N5bmNpbmc6IGJvb2xlYW4gPSBmYWxzZTtcbiAgcHJpdmF0ZSBfaXNDYWxpYnJhdGluZzogYm9vbGVhbiA9IGZhbHNlO1xuICBwcml2YXRlIGN1cnJlbnRMYXRlbmN5OiBudW1iZXIgPSAwO1xuICBwcml2YXRlIGJhc2VsaW5lTGF0ZW5jeTogbnVtYmVyID0gMDtcbiAgcHJpdmF0ZSBjdXJyZW50RHJpZnQ6IG51bWJlciA9IDA7XG4gIHByaXZhdGUgc3luY09mZnNldDogbnVtYmVyID0gMDtcbiAgcHJpdmF0ZSBldmVudExpc3RlbmVyczogU2V0PFN5bmNFdmVudExpc3RlbmVyPiA9IG5ldyBTZXQoKTtcbiAgcHJpdmF0ZSBjYWxpYnJhdGlvblRpbWVvdXQ6IG51bWJlciB8IG51bGwgPSBudWxsO1xuXG4gIGNvbnN0cnVjdG9yIChvcHRpb25zOiBTeW5jTWFuYWdlck9wdGlvbnMgPSB7fSkge1xuICAgIHRoaXMub3B0aW9ucyA9IHtcbiAgICAgIHB1bHNlQ2hlY2s6IHsgZHVyYXRpb246IDIsIGZyZXF1ZW5jeTogNCwgdm9sdW1lOiAwLjUsIHRocmVzaG9sZDogMC4xLCBtYXhSZXRyaWVzOiAzIH0sXG4gICAgICBkcmlmdENvcnJlY3Rpb246IHsgZW5hYmxlZDogdHJ1ZSwgcHJlZGljdGlvbldpbmRvdzogMTAsIGNvcnJlY3Rpb25TdHJlbmd0aDogMC41LCBtYXhDb3JyZWN0aW9uOiAwLjEsIGhpc3RvcnlTaXplOiAxMDAgfSxcbiAgICAgIGNvbmZpZzoge30sXG4gICAgICAuLi5vcHRpb25zLFxuICAgIH07XG4gICAgdGhpcy5jb25maWcgPSB7IC4uLnRoaXMub3B0aW9ucy5jb25maWcgfTtcbiAgICB0aGlzLmxvZ2dlciA9IG5ldyBMb2dnZXIodGhpcy5jb25maWcsICdTeW5jTWFuYWdlcicpO1xuICAgIHRoaXMuYXVkaW9FbmdpbmUgPSBuZXcgQXVkaW9FbmdpbmUoKTtcbiAgICB0aGlzLmxhdGVuY3lEZXRlY3RvciA9IG5ldyBMYXRlbmN5RGV0ZWN0b3IodGhpcy5hdWRpb0VuZ2luZSwge1xuICAgICAgcHVsc2VDaGVjazogdGhpcy5vcHRpb25zLnB1bHNlQ2hlY2ssXG4gICAgICB1c2VOYXRpdmVMYXRlbmN5OiB0cnVlLFxuICAgICAgY2FsaWJyYXRpb25Sb3VuZHM6IDMsXG4gICAgICBvbkxhdGVuY3lVcGRhdGU6IHRoaXMuaGFuZGxlTGF0ZW5jeVVwZGF0ZS5iaW5kKHRoaXMpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkVycm9yOiB0aGlzLmhhbmRsZUVycm9yLmJpbmQodGhpcyksXG4gICAgfSk7XG4gICAgdGhpcy5kcmlmdENvcnJlY3RvciA9IG5ldyBEcmlmdENvcnJlY3Rvcih0aGlzLm9wdGlvbnMuZHJpZnRDb3JyZWN0aW9uKTtcbiAgfVxuXG4gIGlzU3luY2luZyAoKTogYm9vbGVhbiB7IHJldHVybiB0aGlzLl9pc1N5bmNpbmc7IH1cbiAgaXNDYWxpYnJhdGluZyAoKTogYm9vbGVhbiB7IHJldHVybiB0aGlzLl9pc0NhbGlicmF0aW5nOyB9XG5cbiAgYXN5bmMgaW5pdGlhbGl6ZSAoKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHN1Y2Nlc3MgPSBhd2FpdCB0aGlzLmF1ZGlvRW5naW5lLmluaXRpYWxpemUoKTtcblxuICAgICAgaWYgKCFzdWNjZXNzKSB7XG4gICAgICAgIHRoaXMubG9nZ2VyLmVycm9yKCdGYWlsZWQgdG8gaW5pdGlhbGl6ZSBBdWRpb0VuZ2luZScpO1xuXG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgTG9nZ2VyLmNvbmZpZ3VyZSh0aGlzLmNvbmZpZyk7XG4gICAgICB0aGlzLmxvZ2dlci5pbmZvKCdTeW5jTWFuYWdlciBpbml0aWFsaXplZCBzdWNjZXNzZnVsbHknKTtcblxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHRoaXMubG9nZ2VyLmVycm9yKCdGYWlsZWQgdG8gaW5pdGlhbGl6ZSBTeW5jTWFuYWdlcicsIGVycm9yKTtcblxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIGdldEF1ZGlvQ29udGV4dCAoKTogQXVkaW9Db250ZXh0IHwgbnVsbCB7XG4gICAgcmV0dXJuIHRoaXMuYXVkaW9FbmdpbmUuZ2V0Q29udGV4dCgpO1xuICB9XG5cbiAgZ2V0QXVkaW9FbmdpbmUgKCk6IEF1ZGlvRW5naW5lIHtcbiAgICByZXR1cm4gdGhpcy5hdWRpb0VuZ2luZTtcbiAgfVxuXG4gIGFzeW5jIHN0YXJ0U3luYyAoKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgaWYgKHRoaXMuX2lzU3luY2luZykge1xuICAgICAgdGhpcy5sb2dnZXIud2FybignU3luYyBhbHJlYWR5IGluIHByb2dyZXNzJyk7XG5cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHRoaXMubG9nZ2VyLmluZm8oJ1N0YXJ0aW5nIGF1ZGlvIHN5bmNocm9uaXphdGlvbi4uLicpO1xuICAgIHRoaXMuX2lzU3luY2luZyA9IHRydWU7XG4gICAgdHJ5IHtcbiAgICAgIGlmICghdGhpcy5hdWRpb0VuZ2luZS5nZXRDb250ZXh0KCkpIHtcbiAgICAgICAgY29uc3QgaW5pdFN1Y2Nlc3MgPSBhd2FpdCB0aGlzLmF1ZGlvRW5naW5lLmluaXRpYWxpemUoKTtcblxuICAgICAgICBpZiAoIWluaXRTdWNjZXNzKSB7XG4gICAgICAgICAgdGhpcy5faXNTeW5jaW5nID0gZmFsc2U7XG5cbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdGhpcy5sYXRlbmN5RGV0ZWN0b3Iuc3RhcnQoKTtcbiAgICAgIGlmICh0aGlzLm9wdGlvbnMuZHJpZnRDb3JyZWN0aW9uPy5lbmFibGVkICE9PSBmYWxzZSkge1xuICAgICAgICB0aGlzLmRyaWZ0Q29ycmVjdG9yLnN0YXJ0KCk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMubG9nZ2VyLmluZm8oJ0F1ZGlvIHN5bmNocm9uaXphdGlvbiBzdGFydGVkJyk7XG5cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICB0aGlzLmxvZ2dlci5lcnJvcignRmFpbGVkIHRvIHN0YXJ0IHN5bmMnLCBlcnJvcik7XG4gICAgICB0aGlzLl9pc1N5bmNpbmcgPSBmYWxzZTtcblxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIHN0b3BTeW5jICgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBpZiAoIXRoaXMuX2lzU3luY2luZykge1xuICAgICAgdGhpcy5sb2dnZXIud2FybignU3luYyBub3QgaW4gcHJvZ3Jlc3MnKTtcblxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMubG9nZ2VyLmluZm8oJ1N0b3BwaW5nIGF1ZGlvIHN5bmNocm9uaXphdGlvbi4uLicpO1xuICAgIHRoaXMuX2lzU3luY2luZyA9IGZhbHNlO1xuICAgIHRyeSB7XG4gICAgICB0aGlzLmxhdGVuY3lEZXRlY3Rvci5zdG9wKCk7XG4gICAgICB0aGlzLmRyaWZ0Q29ycmVjdG9yLnN0b3AoKTtcbiAgICAgIHRoaXMubG9nZ2VyLmluZm8oJ0F1ZGlvIHN5bmNocm9uaXphdGlvbiBzdG9wcGVkJyk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHRoaXMubG9nZ2VyLmVycm9yKCdGYWlsZWQgdG8gc3RvcCBzeW5jJywgZXJyb3IpO1xuICAgIH1cbiAgfVxuXG4gIHN0YXJ0TWFudWFsVGFwU3luYyAob3B0aW9uczogeyBwdWxzZUNvdW50PzogbnVtYmVyOyBwdWxzZUludGVydmFsPzogbnVtYmVyOyBvblRhcD86ICh0YXA6IFRhcEV2ZW50KSA9PiB2b2lkOyB9ID0ge30pOiB2b2lkIHtcbiAgICB0aGlzLmxvZ2dlci5pbmZvKCdTdGFydGluZyBtYW51YWwgdGFwIHN5bmMnLCBvcHRpb25zKTtcbiAgICB0aGlzLmxhdGVuY3lEZXRlY3Rvci5zdGFydE1hbnVhbFRhcFN5bmMoeyBwdWxzZUNvdW50OiBvcHRpb25zLnB1bHNlQ291bnQsIHB1bHNlSW50ZXJ2YWw6IG9wdGlvbnMucHVsc2VJbnRlcnZhbCwgb25UYXA6IG9wdGlvbnMub25UYXAgfSk7XG4gIH1cblxuICBhc3luYyBkZXRlY3RMYXRlbmN5ICgpOiBQcm9taXNlPExhdGVuY3lNZWFzdXJlbWVudD4ge1xuICAgIC8vIERvbid0IHJlcXVpcmUgc3luYyB0byBiZSBzdGFydGVkIGZvciBsYXRlbmN5IGRldGVjdGlvblxuICAgIC8vIFRoaXMgYWxsb3dzIHRlc3RzIHRvIGNhbGwgZGV0ZWN0TGF0ZW5jeSBkaXJlY3RseVxuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmxhdGVuY3lEZXRlY3Rvci5kZXRlY3RMYXRlbmN5KCk7XG5cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSBjYXRjaCB7XG4gICAgICAvLyBGYWxsIGJhY2sgdG8gY3VycmVudCBsYXRlbmN5IGlmIGRldGVjdGlvbiBmYWlsc1xuICAgICAgY29uc3QgZmFsbGJhY2sgPSB0aGlzLmdldEN1cnJlbnRMYXRlbmN5KCk7XG5cbiAgICAgIGlmICh0eXBlb2YgZmFsbGJhY2sgPT09ICdudW1iZXInKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgb3V0cHV0TGF0ZW5jeTogZmFsbGJhY2sgLyAyLFxuICAgICAgICAgIGlucHV0TGF0ZW5jeTogZmFsbGJhY2sgLyAyLFxuICAgICAgICAgIHRvdGFsTGF0ZW5jeTogZmFsbGJhY2ssXG4gICAgICAgICAgdGltZXN0YW1wOiBEYXRlLm5vdygpLFxuICAgICAgICAgIGNvbmZpZGVuY2U6IDAuMyxcbiAgICAgICAgICBtZXRob2Q6ICduYXRpdmUnLFxuICAgICAgICB9O1xuICAgICAgfVxuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBvdXRwdXRMYXRlbmN5OiAwLjA1LFxuICAgICAgICBpbnB1dExhdGVuY3k6IDAuMDUsXG4gICAgICAgIHRvdGFsTGF0ZW5jeTogMC4xLFxuICAgICAgICB0aW1lc3RhbXA6IERhdGUubm93KCksXG4gICAgICAgIGNvbmZpZGVuY2U6IDAuMyxcbiAgICAgICAgbWV0aG9kOiAnbmF0aXZlJyxcbiAgICAgIH07XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgcGVyZm9ybVB1bHNlQ2hlY2sgKCk6IFByb21pc2U8UHVsc2VDaGVja1Jlc3VsdD4ge1xuICAgIHJldHVybiB0aGlzLmxhdGVuY3lEZXRlY3Rvci5wZXJmb3JtUHVsc2VDaGVjaygpO1xuICB9XG5cbiAgYXN5bmMgY2FsaWJyYXRlICgpOiBQcm9taXNlPFN5bmNDYWxpYnJhdGlvblJlc3VsdD4ge1xuICAgIGlmICh0aGlzLl9pc0NhbGlicmF0aW5nKSB7XG4gICAgICB0aGlzLmxvZ2dlci53YXJuKCdDYWxpYnJhdGlvbiBhbHJlYWR5IGluIHByb2dyZXNzJyk7XG5cbiAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBsYXRlbmN5OiB0aGlzLmN1cnJlbnRMYXRlbmN5LCBtZWFzdXJlbWVudHM6IFtdLCBjb25maWRlbmNlOiAwIH07XG4gICAgfVxuXG4gICAgdGhpcy5faXNDYWxpYnJhdGluZyA9IHRydWU7XG4gICAgdGhpcy5sb2dnZXIuaW5mbygnU3RhcnRpbmcgY2FsaWJyYXRpb24uLi4nKTtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzdWx0OiBMYXRlbmN5Q2FsaWJyYXRpb25SZXN1bHQgPSBhd2FpdCB0aGlzLmxhdGVuY3lEZXRlY3Rvci5jYWxpYnJhdGUoKTtcblxuICAgICAgaWYgKHJlc3VsdD8uc3VjY2Vzcykge1xuICAgICAgICBjb25zdCBtZWFzdXJlbWVudDogTGF0ZW5jeU1lYXN1cmVtZW50ID0ge1xuICAgICAgICAgIG91dHB1dExhdGVuY3k6IHJlc3VsdC5vdXRwdXRMYXRlbmN5ID8/IDAsXG4gICAgICAgICAgaW5wdXRMYXRlbmN5OiByZXN1bHQuaW5wdXRMYXRlbmN5ID8/IDAsXG4gICAgICAgICAgdG90YWxMYXRlbmN5OiByZXN1bHQubGF0ZW5jeSxcbiAgICAgICAgICB0aW1lc3RhbXA6IHJlc3VsdC50aW1lc3RhbXAsXG4gICAgICAgICAgY29uZmlkZW5jZTogcmVzdWx0LmNvbmZpZGVuY2UsXG4gICAgICAgICAgbWV0aG9kOiAncHVsc2UnLFxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIENhbGlicmF0aW9uIGRlZmluZXMgdGhlIGJhc2VsaW5lOyBkcmlmdCBvZiB0aGUgY2FsaWJyYXRpb24gc2FtcGxlXG4gICAgICAgIC8vIGl0c2VsZiBpcyB6ZXJvIGJ5IGRlZmluaXRpb25cbiAgICAgICAgdGhpcy5iYXNlbGluZUxhdGVuY3kgPSByZXN1bHQubGF0ZW5jeTtcbiAgICAgICAgdGhpcy5kcmlmdENvcnJlY3Rvci5hZGRNZWFzdXJlbWVudChtZWFzdXJlbWVudCwgdGhpcy5iYXNlbGluZUxhdGVuY3kpO1xuICAgICAgICB0aGlzLmN1cnJlbnRMYXRlbmN5ID0gcmVzdWx0LmxhdGVuY3k7XG4gICAgICB9XG5cbiAgICAgIHRoaXMubG9nZ2VyLmluZm8oJ0NhbGlicmF0aW9uIGNvbXBsZXRlZCcsIHsgc3VjY2VzczogcmVzdWx0Py5zdWNjZXNzLCBsYXRlbmN5OiByZXN1bHQ/LmxhdGVuY3kgfSk7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN1Y2Nlc3M6IHJlc3VsdD8uc3VjY2VzcyA/PyBmYWxzZSxcbiAgICAgICAgbGF0ZW5jeTogcmVzdWx0Py5sYXRlbmN5ID8/IHRoaXMuY3VycmVudExhdGVuY3ksXG4gICAgICAgIG91dHB1dExhdGVuY3k6IHJlc3VsdD8ub3V0cHV0TGF0ZW5jeSA/PyAwLFxuICAgICAgICBtZWFzdXJlbWVudHM6IHJlc3VsdD8ubWVhc3VyZW1lbnRzID8/IFtdLFxuICAgICAgICBjb25maWRlbmNlOiByZXN1bHQ/LmNvbmZpZGVuY2UgPz8gMCxcbiAgICAgICAgbWV0aG9kOiByZXN1bHQ/Lm1ldGhvZCxcbiAgICAgIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHRoaXMubG9nZ2VyLmVycm9yKCdDYWxpYnJhdGlvbiBmYWlsZWQnLCBlcnJvcik7XG5cbiAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBsYXRlbmN5OiB0aGlzLmN1cnJlbnRMYXRlbmN5LCBtZWFzdXJlbWVudHM6IFtdLCBjb25maWRlbmNlOiAwIH07XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHRoaXMuX2lzQ2FsaWJyYXRpbmcgPSBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBhcHBseURyaWZ0Q29ycmVjdGlvbiAoKTogRHJpZnRDb3JyZWN0aW9uIHwgbnVsbCB7XG4gICAgaWYgKHRoaXMub3B0aW9ucy5kcmlmdENvcnJlY3Rpb24/LmVuYWJsZWQgIT09IGZhbHNlKSB7XG4gICAgICBjb25zdCBjb3JyZWN0aW9uID0gdGhpcy5kcmlmdENvcnJlY3Rvci5hcHBseUNvcnJlY3Rpb24oKTtcblxuICAgICAgaWYgKGNvcnJlY3Rpb24pIHtcbiAgICAgICAgdGhpcy5zeW5jT2Zmc2V0ID0gY29ycmVjdGlvbi5jb3JyZWN0aW9uO1xuICAgICAgICB0aGlzLmN1cnJlbnREcmlmdCA9IGNvcnJlY3Rpb24uY29ycmVjdGlvbjtcbiAgICAgICAgdGhpcy5lbWl0RXZlbnQoJ2RyaWZ0OmNvcnJlY3Rpb24nLCBjb3JyZWN0aW9uKTtcblxuICAgICAgICByZXR1cm4gY29ycmVjdGlvbjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGdldERyaWZ0VHJlbmQgKCk6IG51bWJlciB7IHJldHVybiB0aGlzLmRyaWZ0Q29ycmVjdG9yLmdldERyaWZ0VHJlbmQoKTsgfVxuICBnZXRDdXJyZW50RHJpZnQgKCk6IG51bWJlciB7IHJldHVybiB0aGlzLmN1cnJlbnREcmlmdDsgfVxuXG4gIGdldFN5bmNTdGF0dXMgKCk6IFN5bmNTdGF0dXMge1xuICAgIGNvbnN0IGRyaWZ0ID0gdGhpcy5kcmlmdENvcnJlY3Rvci5nZXRDdXJyZW50RHJpZnQoKTtcblxuICAgIGNvbnN0IGxhdGVuY3kgPSB0aGlzLmN1cnJlbnRMYXRlbmN5O1xuXG4gICAgY29uc3QgdGltZXN0YW1wID0gRGF0ZS5ub3coKTtcblxuICAgIGxldCBxdWFsaXR5OiAnZXhjZWxsZW50JyB8ICdnb29kJyB8ICdmYWlyJyB8ICdwb29yJyA9ICdleGNlbGxlbnQnO1xuXG4gICAgY29uc3QgYWJzRHJpZnQgPSBNYXRoLmFicyhkcmlmdCk7XG5cbiAgICBpZiAoYWJzRHJpZnQgPCAwLjAwNSkge3F1YWxpdHkgPSAnZXhjZWxsZW50Jzt9XG4gICAgZWxzZSBpZiAoYWJzRHJpZnQgPCAwLjAxNSkge3F1YWxpdHkgPSAnZ29vZCc7fVxuICAgIGVsc2UgaWYgKGFic0RyaWZ0IDwgMC4wMykge3F1YWxpdHkgPSAnZmFpcic7fVxuICAgIGVsc2Uge3F1YWxpdHkgPSAncG9vcic7fVxuXG4gICAgcmV0dXJuIHsgaXNTeW5jZWQ6IGFic0RyaWZ0IDwgMC4wNSwgY3VycmVudExhdGVuY3k6IGxhdGVuY3ksIGRyaWZ0LCB0aW1lc3RhbXAsIGxhc3RDaGVjazogdGltZXN0YW1wLCBxdWFsaXR5IH07XG4gIH1cblxuICBnZXRDdXJyZW50TGF0ZW5jeSAoKTogbnVtYmVyIHsgcmV0dXJuIHRoaXMuY3VycmVudExhdGVuY3k7IH1cblxuICAvKipcbiAgICogU2V0IHRoZSBiYXNlbGluZSBsYXRlbmN5IHRoYXQgZHJpZnQgaXMgbWVhc3VyZWQgYWdhaW5zdC5cbiAgICogQ2FsbGVkIGJ5IGNhbGlicmF0ZSgpOyBleHBvc2VkIHNvIGludGVncmF0b3JzIGNhbiByZS1iYXNlbGluZSBhZnRlclxuICAgKiBpbnRlbnRpb25hbGx5IGNoYW5naW5nIHRoZSBvdXRwdXQgZGV2aWNlLlxuICAgKi9cbiAgc2V0QmFzZWxpbmVMYXRlbmN5IChsYXRlbmN5OiBudW1iZXIpOiB2b2lkIHtcbiAgICB0aGlzLmJhc2VsaW5lTGF0ZW5jeSA9IGxhdGVuY3k7XG4gIH1cblxuICBhZGRFdmVudExpc3RlbmVyIChsaXN0ZW5lcjogU3luY0V2ZW50TGlzdGVuZXIpOiB2b2lkIHsgdGhpcy5ldmVudExpc3RlbmVycy5hZGQobGlzdGVuZXIpOyB9XG4gIHJlbW92ZUV2ZW50TGlzdGVuZXIgKGxpc3RlbmVyOiBTeW5jRXZlbnRMaXN0ZW5lcik6IHZvaWQgeyB0aGlzLmV2ZW50TGlzdGVuZXJzLmRlbGV0ZShsaXN0ZW5lcik7IH1cblxuICBwcml2YXRlIGVtaXRFdmVudCAodHlwZTogU3luY0V2ZW50VHlwZSwgZGF0YT86IHVua25vd24pOiB2b2lkIHtcbiAgICBjb25zdCBldmVudDogU3luY0V2ZW50ID0geyB0eXBlLCBkYXRhLCB0aW1lc3RhbXA6IERhdGUubm93KCkgfTtcblxuICAgIHRoaXMuZXZlbnRMaXN0ZW5lcnMuZm9yRWFjaChsaXN0ZW5lciA9PiB7XG4gICAgICB0cnkgeyBsaXN0ZW5lcihldmVudCk7IH0gY2F0Y2ggKGVycm9yKSB7IHRoaXMubG9nZ2VyLmVycm9yKCdFcnJvciBpbiBldmVudCBsaXN0ZW5lcicsIGVycm9yKTsgfVxuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBoYW5kbGVMYXRlbmN5VXBkYXRlIChtZWFzdXJlbWVudDogTGF0ZW5jeU1lYXN1cmVtZW50KTogdm9pZCB7XG4gICAgLy8gRHJpZnQgaXMgdGhlIGRldmlhdGlvbiBmcm9tIHRoZSBjYWxpYnJhdGVkIGJhc2VsaW5lLCBub3QgZnJvbSB0aGVcbiAgICAvLyBwcmV2aW91cyBzYW1wbGUg4oCUIG90aGVyd2lzZSBhIHN0ZWFkaWx5IGdyb3dpbmcgbGF0ZW5jeSB3b3VsZCBzaG93XG4gICAgLy8gemVybyB0cmVuZFxuICAgIGlmICh0aGlzLmJhc2VsaW5lTGF0ZW5jeSA9PT0gMCkge1xuICAgICAgdGhpcy5iYXNlbGluZUxhdGVuY3kgPSBtZWFzdXJlbWVudC50b3RhbExhdGVuY3k7XG4gICAgfVxuXG4gICAgdGhpcy5kcmlmdENvcnJlY3Rvci5hZGRNZWFzdXJlbWVudChtZWFzdXJlbWVudCwgdGhpcy5iYXNlbGluZUxhdGVuY3kpO1xuICAgIHRoaXMuY3VycmVudExhdGVuY3kgPSBtZWFzdXJlbWVudC50b3RhbExhdGVuY3k7XG4gICAgdGhpcy5lbWl0RXZlbnQoJ2xhdGVuY3k6dXBkYXRlJywgbWVhc3VyZW1lbnQpO1xuICAgIGlmICh0aGlzLm9wdGlvbnMub25MYXRlbmN5VXBkYXRlKSB7dGhpcy5vcHRpb25zLm9uTGF0ZW5jeVVwZGF0ZShtZWFzdXJlbWVudCk7fVxuICB9XG5cbiAgLyoqXG4gICAqIEZlZWQgYW4gZXh0ZXJuYWxseSBwcm9kdWNlZCBsYXRlbmN5IG1lYXN1cmVtZW50IChlLmcuIFBybyBhY291c3RpY1xuICAgKiBsb29wYmFjaykgaW50byB0aGUgc3luYyBtYW5hZ2VyOiB1cGRhdGVzIHRoZSBjdXJyZW50IGxhdGVuY3kgYW5kIHRoZVxuICAgKiBkcmlmdCBoaXN0b3J5IChkcmlmdCA9IG1lYXN1cmVkIC0gYmFzZWxpbmUpLlxuICAgKi9cbiAgdXBkYXRlTGF0ZW5jeSAobWVhc3VyZW1lbnQ6IExhdGVuY3lNZWFzdXJlbWVudCk6IHZvaWQge1xuICAgIHRoaXMuaGFuZGxlTGF0ZW5jeVVwZGF0ZShtZWFzdXJlbWVudCk7XG4gIH1cblxuICBwcml2YXRlIGhhbmRsZUVycm9yIChlcnJvcjogRXJyb3IpOiB2b2lkIHtcbiAgICB0aGlzLmVtaXRFdmVudCgnZXJyb3InLCBlcnJvcik7XG4gICAgaWYgKHRoaXMub3B0aW9ucy5vbkVycm9yKSB7dGhpcy5vcHRpb25zLm9uRXJyb3IoZXJyb3IpO31cbiAgfVxuXG4gIGFzeW5jIGRlc3Ryb3kgKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMubG9nZ2VyLmluZm8oJ0Rlc3Ryb3lpbmcgU3luY01hbmFnZXIuLi4nKTtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgdGhpcy5zdG9wU3luYygpO1xuICAgICAgaWYgKHRoaXMuY2FsaWJyYXRpb25UaW1lb3V0KSB7IGNsZWFyVGltZW91dCh0aGlzLmNhbGlicmF0aW9uVGltZW91dCk7IHRoaXMuY2FsaWJyYXRpb25UaW1lb3V0ID0gbnVsbDsgfVxuXG4gICAgICB0aGlzLmV2ZW50TGlzdGVuZXJzLmNsZWFyKCk7XG4gICAgICBhd2FpdCB0aGlzLmF1ZGlvRW5naW5lLmNsb3NlKCk7XG4gICAgICB0aGlzLmxhdGVuY3lEZXRlY3Rvci5jbGVhbnVwKCk7XG4gICAgICB0aGlzLmRyaWZ0Q29ycmVjdG9yLnJlc2V0KCk7XG4gICAgICB0aGlzLl9pc1N5bmNpbmcgPSBmYWxzZTsgdGhpcy5faXNDYWxpYnJhdGluZyA9IGZhbHNlOyB0aGlzLmN1cnJlbnRMYXRlbmN5ID0gMDsgdGhpcy5jdXJyZW50RHJpZnQgPSAwOyB0aGlzLnN5bmNPZmZzZXQgPSAwO1xuICAgICAgdGhpcy5sb2dnZXIuaW5mbygnU3luY01hbmFnZXIgZGVzdHJveWVkJyk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHRoaXMubG9nZ2VyLmVycm9yKCdGYWlsZWQgdG8gZGVzdHJveSBTeW5jTWFuYWdlcicsIGVycm9yKTtcbiAgICB9XG4gIH1cbn1cbiJdfQ==