/**
 * Knobs for Leaflet sprite animation — sim batches are tiny steps, Metro API batches can jump.
 * Numbers are guess-and-check; README "Project evolution" explains why I split sim vs live.
 */

/** Rough deg/s guess for how fast to ease along the drawn line. */
export const METRO_SPEED_DEG_PER_S = 0.0001;

/** Ignore noise smaller than this so I don't restart animation every WS tick. */
export const MOVE_THRESHOLD = 0.00001;

/** Easing length caps for non-simulator data. */
export const MIN_ANIM_MS = 1000;
export const MAX_ANIM_MS = 10000;

/**
 * Sim updates come in every ~500ms with small moves; long CSS transitions never finished
 * because the next tick kept cancelling them. Short + linear works better there.
 */
export const SIMULATED_MIN_ANIM_MS = 70;
export const SIMULATED_MAX_ANIM_MS = 450;

/**
 * If the backend jumps farther than this (lat/lng combined), I teleport — animating across
 * half the city looked silly.
 */
export const TELEPORT_THRESHOLD = 0.015;

/**
 * If packets pause but status still says Moving, creep the dinosaur forward so it doesn't
 * look frozen (Metro API batches sit on a cache for a few seconds).
 */
export const COAST_DELAY_MS = 2000;
export const COAST_SPEED_PROGRESS_PER_S = 0.003;
