//! Vorion ACI Rust SDK Example
//!
//! This example demonstrates how to interact with the Phase 6 Trust Engine API
//! using Rust. It covers role gate evaluation, ceiling checks, and provenance tracking.
//!
//! # Usage
//!
//! ```bash
//! cargo run
//! ```
//!
//! # Environment Variables
//!
//! - `ACI_BASE_URL` - API base URL (default: http://localhost:3000)
//! - `ACI_API_KEY` - API key for authentication

use chrono::{DateTime, Utc};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::env;
use thiserror::Error;

// =============================================================================
// Types
// =============================================================================

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum TrustTier {
    Unknown,
    Basic,
    Verified,
    Trusted,
    Privileged,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AgentRole {
    Reader,
    Writer,
    DataAnalyst,
    CodeExecutor,
    SystemAdmin,
    ExternalCommunicator,
    ResourceManager,
    Auditor,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ResourceType {
    ApiCalls,
    DataAccess,
    Compute,
    Storage,
    Network,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Decision {
    Allow,
    Deny,
    Escalate,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RoleGateRequest {
    pub agent_id: String,
    pub role: AgentRole,
    pub tier: TrustTier,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context: Option<HashMap<String, String>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoleGateResponse {
    pub allowed: bool,
    pub decision: Decision,
    pub reason: String,
    pub evaluated_at: DateTime<Utc>,
    #[serde(default)]
    pub provenance_id: Option<String>,
    #[serde(default)]
    pub required_tier: Option<TrustTier>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CeilingCheckRequest {
    pub agent_id: String,
    pub resource_type: ResourceType,
    pub requested_amount: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tier: Option<TrustTier>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CeilingCheckResponse {
    pub allowed: bool,
    pub current_usage: i32,
    pub ceiling: i32,
    pub remaining: i32,
    pub reset_at: DateTime<Utc>,
    #[serde(default)]
    pub provenance_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardStats {
    pub role_gates: RoleGateStats,
    pub ceiling: CeilingStats,
    pub provenance: ProvenanceStats,
    pub alerts: AlertStats,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoleGateStats {
    pub total: i32,
    pub allowed: i32,
    pub denied: i32,
    pub escalated: i32,
    #[serde(default)]
    pub by_tier: HashMap<String, i32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CeilingStats {
    pub total_checks: i32,
    pub exceeded: i32,
    pub near_limit: i32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProvenanceStats {
    pub total_records: i32,
    #[serde(default)]
    pub by_type: HashMap<String, i32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AlertStats {
    pub active: i32,
    #[serde(default)]
    pub by_severity: HashMap<String, i32>,
}

// =============================================================================
// Errors
// =============================================================================

#[derive(Error, Debug)]
pub enum ACIError {
    #[error("HTTP request failed: {0}")]
    RequestFailed(#[from] reqwest::Error),

    #[error("API error (status {status}): {message}")]
    ApiError { status: u16, message: String },

    #[error("Failed to parse response: {0}")]
    ParseError(#[from] serde_json::Error),
}

// =============================================================================
// Client
// =============================================================================

pub struct ACIClient {
    base_url: String,
    api_key: Option<String>,
    client: Client,
}

impl ACIClient {
    pub fn new(base_url: impl Into<String>, api_key: Option<String>) -> Self {
        Self {
            base_url: base_url.into(),
            api_key,
            client: Client::new(),
        }
    }

    async fn request<T, R>(&self, method: &str, path: &str, body: Option<&T>) -> Result<R, ACIError>
    where
        T: Serialize,
        R: for<'de> Deserialize<'de>,
    {
        let url = format!("{}{}", self.base_url, path);

        let mut req = match method {
            "GET" => self.client.get(&url),
            "POST" => self.client.post(&url),
            "PUT" => self.client.put(&url),
            "DELETE" => self.client.delete(&url),
            "PATCH" => self.client.patch(&url),
            _ => return Err(ACIError::ApiError {
                status: 0,
                message: format!("Unsupported method: {}", method),
            }),
        };

        req = req.header("Content-Type", "application/json");
        req = req.header("Accept", "application/json");

        if let Some(key) = &self.api_key {
            req = req.header("X-API-Key", key);
        }

        if let Some(body) = body {
            req = req.json(body);
        }

        let resp = req.send().await?;
        let status = resp.status().as_u16();

        if status >= 400 {
            let message = resp.text().await.unwrap_or_default();
            return Err(ACIError::ApiError { status, message });
        }

        let data = resp.json().await?;
        Ok(data)
    }

    /// Get dashboard statistics
    pub async fn get_stats(&self) -> Result<DashboardStats, ACIError> {
        self.request::<(), DashboardStats>("GET", "/api/phase6/stats", None)
            .await
    }

    /// Evaluate role gate access
    pub async fn evaluate_role_gate(
        &self,
        request: &RoleGateRequest,
    ) -> Result<RoleGateResponse, ACIError> {
        self.request("POST", "/api/phase6/role-gates/evaluate", Some(request))
            .await
    }

    /// Check capability ceiling
    pub async fn check_ceiling(
        &self,
        request: &CeilingCheckRequest,
    ) -> Result<CeilingCheckResponse, ACIError> {
        self.request("POST", "/api/phase6/ceiling/check", Some(request))
            .await
    }
}

// =============================================================================
// Example Usage
// =============================================================================

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Get configuration from environment
    let base_url = env::var("ACI_BASE_URL").unwrap_or_else(|_| "http://localhost:3000".to_string());
    let api_key = env::var("ACI_API_KEY").ok();

    // Create client
    let client = ACIClient::new(&base_url, api_key);

    println!("Vorion ACI Rust SDK Example");
    println!("===========================");
    println!("Base URL: {}\n", base_url);

    // Example 1: Get Dashboard Stats
    println!("1. Getting Dashboard Stats...");
    match client.get_stats().await {
        Ok(stats) => {
            println!(
                "   Role Gates: {} total, {} allowed, {} denied",
                stats.role_gates.total, stats.role_gates.allowed, stats.role_gates.denied
            );
            println!(
                "   Ceiling Checks: {} total, {} exceeded",
                stats.ceiling.total_checks, stats.ceiling.exceeded
            );
            println!("   Active Alerts: {}", stats.alerts.active);
        }
        Err(e) => println!("   Error: {}", e),
    }
    println!();

    // Example 2: Evaluate Role Gate
    println!("2. Evaluating Role Gate...");
    let role_gate_req = RoleGateRequest {
        agent_id: "agent_rust_example".to_string(),
        role: AgentRole::DataAnalyst,
        tier: TrustTier::Verified,
        context: Some(HashMap::from([
            ("resourceId".to_string(), "dataset_001".to_string()),
            ("action".to_string(), "read".to_string()),
        ])),
    };

    match client.evaluate_role_gate(&role_gate_req).await {
        Ok(resp) => {
            println!("   Agent: {}", role_gate_req.agent_id);
            println!("   Role: {:?}, Tier: {:?}", role_gate_req.role, role_gate_req.tier);
            println!("   Decision: {:?} (allowed: {})", resp.decision, resp.allowed);
            println!("   Reason: {}", resp.reason);
        }
        Err(e) => println!("   Error: {}", e),
    }
    println!();

    // Example 3: Check Capability Ceiling
    println!("3. Checking Capability Ceiling...");
    let ceiling_req = CeilingCheckRequest {
        agent_id: "agent_rust_example".to_string(),
        resource_type: ResourceType::ApiCalls,
        requested_amount: 10,
        tier: Some(TrustTier::Verified),
    };

    match client.check_ceiling(&ceiling_req).await {
        Ok(resp) => {
            println!("   Resource: {:?}", ceiling_req.resource_type);
            println!("   Current Usage: {} / {}", resp.current_usage, resp.ceiling);
            println!("   Remaining: {}", resp.remaining);
            println!("   Request Allowed: {}", resp.allowed);
        }
        Err(e) => println!("   Error: {}", e),
    }
    println!();

    // Example 4: Role Gate with Insufficient Trust
    println!("4. Testing Role Gate Denial...");
    let denied_req = RoleGateRequest {
        agent_id: "agent_rust_example".to_string(),
        role: AgentRole::SystemAdmin,
        tier: TrustTier::Basic,
        context: None,
    };

    match client.evaluate_role_gate(&denied_req).await {
        Ok(resp) => {
            println!("   Attempting SYSTEM_ADMIN with BASIC tier...");
            println!("   Decision: {:?}", resp.decision);
            if let Some(required) = resp.required_tier {
                println!("   Required Tier: {:?}", required);
            }
        }
        Err(e) => println!("   Error: {}", e),
    }

    println!("\n✓ Example completed");
    Ok(())
}
