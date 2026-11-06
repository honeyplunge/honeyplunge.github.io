// Mathematical utilities for WebAudio Sync
export class MathUtils {
    /**
     * Calculate mean of an array of numbers
     */
    static mean(values) {
        if (values.length === 0) {
            return 0;
        }
        const sum = values.reduce((acc, val) => acc + val, 0);
        return sum / values.length;
    }
    /**
     * Calculate standard deviation of an array of numbers
     */
    static standardDeviation(values) {
        if (values.length <= 1) {
            return 0;
        }
        const avg = this.mean(values);
        const squaredDiffs = values.map(val => Math.pow(val - avg, 2));
        const variance = this.mean(squaredDiffs);
        return Math.sqrt(variance);
    }
    /**
     * Calculate variance of an array of numbers
     */
    static variance(values) {
        return Math.pow(this.standardDeviation(values), 2);
    }
    /**
     * Calculate median of an array of numbers
     */
    static median(values) {
        if (values.length === 0) {
            return 0;
        }
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        if (sorted.length % 2 === 0) {
            return (sorted[mid - 1] + sorted[mid]) / 2;
        }
        return sorted[mid];
    }
    /**
     * Calculate moving average
     */
    static movingAverage(values, windowSize) {
        if (values.length === 0) {
            return 0;
        }
        const window = values.slice(-windowSize);
        return this.mean(window);
    }
    /**
     * Linear regression to predict next value
     */
    static linearRegression(x, y) {
        if (x.length !== y.length || x.length < 2) {
            return { slope: 0, intercept: this.mean(y) };
        }
        const n = x.length;
        const sumX = x.reduce((acc, val) => acc + val, 0);
        const sumY = y.reduce((acc, val) => acc + val, 0);
        const sumXY = x.reduce((acc, val, i) => acc + val * y[i], 0);
        const sumX2 = x.reduce((acc, val) => acc + val * val, 0);
        const denominator = n * sumX2 - sumX * sumX;
        if (denominator === 0) {
            // All x values are identical — no trend, return mean of y
            return { slope: 0, intercept: this.mean(y) };
        }
        const slope = (n * sumXY - sumX * sumY) / denominator;
        const intercept = (sumY - slope * sumX) / n;
        return { slope, intercept };
    }
    /**
     * Predict next value using linear regression
     */
    static predictNextValue(timestamps, values) {
        if (timestamps.length < 2) {
            return values.length > 0 ? values[values.length - 1] : 0;
        }
        const { slope, intercept } = this.linearRegression(timestamps, values);
        const lastTimestamp = timestamps[timestamps.length - 1];
        const nextTimestamp = lastTimestamp + (timestamps[timestamps.length - 1] - timestamps[timestamps.length - 2]);
        return slope * nextTimestamp + intercept;
    }
    /**
     * Calculate exponential moving average
     */
    static exponentialMovingAverage(current, previous, smoothingFactor = 0.3) {
        return current * smoothingFactor + previous * (1 - smoothingFactor);
    }
    /**
     * Calculate weighted average
     */
    static weightedAverage(values, weights) {
        if (values.length !== weights.length || values.length === 0) {
            return this.mean(values);
        }
        const totalWeight = weights.reduce((acc, w) => acc + w, 0);
        if (totalWeight === 0) {
            return this.mean(values);
        }
        const weightedSum = values.reduce((acc, val, i) => acc + val * weights[i], 0);
        return weightedSum / totalWeight;
    }
    /**
     * Clamp value between min and max
     */
    static clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }
    /**
     * Normalize value to range [0, 1]
     */
    static normalize(value, min, max) {
        if (max === min) {
            return 0.5;
        }
        return (value - min) / (max - min);
    }
    /**
     * Denormalize value from range [0, 1] to [min, max]
     */
    static denormalize(normalized, min, max) {
        return min + normalized * (max - min);
    }
    /**
     * Calculate RMS (Root Mean Square) of an array of numbers
     */
    static rms(values) {
        if (values.length === 0) {
            return 0;
        }
        const sumSquares = values.reduce((acc, val) => acc + val * val, 0);
        const meanSquare = sumSquares / values.length;
        return Math.sqrt(meanSquare);
    }
    /**
     * Calculate peak value in an array
     */
    static peak(values) {
        return Math.max(...values.map(Math.abs));
    }
    /**
     * Calculate correlation coefficient between two arrays
     */
    static correlation(x, y) {
        if (x.length !== y.length || x.length < 2) {
            return 0;
        }
        const n = x.length;
        const sumX = x.reduce((acc, val) => acc + val, 0);
        const sumY = y.reduce((acc, val) => acc + val, 0);
        const sumXY = x.reduce((acc, val, i) => acc + val * y[i], 0);
        const sumX2 = x.reduce((acc, val) => acc + val * val, 0);
        const sumY2 = y.reduce((acc, val) => acc + val * val, 0);
        const numerator = sumXY - (sumX * sumY) / n;
        const denominatorX = Math.sqrt(sumX2 - (sumX * sumX) / n);
        const denominatorY = Math.sqrt(sumY2 - (sumY * sumY) / n);
        if (denominatorX === 0 || denominatorY === 0) {
            return 0;
        }
        return numerator / (denominatorX * denominatorY);
    }
    /**
     * Normalized cross-correlation of a reference signal against a longer signal.
     * Finds the lag (in samples, sub-sample via parabolic interpolation) at which
     * the reference best matches the signal. Score is in [-1, 1].
     */
    static crossCorrelate(reference, signal, maxLag, minLag = 0) {
        const refLen = reference.length;
        if (refLen === 0 || signal.length < refLen) {
            return { lag: 0, score: 0 };
        }
        const upper = Math.min(maxLag, signal.length - refLen);
        const lower = Math.max(0, Math.min(minLag, upper));
        let refEnergy = 0;
        for (let i = 0; i < refLen; i++) {
            const v = reference[i];
            refEnergy += v * v;
        }
        if (refEnergy === 0) {
            return { lag: 0, score: 0 };
        }
        const scores = new Float64Array(upper - lower + 1);
        let bestLag = lower;
        let bestScore = -Infinity;
        for (let lag = lower; lag <= upper; lag++) {
            let dot = 0;
            let sigEnergy = 0;
            for (let i = 0; i < refLen; i++) {
                const s = signal[lag + i];
                dot += reference[i] * s;
                sigEnergy += s * s;
            }
            const denom = Math.sqrt(refEnergy * sigEnergy);
            const score = denom > 0 ? dot / denom : 0;
            scores[lag - lower] = score;
            if (score > bestScore) {
                bestScore = score;
                bestLag = lag;
            }
        }
        // Parabolic interpolation around the peak for sub-sample resolution
        let lag = bestLag;
        const idx = bestLag - lower;
        if (idx > 0 && idx < scores.length - 1) {
            const y0 = scores[idx - 1];
            const y1 = scores[idx];
            const y2 = scores[idx + 1];
            const denom = y0 - 2 * y1 + y2;
            if (denom !== 0) {
                const delta = 0.5 * (y0 - y2) / denom;
                if (Math.abs(delta) <= 1) {
                    lag = bestLag + delta;
                }
            }
        }
        return { lag, score: bestScore };
    }
    /**
     * Generate a range of numbers
     */
    static range(start, end, step = 1) {
        const result = [];
        for (let i = start; i <= end; i += step) {
            result.push(i);
        }
        return result;
    }
    /**
     * Check if value is within range (inclusive)
     */
    static inRange(value, min, max) {
        return value >= min && value <= max;
    }
    /**
     * Calculate modulo that works correctly with negative numbers
     */
    static mod(n, m) {
        return ((n % m) + m) % m;
    }
    /**
     * Calculate phase difference between two timestamps
     */
    static phaseDifference(timestamp1, timestamp2, period) {
        const diff = (timestamp1 - timestamp2) % period;
        return diff > period / 2 ? diff - period : diff;
    }
}
export default MathUtils;
