import { LatencyMeasurement, PulseCheckOptions, PulseCheckResult, TapEvent } from '../types';
import { AudioEngine } from './audioEngine';
export type { PulseCheckResult };
export interface LatencyCalibrationResult {
    success: boolean;
    latency: number;
    outputLatency: number;
    inputLatency: number;
    totalLatency: number;
    timestamp: number;
    confidence: number;
    measurements: LatencyMeasurement[];
    method?: LatencyMeasurement['method'];
}
export interface LatencyDetectorOptions {
    pulseCheck?: PulseCheckOptions;
    useNativeLatency?: boolean;
    calibrationRounds?: number;
    onLatencyUpdate?: (_measurement: LatencyMeasurement) => void;
    onError?: (_error: Error) => void;
}
export declare class LatencyDetector {
    private audioEngine;
    private options;
    private logger;
    private _isCalibrating;
    private calibrationResults;
    constructor(audioEngine: AudioEngine, options?: LatencyDetectorOptions);
    get isCalibrating(): boolean;
    set isCalibrating(value: boolean);
    getNativeLatency(): LatencyMeasurement;
    performPulseCheck(options?: PulseCheckOptions): Promise<PulseCheckResult>;
    private singlePulseCheckRound;
    private calculateLatencyFromTaps;
    private filterOutliers;
    calibrate(): Promise<LatencyCalibrationResult>;
    getCurrentLatency(): LatencyMeasurement;
    isDetecting(): boolean;
    getCalibrationHistory(): LatencyMeasurement[];
    start(): void;
    stop(): void;
    startManualTapSync(options?: {
        pulseCount?: number;
        pulseInterval?: number;
        onTap?: (tap: TapEvent) => void;
    }): void;
    detectLatency(): Promise<LatencyMeasurement>;
    cleanup(): void;
}
export default LatencyDetector;
