import { DriftCorrectionOptions, LatencyMeasurement, SyncStatus } from '../types';
export interface DriftSample {
    timestamp: number;
    measuredLatency: number;
    expectedLatency: number;
    drift: number;
}
export interface DriftCorrection {
    correction: number;
    confidence: number;
    samplesUsed: number;
    timestamp: number;
}
export interface DriftCorrectionConfig extends DriftCorrectionOptions {
    maxHistorySize?: number;
    minSamplesForCorrection?: number;
    correctionInterval?: number;
    historySize?: number;
}
export declare class DriftCorrector {
    private options;
    private history;
    private correctionHistory;
    private _isRunning;
    private correctionInterval;
    private lastCorrection;
    private logger;
    constructor(options?: DriftCorrectionOptions);
    isRunning(): boolean;
    start(): void;
    stop(): void;
    addMeasurement(measurement: LatencyMeasurement, expectedLatency: number): void;
    getCurrentDrift(): number;
    getAverageDrift(): number;
    getDriftTrend(): number;
    predictDrift(predictionWindow?: number): number;
    applyCorrection(): DriftCorrection | null;
    private calculateConfidence;
    getLastCorrection(): DriftCorrection | null;
    getCorrectionHistory(): DriftCorrection[];
    getDriftSamples(): DriftSample[];
    clearHistory(): void;
    getSyncStatus(expectedLatency: number): SyncStatus;
    reset(): void;
}
