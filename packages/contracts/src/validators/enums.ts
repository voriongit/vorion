/**
 * Zod schemas for ORION enums
 */

import { z } from 'zod';
import {
  TrustBand,
  ObservationTier,
  DataSensitivity,
  Reversibility,
  ActionType,
  ProofEventType,
  ComponentType,
  ComponentStatus,
  ApprovalType,
} from '../v2/enums.js';

/** Trust band validator */
export const trustBandSchema = z.nativeEnum(TrustBand);

/** Observation tier validator */
export const observationTierSchema = z.nativeEnum(ObservationTier);

/** Data sensitivity validator */
export const dataSensitivitySchema = z.nativeEnum(DataSensitivity);

/** Reversibility validator */
export const reversibilitySchema = z.nativeEnum(Reversibility);

/** Action type validator */
export const actionTypeSchema = z.nativeEnum(ActionType);

/** Proof event type validator */
export const proofEventTypeSchema = z.nativeEnum(ProofEventType);

/** Component type validator */
export const componentTypeSchema = z.nativeEnum(ComponentType);

/** Component status validator */
export const componentStatusSchema = z.nativeEnum(ComponentStatus);

/** Approval type validator */
export const approvalTypeSchema = z.nativeEnum(ApprovalType);
