import { BasisLayout } from '@/components/BasisLayout';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'JSON Schemas | BASIS',
  description: 'Complete JSON Schema definitions for BASIS wire protocol including IntentRecord, EnforceResponse, and ProofRecord.',
};

export default function SchemasPage() {
  return (
    <BasisLayout
      title="JSON Schemas"
      description="Wire protocol schemas (JSON Schema Draft 2020-12)"
      breadcrumb="Schemas"
    >
      <div className="space-y-12">
        {/* Overview */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Overview</h2>
          <p className="text-neutral-400 leading-relaxed">
            BASIS defines JSON Schemas for all wire protocol messages. These schemas enable interoperability between different implementations and provide validation for API requests and responses.
          </p>
          <div className="mt-4 bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-sm text-neutral-400">
              <strong className="text-white">Schema Version:</strong> JSON Schema Draft 2020-12
            </p>
          </div>
        </section>

        {/* Schema List */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Available Schemas</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <SchemaCard name="intent-record" description="Structured action intent from INTENT layer" />
            <SchemaCard name="enforce-request" description="Request to ENFORCE layer for decision" />
            <SchemaCard name="enforce-response" description="Governance decision from ENFORCE layer" />
            <SchemaCard name="proof-record" description="Immutable audit record from PROOF layer" />
            <SchemaCard name="entity" description="Agent or user entity definition" />
            <SchemaCard name="trust-score-update" description="Trust score change event" />
            <SchemaCard name="error-response" description="Standardized error format" />
            <SchemaCard name="escalation" description="Human escalation request" />
          </div>
        </section>

        {/* IntentRecord Example */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">IntentRecord Schema</h2>
          <div className="bg-black/30 border border-white/10 rounded-xl p-6 overflow-x-auto">
            <pre className="text-sm text-neutral-300 font-mono">
{`{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://vorion.org/basis/schemas/v1/intent-record.json",
  "title": "IntentRecord",
  "description": "A structured representation of an agent's intended action",
  "type": "object",
  "required": ["intent_id", "entity_id", "timestamp", "raw_input",
               "capabilities_required", "risk_level"],
  "properties": {
    "intent_id": {
      "type": "string",
      "pattern": "^int_[a-zA-Z0-9]{12,}$",
      "description": "Unique identifier for this intent"
    },
    "entity_id": {
      "type": "string",
      "pattern": "^ent_[a-zA-Z0-9]{12,}$",
      "description": "Entity requesting the action"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time",
      "description": "ISO 8601 timestamp"
    },
    "raw_input": {
      "type": "string",
      "maxLength": 10000,
      "description": "Original action request"
    },
    "capabilities_required": {
      "type": "array",
      "items": { "type": "string" },
      "minItems": 1,
      "description": "Capabilities needed for this action"
    },
    "risk_level": {
      "type": "string",
      "enum": ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    }
  }
}`}
            </pre>
          </div>
        </section>

        {/* EnforceResponse Example */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">EnforceResponse Schema</h2>
          <div className="bg-black/30 border border-white/10 rounded-xl p-6 overflow-x-auto">
            <pre className="text-sm text-neutral-300 font-mono">
{`{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://vorion.org/basis/schemas/v1/enforce-response.json",
  "title": "EnforceResponse",
  "description": "Governance decision from the ENFORCE layer",
  "type": "object",
  "required": ["decision", "intent_id", "entity_id", "timestamp",
               "trust_score_at_decision", "trust_tier_at_decision"],
  "properties": {
    "decision": {
      "type": "string",
      "enum": ["ALLOW", "DENY", "ESCALATE", "DEGRADE"],
      "description": "The governance decision"
    },
    "intent_id": { "type": "string" },
    "entity_id": { "type": "string" },
    "timestamp": { "type": "string", "format": "date-time" },
    "trust_score_at_decision": {
      "type": "integer",
      "minimum": 0,
      "maximum": 1000
    },
    "trust_tier_at_decision": {
      "type": "string",
      "enum": ["sandbox", "provisional", "standard",
               "trusted", "certified", "autonomous"]
    },
    "denial_reason": {
      "type": ["string", "null"],
      "description": "Required if decision is DENY"
    },
    "escalation_target": {
      "type": ["object", "null"],
      "description": "Required if decision is ESCALATE"
    }
  }
}`}
            </pre>
          </div>
        </section>

        {/* ProofRecord Example */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">ProofRecord Schema</h2>
          <div className="bg-black/30 border border-white/10 rounded-xl p-6 overflow-x-auto">
            <pre className="text-sm text-neutral-300 font-mono">
{`{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://vorion.org/basis/schemas/v1/proof-record.json",
  "title": "ProofRecord",
  "description": "Immutable audit record from the PROOF layer",
  "type": "object",
  "required": ["proof_id", "timestamp", "intent_id", "entity_id",
               "decision", "payload_hash", "chain_hash"],
  "properties": {
    "proof_id": {
      "type": "string",
      "pattern": "^prf_[a-zA-Z0-9]{12,}$"
    },
    "previous_proof_id": {
      "type": ["string", "null"],
      "description": "Null only for genesis proof"
    },
    "timestamp": { "type": "string", "format": "date-time" },
    "payload_hash": {
      "type": "string",
      "pattern": "^sha256:[a-f0-9]{64}$"
    },
    "chain_hash": {
      "type": "string",
      "pattern": "^sha256:[a-f0-9]{64}$"
    },
    "signature": {
      "type": "object",
      "properties": {
        "algorithm": { "type": "string" },
        "value": { "type": "string" }
      }
    }
  }
}`}
            </pre>
          </div>
        </section>

        {/* Full Schemas Link */}
        <section className="border-t border-white/10 pt-8">
          <p className="text-neutral-400 mb-4">
            For all schemas including validation rules and examples, see the complete JSON Schemas document on GitHub.
          </p>
          <Link
            href="https://github.com/voriongit/vorion/blob/master/basis-core/specs/BASIS-JSON-SCHEMAS.md"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black font-semibold rounded hover:bg-neutral-200 transition-colors"
          >
            View All Schemas on GitHub
          </Link>
        </section>
      </div>
    </BasisLayout>
  );
}

function SchemaCard({ name, description }: { name: string; description: string }) {
  return (
    <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
      <code className="text-emerald-400 font-mono text-sm">{name}.json</code>
      <p className="text-sm text-neutral-400 mt-1">{description}</p>
    </div>
  );
}
