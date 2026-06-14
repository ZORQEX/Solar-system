/**
 * Physical constants in SI units (kg, m, s) unless noted.
 *
 * The simulation runs in SI internally. Tests frequently switch to natural
 * units (G = 1) for readability — pass a custom `G` into the engine config.
 */

/** Newtonian gravitational constant, m³ kg⁻¹ s⁻². */
export const G = 6.6743e-11;

/** Speed of light in vacuum, m/s. */
export const SPEED_OF_LIGHT = 299_792_458;

/** Astronomical unit (mean Earth–Sun distance), m. */
export const AU = 1.495_978_707e11;

/** Light year, m. */
export const LIGHT_YEAR = 9.460_730_472e15;

/** Parsec, m. */
export const PARSEC = 3.085_677_581e16;

/** Mass of the Sun, kg. */
export const SOLAR_MASS = 1.988_47e30;

/** Mass of the Earth, kg. */
export const EARTH_MASS = 5.972_2e24;

/** Mean radius of the Sun, m. */
export const SOLAR_RADIUS = 6.957e8;

/** Mean radius of the Earth, m. */
export const EARTH_RADIUS = 6.371e6;

/** Luminosity of the Sun, W. */
export const SOLAR_LUMINOSITY = 3.828e26;

/** Effective surface temperature of the Sun, K. */
export const SUN_SURFACE_TEMPERATURE = 5772;

/** Stefan–Boltzmann constant, W m⁻² K⁻⁴. */
export const STEFAN_BOLTZMANN = 5.670374419e-8;

/** Mass below which an object cannot sustain hydrogen fusion (brown dwarf), kg. */
export const HYDROGEN_BURNING_LIMIT = 0.08 * SOLAR_MASS;

/** Seconds in a Julian year (365.25 days). */
export const SECONDS_PER_YEAR = 365.25 * 24 * 3600;

/** Seconds in a day. */
export const SECONDS_PER_DAY = 24 * 3600;

/**
 * Default Barnes–Hut opening angle. A node of size `s` at distance `d` is
 * treated as one mass when `s / d < THETA`. Smaller = more accurate, slower.
 */
export const DEFAULT_THETA = 0.5;

/**
 * Default Plummer softening length, m. Prevents singular accelerations when
 * two bodies are very close. Roughly the resolution floor of the simulation.
 */
export const DEFAULT_SOFTENING = 1e7;
