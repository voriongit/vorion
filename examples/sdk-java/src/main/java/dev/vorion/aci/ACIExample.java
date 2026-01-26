package dev.vorion.aci;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.annotations.SerializedName;
import okhttp3.*;

import java.io.IOException;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Vorion ACI Java SDK Example
 *
 * This example demonstrates how to interact with the Phase 6 Trust Engine API
 * using Java. It covers role gate evaluation, ceiling checks, and provenance tracking.
 *
 * Usage:
 *   mvn exec:java
 *
 * Environment:
 *   ACI_BASE_URL - API base URL (default: http://localhost:3000)
 *   ACI_API_KEY  - API key for authentication
 */
public class ACIExample {

    // =============================================================================
    // Enums
    // =============================================================================

    public enum TrustTier {
        UNKNOWN, BASIC, VERIFIED, TRUSTED, PRIVILEGED
    }

    public enum AgentRole {
        READER, WRITER, DATA_ANALYST, CODE_EXECUTOR,
        SYSTEM_ADMIN, EXTERNAL_COMMUNICATOR, RESOURCE_MANAGER, AUDITOR
    }

    public enum ResourceType {
        API_CALLS, DATA_ACCESS, COMPUTE, STORAGE, NETWORK
    }

    public enum Decision {
        ALLOW, DENY, ESCALATE
    }

    // =============================================================================
    // Request/Response Classes
    // =============================================================================

    public static class RoleGateRequest {
        @SerializedName("agentId")
        public String agentId;

        @SerializedName("role")
        public AgentRole role;

        @SerializedName("tier")
        public TrustTier tier;

        @SerializedName("context")
        public Map<String, String> context;

        public RoleGateRequest(String agentId, AgentRole role, TrustTier tier) {
            this.agentId = agentId;
            this.role = role;
            this.tier = tier;
        }

        public RoleGateRequest withContext(Map<String, String> context) {
            this.context = context;
            return this;
        }
    }

    public static class RoleGateResponse {
        @SerializedName("allowed")
        public boolean allowed;

        @SerializedName("decision")
        public Decision decision;

        @SerializedName("reason")
        public String reason;

        @SerializedName("evaluatedAt")
        public String evaluatedAt;

        @SerializedName("provenanceId")
        public String provenanceId;

        @SerializedName("requiredTier")
        public TrustTier requiredTier;
    }

    public static class CeilingCheckRequest {
        @SerializedName("agentId")
        public String agentId;

        @SerializedName("resourceType")
        public ResourceType resourceType;

        @SerializedName("requestedAmount")
        public int requestedAmount;

        @SerializedName("tier")
        public TrustTier tier;

        public CeilingCheckRequest(String agentId, ResourceType resourceType, int requestedAmount) {
            this.agentId = agentId;
            this.resourceType = resourceType;
            this.requestedAmount = requestedAmount;
        }

        public CeilingCheckRequest withTier(TrustTier tier) {
            this.tier = tier;
            return this;
        }
    }

    public static class CeilingCheckResponse {
        @SerializedName("allowed")
        public boolean allowed;

        @SerializedName("currentUsage")
        public int currentUsage;

        @SerializedName("ceiling")
        public int ceiling;

        @SerializedName("remaining")
        public int remaining;

        @SerializedName("resetAt")
        public String resetAt;

        @SerializedName("provenanceId")
        public String provenanceId;
    }

    public static class DashboardStats {
        @SerializedName("roleGates")
        public RoleGateStats roleGates;

        @SerializedName("ceiling")
        public CeilingStats ceiling;

        @SerializedName("provenance")
        public ProvenanceStats provenance;

        @SerializedName("alerts")
        public AlertStats alerts;

        @SerializedName("timestamp")
        public String timestamp;
    }

    public static class RoleGateStats {
        public int total;
        public int allowed;
        public int denied;
        public int escalated;
        public Map<String, Integer> byTier;
    }

    public static class CeilingStats {
        public int totalChecks;
        public int exceeded;
        public int nearLimit;
    }

    public static class ProvenanceStats {
        public int totalRecords;
        public Map<String, Integer> byType;
    }

    public static class AlertStats {
        public int active;
        public Map<String, Integer> bySeverity;
    }

    // =============================================================================
    // Client
    // =============================================================================

    public static class ACIClient {
        private final String baseUrl;
        private final String apiKey;
        private final OkHttpClient client;
        private final Gson gson;

        public ACIClient(String baseUrl, String apiKey) {
            this.baseUrl = baseUrl;
            this.apiKey = apiKey;
            this.client = new OkHttpClient();
            this.gson = new GsonBuilder().create();
        }

        private <T> T request(String method, String path, Object body, Class<T> responseClass) throws IOException {
            Request.Builder requestBuilder = new Request.Builder()
                    .url(baseUrl + path)
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json");

            if (apiKey != null && !apiKey.isEmpty()) {
                requestBuilder.header("X-API-Key", apiKey);
            }

            RequestBody requestBody = null;
            if (body != null) {
                requestBody = RequestBody.create(
                        gson.toJson(body),
                        MediaType.parse("application/json")
                );
            }

            switch (method.toUpperCase()) {
                case "GET" -> requestBuilder.get();
                case "POST" -> requestBuilder.post(requestBody);
                case "PUT" -> requestBuilder.put(requestBody);
                case "DELETE" -> requestBuilder.delete(requestBody);
                case "PATCH" -> requestBuilder.patch(requestBody);
                default -> throw new IllegalArgumentException("Unsupported method: " + method);
            }

            try (Response response = client.newCall(requestBuilder.build()).execute()) {
                if (!response.isSuccessful()) {
                    String errorBody = response.body() != null ? response.body().string() : "Unknown error";
                    throw new IOException("API error (status " + response.code() + "): " + errorBody);
                }

                if (response.body() == null) {
                    return null;
                }

                return gson.fromJson(response.body().string(), responseClass);
            }
        }

        /**
         * Get dashboard statistics
         */
        public DashboardStats getStats() throws IOException {
            return request("GET", "/api/phase6/stats", null, DashboardStats.class);
        }

        /**
         * Evaluate role gate access
         */
        public RoleGateResponse evaluateRoleGate(RoleGateRequest request) throws IOException {
            return this.request("POST", "/api/phase6/role-gates/evaluate", request, RoleGateResponse.class);
        }

        /**
         * Check capability ceiling
         */
        public CeilingCheckResponse checkCeiling(CeilingCheckRequest request) throws IOException {
            return this.request("POST", "/api/phase6/ceiling/check", request, CeilingCheckResponse.class);
        }
    }

    // =============================================================================
    // Main
    // =============================================================================

    public static void main(String[] args) {
        // Get configuration from environment
        String baseUrl = Optional.ofNullable(System.getenv("ACI_BASE_URL"))
                .orElse("http://localhost:3000");
        String apiKey = System.getenv("ACI_API_KEY");

        // Create client
        ACIClient client = new ACIClient(baseUrl, apiKey);

        System.out.println("Vorion ACI Java SDK Example");
        System.out.println("===========================");
        System.out.printf("Base URL: %s%n%n", baseUrl);

        // Example 1: Get Dashboard Stats
        System.out.println("1. Getting Dashboard Stats...");
        try {
            DashboardStats stats = client.getStats();
            System.out.printf("   Role Gates: %d total, %d allowed, %d denied%n",
                    stats.roleGates.total, stats.roleGates.allowed, stats.roleGates.denied);
            System.out.printf("   Ceiling Checks: %d total, %d exceeded%n",
                    stats.ceiling.totalChecks, stats.ceiling.exceeded);
            System.out.printf("   Active Alerts: %d%n", stats.alerts.active);
        } catch (IOException e) {
            System.out.printf("   Error: %s%n", e.getMessage());
        }
        System.out.println();

        // Example 2: Evaluate Role Gate
        System.out.println("2. Evaluating Role Gate...");
        try {
            Map<String, String> context = new HashMap<>();
            context.put("resourceId", "dataset_001");
            context.put("action", "read");

            RoleGateRequest roleGateReq = new RoleGateRequest(
                    "agent_java_example",
                    AgentRole.DATA_ANALYST,
                    TrustTier.VERIFIED
            ).withContext(context);

            RoleGateResponse roleGateResp = client.evaluateRoleGate(roleGateReq);
            System.out.printf("   Agent: %s%n", roleGateReq.agentId);
            System.out.printf("   Role: %s, Tier: %s%n", roleGateReq.role, roleGateReq.tier);
            System.out.printf("   Decision: %s (allowed: %s)%n", roleGateResp.decision, roleGateResp.allowed);
            System.out.printf("   Reason: %s%n", roleGateResp.reason);
        } catch (IOException e) {
            System.out.printf("   Error: %s%n", e.getMessage());
        }
        System.out.println();

        // Example 3: Check Capability Ceiling
        System.out.println("3. Checking Capability Ceiling...");
        try {
            CeilingCheckRequest ceilingReq = new CeilingCheckRequest(
                    "agent_java_example",
                    ResourceType.API_CALLS,
                    10
            ).withTier(TrustTier.VERIFIED);

            CeilingCheckResponse ceilingResp = client.checkCeiling(ceilingReq);
            System.out.printf("   Resource: %s%n", ceilingReq.resourceType);
            System.out.printf("   Current Usage: %d / %d%n", ceilingResp.currentUsage, ceilingResp.ceiling);
            System.out.printf("   Remaining: %d%n", ceilingResp.remaining);
            System.out.printf("   Request Allowed: %s%n", ceilingResp.allowed);
        } catch (IOException e) {
            System.out.printf("   Error: %s%n", e.getMessage());
        }
        System.out.println();

        // Example 4: Role Gate with Insufficient Trust
        System.out.println("4. Testing Role Gate Denial...");
        try {
            RoleGateRequest deniedReq = new RoleGateRequest(
                    "agent_java_example",
                    AgentRole.SYSTEM_ADMIN,
                    TrustTier.BASIC
            );

            RoleGateResponse deniedResp = client.evaluateRoleGate(deniedReq);
            System.out.println("   Attempting SYSTEM_ADMIN with BASIC tier...");
            System.out.printf("   Decision: %s%n", deniedResp.decision);
            if (deniedResp.requiredTier != null) {
                System.out.printf("   Required Tier: %s%n", deniedResp.requiredTier);
            }
        } catch (IOException e) {
            System.out.printf("   Error: %s%n", e.getMessage());
        }

        System.out.println("\n✓ Example completed");
    }
}
