import { describe, it, expect } from 'vitest';
import {
  ObservationTier,
  OBSERVATION_CEILINGS,
  ModelAccessType,
  getObservationTierForAccess,
  getTrustCeiling,
  allowsFullTrust,
  isHardwareAttested,
  canInspectSource,
  getTierDescription,
  compareTiers,
  getLowestTier,
} from '../../src/observation/tiers.js';
import {
  applyCeiling,
  getCeilingLoss,
  isAtCeiling,
  getRoomForImprovement,
  requiredTierForScore,
  analyzeCeilingImpact,
} from '../../src/observation/ceilings.js';
import {
  AttestationType,
  isHardwareBacked,
  getObservationTierForAttestation,
  createAttestationEvidence,
  verifyAttestation,
} from '../../src/observation/attestation.js';

describe('Observation Tiers', () => {
  describe('OBSERVATION_CEILINGS', () => {
    it('should have correct ceiling values per ATSF v2.0 RTA', () => {
      expect(OBSERVATION_CEILINGS[ObservationTier.BLACK_BOX]).toBe(60);
      expect(OBSERVATION_CEILINGS[ObservationTier.GRAY_BOX]).toBe(75);
      expect(OBSERVATION_CEILINGS[ObservationTier.WHITE_BOX]).toBe(90);  // Reduced from 95 (sleeper risk)
      expect(OBSERVATION_CEILINGS[ObservationTier.ATTESTED_BOX]).toBe(95);  // Reduced from 100 (TEE side-channel)
      expect(OBSERVATION_CEILINGS[ObservationTier.VERIFIED_BOX]).toBe(100);  // New tier
    });
  });

  describe('getObservationTierForAccess', () => {
    it('should return BLACK_BOX for proprietary APIs', () => {
      expect(getObservationTierForAccess(ModelAccessType.API_PROPRIETARY)).toBe(
        ObservationTier.BLACK_BOX
      );
    });

    it('should return WHITE_BOX for self-hosted open source', () => {
      expect(getObservationTierForAccess(ModelAccessType.SELF_HOSTED_OPEN)).toBe(
        ObservationTier.WHITE_BOX
      );
    });

    it('should return ATTESTED_BOX for TEE', () => {
      expect(getObservationTierForAccess(ModelAccessType.SELF_HOSTED_TEE)).toBe(
        ObservationTier.ATTESTED_BOX
      );
    });
  });

  describe('getTrustCeiling', () => {
    it('should return correct ceiling for each tier', () => {
      expect(getTrustCeiling(ObservationTier.BLACK_BOX)).toBe(60);
      expect(getTrustCeiling(ObservationTier.ATTESTED_BOX)).toBe(95);
      expect(getTrustCeiling(ObservationTier.VERIFIED_BOX)).toBe(100);
    });
  });

  describe('allowsFullTrust', () => {
    it('should only allow full trust for VERIFIED_BOX (per ATSF v2.0)', () => {
      expect(allowsFullTrust(ObservationTier.BLACK_BOX)).toBe(false);
      expect(allowsFullTrust(ObservationTier.GRAY_BOX)).toBe(false);
      expect(allowsFullTrust(ObservationTier.WHITE_BOX)).toBe(false);
      expect(allowsFullTrust(ObservationTier.ATTESTED_BOX)).toBe(false);  // Now 95%, not full
      expect(allowsFullTrust(ObservationTier.VERIFIED_BOX)).toBe(true);
    });
  });

  describe('isHardwareAttested', () => {
    it('should be true for ATTESTED_BOX and VERIFIED_BOX', () => {
      expect(isHardwareAttested(ObservationTier.BLACK_BOX)).toBe(false);
      expect(isHardwareAttested(ObservationTier.WHITE_BOX)).toBe(false);
      expect(isHardwareAttested(ObservationTier.ATTESTED_BOX)).toBe(true);
      expect(isHardwareAttested(ObservationTier.VERIFIED_BOX)).toBe(true);
    });
  });

  describe('canInspectSource', () => {
    it('should be true for WHITE_BOX, ATTESTED_BOX, and VERIFIED_BOX', () => {
      expect(canInspectSource(ObservationTier.BLACK_BOX)).toBe(false);
      expect(canInspectSource(ObservationTier.GRAY_BOX)).toBe(false);
      expect(canInspectSource(ObservationTier.WHITE_BOX)).toBe(true);
      expect(canInspectSource(ObservationTier.ATTESTED_BOX)).toBe(true);
      expect(canInspectSource(ObservationTier.VERIFIED_BOX)).toBe(true);
    });
  });

  describe('getTierDescription', () => {
    it('should return description with correct ceiling', () => {
      const desc = getTierDescription(ObservationTier.BLACK_BOX);
      expect(desc.name).toBe('Black Box');
      expect(desc.ceiling).toBe(60);
      expect(desc.examples.length).toBeGreaterThan(0);
    });
  });

  describe('compareTiers', () => {
    it('should compare tiers correctly', () => {
      expect(compareTiers(ObservationTier.BLACK_BOX, ObservationTier.WHITE_BOX)).toBeLessThan(0);
      expect(compareTiers(ObservationTier.ATTESTED_BOX, ObservationTier.GRAY_BOX)).toBeGreaterThan(0);
      expect(compareTiers(ObservationTier.WHITE_BOX, ObservationTier.WHITE_BOX)).toBe(0);
    });
  });

  describe('getLowestTier', () => {
    it('should return the most restrictive tier', () => {
      const tiers = [
        ObservationTier.WHITE_BOX,
        ObservationTier.BLACK_BOX,
        ObservationTier.ATTESTED_BOX,
      ];
      expect(getLowestTier(tiers)).toBe(ObservationTier.BLACK_BOX);
    });

    it('should return BLACK_BOX for empty array', () => {
      expect(getLowestTier([])).toBe(ObservationTier.BLACK_BOX);
    });
  });
});

