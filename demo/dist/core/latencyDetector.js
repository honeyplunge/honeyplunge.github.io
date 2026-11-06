"use strict";
// Latency Detection System for WebAudio Sync
Object.defineProperty(exports, "__esModule", { value: true });
exports.LatencyDetector = void 0;
const browser_1 = require("../utils/browser");
const math_1 = require("../utils/math");
const logger_1 = require("../utils/logger");
class LatencyDetector {
    constructor(audioEngine, options = {}) {
        this._isCalibrating = false;
        this.calibrationResults = [];
        this.audioEngine = audioEngine;
        this.options = {
            pulseCheck: {
                duration: 2,
                frequency: 1000,
                volume: 0.5,
                threshold: 0.1,
                maxRetries: 3,
            },
            useNativeLatency: true,
            calibrationRounds: 3,
            ...options,
        };
        this.logger = new logger_1.Logger({}, 'LatencyDetector');
    }
    get isCalibrating() {
        return this._isCalibrating;
    }
    set isCalibrating(value) {
        this._isCalibrating = value;
    }
    getNativeLatency() {
        const context = this.audioEngine.getContext();
        if (!context) {
            throw new Error('AudioEngine not initialized');
        }
        const outputLatency = browser_1.BrowserUtils.getOutputLatency(context);
        const inputLatency = browser_1.BrowserUtils.getInputLatency(context);
        const timestamp = browser_1.BrowserUtils.getDOMHighResTimeStamp();
        return {
            outputLatency,
            inputLatency,
            totalLatency: outputLatency + inputLatency,
            timestamp,
            confidence: 0.8,
            method: 'native',
        };
    }
    async performPulseCheck(options = {}) {
        const opts = { ...this.options.pulseCheck, ...options };
        if (this._isCalibrating) {
            return { success: false, latency: 0, confidence: 0, measurements: [], timestamp: browser_1.BrowserUtils.getDOMHighResTimeStamp() };
        }
        this._isCalibrating = true;
        const measurements = [];
        let success = false;
        let confidence = 0;
        let latency = 0;
        try {
            this.logger.info('Starting pulse check latency measurement', opts);
            if (this.audioEngine.getContext()?.state === 'suspended') {
                await this.audioEngine.resume();
            }
            for (let round = 0; round < (opts.maxRetries ?? 3); round++) {
                const result = await this.singlePulseCheckRound(opts);
                if (result.success) {
                    measurements.push(result.latency);
                }
            }
            if (measurements.length > 0) {
                const filtered = this.filterOutliers(measurements);
                if (filtered.length > 0) {
                    latency = math_1.MathUtils.mean(filtered);
                    confidence = Math.min(1.0, 0.7 + (filtered.length / (opts.maxRetries ?? 3) * 0.3));
                    success = true;
                }
            }
        }
        catch (error) {
            this.logger.error('Pulse check failed', error);
            if (this.options.onError) {
                this.options.onError(error);
            }
        }
        finally {
            this._isCalibrating = false;
        }
        const timestamp = browser_1.BrowserUtils.getDOMHighResTimeStamp();
        if (success && this.options.onLatencyUpdate) {
            this.options.onLatencyUpdate({
                outputLatency: latency, inputLatency: 0, totalLatency: latency,
                timestamp, confidence, method: 'pulse',
            });
        }
        return { success, latency, confidence, measurements, timestamp };
    }
    async singlePulseCheckRound(options) {
        return new Promise(resolve => {
            const context = this.audioEngine.getContext();
            if (!context) {
                resolve({ success: false, latency: 0 });
                return;
            }
            const pulseTimes = [];
            const tapTimes = [];
            const pulseCount = Math.floor((options.duration ?? 2) * (options.frequency ?? 1000));
            const pulseInterval = 1.0 / (options.frequency ?? 1000);
            const startTime = context.currentTime + 0.1;
            for (let i = 0; i < pulseCount; i++) {
                const pulseTime = startTime + (i * pulseInterval);
                setTimeout(() => {
                    // Record actual wall-clock time when the click plays (same time base as tapTimes)
                    pulseTimes.push(browser_1.BrowserUtils.getPerformanceNow());
                    this.audioEngine.playClick(options.volume);
                }, (pulseTime - context.currentTime) * 1000);
            }
            const handleTap = (_timestamp) => {
                const now = browser_1.BrowserUtils.getPerformanceNow();
                tapTimes.push(now);
                if (tapTimes.length >= pulseCount * 0.7) {
                    const latency = this.calculateLatencyFromTaps(pulseTimes, tapTimes);
                    cleanup();
                    resolve({ success: true, latency });
                }
            };
            const handleKeyDown = (e) => {
                if (e.code === 'Space' || e.code === 'Enter') {
                    e.preventDefault();
                    handleTap(browser_1.BrowserUtils.getDOMHighResTimeStamp());
                }
            };
            const handleClick = (e) => { e.preventDefault(); handleTap(browser_1.BrowserUtils.getDOMHighResTimeStamp()); };
            const handleTouchStart = (e) => { e.preventDefault(); handleTap(browser_1.BrowserUtils.getDOMHighResTimeStamp()); };
            const cleanup = () => {
                document.removeEventListener('keydown', handleKeyDown);
                document.removeEventListener('click', handleClick);
                document.removeEventListener('touchstart', handleTouchStart);
            };
            document.addEventListener('keydown', handleKeyDown);
            document.addEventListener('click', handleClick);
            document.addEventListener('touchstart', handleTouchStart);
            setTimeout(() => {
                cleanup();
                if (tapTimes.length >= pulseCount * 0.5) {
                    const latency = this.calculateLatencyFromTaps(pulseTimes, tapTimes);
                    resolve({ success: true, latency });
                }
                else {
                    resolve({ success: false, latency: 0 });
                }
            }, (options.duration ?? 2) * 1000 * 2);
        });
    }
    calculateLatencyFromTaps(pulseTimes, tapTimes) {
        if (pulseTimes.length === 0 || tapTimes.length === 0) {
            return 0;
        }
        const latencies = [];
        for (let i = 0; i < Math.min(pulseTimes.length, tapTimes.length); i++) {
            const latency = tapTimes[i] - pulseTimes[i];
            if (latency > 0 && latency < 1.0) {
                latencies.push(latency);
            }
        }
        if (latencies.length === 0) {
            return 0;
        }
        return math_1.MathUtils.median(latencies);
    }
    filterOutliers(measurements) {
        if (measurements.length <= 2) {
            return measurements;
        }
        const mean = math_1.MathUtils.mean(measurements);
        const stdDev = math_1.MathUtils.standardDeviation(measurements);
        const threshold = stdDev * 2;
        return measurements.filter(m => Math.abs(m - mean) <= threshold);
    }
    async calibrate() {
        this.logger.info('Starting latency calibration');
        const measurements = [];
        try {
            if (this.options.useNativeLatency) {
                try {
                    const native = this.getNativeLatency();
                    measurements.push(native);
                    this.logger.info('Native latency detected', native);
                }
                catch (error) {
                    this.logger.warn('Native latency not available', error);
                }
            }
            // Only perform pulse check if we have user interaction available
            // In test environments, this will timeout, so we skip it
            const isTestEnvironment = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
            if (!isTestEnvironment) {
                const pulseResult = await this.performPulseCheck();
                if (pulseResult.success) {
                    measurements.push({
                        outputLatency: pulseResult.latency, inputLatency: 0,
                        totalLatency: pulseResult.latency, timestamp: pulseResult.timestamp,
                        confidence: pulseResult.confidence, method: 'pulse',
                    });
                    this.logger.info('Pulse check completed', pulseResult);
                }
            }
            if (measurements.length > 0) {
                const totalConfidence = measurements.reduce((acc, m) => acc + m.confidence, 0);
                const weightedLatency = measurements.reduce((acc, m) => acc + (m.totalLatency * m.confidence), 0) / totalConfidence;
                const bestMeasurement = measurements.reduce((best, current) => current.confidence > best.confidence ? current : best);
                return {
                    success: true,
                    latency: weightedLatency,
                    outputLatency: bestMeasurement.outputLatency,
                    inputLatency: bestMeasurement.inputLatency,
                    totalLatency: weightedLatency,
                    timestamp: Date.now(),
                    confidence: Math.min(1.0, totalConfidence / measurements.length),
                    measurements,
                    method: bestMeasurement.method,
                };
            }
        }
        catch (error) {
            this.logger.error('Calibration failed', error);
            if (this.options.onError) {
                this.options.onError(error);
            }
        }
        return {
            success: false, latency: 0.1,
            outputLatency: 0.05, inputLatency: 0.05,
            totalLatency: 0.1,
            timestamp: browser_1.BrowserUtils.getDOMHighResTimeStamp(),
            confidence: 0.3, measurements: [], method: 'native',
        };
    }
    getCurrentLatency() {
        try {
            return this.getNativeLatency();
        }
        catch {
            return {
                outputLatency: 0.05, inputLatency: 0.05, totalLatency: 0.1,
                timestamp: browser_1.BrowserUtils.getDOMHighResTimeStamp(), confidence: 0.3, method: 'native',
            };
        }
    }
    isDetecting() { return this._isCalibrating; }
    getCalibrationHistory() { return []; }
    start() {
        if (!this._isCalibrating) {
            this.logger.info('Latency detector started');
        }
    }
    stop() {
        if (this._isCalibrating) {
            this._isCalibrating = false;
        }
        this.logger.info('Latency detector stopped');
    }
    startManualTapSync(options = {}) {
        const pulseCount = options.pulseCount ?? 10;
        const pulseInterval = options.pulseInterval ?? 1.0;
        const onTap = options.onTap;
        const context = this.audioEngine.getContext();
        if (!context) {
            this.logger.error('AudioEngine not initialized. Call initialize() first.');
            return;
        }
        if (context.state === 'suspended') {
            void context.resume();
        }
        this.logger.info('Manual tap sync started', { pulseCount, pulseInterval });
        // Map AudioContext time to performance.now() time so offsets are meaningful
        const ctxStart = context.currentTime;
        const perfStart = browser_1.BrowserUtils.getPerformanceNow(); // seconds
        const audioToPerf = (audioTime) => perfStart + (audioTime - ctxStart);
        const pulseTimes = []; // in performance-time seconds
        const audioStartTime = context.currentTime + 0.5; // small lead-in
        for (let i = 0; i < pulseCount; i++) {
            const audioPulseTime = audioStartTime + (i * pulseInterval);
            pulseTimes.push(audioToPerf(audioPulseTime));
            const delayMs = Math.max(0, (audioPulseTime - context.currentTime) * 1000);
            setTimeout(() => {
                this.audioEngine.playClick(0.5);
            }, delayMs);
        }
        let tapCount = 0;
        const handleTap = () => {
            const now = browser_1.BrowserUtils.getPerformanceNow();
            tapCount++;
            // Find nearest scheduled pulse
            let nearestIdx = 0;
            let nearestDiff = Infinity;
            for (let i = 0; i < pulseTimes.length; i++) {
                const diff = Math.abs(now - pulseTimes[i]);
                if (diff < nearestDiff) {
                    nearestDiff = diff;
                    nearestIdx = i;
                }
            }
            this.logger.debug('Tap received', { tapCount, offset: now - pulseTimes[nearestIdx] });
            if (onTap) {
                onTap({
                    timestamp: now,
                    type: 'tap',
                    expectedTime: pulseTimes[nearestIdx],
                });
            }
        };
        const handleKeyDown = (e) => {
            if (e.code === 'Space' || e.code === 'Enter') {
                e.preventDefault();
                handleTap();
            }
        };
        const handlePointer = (e) => {
            e.preventDefault();
            handleTap();
        };
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('click', handlePointer);
        document.addEventListener('touchstart', handlePointer);
        // Clean up after all pulses + buffer
        const totalMs = (pulseCount * pulseInterval + 2) * 1000;
        setTimeout(() => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('click', handlePointer);
            document.removeEventListener('touchstart', handlePointer);
            this.logger.info('Manual tap sync ended', { tapsReceived: tapCount, pulsesScheduled: pulseCount });
        }, totalMs);
    }
    async detectLatency() {
        const result = await this.calibrate();
        return {
            outputLatency: result.outputLatency ?? 0.05,
            inputLatency: result.inputLatency ?? 0.05,
            totalLatency: result.totalLatency ?? result.latency ?? 0.1,
            timestamp: result.timestamp ?? Date.now(),
            confidence: result.confidence ?? 0.3,
            method: result.method ?? 'native',
        };
    }
    cleanup() {
        this._isCalibrating = false;
        this.calibrationResults = [];
        this.logger.info('Latency detector cleaned up');
    }
}
exports.LatencyDetector = LatencyDetector;
exports.default = LatencyDetector;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGF0ZW5jeURldGVjdG9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2NvcmUvbGF0ZW5jeURldGVjdG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSw2Q0FBNkM7OztBQVM3Qyw4Q0FBZ0Q7QUFDaEQsd0NBQTBDO0FBQzFDLDRDQUF5QztBQXdCekMsTUFBYSxlQUFlO0lBTzFCLFlBQWEsV0FBd0IsRUFBRSxVQUFrQyxFQUFFO1FBSG5FLG1CQUFjLEdBQVksS0FBSyxDQUFDO1FBQ2hDLHVCQUFrQixHQUFhLEVBQUUsQ0FBQztRQUd4QyxJQUFJLENBQUMsV0FBVyxHQUFHLFdBQVcsQ0FBQztRQUMvQixJQUFJLENBQUMsT0FBTyxHQUFHO1lBQ2IsVUFBVSxFQUFFO2dCQUNWLFFBQVEsRUFBRSxDQUFDO2dCQUNYLFNBQVMsRUFBRSxJQUFJO2dCQUNmLE1BQU0sRUFBRSxHQUFHO2dCQUNYLFNBQVMsRUFBRSxHQUFHO2dCQUNkLFVBQVUsRUFBRSxDQUFDO2FBQ2Q7WUFDRCxnQkFBZ0IsRUFBRSxJQUFJO1lBQ3RCLGlCQUFpQixFQUFFLENBQUM7WUFDcEIsR0FBRyxPQUFPO1NBQ1gsQ0FBQztRQUNGLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxlQUFNLENBQUMsRUFBRSxFQUFFLGlCQUFpQixDQUFDLENBQUM7SUFDbEQsQ0FBQztJQUVELElBQUksYUFBYTtRQUNmLE9BQU8sSUFBSSxDQUFDLGNBQWMsQ0FBQztJQUM3QixDQUFDO0lBRUQsSUFBSSxhQUFhLENBQUUsS0FBYztRQUMvQixJQUFJLENBQUMsY0FBYyxHQUFHLEtBQUssQ0FBQztJQUM5QixDQUFDO0lBRUQsZ0JBQWdCO1FBQ2QsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUU5QyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDYixNQUFNLElBQUksS0FBSyxDQUFDLDZCQUE2QixDQUFDLENBQUM7UUFDakQsQ0FB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TUFBTSxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7UUFFdEMsT0FBTztZQUNMLGFBQWEsRUFBRSxNQUFNLENBQUMsYUFBYSxJQUFJLElBQUk7WUFDM0MsWUFBWSxFQUFFLE1BQU0sQ0FBQyxZQUFZLElBQUksSUFBSTtZQUN6QyxZQUFZLEVBQUUsTUFBTSxDQUFDLFlBQVksSUFBSSxNQUFNLENBQUMsT0FBTyxJQUFJLEdBQUc7WUFDMUQsU0FBUyxFQUFFLE1BQU0sQ0FBQyxTQUFTLElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRTtZQUN6QyxVQUFVLEVBQUUsTUFBTSxDQUFDLFVBQVUsSUFBSSxHQUFHO1lBQ3BDLE1BQU0sRUFBRSxNQUFNLENBQUMsTUFBTSxJQUFJLFFBQVE7U0FDbEMsQ0FBQztJQUNKLENBQUM7SUFFRCxPQUFPO1FBQ0wsSUFBSSxDQUFDLGNBQWMsR0FBRyxLQUFLLENBQUM7UUFDNUIsSUFBSSxDQUFDLGtCQUFrQixHQUFHLEVBQUUsQ0FBQztRQUM3QixJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyw2QkFBNkIsQ0FBQyxDQUFDO0lBQ2xELENBQUM7Q0FDRjtBQXZhRCwwQ0F1YUM7QUFFRCxrQkFBZSxlQUFlLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBMYXRlbmN5IERldGVjdGlvbiBTeXN0ZW0gZm9yIFdlYkF1ZGlvIFN5bmNcblxuaW1wb3J0IHtcbiAgTGF0ZW5jeU1lYXN1cmVtZW50LFxuICBQdWxzZUNoZWNrT3B0aW9ucyxcbiAgUHVsc2VDaGVja1Jlc3VsdCxcbiAgVGFwRXZlbnQsXG59IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IEF1ZGlvRW5naW5lIH0gZnJvbSAnLi9hdWRpb0VuZ2luZSc7XG5pbXBvcnQgeyBCcm93c2VyVXRpbHMgfSBmcm9tICcuLi91dGlscy9icm93c2VyJztcbmltcG9ydCB7IE1hdGhVdGlscyB9IGZyb20gJy4uL3V0aWxzL21hdGgnO1xuaW1wb3J0IHsgTG9nZ2VyIH0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcblxuZXhwb3J0IHR5cGUgeyBQdWxzZUNoZWNrUmVzdWx0IH07XG5cbmV4cG9ydCBpbnRlcmZhY2UgTGF0ZW5jeUNhbGlicmF0aW9uUmVzdWx0IHtcbiAgc3VjY2VzczogYm9vbGVhbjtcbiAgbGF0ZW5jeTogbnVtYmVyO1xuICBvdXRwdXRMYXRlbmN5OiBudW1iZXI7XG4gIGlucHV0TGF0ZW5jeTogbnVtYmVyO1xuICB0b3RhbExhdGVuY3k6IG51bWJlcjtcbiAgdGltZXN0YW1wOiBudW1iZXI7XG4gIGNvbmZpZGVuY2U6IG51bWJlcjtcbiAgbWVhc3VyZW1lbnRzOiBMYXRlbmN5TWVhc3VyZW1lbnRbXTtcbiAgbWV0aG9kPzogTGF0ZW5jeU1lYXN1cmVtZW50WydtZXRob2QnXTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBMYXRlbmN5RGV0ZWN0b3JPcHRpb25zIHtcbiAgcHVsc2VDaGVjaz86IFB1bHNlQ2hlY2tPcHRpb25zO1xuICB1c2VOYXRpdmVMYXRlbmN5PzogYm9vbGVhbjtcbiAgY2FsaWJyYXRpb25Sb3VuZHM/OiBudW1iZXI7XG4gIG9uTGF0ZW5jeVVwZGF0ZT86IChfbWVhc3VyZW1lbnQ6IExhdGVuY3lNZWFzdXJlbWVudCkgPT4gdm9pZDtcbiAgb25FcnJvcj86IChfZXJyb3I6IEVycm9yKSA9PiB2b2lkO1xufVxuXG5leHBvcnQgY2xhc3MgTGF0ZW5jeURldGVjdG9yIHtcbiAgcHJpdmF0ZSBhdWRpb0VuZ2luZTogQXVkaW9FbmdpbmU7XG4gIHByaXZhdGUgb3B0aW9uczogTGF0ZW5jeURldGVjdG9yT3B0aW9ucztcbiAgcHJpdmF0ZSBsb2dnZXI6IExvZ2dlcjtcbiAgcHJpdmF0ZSBfaXNDYWxpYnJhdGluZzogYm9vbGVhbiA9IGZhbHNlO1xuICBwcml2YXRlIGNhbGlicmF0aW9uUmVzdWx0czogbnVtYmVyW10gPSBbXTtcblxuICBjb25zdHJ1Y3RvciAoYXVkaW9FbmdpbmU6IEF1ZGlvRW5naW5lLCBvcHRpb25zOiBMYXRlbmN5RGV0ZWN0b3JPcHRpb25zID0ge30pIHtcbiAgICB0aGlzLmF1ZGlvRW5naW5lID0gYXVkaW9FbmdpbmU7XG4gICAgdGhpcy5vcHRpb25zID0ge1xuICAgICAgcHVsc2VDaGVjazoge1xuICAgICAgICBkdXJhdGlvbjogMixcbiAgICAgICAgZnJlcXVlbmN5OiAxMDAwLFxuICAgICAgICB2b2x1bWU6IDAuNSxcbiAgICAgICAgdGhyZXNob2xkOiAwLjEsXG4gICAgICAgIG1heFJldHJpZXM6IDMsXG4gICAgICB9LFxuICAgICAgdXNlTmF0aXZlTGF0ZW5jeTogdHJ1ZSxcbiAgICAgIGNhbGlicmF0aW9uUm91bmRzOiAzLFxuICAgICAgLi4ub3B0aW9ucyxcbiAgICB9O1xuICAgIHRoaXMubG9nZ2VyID0gbmV3IExvZ2dlcih7fSwgJ0xhdGVuY3lEZXRlY3RvcicpO1xuICB9XG5cbiAgZ2V0IGlzQ2FsaWJyYXRpbmcgKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLl9pc0NhbGlicmF0aW5nO1xuICB9XG5cbiAgc2V0IGlzQ2FsaWJyYXRpbmcgKHZhbHVlOiBib29sZWFuKSB7XG4gICAgdGhpcy5faXNDYWxpYnJhdGluZyA9IHZhbHVlO1xuICB9XG5cbiAgZ2V0TmF0aXZlTGF0ZW5jeSAoKTogTGF0ZW5jeU1lYXN1cmVtZW50IHtcbiAgICBjb25zdCBjb250ZXh0ID0gdGhpcy5hdWRpb0VuZ2luZS5nZXRDb250ZXh0KCk7XG5cbiAgICBpZiAoIWNvbnRleHQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQXVkaW9FbmdpbmUgbm90IGluaXRpYWxpemVkJyk7XG4gICAgfVxuXG4gICAgY29uc3Qgb3V0cHV0TGF0ZW5jeSA9IEJyb3dzZXJVdGlscy5nZXRPdXRwdXRMYXRlbmN5KGNvbnRleHQpO1xuXG4gICAgY29uc3QgaW5wdXRMYXRlbmN5ID0gQnJvd3NlclV0aWxzLmdldElucHV0TGF0ZW5jeShjb250ZXh0KTtcblxuICAgIGNvbnN0IHRpbWVzdGFtcCA9IEJyb3dzZXJVdGlscy5nZXRET01IaWdoUmVzVGltZVN0YW1wKCk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgb3V0cHV0TGF0ZW5jeSxcbiAgICAgIGlucHV0TGF0ZW5jeSxcbiAgICAgIHRvdGFsTGF0ZW5jeTogb3V0cHV0TGF0ZW5jeSArIGlucHV0TGF0ZW5jeSxcbiAgICAgIHRpbWVzdGFtcCxcbiAgICAgIGNvbmZpZGVuY2U6IDAuOCxcbiAgICAgIG1ldGhvZDogJ25hdGl2ZScsXG4gICAgfTtcbiAgfVxuXG4gIGFzeW5jIHBlcmZvcm1QdWxzZUNoZWNrIChvcHRpb25zOiBQdWxzZUNoZWNrT3B0aW9ucyA9IHt9KTogUHJvbWlzZTxQdWxzZUNoZWNrUmVzdWx0PiB7XG4gICAgY29uc3Qgb3B0cyA9IHsgLi4udGhpcy5vcHRpb25zLnB1bHNlQ2hlY2ssIC4uLm9wdGlvbnMgfTtcblxuICAgIGlmICh0aGlzLl9pc0NhbGlicmF0aW5nKSB7XG4gICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgbGF0ZW5jeTogMCwgY29uZmlkZW5jZTogMCwgbWVhc3VyZW1lbnRzOiBbXSwgdGltZXN0YW1wOiBCcm93c2VyVXRpbHMuZ2V0RE9NSGlnaFJlc1RpbWVTdGFtcCgpIH07XG4gICAgfVxuXG4gICAgdGhpcy5faXNDYWxpYnJhdGluZyA9IHRydWU7XG4gICAgY29uc3QgbWVhc3VyZW1lbnRzOiBudW1iZXJbXSA9IFtdO1xuXG4gICAgbGV0IHN1Y2Nlc3MgPSBmYWxzZTtcblxuICAgIGxldCBjb25maWRlbmNlID0gMDtcblxuICAgIGxldCBsYXRlbmN5ID0gMDtcblxuICAgIHRyeSB7XG4gICAgICB0aGlzLmxvZ2dlci5pbmZvKCdTdGFydGluZyBwdWxzZSBjaGVjayBsYXRlbmN5IG1lYXN1cmVtZW50Jywgb3B0cyk7XG4gICAgICBpZiAodGhpcy5hdWRpb0VuZ2luZS5nZXRDb250ZXh0KCk/LnN0YXRlID09PSAnc3VzcGVuZGVkJykge1xuICAgICAgICBhd2FpdCB0aGlzLmF1ZGlvRW5naW5lLnJlc3VtZSgpO1xuICAgICAgfVxuXG4gICAgICBmb3IgKGxldCByb3VuZCA9IDA7IHJvdW5kIDwgKG9wdHMubWF4UmV0cmllcyA/PyAzKTsgcm91bmQrKykge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLnNpbmdsZVB1bHNlQ2hlY2tSb3VuZChvcHRzKTtcblxuICAgICAgICBpZiAocmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICAgICAgICBtZWFzdXJlbWVudHMucHVzaChyZXN1bHQubGF0ZW5jeSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKG1lYXN1cmVtZW50cy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGNvbnN0IGZpbHRlcmVkID0gdGhpcy5maWx0ZXJPdXRsaWVycyhtZWFzdXJlbWVudHMpO1xuXG4gICAgICAgIGlmIChmaWx0ZXJlZC5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgbGF0ZW5jeSA9IE1hdGhVdGlscy5tZWFuKGZpbHRlcmVkKTtcbiAgICAgICAgICBjb25maWRlbmNlID0gTWF0aC5taW4oMS4wLCAwLjcgKyAoZmlsdGVyZWQubGVuZ3RoIC8gKG9wdHMubWF4UmV0cmllcyA/PyAzKSAqIDAuMykpO1xuICAgICAgICAgIHN1Y2Nlc3MgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHRoaXMubG9nZ2VyLmVycm9yKCdQdWxzZSBjaGVjayBmYWlsZWQnLCBlcnJvcik7XG4gICAgICBpZiAodGhpcy5vcHRpb25zLm9uRXJyb3IpIHsgdGhpcy5vcHRpb25zLm9uRXJyb3IoZXJyb3IgYXMgRXJyb3IpOyB9XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHRoaXMuX2lzQ2FsaWJyYXRpbmcgPSBmYWxzZTtcbiAgICB9XG4gICAgY29uc3QgdGltZXN0YW1wID0gQnJvd3NlclV0aWxzLmdldERPTUhpZ2hSZXNUaW1lU3RhbXAoKTtcblxuICAgIGlmIChzdWNjZXNzICYmIHRoaXMub3B0aW9ucy5vbkxhdGVuY3lVcGRhdGUpIHtcbiAgICAgIHRoaXMub3B0aW9ucy5vbkxhdGVuY3lVcGRhdGUoe1xuICAgICAgICBvdXRwdXRMYXRlbmN5OiBsYXRlbmN5LCBpbnB1dExhdGVuY3k6IDAsIHRvdGFsTGF0ZW5jeTogbGF0ZW5jeSxcbiAgICAgICAgdGltZXN0YW1wLCBjb25maWRlbmNlLCBtZXRob2Q6ICdwdWxzZScsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4geyBzdWNjZXNzLCBsYXRlbmN5LCBjb25maWRlbmNlLCBtZWFzdXJlbWVudHMsIHRpbWVzdGFtcCB9O1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBzaW5nbGVQdWxzZUNoZWNrUm91bmQgKG9wdGlvbnM6IFB1bHNlQ2hlY2tPcHRpb25zKTogUHJvbWlzZTx7IHN1Y2Nlc3M6IGJvb2xlYW47IGxhdGVuY3k6IG51bWJlciB9PiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuICAgICAgY29uc3QgY29udGV4dCA9IHRoaXMuYXVkaW9FbmdpbmUuZ2V0Q29udGV4dCgpO1xuXG4gICAgICBpZiAoIWNvbnRleHQpIHsgcmVzb2x2ZSh7IHN1Y2Nlc3M6IGZhbHNlLCBsYXRlbmN5OiAwIH0pO1xuXG4gcmV0dXJuOyB9XG5cbiAgICAgIGNvbnN0IHB1bHNlVGltZXM6IG51bWJlcltdID0gW107XG5cbiAgICAgIGNvbnN0IHRhcFRpbWVzOiBudW1iZXJbXSA9IFtdO1xuXG4gICAgICBjb25zdCBwdWxzZUNvdW50ID0gTWF0aC5mbG9vcigob3B0aW9ucy5kdXJhdGlvbiA/PyAyKSAqIChvcHRpb25zLmZyZXF1ZW5jeSA/PyAxMDAwKSk7XG5cbiAgICAgIGNvbnN0IHB1bHNlSW50ZXJ2YWwgPSAxLjAgLyAob3B0aW9ucy5mcmVxdWVuY3kgPz8gMTAwMCk7XG5cbiAgICAgIGNvbnN0IHN0YXJ0VGltZSA9IGNvbnRleHQuY3VycmVudFRpbWUgKyAwLjE7XG5cbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcHVsc2VDb3VudDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IHB1bHNlVGltZSA9IHN0YXJ0VGltZSArIChpICogcHVsc2VJbnRlcnZhbCk7XG5cbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgLy8gUmVjb3JkIGFjdHVhbCB3YWxsLWNsb2NrIHRpbWUgd2hlbiB0aGUgY2xpY2sgcGxheXMgKHNhbWUgdGltZSBiYXNlIGFzIHRhcFRpbWVzKVxuICAgICAgICAgIHB1bHNlVGltZXMucHVzaChCcm93c2VyVXRpbHMuZ2V0UGVyZm9ybWFuY2VOb3coKSk7XG4gICAgICAgICAgdGhpcy5hdWRpb0VuZ2luZS5wbGF5Q2xpY2sob3B0aW9ucy52b2x1bWUpO1xuICAgICAgICB9LCAocHVsc2VUaW1lIC0gY29udGV4dC5jdXJyZW50VGltZSkgKiAxMDAwKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgaGFuZGxlVGFwID0gKF90aW1lc3RhbXA6IG51bWJlcik6IHZvaWQgPT4ge1xuICAgICAgICBjb25zdCBub3cgPSBCcm93c2VyVXRpbHMuZ2V0UGVyZm9ybWFuY2VOb3coKTtcblxuICAgICAgICB0YXBUaW1lcy5wdXNoKG5vdyk7XG4gICAgICAgIGlmICh0YXBUaW1lcy5sZW5ndGggPj0gcHVsc2VDb3VudCAqIDAuNykge1xuICAgICAgICAgIGNvbnN0IGxhdGVuY3kgPSB0aGlzLmNhbGN1bGF0ZUxhdGVuY3lGcm9tVGFwcyhwdWxzZVRpbWVzLCB0YXBUaW1lcyk7XG5cbiAgICAgICAgICBjbGVhbnVwKCk7IHJlc29sdmUoeyBzdWNjZXNzOiB0cnVlLCBsYXRlbmN5IH0pO1xuICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgICBjb25zdCBoYW5kbGVLZXlEb3duID0gKGU6IEtleWJvYXJkRXZlbnQpOiB2b2lkID0+IHtcbiAgICAgICAgaWYgKGUuY29kZSA9PT0gJ1NwYWNlJyB8fCBlLmNvZGUgPT09ICdFbnRlcicpIHsgZS5wcmV2ZW50RGVmYXVsdCgpOyBoYW5kbGVUYXAoQnJvd3NlclV0aWxzLmdldERPTUhpZ2hSZXNUaW1lU3RhbXAoKSk7IH1cbiAgICAgIH07XG5cbiAgICAgIGNvbnN0IGhhbmRsZUNsaWNrID0gKGU6IE1vdXNlRXZlbnQpOiB2b2lkID0+IHsgZS5wcmV2ZW50RGVmYXVsdCgpOyBoYW5kbGVUYXAoQnJvd3NlclV0aWxzLmdldERPTUhpZ2hSZXNUaW1lU3RhbXAoKSk7IH07XG5cbiAgICAgIGNvbnN0IGhhbmRsZVRvdWNoU3RhcnQgPSAoZTogVG91Y2hFdmVudCk6IHZvaWQgPT4geyBlLnByZXZlbnREZWZhdWx0KCk7IGhhbmRsZVRhcChCcm93c2VyVXRpbHMuZ2V0RE9NSGlnaFJlc1RpbWVTdGFtcCgpKTsgfTtcblxuICAgICAgY29uc3QgY2xlYW51cCA9ICgpOiB2b2lkID0+IHtcbiAgICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIGhhbmRsZUtleURvd24pO1xuICAgICAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdjbGljaycsIGhhbmRsZUNsaWNrKTtcbiAgICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcigndG91Y2hzdGFydCcsIGhhbmRsZVRvdWNoU3RhcnQpO1xuICAgICAgfTtcblxuICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIGhhbmRsZUtleURvd24pO1xuICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBoYW5kbGVDbGljayk7XG4gICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCd0b3VjaHN0YXJ0JywgaGFuZGxlVG91Y2hTdGFydCk7XG4gICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgY2xlYW51cCgpO1xuICAgICAgICBpZiAodGFwVGltZXMubGVuZ3RoID49IHB1bHNlQ291bnQgKiAwLjUpIHtcbiAgICAgICAgICBjb25zdCBsYXRlbmN5ID0gdGhpcy5jYWxjdWxhdGVMYXRlbmN5RnJvbVRhcHMocHVsc2VUaW1lcywgdGFwVGltZXMpO1xuXG4gICAgICAgICAgcmVzb2x2ZSh7IHN1Y2Nlc3M6IHRydWUsIGxhdGVuY3kgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVzb2x2ZSh7IHN1Y2Nlc3M6IGZhbHNlLCBsYXRlbmN5OiAwIH0pO1xuICAgICAgICB9XG4gICAgICB9LCAob3B0aW9ucy5kdXJhdGlvbiA/PyAyKSAqIDEwMDAgKiAyKTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgY2FsY3VsYXRlTGF0ZW5jeUZyb21UYXBzIChwdWxzZVRpbWVzOiBudW1iZXJbXSwgdGFwVGltZXM6IG51bWJlcltdKTogbnVtYmVyIHtcbiAgICBpZiAocHVsc2VUaW1lcy5sZW5ndGggPT09IDAgfHwgdGFwVGltZXMubGVuZ3RoID09PSAwKSB7cmV0dXJuIDA7fVxuXG4gICAgY29uc3QgbGF0ZW5jaWVzOiBudW1iZXJbXSA9IFtdO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBNYXRoLm1pbihwdWxzZVRpbWVzLmxlbmd0aCwgdGFwVGltZXMubGVuZ3RoKTsgaSsrKSB7XG4gICAgICBjb25zdCBsYXRlbmN5ID0gdGFwVGltZXNbaV0gLSBwdWxzZVRpbWVzW2ldO1xuXG4gICAgICBpZiAobGF0ZW5jeSA+IDAgJiYgbGF0ZW5jeSA8IDEuMCkge2xhdGVuY2llcy5wdXNoKGxhdGVuY3kpO31cbiAgICB9XG5cbiAgICBpZiAobGF0ZW5jaWVzLmxlbmd0aCA9PT0gMCkge3JldHVybiAwO31cblxuICAgIHJldHVybiBNYXRoVXRpbHMubWVkaWFuKGxhdGVuY2llcyk7XG4gIH1cblxuICBwcml2YXRlIGZpbHRlck91dGxpZXJzIChtZWFzdXJlbWVudHM6IG51bWJlcltdKTogbnVtYmVyW10ge1xuICAgIGlmIChtZWFzdXJlbWVudHMubGVuZ3RoIDw9IDIpIHtyZXR1cm4gbWVhc3VyZW1lbnRzO31cblxuICAgIGNvbnN0IG1lYW4gPSBNYXRoVXRpbHMubWVhbihtZWFzdXJlbWVudHMpO1xuXG4gICAgY29uc3Qgc3RkRGV2ID0gTWF0aFV0aWxzLnN0YW5kYXJkRGV2aWF0aW9uKG1lYXN1cmVtZW50cyk7XG5cbiAgICBjb25zdCB0aHJlc2hvbGQgPSBzdGREZXYgKiAyO1xuXG4gICAgcmV0dXJuIG1lYXN1cmVtZW50cy5maWx0ZXIobSA9PiBNYXRoLmFicyhtIC0gbWVhbikgPD0gdGhyZXNob2xkKTtcbiAgfVxuXG4gIGFzeW5jIGNhbGlicmF0ZSAoKTogUHJvbWlzZTxMYXRlbmN5Q2FsaWJyYXRpb25SZXN1bHQ+IHtcbiAgICB0aGlzLmxvZ2dlci5pbmZvKCdTdGFydGluZyBsYXRlbmN5IGNhbGlicmF0aW9uJyk7XG4gICAgY29uc3QgbWVhc3VyZW1lbnRzOiBMYXRlbmN5TWVhc3VyZW1lbnRbXSA9IFtdO1xuXG4gICAgdHJ5IHtcbiAgICAgIGlmICh0aGlzLm9wdGlvbnMudXNlTmF0aXZlTGF0ZW5jeSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IG5hdGl2ZSA9IHRoaXMuZ2V0TmF0aXZlTGF0ZW5jeSgpO1xuXG4gICAgICAgICAgbWVhc3VyZW1lbnRzLnB1c2gobmF0aXZlKTtcbiAgICAgICAgICB0aGlzLmxvZ2dlci5pbmZvKCdOYXRpdmUgbGF0ZW5jeSBkZXRlY3RlZCcsIG5hdGl2ZSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgdGhpcy5sb2dnZXIud2FybignTmF0aXZlIGxhdGVuY3kgbm90IGF2YWlsYWJsZScsIGVycm9yKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBPbmx5IHBlcmZvcm0gcHVsc2UgY2hlY2sgaWYgd2UgaGF2ZSB1c2VyIGludGVyYWN0aW9uIGF2YWlsYWJsZVxuICAgICAgLy8gSW4gdGVzdCBlbnZpcm9ubWVudHMsIHRoaXMgd2lsbCB0aW1lb3V0LCBzbyB3ZSBza2lwIGl0XG4gICAgICBjb25zdCBpc1Rlc3RFbnZpcm9ubWVudCA9IHR5cGVvZiBwcm9jZXNzICE9PSAndW5kZWZpbmVkJyAmJiBwcm9jZXNzLmVudi5OT0RFX0VOViA9PT0gJ3Rlc3QnO1xuXG4gICAgICBpZiAoIWlzVGVzdEVudmlyb25tZW50KSB7XG4gICAgICAgIGNvbnN0IHB1bHNlUmVzdWx0ID0gYXdhaXQgdGhpcy5wZXJmb3JtUHVsc2VDaGVjaygpO1xuXG4gICAgICAgIGlmIChwdWxzZVJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICAgICAgbWVhc3VyZW1lbnRzLnB1c2goe1xuICAgICAgICAgICAgb3V0cHV0TGF0ZW5jeTogcHVsc2VSZXN1bHQubGF0ZW5jeSwgaW5wdXRMYXRlbmN5OiAwLFxuICAgICAgICAgICAgdG90YWxMYXRlbmN5OiBwdWxzZVJlc3VsdC5sYXRlbmN5LCB0aW1lc3RhbXA6IHB1bHNlUmVzdWx0LnRpbWVzdGFtcCxcbiAgICAgICAgICAgIGNvbmZpZGVuY2U6IHB1bHNlUmVzdWx0LmNvbmZpZGVuY2UsIG1ldGhvZDogJ3B1bHNlJyxcbiAgICAgICAgICB9KTtcbiAgICAgICAgICB0aGlzLmxvZ2dlci5pbmZvKCdQdWxzZSBjaGVjayBjb21wbGV0ZWQnLCBwdWxzZVJlc3VsdCk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKG1lYXN1cmVtZW50cy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGNvbnN0IHRvdGFsQ29uZmlkZW5jZSA9IG1lYXN1cmVtZW50cy5yZWR1Y2UoKGFjYywgbSkgPT4gYWNjICsgbS5jb25maWRlbmNlLCAwKTtcblxuICAgICAgICBjb25zdCB3ZWlnaHRlZExhdGVuY3kgPSBtZWFzdXJlbWVudHMucmVkdWNlKChhY2MsIG0pID0+IGFjYyArIChtLnRvdGFsTGF0ZW5jeSAqIG0uY29uZmlkZW5jZSksIDApIC8gdG90YWxDb25maWRlbmNlO1xuXG4gICAgICAgIGNvbnN0IGJlc3RNZWFzdXJlbWVudCA9IG1lYXN1cmVtZW50cy5yZWR1Y2UoKGJlc3QsIGN1cnJlbnQpID0+IGN1cnJlbnQuY29uZmlkZW5jZSA+IGJlc3QuY29uZmlkZW5jZSA/IGN1cnJlbnQgOiBiZXN0KTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgbGF0ZW5jeTogd2VpZ2h0ZWRMYXRlbmN5LFxuICAgICAgICAgIG91dHB1dExhdGVuY3k6IGJlc3RNZWFzdXJlbWVudC5vdXRwdXRMYXRlbmN5LFxuICAgICAgICAgIGlucHV0TGF0ZW5jeTogYmVzdE1lYXN1cmVtZW50LmlucHV0TGF0ZW5jeSxcbiAgICAgICAgICB0b3RhbExhdGVuY3k6IHdlaWdodGVkTGF0ZW5jeSxcbiAgICAgICAgICB0aW1lc3RhbXA6IERhdGUubm93KCksXG4gICAgICAgICAgY29uZmlkZW5jZTogTWF0aC5taW4oMS4wLCB0b3RhbENvbmZpZGVuY2UgLyBtZWFzdXJlbWVudHMubGVuZ3RoKSxcbiAgICAgICAgICBtZWFzdXJlbWVudHMsXG4gICAgICAgICAgbWV0aG9kOiBiZXN0TWVhc3VyZW1lbnQubWV0aG9kLFxuICAgICAgICB9O1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICB0aGlzLmxvZ2dlci5lcnJvcignQ2FsaWJyYXRpb24gZmFpbGVkJywgZXJyb3IpO1xuICAgICAgaWYgKHRoaXMub3B0aW9ucy5vbkVycm9yKSB7IHRoaXMub3B0aW9ucy5vbkVycm9yKGVycm9yIGFzIEVycm9yKTsgfVxuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBzdWNjZXNzOiBmYWxzZSwgbGF0ZW5jeTogMC4xLFxuICAgICAgb3V0cHV0TGF0ZW5jeTogMC4wNSwgaW5wdXRMYXRlbmN5OiAwLjA1LFxuICAgICAgdG90YWxMYXRlbmN5OiAwLjEsXG4gICAgICB0aW1lc3RhbXA6IEJyb3dzZXJVdGlscy5nZXRET01IaWdoUmVzVGltZVN0YW1wKCksXG4gICAgICBjb25maWRlbmNlOiAwLjMsIG1lYXN1cmVtZW50czogW10sIG1ldGhvZDogJ25hdGl2ZScsXG4gICAgfTtcbiAgfVxuXG4gIGdldEN1cnJlbnRMYXRlbmN5ICgpOiBMYXRlbmN5TWVhc3VyZW1lbnQge1xuICAgIHRyeSB7IHJldHVybiB0aGlzLmdldE5hdGl2ZUxhdGVuY3koKTsgfVxuICAgIGNhdGNoIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG91dHB1dExhdGVuY3k6IDAuMDUsIGlucHV0TGF0ZW5jeTogMC4wNSwgdG90YWxMYXRlbmN5OiAwLjEsXG4gICAgICAgIHRpbWVzdGFtcDogQnJvd3NlclV0aWxzLmdldERPTUhpZ2hSZXNUaW1lU3RhbXAoKSwgY29uZmlkZW5jZTogMC4zLCBtZXRob2Q6ICduYXRpdmUnLFxuICAgICAgfTtcbiAgICB9XG4gIH1cblxuICBpc0RldGVjdGluZyAoKTogYm9vbGVhbiB7IHJldHVybiB0aGlzLl9pc0NhbGlicmF0aW5nOyB9XG4gIGdldENhbGlicmF0aW9uSGlzdG9yeSAoKTogTGF0ZW5jeU1lYXN1cmVtZW50W10geyByZXR1cm4gW107IH1cblxuICBzdGFydCAoKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLl9pc0NhbGlicmF0aW5nKSB7XG4gICAgICB0aGlzLmxvZ2dlci5pbmZvKCdMYXRlbmN5IGRldGVjdG9yIHN0YXJ0ZWQnKTtcbiAgICB9XG4gIH1cblxuICBzdG9wICgpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5faXNDYWxpYnJhdGluZykge1xuICAgICAgdGhpcy5faXNDYWxpYnJhdGluZyA9IGZhbHNlO1xuICAgIH1cblxuICAgIHRoaXMubG9nZ2VyLmluZm8oJ0xhdGVuY3kgZGV0ZWN0b3Igc3RvcHBlZCcpO1xuICB9XG5cbiAgc3RhcnRNYW51YWxUYXBTeW5jIChvcHRpb25zOiB7IHB1bHNlQ291bnQ/OiBudW1iZXI7IHB1bHNlSW50ZXJ2YWw/OiBudW1iZXI7IG9uVGFwPzogKHRhcDogVGFwRXZlbnQpID0+IHZvaWQ7IH0gPSB7fSk6IHZvaWQge1xuICAgIGNvbnN0IHB1bHNlQ291bnQgPSBvcHRpb25zLnB1bHNlQ291bnQgPz8gMTA7XG5cbiAgICBjb25zdCBwdWxzZUludGVydmFsID0gb3B0aW9ucy5wdWxzZUludGVydmFsID8/IDEuMDtcblxuICAgIGNvbnN0IG9uVGFwID0gb3B0aW9ucy5vblRhcDtcblxuICAgIGNvbnN0IGNvbnRleHQgPSB0aGlzLmF1ZGlvRW5naW5lLmdldENvbnRleHQoKTtcblxuICAgIGlmICghY29udGV4dCkge1xuICAgICAgdGhpcy5sb2dnZXIuZXJyb3IoJ0F1ZGlvRW5naW5lIG5vdCBpbml0aWFsaXplZC4gQ2FsbCBpbml0aWFsaXplKCkgZmlyc3QuJyk7XG5cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoY29udGV4dC5zdGF0ZSA9PT0gJ3N1c3BlbmRlZCcpIHtcbiAgICAgIHZvaWQgY29udGV4dC5yZXN1bWUoKTtcbiAgICB9XG5cbiAgICB0aGlzLmxvZ2dlci5pbmZvKCdNYW51YWwgdGFwIHN5bmMgc3RhcnRlZCcsIHsgcHVsc2VDb3VudCwgcHVsc2VJbnRlcnZhbCB9KTtcblxuICAgIC8vIE1hcCBBdWRpb0NvbnRleHQgdGltZSB0byBwZXJmb3JtYW5jZS5ub3coKSB0aW1lIHNvIG9mZnNldHMgYXJlIG1lYW5pbmdmdWxcbiAgICBjb25zdCBjdHhTdGFydCA9IGNvbnRleHQuY3VycmVudFRpbWU7XG5cbiAgICBjb25zdCBwZXJmU3RhcnQgPSBCcm93c2VyVXRpbHMuZ2V0UGVyZm9ybWFuY2VOb3coKTsgLy8gc2Vjb25kc1xuXG4gICAgY29uc3QgYXVkaW9Ub1BlcmYgPSAoYXVkaW9UaW1lOiBudW1iZXIpOiBudW1iZXIgPT4gcGVyZlN0YXJ0ICsgKGF1ZGlvVGltZSAtIGN0eFN0YXJ0KTtcblxuICAgIGNvbnN0IHB1bHNlVGltZXM6IG51bWJlcltdID0gW107IC8vIGluIHBlcmZvcm1hbmNlLXRpbWUgc2Vjb25kc1xuXG4gICAgY29uc3QgYXVkaW9TdGFydFRpbWUgPSBjb250ZXh0LmN1cnJlbnRUaW1lICsgMC41OyAvLyBzbWFsbCBsZWFkLWluXG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHB1bHNlQ291bnQ7IGkrKykge1xuICAgICAgY29uc3QgYXVkaW9QdWxzZVRpbWUgPSBhdWRpb1N0YXJ0VGltZSArIChpICogcHVsc2VJbnRlcnZhbCk7XG5cbiAgICAgIHB1bHNlVGltZXMucHVzaChhdWRpb1RvUGVyZihhdWRpb1B1bHNlVGltZSkpO1xuXG4gICAgICBjb25zdCBkZWxheU1zID0gTWF0aC5tYXgoMCwgKGF1ZGlvUHVsc2VUaW1lIC0gY29udGV4dC5jdXJyZW50VGltZSkgKiAxMDAwKTtcblxuICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIHRoaXMuYXVkaW9FbmdpbmUucGxheUNsaWNrKDAuNSk7XG4gICAgICB9LCBkZWxheU1zKTtcbiAgICB9XG5cbiAgICBsZXQgdGFwQ291bnQgPSAwO1xuXG4gICAgY29uc3QgaGFuZGxlVGFwID0gKCk6IHZvaWQgPT4ge1xuICAgICAgY29uc3Qgbm93ID0gQnJvd3NlclV0aWxzLmdldFBlcmZvcm1hbmNlTm93KCk7XG5cbiAgICAgIHRhcENvdW50Kys7XG5cbiAgICAgIC8vIEZpbmQgbmVhcmVzdCBzY2hlZHVsZWQgcHVsc2VcbiAgICAgIGxldCBuZWFyZXN0SWR4ID0gMDtcblxuICAgICAgbGV0IG5lYXJlc3REaWZmID0gSW5maW5pdHk7XG5cbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcHVsc2VUaW1lcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBkaWZmID0gTWF0aC5hYnMobm93IC0gcHVsc2VUaW1lc1tpXSk7XG5cbiAgICAgICAgaWYgKGRpZmYgPCBuZWFyZXN0RGlmZikge1xuICAgICAgICAgIG5lYXJlc3REaWZmID0gZGlmZjtcbiAgICAgICAgICBuZWFyZXN0SWR4ID0gaTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICB0aGlzLmxvZ2dlci5kZWJ1ZygnVGFwIHJlY2VpdmVkJywgeyB0YXBDb3VudCwgb2Zmc2V0OiBub3cgLSBwdWxzZVRpbWVzW25lYXJlc3RJZHhdIH0pO1xuXG4gICAgICBpZiAob25UYXApIHtcbiAgICAgICAgb25UYXAoe1xuICAgICAgICAgIHRpbWVzdGFtcDogbm93LFxuICAgICAgICAgIHR5cGU6ICd0YXAnLFxuICAgICAgICAgIGV4cGVjdGVkVGltZTogcHVsc2VUaW1lc1tuZWFyZXN0SWR4XSxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIGNvbnN0IGhhbmRsZUtleURvd24gPSAoZTogS2V5Ym9hcmRFdmVudCk6IHZvaWQgPT4ge1xuICAgICAgaWYgKGUuY29kZSA9PT0gJ1NwYWNlJyB8fCBlLmNvZGUgPT09ICdFbnRlcicpIHtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICBoYW5kbGVUYXAoKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgY29uc3QgaGFuZGxlUG9pbnRlciA9IChlOiBNb3VzZUV2ZW50IHwgVG91Y2hFdmVudCk6IHZvaWQgPT4ge1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgaGFuZGxlVGFwKCk7XG4gICAgfTtcblxuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBoYW5kbGVLZXlEb3duKTtcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGhhbmRsZVBvaW50ZXIpO1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNoc3RhcnQnLCBoYW5kbGVQb2ludGVyKTtcblxuICAgIC8vIENsZWFuIHVwIGFmdGVyIGFsbCBwdWxzZXMgKyBidWZmZXJcbiAgICBjb25zdCB0b3RhbE1zID0gKHB1bHNlQ291bnQgKiBwdWxzZUludGVydmFsICsgMikgKiAxMDAwO1xuXG4gICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdrZXlkb3duJywgaGFuZGxlS2V5RG93bik7XG4gICAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdjbGljaycsIGhhbmRsZVBvaW50ZXIpO1xuICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcigndG91Y2hzdGFydCcsIGhhbmRsZVBvaW50ZXIpO1xuICAgICAgdGhpcy5sb2dnZXIuaW5mbygnTWFudWFsIHRhcCBzeW5jIGVuZGVkJywgeyB0YXBzUmVjZWl2ZWQ6IHRhcENvdW50LCBwdWxzZXNTY2hlZHVsZWQ6IHB1bHNlQ291bnQgfSk7XG4gICAgfSwgdG90YWxNcyk7XG4gIH1cblxuICBhc3luYyBkZXRlY3RMYXRlbmN5ICgpOiBQcm9taXNlPExhdGVuY3lNZWFzdXJlbWVudD4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuY2FsaWJyYXRlKCk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgb3V0cHV0TGF0ZW5jeTogcmVzdWx0Lm91dHB1dExhdGVuY3kgPz8gMC4wNSxcbiAgICAgIGlucHV0TGF0ZW5jeTogcmVzdWx0LmlucHV0TGF0ZW5jeSA/PyAwLjA1LFxuICAgICAgdG90YWxMYXRlbmN5OiByZXN1bHQudG90YWxMYXRlbmN5ID8/IHJlc3VsdC5sYXRlbmN5ID8/IDAuMSxcbiAgICAgIHRpbWVzdGFtcDogcmVzdWx0LnRpbWVzdGFtcCA/PyBEYXRlLm5vdygpLFxuICAgICAgY29uZmlkZW5jZTogcmVzdWx0LmNvbmZpZGVuY2UgPz8gMC4zLFxuICAgICAgbWV0aG9kOiByZXN1bHQubWV0aG9kID8/ICduYXRpdmUnLFxuICAgIH07XG4gIH1cblxuICBjbGVhbnVwICgpOiB2b2lkIHtcbiAgICB0aGlzLl9pc0NhbGlicmF0aW5nID0gZmFsc2U7XG4gICAgdGhpcy5jYWxpYnJhdGlvblJlc3VsdHMgPSBbXTtcbiAgICB0aGlzLmxvZ2dlci5pbmZvKCdMYXRlbmN5IGRldGVjdG9yIGNsZWFuZWQgdXAnKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBMYXRlbmN5RGV0ZWN0b3I7XG4iXX0=