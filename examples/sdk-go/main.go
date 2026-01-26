// Vorion ACI Go SDK Example
//
// This example demonstrates how to interact with the Phase 6 Trust Engine API
// using Go. It covers role gate evaluation, ceiling checks, and provenance tracking.
//
// Usage:
//   go run main.go
//
// Environment:
//   ACI_BASE_URL - API base URL (default: http://localhost:3000)
//   ACI_API_KEY  - API key for authentication

package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

// =============================================================================
// Types
// =============================================================================

type TrustTier string

const (
	TrustTierUnknown    TrustTier = "UNKNOWN"
	TrustTierBasic      TrustTier = "BASIC"
	TrustTierVerified   TrustTier = "VERIFIED"
	TrustTierTrusted    TrustTier = "TRUSTED"
	TrustTierPrivileged TrustTier = "PRIVILEGED"
)

type AgentRole string

const (
	RoleReader              AgentRole = "READER"
	RoleWriter              AgentRole = "WRITER"
	RoleDataAnalyst         AgentRole = "DATA_ANALYST"
	RoleCodeExecutor        AgentRole = "CODE_EXECUTOR"
	RoleSystemAdmin         AgentRole = "SYSTEM_ADMIN"
	RoleExternalCommunicator AgentRole = "EXTERNAL_COMMUNICATOR"
	RoleResourceManager     AgentRole = "RESOURCE_MANAGER"
	RoleAuditor             AgentRole = "AUDITOR"
)

type ResourceType string

const (
	ResourceAPICalls   ResourceType = "API_CALLS"
	ResourceDataAccess ResourceType = "DATA_ACCESS"
	ResourceCompute    ResourceType = "COMPUTE"
	ResourceStorage    ResourceType = "STORAGE"
	ResourceNetwork    ResourceType = "NETWORK"
)

type RoleGateRequest struct {
	AgentID string            `json:"agentId"`
	Role    AgentRole         `json:"role"`
	Tier    TrustTier         `json:"tier"`
	Context map[string]string `json:"context,omitempty"`
}

type RoleGateResponse struct {
	Allowed      bool      `json:"allowed"`
	Decision     string    `json:"decision"`
	Reason       string    `json:"reason"`
	EvaluatedAt  time.Time `json:"evaluatedAt"`
	ProvenanceID string    `json:"provenanceId,omitempty"`
	RequiredTier TrustTier `json:"requiredTier,omitempty"`
}

type CeilingCheckRequest struct {
	AgentID         string       `json:"agentId"`
	ResourceType    ResourceType `json:"resourceType"`
	RequestedAmount int          `json:"requestedAmount"`
	Tier            TrustTier    `json:"tier,omitempty"`
}

type CeilingCheckResponse struct {
	Allowed      bool      `json:"allowed"`
	CurrentUsage int       `json:"currentUsage"`
	Ceiling      int       `json:"ceiling"`
	Remaining    int       `json:"remaining"`
	ResetAt      time.Time `json:"resetAt"`
	ProvenanceID string    `json:"provenanceId,omitempty"`
}

type DashboardStats struct {
	RoleGates  RoleGateStats  `json:"roleGates"`
	Ceiling    CeilingStats   `json:"ceiling"`
	Provenance ProvenanceStats `json:"provenance"`
	Alerts     AlertStats     `json:"alerts"`
	Timestamp  time.Time      `json:"timestamp"`
}

type RoleGateStats struct {
	Total     int            `json:"total"`
	Allowed   int            `json:"allowed"`
	Denied    int            `json:"denied"`
	Escalated int            `json:"escalated"`
	ByTier    map[string]int `json:"byTier"`
}

type CeilingStats struct {
	TotalChecks int `json:"totalChecks"`
	Exceeded    int `json:"exceeded"`
	NearLimit   int `json:"nearLimit"`
}

type ProvenanceStats struct {
	TotalRecords int            `json:"totalRecords"`
	ByType       map[string]int `json:"byType"`
}

type AlertStats struct {
	Active     int            `json:"active"`
	BySeverity map[string]int `json:"bySeverity"`
}

// =============================================================================
// Client
// =============================================================================

type ACIClient struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

func NewACIClient(baseURL, apiKey string) *ACIClient {
	return &ACIClient{
		baseURL: baseURL,
		apiKey:  apiKey,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (c *ACIClient) doRequest(ctx context.Context, method, path string, body interface{}) ([]byte, error) {
	var bodyReader io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request body: %w", err)
		}
		bodyReader = bytes.NewReader(jsonBody)
	}

	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	if c.apiKey != "" {
		req.Header.Set("X-API-Key", c.apiKey)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("API error (status %d): %s", resp.StatusCode, string(respBody))
	}

	return respBody, nil
}

