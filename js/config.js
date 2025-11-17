/**
 * @typedef {Object} Config
 * @property {Object} ui - User interface settings
 * @property {Object} koi - Koi fish behavior and appearance
 * @property {Object} lillypad - Lilly pad settings
 * @property {Object} physics - Simulation physics parameters
 * @property {Object} koiTrail - Koi movement trail effects
 * @property {Object} lillyTrail - Lilly pad trail effects
 */

export const config = {
    ui: {
        hotCornerSize: 250,
        leafGroupHeight: 120,
        leafGroupWidth: 80
    },

    koi: {
        meanSize: 67, // Smaller fish = less pixels to render
        stdDevSize: 4.0,
        minSize: 15,
        minSpeed: .5, // Reduced from .7 for slower swimming
        maxSpeed: 1.0, // Reduced from 1.3 for calmer movement
        turnSpeed: 0.018, // Reduced from 0.025 for smoother, less erratic turns
        wiggleSpeed: 0.05, // Reduced from 0.08 for less frequent wiggle
        wiggleAmount: 0.035, // Reduced from 0.05 for less erratic side-to-side
        tailAmplitude: 2.0, // Reduced from 2.5 for less tail movement
        rareKoiChance: 0.0002441406,
        growthRate: 0.08,
        maxGrowth: 1.3 // Less maximum growth
    },

    lillypad: {
        meanSize: 115,
        stdDevSize: 10.0,
        minSize: 20,
        colorBody: '#3a5e2a',
        colorBodyAlt: '#4a9650',
        spawnChanceFlower: 0.25,
        spawnChanceSemiPad: 0.35
    },

    physics: {
        minRoamTime: 4, // Less frequent direction changes
        maxRoamTime: 8,
        wallMargin: 120, // Smaller margin = less boundary checking
        wallForce: 0.8,
        avoidanceRadiusMultiplier: 2.5, // Smaller radius = fewer collision checks
        schoolingRadius: 200, // Smaller radius = fewer neighbor checks
        avoidanceForce: 0.8,
        schoolingForce: 0.25,
        roamingForce: 0.6,
        centeringForce: 1,
        mouseAvoidanceRadius: 120, // Smaller radius
        mouseAvoidanceForce: 2.8,
        mouseFleeSpeedMultiplier: 2 // Less dramatic fleeing
    },

    koiTrail: {
        spawnRate: 0.1, // Spawn more frequently for visible trail
        minLifespan: 1.5,
        maxLifespan: 4, // Longer lifespan
        minSize: 3,
        maxSize: 6, // Larger particles
        jitter: 5,
        drift: 15,
        color: 'rgba(220, 240, 255,',
        maxOpacity: 0.3 // Much more visible
    },

    lillyTrail: {
        spawnRate: .04, // Reduced frequency
        minLifespan: 1.0,
        maxLifespan: 2, // Shorter lifespan
        minSize: 6,
        maxSize: 20, // Smaller particles
        jitter: 10,
        drift: 15,
        color: 'rgba(220, 240, 255,',
        maxOpacity: 0.06 // Less visible
    }
};

// Food / Feeder configuration
export const foodConfig = {
    pelletRadius: 8,
    nutritionPerPellet: 25 ,
    decayTime: 45, // seconds until food decays
    attractRadius: 500, // how far fish can detect food (px)
    attractForce: 1.6, // steering force multiplier toward food
    eatDistance: 12 // distance at which fish consume food
};