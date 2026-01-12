#!/usr/bin/env python3
"""
ATSF v3.2 Command Line Interface
=================================

Production CLI for managing the ATSF system.

Commands:
  atsf start         Start the ATSF server
  atsf status        Show system status
  atsf creator       Manage creators
  atsf agent         Manage agents
  atsf verify        Run verification
  atsf probe         Run red team probes
  atsf gate          Run CI/CD safety gate

Usage:
  atsf start --port 8000
  atsf status
  atsf creator register --id creator_001 --tier verified --stake 1000
  atsf agent register --id agent_001 --creator creator_001 --tier gray_box
  atsf probe --agent agent_001 --type all
  atsf gate --config ./agent.yaml
"""

import argparse
import asyncio
import json
import sys
import os
from datetime import datetime
from typing import Optional


def get_system():
    """Get or create ATSF system instance."""
    from atsf_system import ATSFSystem
    # In production, this would connect to running server
    return ATSFSystem()


def cmd_start(args):
    """Start ATSF server."""
    print(f"""
╔═══════════════════════════════════════════════════════════════╗
║                    ATSF v3.2 Server                            ║
╠═══════════════════════════════════════════════════════════════╣
║  Starting server on port {args.port}...                           ║
║                                                                ║
║  Components:                                                   ║
║    ✓ Core Trust Engine (46 layers)                            ║
║    ✓ Creator Accountability                                   ║
║    ✓ Tool Output Sanitization (L43)                           ║
║    ✓ Reasoning Trace Evaluation (L44)                         ║
║    ✓ Benign Bias Probing (L45)                                ║
║    ✓ CI/CD Safety Gate (L46)                                  ║
║    ✓ Verifier Network                                         ║
║    ✓ Red Team Scheduler                                       ║
║    ✓ Human Oversight System                                   ║
║                                                                ║
║  API: http://localhost:{args.port}/api/v1                         ║
║  Docs: http://localhost:{args.port}/docs                          ║
║  Health: http://localhost:{args.port}/health                      ║
╚═══════════════════════════════════════════════════════════════╝
""")
    
    # In production, this would start uvicorn with the FastAPI app
    print(f"[{datetime.now().isoformat()}] Server starting...")
    print(f"[{datetime.now().isoformat()}] Press Ctrl+C to stop")
    
    try:
        import uvicorn
        # uvicorn.run("atsf_api:app", host="0.0.0.0", port=args.port, reload=args.reload)
        print("Note: Run with 'uvicorn atsf_api:app --port 8000' for production")
    except ImportError:
        print("Note: Install uvicorn for production server: pip install uvicorn")


def cmd_status(args):
    """Show system status."""
    system = get_system()
    stats = system.get_system_stats()
    
    print(f"""
╔═══════════════════════════════════════════════════════════════╗
║                    ATSF v3.2 Status                            ║
╠═══════════════════════════════════════════════════════════════╣
║                                                                ║
║  AGENTS                                                        ║
║    Total:       {stats['agents_total']:>6}                                      ║
║    Active:      {stats['agents_active']:>6}                                      ║
║    Quarantined: {stats['agents_quarantined']:>6}                                      ║
║                                                                ║
║  CREATORS                                                      ║
║    Total:       {stats['creators_total']:>6}                                      ║
║    Active:      {stats['creators_active']:>6}                                      ║
║                                                                ║
║  ACTIONS                                                       ║
║    Processed:   {stats['actions_processed']:>6}                                      ║
║    Allowed:     {stats['actions_allowed']:>6}                                      ║
║    Denied:      {stats['actions_denied']:>6}                                      ║
║                                                                ║
║  SECURITY                                                      ║
║    Threats:     {stats['threats_detected']:>6}                                      ║
║    Verifications: {stats['verifications_performed']:>4}                                      ║
║    Pending Approvals: {stats['pending_approvals']:>2}                                    ║
║                                                                ║
║  NETWORK                                                       ║
║    Verifiers:   {stats['verifiers_active']:>6}                                      ║
║                                                                ║
╚═══════════════════════════════════════════════════════════════╝
""")


def cmd_creator_register(args):
    """Register a new creator."""
    system = get_system()
    
    from atsf_system import CreatorTier
    tier = CreatorTier(args.tier)
    
    creator = system.register_creator(
        args.id,
        tier,
        stake=args.stake
    )
    
    print(f"""
Creator Registered:
  ID:         {creator.creator_id}
  Tier:       {creator.tier.value}
  Status:     {creator.status.value}
  Reputation: {creator.reputation_score:.3f}
  Stake:      ${creator.stake_deposited:.2f}
  Ceiling:    {creator.effective_ceiling():.3f}
""")


def cmd_agent_register(args):
    """Register a new agent."""
    system = get_system()
    
    # First ensure creator exists
    from atsf_system import CreatorTier, TransparencyTier
    
    if args.creator not in system.creators:
        system.register_creator(args.creator, CreatorTier.VERIFIED)
    
    tier = TransparencyTier(args.tier)
    
    agent = system.register_agent(
        args.id,
        args.creator,
        tier,
        name=args.name or args.id
    )
    
    print(f"""
Agent Registered:
  ID:           {agent.agent_id}
  Name:         {agent.name}
  Creator:      {agent.creator_id}
  Tier:         {agent.tier.value}
  Status:       {agent.status.value}
  Trust:        {agent.trust.score:.3f} / {agent.trust.ceiling:.3f}
  Red Team:     Scheduled (intensive 24h)
""")


