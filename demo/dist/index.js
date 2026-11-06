"use strict";
// WebAudio Sync - Open Source Edition
// Public entry point: OSS features only (no Pro code in this package)
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTierFeatures = exports.getVersion = exports.hasMicrophoneAccess = exports.isSupported = exports.createWebAudioSync = exports.Logger = exports.MathUtils = exports.BrowserUtils = exports.SyncManager = exports.DriftCorrector = exports.LatencyDetector = exports.AudioEngine = exports.getWebAudioSyncOSS = exports.createWebAudioSyncOSS = exports.WebAudioSyncOSSClass = void 0;
const oss_1 = require("./oss");
// Export types
__exportStar(require("./types"), exports);
// Export OSS version
var oss_2 = require("./oss");
Object.defineProperty(exports, "WebAudioSyncOSSClass", { enumerable: true, get: function () { return oss_2.WebAudioSyncOSSClass; } });
Object.defineProperty(exports, "createWebAudioSyncOSS", { enumerable: true, get: function () { return oss_2.createWebAudioSyncOSS; } });
Object.defineProperty(exports, "getWebAudioSyncOSS", { enumerable: true, get: function () { return oss_2.getWebAudioSyncOSS; } });
// Export core components
var audioEngine_1 = require("./core/audioEngine");
Object.defineProperty(exports, "AudioEngine", { enumerable: true, get: function () { return audioEngine_1.AudioEngine; } });
var latencyDetector_1 = require("./core/latencyDetector");
Object.defineProperty(exports, "LatencyDetector", { enumerable: true, get: function () { return latencyDetector_1.LatencyDetector; } });
var driftCorrector_1 = require("./core/driftCorrector");
Object.defineProperty(exports, "DriftCorrector", { enumerable: true, get: function () { return driftCorrector_1.DriftCorrector; } });
var syncManager_1 = require("./core/syncManager");
Object.defineProperty(exports, "SyncManager", { enumerable: true, get: function () { return syncManager_1.SyncManager; } });
// Export utilities
var browser_1 = require("./utils/browser");
Object.defineProperty(exports, "BrowserUtils", { enumerable: true, get: function () { return browser_1.BrowserUtils; } });
var math_1 = require("./utils/math");
Object.defineProperty(exports, "MathUtils", { enumerable: true, get: function () { return math_1.MathUtils; } });
var logger_1 = require("./utils/logger");
Object.defineProperty(exports, "Logger", { enumerable: true, get: function () { return logger_1.Logger; } });
/**
 * Factory function to create a WebAudio Sync OSS instance
 */
function createWebAudioSync(options = {}) {
    return (0, oss_1.createWebAudioSyncOSS)(options);
}
exports.createWebAudioSync = createWebAudioSync;
/**
 * Check if WebAudio is supported in the current browser
 */
async function isSupported() {
    return window.AudioContext !== undefined ||
        window.webkitAudioContext !== undefined;
}
exports.isSupported = isSupported;
/**
 * Check if microphone access is available
 */
async function hasMicrophoneAccess() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        return true;
    }
    catch {
        return false;
    }
}
exports.hasMicrophoneAccess = hasMicrophoneAccess;
/**
 * Get library version
 */
function getVersion() {
    return '1.0.2';
}
exports.getVersion = getVersion;
/**
 * Get available tier features
 */
