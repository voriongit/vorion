ORION V1 — FULL REPO (MOST UP-TO-DATE / INCLUDES ALL MODIFICATIONS)
STATUS: CANONICAL / NO-DRIFT / CLI-INGESTIBLE
NOTE: This is the authoritative monorepo structure for the complete ORION system,
including: Global Compliance + Trust Profiles (ATP) + Audit Completeness (ERPL) +
External Acceptance Conflict Detection (EASE) + PAL/ERA/Evolution integration.

orion-platform/
├─ README.md
├─ LICENSE.private.md
├─ SECURITY.md
├─ .gitignore
├─ .editorconfig
├─ .env.example
├─ Makefile
├─ docker-compose.yml
│
├─ .github/
│  ├─ CODEOWNERS
│  ├─ pull_request_template.md
│  └─ workflows/
│     ├─ ci.yml                          # lint, unit tests, schema checks, type checks
│     ├─ integration.yml                  # end-to-end flows + conformance suites
│     ├─ security.yml                     # SAST/dep scans/secret scanning gates
│     ├─ audit-gates.yml                  # EASE conflict scan + audit readiness verification (RELEASE BLOCKER)
│     └─ release.yml                      # canary promotion + rollback
│
├─ docs/
│  ├─ 00_overview.md
│  ├─ 01_architecture.md
│  ├─ 02_boundaries.md                    # “what starts/ends where” (no drift)
│  ├─ constitution/
│  │  ├─ orion_naming_convention.md
│  │  ├─ orion_global_compliance_and_adaptability.md
│  │  ├─ orion_adaptive_trust_profile_atp.md
│  │  ├─ orion_audit_forensic_completeness_erpl.md
│  │  └─ orion_external_acceptance_conflict_detection_ease.md
│  ├─ acceptance_packets/                # GENERATED outputs (auditor/procurement-ready)
│  │  ├─ procurement_packets/
│  │  ├─ enterprise_assurance_packs/
│  │  ├─ vendor_partner_packs/
│  │  └─ developer_compliance_packs/
│  ├─ runbooks/
│  │  ├─ incident_response.md
│  │  ├─ rollback_procedures.md
│  │  ├─ key_rotation.md
│  │  └─ onboarding_new_org.md
│  └─ adr/
│     ├─ ADR-0001-monorepo.md
│     ├─ ADR-0002-contract-versioning.md
│     └─ ADR-0003-policy-bundles.md
│
├─ contracts/                             # SHARED truth — both approve
│  ├─ README.md
│  ├─ versions/
│  │  ├─ v1/
│  │  │  ├─ intent.schema.json
│  │  │  ├─ decision.schema.json
│  │  │  ├─ policy_bundle.schema.json
│  │  │  ├─ proof_event.schema.json
│  │  │  └─ evidence_pack.schema.json
│  │  └─ v2/                               # v2 introduces trust + audit + acceptance artifacts (DO NOT edit v1)
│  │     ├─ intent.schema.json
│  │     ├─ decision.schema.json
│  │     ├─ policy_bundle.schema.json
│  │     ├─ proof_event.schema.json
│  │     ├─ evidence_pack.schema.json
│  │     ├─ trust_scope.schema.json
│  │     ├─ trust_profile.schema.json
│  │     ├─ trust_band.schema.json
│  │     ├─ trust_delta_event.schema.json
│  │     ├─ retention_policy.schema.json
│  │     ├─ seal_event.schema.json
│  │     ├─ acceptance_packet.schema.json
│  │     ├─ change_record.schema.json
│  │     └─ access_review_report.schema.json
│  ├─ examples/
│  │  ├─ intents/
│  │  ├─ decisions/
│  │  ├─ policy_bundles/
│  │  ├─ trust_profiles/
│  │  ├─ trust_delta_events/
│  │  ├─ evidence_packs/
│  │  └─ acceptance_packets/
│  └─ tools/
│     ├─ schema_linter/
│     └─ contract_diff/
│
├─ auryn/                                  # CORE 1 (Alex owns)
│  ├─ README.md
│  ├─ src/
│  │  ├─ intake/
│  │  │  ├─ context_intake/
│  │  │  ├─ constraint_intake/
│  │  │  └─ trust_context_reader/           # READ-ONLY trust band + AC consumption
│  │  ├─ goal_normalization/
│  │  ├─ reasoning_modes/
│  │  │  └─ aria_mode/                      # if used: reasoning mode only; NOT orchestration, NOT enforcement
│  │  ├─ option_generation/
│  │  ├─ risk_assumptions/
│  │  ├─ plan_graph/
│  │  ├─ intent_packager/                   # strict contracts compliance
│  │  └─ anchor_client/                     # submit intent; receives decisions; no execution
│  ├─ evals/
│  ├─ tests/
│  └─ configs/
│     ├─ auryn_defaults.yaml
│     └─ mode_profiles.yaml
│
├─ agent-anchor/                            # CORE 2 (Ryan owns)
│  ├─ README.md
│  ├─ src/
│  │  ├─ policy_intake/
│  │  ├─ jsal/                              # Jurisdiction & Standards Abstraction Layer
│  │  ├─ intent_validation/
│  │  ├─ authorization_engine/
│  │  ├─ autonomy_controller/
│  │  ├─ observation/
│  │  ├─ trust/                             # Adaptive Trust Profile (ATP) authority
│  │  │  ├─ model/
│  │  │  ├─ calculators/                    # CT/BT/GT/XT/AC
│  │  │  ├─ banding/                        # T0–T5 + hysteresis + decay + caps (GT/AC/XT gates)
│  │  │  ├─ evidence/
│  │  │  ├─ events/                         # trust delta event emission
│  │  │  └─ api/
│  │  ├─ proof_plane/                       # immutable proof + hash chaining
│  │  ├─ erpl/                              # Evidence Retention & Preservation Layer (WORM + legal holds + sealing)
│  │  ├─ proof_exports/                     # SOC2/ISO/NIST/FedRAMP mappings
│  │  ├─ ease/                              # External Acceptance Simulation Engine + conflict scan (release blocker)
│  │  ├─ entitlements_metering/
│  │  ├─ escalation_signaling/
│  │  └─ admin_api/                         # policy mgmt, audit queries, reports
│  ├─ evals/
│  │  ├─ bypass_tests/
│  │  ├─ policy_conflict_tests/
│  │  ├─ trust_regression_tests/
│  │  ├─ retention_worm_tests/
│  │  ├─ seal_verification_tests/
│  │  ├─ ease_conflict_tests/
│  │  └─ harness/
│  ├─ tests/
│  └─ configs/
│     ├─ anchor_defaults.yaml
│     ├─ autonomy_levels.yaml
│     ├─ trust_band_thresholds.yaml
│     ├─ retention_defaults.yaml
│     └─ acceptance_gates.yaml
│
├─ pal/                                     # ORION platform wrapper (Ryan-led, joint governed)
│  ├─ README.md
│  ├─ src/
│  │  ├─ registry/
│  │  ├─ version_lineage/
│  │  ├─ promotion_demotion/
│  │  ├─ ownership_map/
│  │  ├─ scorecards/
│  │  ├─ rollback_retirement/
│  │  ├─ trust_history/                      # records trust evolution; DOES NOT compute
│  │  └─ executive_views/                    # auditor/procurement summary views
│  ├─ tests/
│  └─ configs/
│     ├─ promotion_rules.yaml
│     └─ incident_thresholds.yaml
│
├─ era/                                     # Execution & Runtime Reference Architecture (Ryan owns)
│  ├─ README.md
│  ├─ spec/
│  │  ├─ era_reference.md
│  │  └─ tool_adapter_contract.md
│  ├─ sdk/
│  │  ├─ python/
│  │  └─ typescript/
│  ├─ reference_runtime/
│  │  ├─ worker/                             # executes only Anchor-approved steps
│  │  ├─ event_bus/
│  │  └─ correlation/
│  └─ tests/
│     ├─ conformance/
│     └─ fixtures/
│
├─ policy-bundles/                          # law/standards as data (Ryan owns; Alex reviews core bundles)
│  ├─ README.md
│  ├─ jurisdictions/
│  │  ├─ US/
│  │  ├─ EU/
│  │  ├─ CA/
│  │  └─ SG/
│  ├─ industries/
│  │  ├─ finance/
│  │  ├─ healthcare/
│  │  ├─ government/
│  │  └─ general_enterprise/
│  ├─ standards/
│  │  ├─ SOC2/
│  │  ├─ ISO27001/
│  │  ├─ NIST_800_53/
│  │  └─ FedRAMP/
│  ├─ org_profiles/
│  │  ├─ default_low_risk.yaml
│  │  ├─ default_enterprise.yaml
│  │  └─ default_government.yaml
│  └─ signing/
│     ├─ keys.example/
│     └─ bundle_signer_tool/
│
├─ evolution/                               # post-launch evolution (joint approved; implemented across subsystems)
│  ├─ README.md
│  ├─ eval_orchestrator/                     # runs AURYN + Anchor evals + conformance
│  ├─ drift_monitor/                         # policy + behavior drift detection
│  ├─ canary_rollouts/                       # staged deploy + rollback automation
│  ├─ incident_automation/                   # degrade autonomy, freeze tools, generate evidence packs
│  └─ reports/                               # scheduled executive/auditor reports
│
├─ integration-tests/                        # joint end-to-end truth
│  ├─ README.md
│  ├─ e2e/
│  │  ├─ auryn_to_anchor_intent_flow/
│  │  ├─ anchor_to_runtime_authorization_flow/
│  │  ├─ trust_profile_generation_flow/
│  │  ├─ trust_band_to_autonomy_enforcement_flow/
│  │  ├─ worm_retention_and_legal_hold_flow/
│  │  ├─ sealing_and_verification_flow/
│  │  ├─ acceptance_packet_generation_flow/
│  │  └─ rollback_canary_flow/
│  ├─ fixtures/
│  └─ harness/
│
├─ services/                                # optional thin shared infrastructure services
│  ├─ api-gateway/
│  ├─ auth/                                 # SSO/SAML hooks (enterprise expansion)
│  ├─ tenant-manager/
│  ├─ secrets/
│  └─ telemetry/
│
├─ deployments/
│  ├─ local/
│  ├─ staging/
│  ├─ prod/
│  ├─ terraform/
│  └─ kubernetes/
│
└─ tools/
   ├─ bootstrap/
   ├─ linting/
   ├─ secret_scanner/
   ├─ release_manager/
   └─ cli/                                  # optional ORION devops CLI wrapper

END ORION V1 — FULL REPO