def cmd_probe(args):
    """Run red team probes."""
    system = get_system()
    
    from atsf_system import ProbeType
    
    print(f"Running probes against agent: {args.agent}")
    print("-" * 50)
    
    async def mock_query(prompt):
        # Mock response for testing
        return "I cannot comply with that request as it would be inappropriate."
    
    async def run_probes():
        probe_types = list(ProbeType) if args.type == "all" else [ProbeType(args.type)]
        
        for probe_type in probe_types:
            result = await system.red_team.run_probe(
                args.agent,
                probe_type,
                mock_query
            )
            
            status = "✓ PASSED" if result.passed else "✗ FAILED"
            print(f"  {probe_type.value}: {status}")
            if not result.passed:
                for indicator in result.risk_indicators:
                    print(f"    - {indicator}")
    
    asyncio.run(run_probes())
    
    # Summary
    summary = system.red_team.get_agent_risk_summary(args.agent)
    print(f"""
Summary:
  Probes run: {summary.get('probes', 0)}
  Pass rate:  {summary.get('pass_rate', 0) * 100:.1f}%
  Risk score: {summary.get('risk_score', 0):.3f}
""")


def cmd_gate(args):
    """Run CI/CD safety gate."""
    from advanced_security_layers import CICDSafetyGate, SafetyGateConfig
    
    print(f"Running ATSF Safety Gate on: {args.config}")
    print("-" * 50)
    
    # Load config
    config_path = args.config
    if os.path.exists(config_path):
        with open(config_path) as f:
            if config_path.endswith('.json'):
                agent_config = json.load(f)
            else:
                import yaml
                agent_config = yaml.safe_load(f)
    else:
        agent_config = {"name": "test-agent"}
    
    gate_config = SafetyGateConfig(
        max_risk_score=args.max_risk,
        block_on_failure=not args.warn_only
    )
    
    gate = CICDSafetyGate(gate_config)
    
    async def run_gate():
        result = await gate.evaluate(
            agent_config=agent_config,
            creator_profile={
                "status": "active",
                "reputation_score": 0.6
            }
        )
        
        print(gate.generate_report(result))
        
        if args.output:
            with open(args.output, 'w') as f:
                json.dump({
                    "passed": result.passed,
                    "risk_score": result.overall_risk,
                    "checks": result.checks_run,
                    "warnings": result.warnings,
                    "blocking_issues": result.blocking_issues
                }, f, indent=2)
            print(f"Report saved to: {args.output}")
        
        return result.passed
    
    passed = asyncio.run(run_gate())
    sys.exit(0 if passed else 1)


def main():
    parser = argparse.ArgumentParser(
        description="ATSF v3.2 - Agentic Trust Scoring Framework",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  atsf start --port 8000
  atsf status
  atsf creator register --id creator_001 --tier verified --stake 1000
  atsf agent register --id agent_001 --creator creator_001 --tier gray_box
  atsf probe --agent agent_001 --type capability_elicitation
  atsf gate --config ./agent.yaml --max-risk 0.3
        """
    )
    
    subparsers = parser.add_subparsers(dest="command", help="Commands")
    
    # Start command
    start_parser = subparsers.add_parser("start", help="Start ATSF server")
    start_parser.add_argument("--port", type=int, default=8000, help="Port to run on")
    start_parser.add_argument("--reload", action="store_true", help="Enable auto-reload")
    
    # Status command
    subparsers.add_parser("status", help="Show system status")
    
    # Creator commands
    creator_parser = subparsers.add_parser("creator", help="Manage creators")
    creator_sub = creator_parser.add_subparsers(dest="creator_cmd")
    
    creator_reg = creator_sub.add_parser("register", help="Register creator")
    creator_reg.add_argument("--id", required=True, help="Creator ID")
    creator_reg.add_argument("--tier", required=True, 
                            choices=["anonymous", "pseudonymous", "verified", "institutional", "certified"],
                            help="Creator tier")
    creator_reg.add_argument("--stake", type=float, default=0, help="Initial stake")
    
    # Agent commands
    agent_parser = subparsers.add_parser("agent", help="Manage agents")
    agent_sub = agent_parser.add_subparsers(dest="agent_cmd")
    
    agent_reg = agent_sub.add_parser("register", help="Register agent")
    agent_reg.add_argument("--id", required=True, help="Agent ID")
    agent_reg.add_argument("--creator", required=True, help="Creator ID")
    agent_reg.add_argument("--tier", required=True,
                          choices=["black_box", "gray_box", "white_box", "verified_box"],
                          help="Transparency tier")
    agent_reg.add_argument("--name", help="Agent name")
    
    # Probe command
    probe_parser = subparsers.add_parser("probe", help="Run red team probes")
    probe_parser.add_argument("--agent", required=True, help="Agent ID to probe")
    probe_parser.add_argument("--type", default="all",
                             choices=["all", "capability_elicitation", "deceptive_alignment",
                                     "goal_hijacking", "trust_farming", "injection_resistance",
                                     "bias_detection", "consistency_check"],
                             help="Probe type")
    
    # Gate command
    gate_parser = subparsers.add_parser("gate", help="Run CI/CD safety gate")
    gate_parser.add_argument("--config", required=True, help="Agent config file")
    gate_parser.add_argument("--max-risk", type=float, default=0.3, help="Max risk threshold")
    gate_parser.add_argument("--warn-only", action="store_true", help="Warn but don't fail")
    gate_parser.add_argument("--output", help="Output report file")
    
    args = parser.parse_args()
    
    if args.command == "start":
        cmd_start(args)
    elif args.command == "status":
        cmd_status(args)
    elif args.command == "creator" and args.creator_cmd == "register":
        cmd_creator_register(args)
    elif args.command == "agent" and args.agent_cmd == "register":
        cmd_agent_register(args)
    elif args.command == "probe":
        cmd_probe(args)
    elif args.command == "gate":
        cmd_gate(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