// GetStats retrieves dashboard statistics
func (c *ACIClient) GetStats(ctx context.Context) (*DashboardStats, error) {
	data, err := c.doRequest(ctx, "GET", "/api/phase6/stats", nil)
	if err != nil {
		return nil, err
	}

	var stats DashboardStats
	if err := json.Unmarshal(data, &stats); err != nil {
		return nil, fmt.Errorf("failed to parse stats: %w", err)
	}

	return &stats, nil
}

// EvaluateRoleGate evaluates whether an agent can access a role
func (c *ACIClient) EvaluateRoleGate(ctx context.Context, req RoleGateRequest) (*RoleGateResponse, error) {
	data, err := c.doRequest(ctx, "POST", "/api/phase6/role-gates/evaluate", req)
	if err != nil {
		return nil, err
	}

	var resp RoleGateResponse
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &resp, nil
}

// CheckCeiling checks if an agent is within their capability ceiling
func (c *ACIClient) CheckCeiling(ctx context.Context, req CeilingCheckRequest) (*CeilingCheckResponse, error) {
	data, err := c.doRequest(ctx, "POST", "/api/phase6/ceiling/check", req)
	if err != nil {
		return nil, err
	}

	var resp CeilingCheckResponse
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &resp, nil
}

// =============================================================================
// Example Usage
// =============================================================================

func main() {
	// Get configuration from environment
	baseURL := os.Getenv("ACI_BASE_URL")
	if baseURL == "" {
		baseURL = "http://localhost:3000"
	}
	apiKey := os.Getenv("ACI_API_KEY")

	// Create client
	client := NewACIClient(baseURL, apiKey)
	ctx := context.Background()

	fmt.Println("Vorion ACI Go SDK Example")
	fmt.Println("=========================")
	fmt.Printf("Base URL: %s\n\n", baseURL)

	// Example 1: Get Dashboard Stats
	fmt.Println("1. Getting Dashboard Stats...")
	stats, err := client.GetStats(ctx)
	if err != nil {
		fmt.Printf("   Error: %v\n", err)
	} else {
		fmt.Printf("   Role Gates: %d total, %d allowed, %d denied\n",
			stats.RoleGates.Total, stats.RoleGates.Allowed, stats.RoleGates.Denied)
		fmt.Printf("   Ceiling Checks: %d total, %d exceeded\n",
			stats.Ceiling.TotalChecks, stats.Ceiling.Exceeded)
		fmt.Printf("   Active Alerts: %d\n", stats.Alerts.Active)
	}
	fmt.Println()

	// Example 2: Evaluate Role Gate
	fmt.Println("2. Evaluating Role Gate...")
	roleGateReq := RoleGateRequest{
		AgentID: "agent_go_example",
		Role:    RoleDataAnalyst,
		Tier:    TrustTierVerified,
		Context: map[string]string{
			"resourceId": "dataset_001",
			"action":     "read",
		},
	}

	roleGateResp, err := client.EvaluateRoleGate(ctx, roleGateReq)
	if err != nil {
		fmt.Printf("   Error: %v\n", err)
	} else {
		fmt.Printf("   Agent: %s\n", roleGateReq.AgentID)
		fmt.Printf("   Role: %s, Tier: %s\n", roleGateReq.Role, roleGateReq.Tier)
		fmt.Printf("   Decision: %s (allowed: %v)\n", roleGateResp.Decision, roleGateResp.Allowed)
		fmt.Printf("   Reason: %s\n", roleGateResp.Reason)
	}
	fmt.Println()

	// Example 3: Check Capability Ceiling
	fmt.Println("3. Checking Capability Ceiling...")
	ceilingReq := CeilingCheckRequest{
		AgentID:         "agent_go_example",
		ResourceType:    ResourceAPICalls,
		RequestedAmount: 10,
		Tier:            TrustTierVerified,
	}

	ceilingResp, err := client.CheckCeiling(ctx, ceilingReq)
	if err != nil {
		fmt.Printf("   Error: %v\n", err)
	} else {
		fmt.Printf("   Resource: %s\n", ceilingReq.ResourceType)
		fmt.Printf("   Current Usage: %d / %d\n", ceilingResp.CurrentUsage, ceilingResp.Ceiling)
		fmt.Printf("   Remaining: %d\n", ceilingResp.Remaining)
		fmt.Printf("   Request Allowed: %v\n", ceilingResp.Allowed)
	}
	fmt.Println()

	// Example 4: Role Gate with Insufficient Trust
	fmt.Println("4. Testing Role Gate Denial...")
	deniedReq := RoleGateRequest{
		AgentID: "agent_go_example",
		Role:    RoleSystemAdmin,
		Tier:    TrustTierBasic,
	}

	deniedResp, err := client.EvaluateRoleGate(ctx, deniedReq)
	if err != nil {
		fmt.Printf("   Error: %v\n", err)
	} else {
		fmt.Printf("   Attempting SYSTEM_ADMIN with BASIC tier...\n")
		fmt.Printf("   Decision: %s\n", deniedResp.Decision)
		fmt.Printf("   Required Tier: %s\n", deniedResp.RequiredTier)
	}

	fmt.Println("\n✓ Example completed")
}
