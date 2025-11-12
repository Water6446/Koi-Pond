let spareGaussian = null;

/**
 * Generates a random number from a Gaussian (normal) distribution
 * Uses the Box-Muller transform
 * @param {number} mean - The mean of the distribution
 * @param {number} stdDev - The standard deviation of the distribution
 * @returns {number} A random number from the distribution
 */
export function gaussianRandom(mean = 0, stdDev = 1) {
    if (spareGaussian !== null) {
        const val = spareGaussian;
        spareGaussian = null;
        return val * stdDev + mean;
    }

    let s, u, v;
    do {
        u = Math.random() * 2 - 1;
        v = Math.random() * 2 - 1;
        s = u * u + v * v;
    } while (s >= 1 || s === 0);
    
    const mul = Math.sqrt(-2.0 * Math.log(s) / s);
    spareGaussian = v * mul;
    return (u * mul) * stdDev + mean;
}

/**
 * Clamps a value between a minimum and maximum
 * @param {number} value - The value to clamp
 * @param {number} min - The minimum value
 * @param {number} max - The maximum value
 * @returns {number} The clamped value
 */
export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation between two values
 * @param {number} start - The start value
 * @param {number} end - The end value
 * @param {number} t - The interpolation factor (0-1)
 * @returns {number} The interpolated value
 */
export function lerp(start, end, t) {
    return start + (end - start) * clamp(t, 0, 1);
}

/**
 * Returns a random value between min and max
 * @param {number} min - The minimum value
 * @param {number} max - The maximum value
 * @returns {number} A random value between min and max
 */
export function randomRange(min, max) {
    return min + Math.random() * (max - min);
}

/**
 * Calculates the distance between two points
 * @param {number} x1 - X coordinate of first point
 * @param {number} y1 - Y coordinate of first point
 * @param {number} x2 - X coordinate of second point
 * @param {number} y2 - Y coordinate of second point
 * @returns {number} The distance between the points
 */
export function distance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}