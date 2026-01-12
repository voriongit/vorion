// Package atsf provides a Go client for the ATSF v3.0 API.
//
// Installation:
//
//	go get github.com/agentanchor/atsf-sdk-go
//
// Usage:
//
//	client := atsf.NewClient("your-api-key")
//	agent, err := client.Agents.Create(ctx, &atsf.CreateAgentRequest{
//	    AgentID: "my-agent",
//	    TransparencyTier: atsf.TierGrayBox,
//	})
package atsf

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

const (
	DefaultBaseURL = "http://localhost:8000"
	DefaultTimeout = 30 * time.Second
	Version        = "3.0.0"
)

// Transparency tiers
type TransparencyTier string

const (
	TierBlackBox    TransparencyTier = "black_box"
	TierGrayBox     TransparencyTier = "gray_box"
	TierWhiteBox    TransparencyTier = "white_box"
	TierAttested    TransparencyTier = "attested"
	TierTransparent TransparencyTier = "transparent"
)

// Agent statuses
type AgentStatus string

const (
	StatusRegistered  AgentStatus = "registered"
	StatusActive      AgentStatus = "active"
	StatusSuspended   AgentStatus = "suspended"
	StatusQuarantined AgentStatus = "quarantined"
	StatusTerminated  AgentStatus = "terminated"
)

// Threat levels
type ThreatLevel string

const (
	ThreatNone        ThreatLevel = "none"
	ThreatLow         ThreatLevel = "low"
	ThreatModerate    ThreatLevel = "moderate"
	ThreatHigh        ThreatLevel = "high"
	ThreatCritical    ThreatLevel = "critical"
	ThreatCatastrophic ThreatLevel = "catastrophic"
)

// Impact levels
type ImpactLevel string

const (
	ImpactNegligible   ImpactLevel = "negligible"
	ImpactLow          ImpactLevel = "low"
	ImpactMedium       ImpactLevel = "medium"
	ImpactHigh         ImpactLevel = "high"
	ImpactCritical     ImpactLevel = "critical"
	ImpactCatastrophic ImpactLevel = "catastrophic"
)

// =============================================================================
// DATA TYPES
// =============================================================================

// Agent represents an ATSF agent.
type Agent struct {
	AgentID          string           `json:"agent_id"`
	Status           AgentStatus      `json:"status"`
	TrustScore       float64          `json:"trust_score"`
	TrustCeiling     float64          `json:"trust_ceiling"`
	ContainmentLevel string           `json:"containment_level"`
	TransparencyTier TransparencyTier `json:"transparency_tier"`
	Capabilities     []string         `json:"capabilities"`
	Flags            []string         `json:"flags"`
	RegisteredAt     string           `json:"registered_at"`
	LastActivity     string           `json:"last_activity"`
}

// TrustInfo contains trust score information.
type TrustInfo struct {
	AgentID      string  `json:"agent_id"`
	TrustScore   float64 `json:"trust_score"`
	TrustCeiling float64 `json:"trust_ceiling"`
	WasCapped    bool    `json:"was_capped"`
	Velocity     float64 `json:"velocity"`
}

// ActionDecision contains the result of an action request.
type ActionDecision struct {
	RequestID        string   `json:"request_id"`
	Allowed          bool     `json:"allowed"`
	Reason           string   `json:"reason"`
	RiskScore        float64  `json:"risk_score"`
	RequiredApproval *string  `json:"required_approval"`
	Signals          []string `json:"signals"`
}

// Assessment contains a threat assessment.
type Assessment struct {
	AgentID            string              `json:"agent_id"`
	Timestamp          string              `json:"timestamp"`
	TrustScore         float64             `json:"trust_score"`
	TrustVelocity      float64             `json:"trust_velocity"`
	TrustCeiling       float64             `json:"trust_ceiling"`
	ThreatLevel        ThreatLevel         `json:"threat_level"`
	RiskScore          float64             `json:"risk_score"`
	TotalSignals       int                 `json:"total_signals"`
	RecommendedAction  string              `json:"recommended_action"`
	Findings           []string            `json:"findings"`
	SignalsByCategory  map[string][]string `json:"signals_by_category"`
}

