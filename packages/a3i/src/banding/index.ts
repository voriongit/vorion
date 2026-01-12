/**
 * A3I Banding Module
 *
 * Trust band calculation and management including
 * hysteresis for oscillation prevention.
 */

export {
  TrustBand,
  DEFAULT_BAND_THRESHOLDS,
  getBand,
  getBandRange,
  getBandName,
  canPromote,
  isHigherBand,
  getNextBand,
  getPreviousBand,
  BAND_DESCRIPTIONS,
} from './bands.js';

export {
  DEFAULT_BANDING_CONFIG,
  type BandHistoryEntry,
  HysteresisCalculator,
  createHysteresisCalculator,
} from './hysteresis.js';

export {
  TransitionType,
  BandCalculator,
  createBandCalculator,
  type TransitionResult,
  type BandStability,
  type BandTransitionEvent,
} from './band-calculator.js';
