/**
 * Risk Classifier - ATSF v2.0 Action Risk Classification
 *
 * Classifies actions into risk levels based on:
 * - Action type (read, write, delete, execute, transfer)
 * - Data sensitivity (public, internal, confidential, restricted)
 * - Reversibility (reversible, partially, irreversible)
 * - Magnitude/impact
 */

import {
  ActionType,
  DataSensitivity,
  Reversibility,
  RiskLevel,
  type ActionRiskFactors,
  type GateVerificationRequest,
} from '@vorion/contracts';

/**
 * Base risk scores for action types (0-100)
 */
const ACTION_TYPE_RISK: Record<ActionType, number> = {
  [ActionType.READ]: 10,
  [ActionType.WRITE]: 40,
  [ActionType.DELETE]: 70,
  [ActionType.EXECUTE]: 50,
  [ActionType.COMMUNICATE]: 30,
  [ActionType.TRANSFER]: 80,
};

/**
 * Risk multipliers for data sensitivity
 */
const DATA_SENSITIVITY_MULTIPLIER: Record<DataSensitivity, number> = {
  [DataSensitivity.PUBLIC]: 0.5,
  [DataSensitivity.INTERNAL]: 1.0,
  [DataSensitivity.CONFIDENTIAL]: 1.5,
  [DataSensitivity.RESTRICTED]: 2.0,
};

/**
 * Risk additions for reversibility
 */
const REVERSIBILITY_RISK: Record<Reversibility, number> = {
  [Reversibility.REVERSIBLE]: 0,
  [Reversibility.PARTIALLY_REVERSIBLE]: 20,
  [Reversibility.IRREVERSIBLE]: 40,
};

/**
 * Map combined risk score to risk level
 */
function scoreToRiskLevel(score: number): RiskLevel {
  if (score < 20) return RiskLevel.READ;
  if (score < 40) return RiskLevel.LOW;
  if (score < 60) return RiskLevel.MEDIUM;
  if (score < 80) return RiskLevel.HIGH;
  return RiskLevel.CRITICAL;
}

/**
 * Calculate magnitude risk contribution
 * Logarithmic scale to handle wide range of magnitudes
 */
function calculateMagnitudeRisk(magnitude?: number): number {
  if (!magnitude || magnitude <= 0) return 0;

  // Logarithmic scale: log10(magnitude) * 10
  // $1 = 0, $10 = 10, $100 = 20, $1000 = 30, etc.
  const logRisk = Math.log10(magnitude) * 10;
  return Math.min(40, Math.max(0, logRisk)); // Cap at 40
}

/**
 * Classify the risk of an action
 */
export function classifyRisk(request: GateVerificationRequest): ActionRiskFactors {
  // Get base action type risk
  const actionTypeRisk = ACTION_TYPE_RISK[request.actionType] ?? 50;

  // Get data sensitivity multiplier
  const sensitivityMultiplier = DATA_SENSITIVITY_MULTIPLIER[request.dataSensitivity] ?? 1.0;

  // Get reversibility risk
  const reversibilityRisk = REVERSIBILITY_RISK[request.reversibility] ?? 20;

  // Calculate magnitude risk
  const magnitudeRisk = calculateMagnitudeRisk(request.magnitude);

  // Calculate data sensitivity risk contribution
  const dataSensitivityRisk = (sensitivityMultiplier - 1) * 30; // 0-30 range

  // Combined score with weighted factors
  const combinedScore = Math.min(100, Math.max(0,
    actionTypeRisk * sensitivityMultiplier +
    reversibilityRisk +
    magnitudeRisk
  ));

  return {
    actionTypeRisk,
    dataSensitivityRisk,
    reversibilityRisk,
    magnitudeRisk,
    combinedScore: Math.round(combinedScore),
    riskLevel: scoreToRiskLevel(combinedScore),
  };
}

/**
 * Get risk level directly from request
 */
export function getRiskLevel(request: GateVerificationRequest): RiskLevel {
  return classifyRisk(request).riskLevel;
}

/**
 * Check if action type is read-only
 */
export function isReadOnly(actionType: ActionType): boolean {
  return actionType === ActionType.READ;
}

/**
 * Check if action involves data transfer
 */
export function involvesTransfer(actionType: ActionType): boolean {
  return actionType === ActionType.TRANSFER || actionType === ActionType.COMMUNICATE;
}

/**
 * Check if action is destructive
 */
export function isDestructive(actionType: ActionType, reversibility: Reversibility): boolean {
  return (
    actionType === ActionType.DELETE &&
    reversibility !== Reversibility.REVERSIBLE
  );
}

/**
 * Get human-readable risk factors explanation
 */
export function explainRiskFactors(factors: ActionRiskFactors): string[] {
  const explanations: string[] = [];

  if (factors.actionTypeRisk >= 70) {
    explanations.push('High-risk action type (delete/transfer)');
  } else if (factors.actionTypeRisk >= 40) {
    explanations.push('Moderate-risk action type (write/execute)');
  }

  if (factors.dataSensitivityRisk > 0) {
    explanations.push(`Elevated data sensitivity (+${factors.dataSensitivityRisk.toFixed(0)} risk)`);
  }

  if (factors.reversibilityRisk >= 40) {
    explanations.push('Irreversible action');
  } else if (factors.reversibilityRisk >= 20) {
    explanations.push('Partially reversible action');
  }

  if (factors.magnitudeRisk > 20) {
    explanations.push(`High magnitude impact (+${factors.magnitudeRisk.toFixed(0)} risk)`);
  } else if (factors.magnitudeRisk > 0) {
    explanations.push(`Moderate magnitude impact (+${factors.magnitudeRisk.toFixed(0)} risk)`);
  }

  return explanations;
}

/**
 * Check if risk level requires multi-prover verification
 */
export function requiresVerification(riskLevel: RiskLevel): boolean {
  return riskLevel === RiskLevel.HIGH || riskLevel === RiskLevel.CRITICAL;
}

/**
 * Check if risk level requires human approval
 */
export function requiresHumanApproval(riskLevel: RiskLevel): boolean {
  return riskLevel === RiskLevel.CRITICAL;
}