// Stats contains system statistics.
type Stats struct {
	AgentsRegistered     int `json:"agents_registered"`
	ActiveAgents         int `json:"active_agents"`
	QuarantinedAgents    int `json:"quarantined_agents"`
	AssessmentsPerformed int `json:"assessments_performed"`
	ActionsProcessed     int `json:"actions_processed"`
	ActionsBlocked       int `json:"actions_blocked"`
	ThreatsDetected      int `json:"threats_detected"`
}

// Health contains health check response.
type Health struct {
	Status        string  `json:"status"`
	Version       string  `json:"version"`
	Timestamp     string  `json:"timestamp"`
	UptimeSeconds float64 `json:"uptime_seconds"`
}

// =============================================================================
// REQUEST TYPES
// =============================================================================

// CreateAgentRequest contains parameters for creating an agent.
type CreateAgentRequest struct {
	AgentID          string                 `json:"agent_id"`
	TransparencyTier TransparencyTier       `json:"transparency_tier,omitempty"`
	Capabilities     []string               `json:"capabilities,omitempty"`
	Metadata         map[string]interface{} `json:"metadata,omitempty"`
}

// UpdateTrustRequest contains parameters for updating trust.
type UpdateTrustRequest struct {
	EventType string  `json:"event_type"`
	Delta     float64 `json:"delta"`
	Source    string  `json:"source,omitempty"`
}

