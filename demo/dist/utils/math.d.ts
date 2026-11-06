export declare class MathUtils {
    /**
     * Calculate mean of an array of numbers
     */
    static mean(values: number[]): number;
    /**
     * Calculate standard deviation of an array of numbers
     */
    static standardDeviation(values: number[]): number;
    /**
     * Calculate variance of an array of numbers
     */
    static variance(values: number[]): number;
    /**
     * Calculate median of an array of numbers
     */
    static median(values: number[]): number;
    /**
     * Calculate moving average
     */
    static movingAverage(values: number[], windowSize: number): number;
    /**
     * Linear regression to predict next value
     */
    static linearRegression(x: number[], y: number[]): {
        slope: number;
        intercept: number;
    };
    /**
     * Predict next value using linear regression
     */
    static predictNextValue(timestamps: number[], values: number[]): number;
    /**
     * Calculate exponential moving average
     */
    static exponentialMovingAverage(current: number, previous: number, smoothingFactor?: number): number;
    /**
     * Calculate weighted average
     */
    static weightedAverage(values: number[], weights: number[]): number;
    /**
     * Clamp value between min and max
     */
    static clamp(value: number, min: number, max: number): number;
    /**
     * Normalize value to range [0, 1]
     */
    static normalize(value: number, min: number, max: number): number;
    /**
     * Denormalize value from range [0, 1] to [min, max]
     */
    static denormalize(normalized: number, min: number, max: number): number;
    /**
     * Calculate RMS (Root Mean Square) of an array of numbers
     */
    static rms(values: number[]): number;
    /**
     * Calculate peak value in an array
     */
    static peak(values: number[]): number;
    /**
     * Calculate correlation coefficient between two arrays
     */
    static correlation(x: number[], y: number[]): number;
    /**
     * Normalized cross-correlation of a reference signal against a longer signal.
     * Finds the lag (in samples, sub-sample via parabolic interpolation) at which
     * the reference best matches the signal. Score is in [-1, 1].
     */
    static crossCorrelate(reference: ArrayLike<number>, signal: ArrayLike<number>, maxLag: number, minLag?: number): {
        lag: number;
        score: number;
    };
    /**
     * Generate a range of numbers
     */
    static range(start: number, end: number, step?: number): number[];
    /**
     * Check if value is within range (inclusive)
     */
    static inRange(value: number, min: number, max: number): boolean;
    /**
     * Calculate modulo that works correctly with negative numbers
     */
    static mod(n: number, m: number): number;
    /**
     * Calculate phase difference between two timestamps
     */
    static phaseDifference(timestamp1: number, timestamp2: number, period: number): number;
}
export default MathUtils;