function getTierFeatures() {
    return {
        oss: [
            'Manual tap sync',
            'Pulse check latency measurement',
            'Native browser latency detection',
            'Basic audio synchronization',
        ],
    };
}
exports.getTierFeatures = getTierFeatures;
// Default export
exports.default = {
    createWebAudioSync,
    isSupported,
    hasMicrophoneAccess,
    getVersion,
    getTierFeatures,
    WebAudioSyncOSS: oss_1.WebAudioSyncOSSClass,
    createWebAudioSyncOSS: oss_1.createWebAudioSyncOSS,
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLHNDQUFzQztBQUN0QyxzRUFBc0U7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBTXRFLCtCQUFvRTtBQUdwRSxlQUFlO0FBQ2YsMENBQXdCO0FBRXhCLHFCQUFxQjtBQUNyQiw2QkFJZTtBQUhiLDJHQUFBLG9CQUFvQixPQUFBO0FBQ3BCLDRHQUFBLHFCQUFxQixPQUFBO0FBQ3JCLHlHQUFBLGtCQUFrQixPQUFBO0FBSXBCLHlCQUF5QjtBQUN6QixrREFBaUQ7QUFBeEMsMEdBQUEsV0FBVyxPQUFBO0FBQ3BCLDBEQUF5RDtBQUFoRCxrSEFBQSxlQUFlLE9BQUE7QUFDeEIsd0RBQXVEO0FBQTlDLGdIQUFBLGNBQWMsT0FBQTtBQUN2QixrREFBaUQ7QUFBeEMsMEdBQUEsV0FBVyxPQUFBO0FBR3BCLG1CQUFtQjtBQUNuQiwyQ0FBK0M7QUFBdEMsdUdBQUEsWUFBWSxPQUFBO0FBQ3JCLHFDQUF5QztBQUFoQyxpR0FBQSxTQUFTLE9BQUE7QUFDbEIseUNBQXdDO0FBQS9CLGdHQUFBLE1BQU0sT0FBQTtBQU9mOztHQUVHO0FBQ0gsU0FBZ0Isa0JBQWtCLENBQUUsVUFBc0MsRUFBRTtJQUMxRSxPQUFPLElBQUEsMkJBQXFCLEVBQUMsT0FBTyxDQUFDLENBQUM7QUFDeEMsQ0FBQztBQUZELGdEQUVDO0FBRUQ7O0dBRUc7QUFDSSxLQUFLLFVBQVUsV0FBVztJQUMvQixPQUFRLE1BQTZDLENBQUMsWUFBWSxLQUFLLFNBQVM7UUFDeEUsTUFBNkMsQ0FBQyxrQkFBa0IsS0FBSyxTQUFTLENBQUM7QUFDekYsQ0FBQztBQUhELGtDQUdDO0FBRUQ7O0dBRUc7QUFDSSxLQUFLLFVBQVUsbUJBQW1CO0lBQ3ZDLElBQUksQ0FBQztRQUNILE1BQU0sTUFBTSxHQUFHLE1BQU0sU0FBUyxDQUFDLFlBQVksQ0FBQyxZQUFZLENBQUMsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztRQUUxRSxNQUFNLENBQUMsU0FBUyxFQUFFLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7UUFFbEQsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBQUMsTUFBTSxDQUFDO1FBQ1AsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0FBQ0gsQ0FBQztBQVZELGtEQVVDO0FBRUQ7O0dBRUc7QUFDSCxTQUFnQixVQUFVO0lBQ3hCLE9BQU8sT0FBTyxDQUFDO0FBQ2pCLENBQUM7QUFGRCxnQ0FFQztBQUVEOztHQUVHO0FBQ0gsU0FBZ0IsZUFBZTtJQUM3QixPQUFPO1FBQ0wsR0FBRyxFQUFFO1lBQ0gsaUJBQWlCO1lBQ2pCLGlDQUFpQztZQUNqQyxrQ0FBa0M7WUFDbEMsNkJBQTZCO1NBQzlCO0tBQ0YsQ0FBQztBQUNKLENBQUM7QUFURCwwQ0FTQztBQUVELGlCQUFpQjtBQUNqQixrQkFBZTtJQUNiLGtCQUFrQjtJQUNsQixXQUFXO0lBQ1gsbUJBQW1CO0lBQ25CLFVBQVU7SUFDVixlQUFlO0lBQ2YsZUFBZSxFQUFFLDBCQUFvQjtJQUNyQyxxQkFBcUIsRUFBckIsMkJBQXFCO0NBQ3RCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBXZWJBdWRpbyBTeW5jIC0gT3BlbiBTb3VyY2UgRWRpdGlvblxuLy8gUHVibGljIGVudHJ5IHBvaW50OiBPU1MgZmVhdHVyZXMgb25seSAobm8gUHJvIGNvZGUgaW4gdGhpcyBwYWNrYWdlKVxuXG5pbXBvcnQge1xuICBTeW5jT3B0aW9ucyxcbiAgV2ViQXVkaW9TeW5jQ29uZmlnLFxufSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IFdlYkF1ZGlvU3luY09TU0NsYXNzLCBjcmVhdGVXZWJBdWRpb1N5bmNPU1MgfSBmcm9tICcuL29zcyc7XG5pbXBvcnQgdHlwZSB7IFdlYkF1ZGlvU3luY09TUyB9IGZyb20gJy4vb3NzJztcblxuLy8gRXhwb3J0IHR5cGVzXG5leHBvcnQgKiBmcm9tICcuL3R5cGVzJztcblxuLy8gRXhwb3J0IE9TUyB2ZXJzaW9uXG5leHBvcnQge1xuICBXZWJBdWRpb1N5bmNPU1NDbGFzcyxcbiAgY3JlYXRlV2ViQXVkaW9TeW5jT1NTLFxuICBnZXRXZWJBdWRpb1N5bmNPU1MsXG59IGZyb20gJy4vb3NzJztcbmV4cG9ydCB0eXBlIHsgV2ViQXVkaW9TeW5jT1NTIH0gZnJvbSAnLi9vc3MnO1xuXG4vLyBFeHBvcnQgY29yZSBjb21wb25lbnRzXG5leHBvcnQgeyBBdWRpb0VuZ2luZSB9IGZyb20gJy4vY29yZS9hdWRpb0VuZ2luZSc7XG5leHBvcnQgeyBMYXRlbmN5RGV0ZWN0b3IgfSBmcm9tICcuL2NvcmUvbGF0ZW5jeURldGVjdG9yJztcbmV4cG9ydCB7IERyaWZ0Q29ycmVjdG9yIH0gZnJvbSAnLi9jb3JlL2RyaWZ0Q29ycmVjdG9yJztcbmV4cG9ydCB7IFN5bmNNYW5hZ2VyIH0gZnJvbSAnLi9jb3JlL3N5bmNNYW5hZ2VyJztcbmV4cG9ydCB0eXBlIHsgU3luY0NhbGlicmF0aW9uUmVzdWx0IH0gZnJvbSAnLi9jb3JlL3N5bmNNYW5hZ2VyJztcblxuLy8gRXhwb3J0IHV0aWxpdGllc1xuZXhwb3J0IHsgQnJvd3NlclV0aWxzIH0gZnJvbSAnLi91dGlscy9icm93c2VyJztcbmV4cG9ydCB7IE1hdGhVdGlscyB9IGZyb20gJy4vdXRpbHMvbWF0aCc7XG5leHBvcnQgeyBMb2dnZXIgfSBmcm9tICcuL3V0aWxzL2xvZ2dlcic7XG5cbi8vIEZhY3RvcnlcbmV4cG9ydCBpbnRlcmZhY2UgV2ViQXVkaW9TeW5jRmFjdG9yeU9wdGlvbnMgZXh0ZW5kcyBTeW5jT3B0aW9ucyB7XG4gIGNvbmZpZz86IFdlYkF1ZGlvU3luY0NvbmZpZztcbn1cblxuLyoqXG4gKiBGYWN0b3J5IGZ1bmN0aW9uIHRvIGNyZWF0ZSBhIFdlYkF1ZGlvIFN5bmMgT1NTIGluc3RhbmNlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVXZWJBdWRpb1N5bmMgKG9wdGlvbnM6IFdlYkF1ZGlvU3luY0ZhY3RvcnlPcHRpb25zID0ge30pOiBXZWJBdWRpb1N5bmNPU1Mge1xuICByZXR1cm4gY3JlYXRlV2ViQXVkaW9TeW5jT1NTKG9wdGlvbnMpO1xufVxuXG4vKipcbiAqIENoZWNrIGlmIFdlYkF1ZGlvIGlzIHN1cHBvcnRlZCBpbiB0aGUgY3VycmVudCBicm93c2VyXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBpc1N1cHBvcnRlZCAoKTogUHJvbWlzZTxib29sZWFuPiB7XG4gIHJldHVybiAod2luZG93IGFzIHVua25vd24gYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4pLkF1ZGlvQ29udGV4dCAhPT0gdW5kZWZpbmVkIHx8XG4gICAgICAgICAod2luZG93IGFzIHVua25vd24gYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4pLndlYmtpdEF1ZGlvQ29udGV4dCAhPT0gdW5kZWZpbmVkO1xufVxuXG4vKipcbiAqIENoZWNrIGlmIG1pY3JvcGhvbmUgYWNjZXNzIGlzIGF2YWlsYWJsZVxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gaGFzTWljcm9waG9uZUFjY2VzcyAoKTogUHJvbWlzZTxib29sZWFuPiB7XG4gIHRyeSB7XG4gICAgY29uc3Qgc3RyZWFtID0gYXdhaXQgbmF2aWdhdG9yLm1lZGlhRGV2aWNlcy5nZXRVc2VyTWVkaWEoeyBhdWRpbzogdHJ1ZSB9KTtcblxuICAgIHN0cmVhbS5nZXRUcmFja3MoKS5mb3JFYWNoKHRyYWNrID0+IHRyYWNrLnN0b3AoKSk7XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG5cbi8qKlxuICogR2V0IGxpYnJhcnkgdmVyc2lvblxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0VmVyc2lvbiAoKTogc3RyaW5nIHtcbiAgcmV0dXJuICcxLjAuMic7XG59XG5cbi8qKlxuICogR2V0IGF2YWlsYWJsZSB0aWVyIGZlYXR1cmVzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRUaWVyRmVhdHVyZXMgKCk6IFJlY29yZDxzdHJpbmcsIHN0cmluZ1tdPiB7XG4gIHJldHVybiB7XG4gICAgb3NzOiBbXG4gICAgICAnTWFudWFsIHRhcCBzeW5jJyxcbiAgICAgICdQdWxzZSBjaGVjayBsYXRlbmN5IG1lYXN1cmVtZW50JyxcbiAgICAgICdOYXRpdmUgYnJvd3NlciBsYXRlbmN5IGRldGVjdGlvbicsXG4gICAgICAnQmFzaWMgYXVkaW8gc3luY2hyb25pemF0aW9uJyxcbiAgICBdLFxuICB9O1xufVxuXG4vLyBEZWZhdWx0IGV4cG9ydFxuZXhwb3J0IGRlZmF1bHQge1xuICBjcmVhdGVXZWJBdWRpb1N5bmMsXG4gIGlzU3VwcG9ydGVkLFxuICBoYXNNaWNyb3Bob25lQWNjZXNzLFxuICBnZXRWZXJzaW9uLFxuICBnZXRUaWVyRmVhdHVyZXMsXG4gIFdlYkF1ZGlvU3luY09TUzogV2ViQXVkaW9TeW5jT1NTQ2xhc3MsXG4gIGNyZWF0ZVdlYkF1ZGlvU3luY09TUyxcbn07XG4iXX0=