// ProcessActionRequest contains parameters for processing an action.
type ProcessActionRequest struct {
	ActionType  string                 `json:"action_type"`
	Description string                 `json:"description"`
	Target      string                 `json:"target"`
	Impact      ImpactLevel            `json:"impact,omitempty"`
	Reversible  *bool                  `json:"reversible,omitempty"`
	InputText   string                 `json:"input_text,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// =============================================================================
// ERRORS
// =============================================================================

// ATSFError represents an API error.
type ATSFError struct {
	StatusCode int
	Message    string
}

func (e *ATSFError) Error() string {
	return fmt.Sprintf("ATSF API error (%d): %s", e.StatusCode, e.Message)
}

// =============================================================================
// CLIENT
// =============================================================================

// Client is the ATSF API client.
type Client struct {
	apiKey     string
	baseURL    string
	httpClient *http.Client

	Agents      *AgentsService
	Trust       *TrustService
	Actions     *ActionsService
	Assessments *AssessmentsService
}

// ClientOption configures the client.
type ClientOption func(*Client)

// WithBaseURL sets the base URL.
func WithBaseURL(url string) ClientOption {
	return func(c *Client) {
		c.baseURL = url
	}
}

// WithTimeout sets the HTTP timeout.
func WithTimeout(timeout time.Duration) ClientOption {
	return func(c *Client) {
		c.httpClient.Timeout = timeout
	}
}

// WithHTTPClient sets a custom HTTP client.
func WithHTTPClient(httpClient *http.Client) ClientOption {
	return func(c *Client) {
		c.httpClient = httpClient
	}
}

// NewClient creates a new ATSF client.
func NewClient(apiKey string, opts ...ClientOption) *Client {
	c := &Client{
		apiKey:  apiKey,
		baseURL: DefaultBaseURL,
		httpClient: &http.Client{
			Timeout: DefaultTimeout,
		},
	}

	for _, opt := range opts {
		opt(c)
	}

	c.Agents = &AgentsService{client: c}
	c.Trust = &TrustService{client: c}
	c.Actions = &ActionsService{client: c}
	c.Assessments = &AssessmentsService{client: c}

	return c
}

func (c *Client) request(ctx context.Context, method, path string, body interface{}, result interface{}) error {
	var bodyReader io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("failed to marshal request body: %w", err)
		}
		bodyReader = bytes.NewReader(jsonBody)
	}

	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, bodyReader)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", c.apiKey)
	req.Header.Set("User-Agent", "atsf-sdk-go/"+Version)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return &ATSFError{
			StatusCode: resp.StatusCode,
			Message:    string(bodyBytes),
		}
	}

	if result != nil {
		if err := json.NewDecoder(resp.Body).Decode(result); err != nil {
			return fmt.Errorf("failed to decode response: %w", err)
		}
	}

	return nil
}

// Health returns the API health status.
func (c *Client) Health(ctx context.Context) (*Health, error) {
	var health Health
	if err := c.request(ctx, http.MethodGet, "/health", nil, &health); err != nil {
		return nil, err
	}
	return &health, nil
}

// Stats returns system statistics.
func (c *Client) Stats(ctx context.Context) (*Stats, error) {
	var stats Stats
	if err := c.request(ctx, http.MethodGet, "/stats", nil, &stats); err != nil {
		return nil, err
	}
	return &stats, nil
}

// =============================================================================
// SERVICES
// =============================================================================

// AgentsService handles agent operations.
type AgentsService struct {
	client *Client
}

// Create creates a new agent.
func (s *AgentsService) Create(ctx context.Context, req *CreateAgentRequest) (*Agent, error) {
	var agent Agent
	if err := s.client.request(ctx, http.MethodPost, "/agents", req, &agent); err != nil {
		return nil, err
	}
	return &agent, nil
}

// List lists all agents.
func (s *AgentsService) List(ctx context.Context, status AgentStatus, limit int) ([]Agent, error) {
	params := url.Values{}
	if status != "" {
		params.Set("status", string(status))
	}
	if limit > 0 {
		params.Set("limit", fmt.Sprintf("%d", limit))
	}

	path := "/agents"
	if len(params) > 0 {
		path += "?" + params.Encode()
	}

	var agents []Agent
	if err := s.client.request(ctx, http.MethodGet, path, nil, &agents); err != nil {
		return nil, err
	}
	return agents, nil
}

// Get retrieves an agent by ID.
func (s *AgentsService) Get(ctx context.Context, agentID string) (*Agent, error) {
	var agent Agent
	if err := s.client.request(ctx, http.MethodGet, "/agents/"+agentID, nil, &agent); err != nil {
		return nil, err
	}
	return &agent, nil
}

// Activate activates an agent.
func (s *AgentsService) Activate(ctx context.Context, agentID string) (*Agent, error) {
	var agent Agent
	if err := s.client.request(ctx, http.MethodPost, "/agents/"+agentID+"/activate", nil, &agent); err != nil {
		return nil, err
	}
	return &agent, nil
}

// Suspend suspends an agent.
func (s *AgentsService) Suspend(ctx context.Context, agentID, reason string) (*Agent, error) {
	var agent Agent
	body := map[string]string{"reason": reason}
	if err := s.client.request(ctx, http.MethodPost, "/agents/"+agentID+"/suspend", body, &agent); err != nil {
		return nil, err
	}
	return &agent, nil
}

// Quarantine quarantines an agent.
func (s *AgentsService) Quarantine(ctx context.Context, agentID, reason string) (*Agent, error) {
	var agent Agent
	body := map[string]string{"reason": reason}
	if err := s.client.request(ctx, http.MethodPost, "/agents/"+agentID+"/quarantine", body, &agent); err != nil {
		return nil, err
	}
	return &agent, nil
}

// TrustService handles trust operations.
type TrustService struct {
	client *Client
}

// Get retrieves trust information.
func (s *TrustService) Get(ctx context.Context, agentID string) (*TrustInfo, error) {
	var trust TrustInfo
	if err := s.client.request(ctx, http.MethodGet, "/agents/"+agentID+"/trust", nil, &trust); err != nil {
		return nil, err
	}
	return &trust, nil
}

// Update updates trust score.
func (s *TrustService) Update(ctx context.Context, agentID string, req *UpdateTrustRequest) (*TrustInfo, error) {
	var trust TrustInfo
	if err := s.client.request(ctx, http.MethodPost, "/agents/"+agentID+"/trust", req, &trust); err != nil {
		return nil, err
	}
	return &trust, nil
}

// ActionsService handles action operations.
type ActionsService struct {
	client *Client
}

// Process processes an action request.
func (s *ActionsService) Process(ctx context.Context, agentID string, req *ProcessActionRequest) (*ActionDecision, error) {
	var decision ActionDecision
	if err := s.client.request(ctx, http.MethodPost, "/agents/"+agentID+"/actions", req, &decision); err != nil {
		return nil, err
	}
	return &decision, nil
}

// AssessmentsService handles assessment operations.
type AssessmentsService struct {
	client *Client
}

// Get retrieves a threat assessment.
func (s *AssessmentsService) Get(ctx context.Context, agentID string) (*Assessment, error) {
	var assessment Assessment
	if err := s.client.request(ctx, http.MethodGet, "/agents/"+agentID+"/assessment", nil, &assessment); err != nil {
		return nil, err
	}
	return &assessment, nil
}
