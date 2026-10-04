/** Confirmed on https://www.spacex.com/spacexai/starmind */
export const STARMIND_WINGSPAN_M = 75;
export const STARMIND_HEIGHT_M = 30;
export const STARMIND_SOURCE_URL = "https://www.spacex.com/spacexai/starmind";

/**
 * Drawn size on the globe. The enlargement is an estimate so the bus reads at Earth scale.
 * Geometry is built in metres, then scaled so the wingspan equals this many kilometres.
 */
export const ILLUSTRATIVE_WINGSPAN_KM = 1800;

/** Bus cross-section and wing chord are estimates. They are not on the SpaceX page. */
export const BUS_WIDTH_M = 8;
export const BUS_DEPTH_M = 6;
export const WING_CHORD_M = 12;

/**
 * Two radiator panels whose combined area is 160 m².
 * The split is an estimate. A 20 m × 70 m sheet is unconfirmed and is not used.
 */
export const RADIATOR_PANEL_M = { width: 8, height: 10 };