describe('Trust Ceilings', () => {
  describe('applyCeiling', () => {
    it('should cap scores at ceiling', () => {
      expect(applyCeiling(80, ObservationTier.BLACK_BOX)).toBe(60);
      expect(applyCeiling(50, ObservationTier.BLACK_BOX)).toBe(50);
    });

    it('should cap ATTESTED_BOX at 95 (per ATSF v2.0)', () => {
      expect(applyCeiling(100, ObservationTier.ATTESTED_BOX)).toBe(95);
    });

    it('should allow full score for VERIFIED_BOX', () => {
      expect(applyCeiling(100, ObservationTier.VERIFIED_BOX)).toBe(100);
    });
  });

  describe('getCeilingLoss', () => {
    it('should calculate lost trust', () => {
      expect(getCeilingLoss(80, ObservationTier.BLACK_BOX)).toBe(20);
      expect(getCeilingLoss(50, ObservationTier.BLACK_BOX)).toBe(0);
    });
  });

  describe('isAtCeiling', () => {
    it('should detect when score is at ceiling', () => {
      expect(isAtCeiling(60, ObservationTier.BLACK_BOX)).toBe(true);
      expect(isAtCeiling(59, ObservationTier.BLACK_BOX)).toBe(false);
    });
  });

  describe('getRoomForImprovement', () => {
    it('should calculate available headroom', () => {
      expect(getRoomForImprovement(50, ObservationTier.BLACK_BOX)).toBe(10);
      expect(getRoomForImprovement(60, ObservationTier.BLACK_BOX)).toBe(0);
    });
  });

  describe('requiredTierForScore', () => {
    it('should find minimum tier for target score', () => {
      expect(requiredTierForScore(55)).toBe(ObservationTier.BLACK_BOX);
      expect(requiredTierForScore(70)).toBe(ObservationTier.GRAY_BOX);
      expect(requiredTierForScore(85)).toBe(ObservationTier.WHITE_BOX);  // WHITE_BOX now 90
      expect(requiredTierForScore(92)).toBe(ObservationTier.ATTESTED_BOX);  // ATTESTED now 95
      expect(requiredTierForScore(100)).toBe(ObservationTier.VERIFIED_BOX);  // Only VERIFIED is 100
    });
  });

  describe('analyzeCeilingImpact', () => {
    it('should provide comprehensive analysis', () => {
      const analysis = analyzeCeilingImpact(80, ObservationTier.BLACK_BOX);

      expect(analysis.originalScore).toBe(80);
      expect(analysis.adjustedScore).toBe(60);
      expect(analysis.ceilingLoss).toBe(20);
      expect(analysis.atCeiling).toBe(true);
      expect(analysis.tierUpgradeWouldHelp).toBe(true);
      expect(analysis.nextUnlockingTier).toBe(ObservationTier.GRAY_BOX);
    });

    it('should not suggest upgrade when not at ceiling', () => {
      const analysis = analyzeCeilingImpact(50, ObservationTier.BLACK_BOX);

      expect(analysis.atCeiling).toBe(false);
      expect(analysis.tierUpgradeWouldHelp).toBe(false);
      expect(analysis.improvementRoom).toBe(10);
    });
  });
});

describe('Attestation', () => {
  describe('isHardwareBacked', () => {
    it('should identify hardware attestation types', () => {
      const softwareAttestation = createAttestationEvidence({
        attestationType: AttestationType.SOFTWARE_HASH,
        codeHash: 'abc123',
        configHash: 'def456',
        certificateChain: [],
      });

      const hardwareAttestation = createAttestationEvidence({
        attestationType: AttestationType.SGX_QUOTE,
        codeHash: 'abc123',
        configHash: 'def456',
        certificateChain: ['cert1'],
        platformQuote: 'base64quote',
      });

      expect(isHardwareBacked(softwareAttestation)).toBe(false);
      expect(isHardwareBacked(hardwareAttestation)).toBe(true);
    });
  });

  describe('getObservationTierForAttestation', () => {
    it('should return correct tier for attestation type', () => {
      expect(getObservationTierForAttestation(AttestationType.NONE)).toBe(
        ObservationTier.BLACK_BOX
      );
      expect(getObservationTierForAttestation(AttestationType.SOFTWARE_HASH)).toBe(
        ObservationTier.WHITE_BOX
      );
      expect(getObservationTierForAttestation(AttestationType.SGX_QUOTE)).toBe(
        ObservationTier.ATTESTED_BOX
      );
    });
  });

  describe('verifyAttestation', () => {
    it('should verify valid attestation', () => {
      const attestation = createAttestationEvidence({
        attestationType: AttestationType.SOFTWARE_HASH,
        codeHash: 'abc123',
        configHash: 'def456',
        certificateChain: [],
      });

      const result = verifyAttestation(attestation);
      expect(result.valid).toBe(true);
      expect(result.observationTier).toBe(ObservationTier.WHITE_BOX);
    });

    it('should fail for missing hashes', () => {
      const attestation = createAttestationEvidence({
        attestationType: AttestationType.SOFTWARE_HASH,
        codeHash: '',
        configHash: '',
        certificateChain: [],
      });

      const result = verifyAttestation(attestation);
      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('should require platform quote for hardware attestation', () => {
      const attestation = createAttestationEvidence({
        attestationType: AttestationType.SGX_QUOTE,
        codeHash: 'abc123',
        configHash: 'def456',
        certificateChain: [],
      });

      const result = verifyAttestation(attestation);
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Hardware attestation requires platform quote');
    });
  });
});
