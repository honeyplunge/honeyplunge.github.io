// Drift Correction System for WebAudio Sync
import { MathUtils } from '../utils/math.js';
import { Logger } from '../utils/logger.js';
export class DriftCorrector {
    constructor(options = {}) {
        this.history = [];
        this.correctionHistory = [];
        this._isRunning = false;
        this.correctionInterval = null;
        this.lastCorrection = null;
        this.options = {
            enabled: options.enabled ?? true,
            predictionWindow: options.predictionWindow ?? 10,
            correctionStrength: options.correctionStrength ?? 0.5,
            maxCorrection: options.maxCorrection ?? 0.1,
            historySize: options.historySize ?? 100,
            maxHistorySize: options.historySize ?? 100,
            minSamplesForCorrection: 5,
            correctionInterval: 1000,
            ...options,
        };
        this.logger = new Logger({}, 'DriftCorrector');
    }
    isRunning() {
        return this._isRunning;
    }
    start() {
        if (this._isRunning) {
            return;
        }
        this._isRunning = true;
        this.logger.info('Drift correction started');
        if (this.options.correctionInterval) {
            this.correctionInterval = window.setInterval(() => {
                this.applyCorrection();
            }, this.options.correctionInterval);
        }
    }
    stop() {
        this._isRunning = false;
        if (this.correctionInterval) {
            clearInterval(this.correctionInterval);
            this.correctionInterval = null;
        }
        this.logger.info('Drift correction stopped');
    }
    addMeasurement(measurement, expectedLatency) {
        const drift = measurement.totalLatency - expectedLatency;
        const sample = {
            timestamp: measurement.timestamp,
            measuredLatency: measurement.totalLatency,
            expectedLatency,
            drift,
        };
        this.history.push(sample);
        const maxSize = this.options.maxHistorySize ?? 100;
        if (this.history.length > maxSize) {
            this.history.shift();
        }
        this.logger.debug('Added drift sample', { measured: measurement.totalLatency, expected: expectedLatency, drift });
    }
    getCurrentDrift() {
        if (this.history.length === 0) {
            return 0;
        }
        return this.history[this.history.length - 1].drift;
    }
    getAverageDrift() {
        if (this.history.length === 0) {
            return 0;
        }
        const drifts = this.history.map(s => s.drift);
        return MathUtils.mean(drifts);
    }
    getDriftTrend() {
        if (this.history.length < 2) {
            return 0;
        }
        const timestamps = this.history.map(s => s.timestamp);
        const drifts = this.history.map(s => s.drift);
        const { slope } = MathUtils.linearRegression(timestamps, drifts);
        return slope * 1000;
    }
    predictDrift(predictionWindow = 10) {
        if (this.history.length < 2) {
            return this.getCurrentDrift();
        }
        const timestamps = this.history.map(s => s.timestamp);
        const drifts = this.history.map(s => s.drift);
        const { slope, intercept } = MathUtils.linearRegression(timestamps, drifts);
        const lastTimestamp = timestamps[timestamps.length - 1];
        const futureTimestamp = lastTimestamp + (predictionWindow * 1000);
        return slope * futureTimestamp + intercept;
    }
    applyCorrection() {
        const enabled = this.options.enabled ?? true;
        const minSamples = this.options.minSamplesForCorrection ?? 5;
        if (!enabled || this.history.length < minSamples) {
            return null;
        }
        const currentDrift = this.getCurrentDrift();
        const averageDrift = this.getAverageDrift();
        const predictionWindow = this.options.predictionWindow ?? 10;
        const predictedDrift = this.predictDrift(predictionWindow);
        const combinedDrift = (currentDrift * 0.6 + averageDrift * 0.2 + predictedDrift * 0.2);
        const correctionStrength = this.options.correctionStrength ?? 0.5;
        let correction = -combinedDrift * correctionStrength;
        const maxCorr = this.options.maxCorrection ?? 0.1;
        correction = MathUtils.clamp(correction, -maxCorr, maxCorr);
        const confidence = this.calculateConfidence();
        const result = { correction, confidence, samplesUsed: this.history.length, timestamp: Date.now() };
        this.lastCorrection = result;
        this.correctionHistory.push(result);
        const maxSize = this.options.maxHistorySize ?? 100;
        if (this.correctionHistory.length > maxSize) {
            this.correctionHistory.shift();
        }
        this.logger.info('Drift correction applied', result);
        return result;
    }
    calculateConfidence() {
        if (this.history.length === 0) {
            return 0;
        }
        const drifts = this.history.map(s => s.drift);
        const stdDev = MathUtils.standardDeviation(drifts);
        const meanDrift = MathUtils.mean(drifts);
        let confidence = 1.0 - Math.min(1.0, stdDev / 0.05);
        confidence *= Math.min(1.0, this.history.length / 20);
        confidence *= (1.0 - Math.min(1.0, Math.abs(meanDrift) / 0.5)) * 0.5 + 0.5;
        return Math.max(0, Math.min(1.0, confidence));
    }
    getLastCorrection() {
        return this.lastCorrection;
    }
    getCorrectionHistory() {
        return [...this.correctionHistory];
    }
    getDriftSamples() {
        return [...this.history];
    }
    clearHistory() {
        this.history = [];
        this.correctionHistory = [];
        this.lastCorrection = null;
        this.logger.info('Drift history cleared');
    }
    getSyncStatus(expectedLatency) {
        const currentLatency = this.history.length > 0 ? this.history[this.history.length - 1].measuredLatency : expectedLatency;
        const drift = this.getCurrentDrift();
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
        return { isSynced: absDrift < 0.05, currentLatency, drift, timestamp, lastCheck: timestamp, quality };
    }
    reset() {
        this.stop();
        this.clearHistory();
        this.lastCorrection = null;
        this._isRunning = false;
    }
}
