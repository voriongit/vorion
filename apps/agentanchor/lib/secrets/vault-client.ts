/**
 * HashiCorp Vault Integration
 *
 * Enterprise secrets management with Vault support
 */

// =============================================================================
// Types
// =============================================================================

export interface VaultConfig {
  address: string;
  token?: string;
  namespace?: string;
  roleId?: string;
  secretId?: string;
  kubernetesRole?: string;
  kubernetesJwtPath?: string;
  caCert?: string;
  timeout?: number;
  retries?: number;
}

export interface VaultSecret {
  data: Record<string, string>;
  metadata: {
    created_time: string;
    deletion_time: string;
    destroyed: boolean;
    version: number;
  };
}

export interface VaultAuthResponse {
  client_token: string;
  accessor: string;
  policies: string[];
  token_policies: string[];
  lease_duration: number;
  renewable: boolean;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: Partial<VaultConfig> = {
  address: process.env.VAULT_ADDR || 'http://127.0.0.1:8200',
  token: process.env.VAULT_TOKEN,
  namespace: process.env.VAULT_NAMESPACE,
  timeout: 30000,
  retries: 3,
};

// =============================================================================
// Vault Client
// =============================================================================

export class VaultClient {
  private config: VaultConfig;
  private token: string | null = null;
  private tokenExpiry: Date | null = null;
  private secretsCache = new Map<string, { value: VaultSecret; expiry: Date }>();

  constructor(config: Partial<VaultConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config } as VaultConfig;
    this.token = this.config.token || null;
  }

  /**
   * Authenticate with Vault
   */
  async authenticate(): Promise<void> {
    if (this.token && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return; // Token still valid
    }

    // Try AppRole authentication
    if (this.config.roleId && this.config.secretId) {
      await this.authenticateAppRole();
      return;
    }

    // Try Kubernetes authentication
    if (this.config.kubernetesRole) {
      await this.authenticateKubernetes();
      return;
    }

    // Use provided token or fail
    if (!this.config.token) {
      throw new VaultError('NO_AUTH', 'No authentication method configured');
    }

    this.token = this.config.token;
  }

  /**
   * AppRole authentication
   */
  private async authenticateAppRole(): Promise<void> {
    const response = await this.request<{ auth: VaultAuthResponse }>(
      'POST',
      '/v1/auth/approle/login',
      {
        role_id: this.config.roleId,
        secret_id: this.config.secretId,
      },
      false
    );

    this.token = response.auth.client_token;
    this.tokenExpiry = new Date(Date.now() + response.auth.lease_duration * 1000);
  }

  /**
   * Kubernetes authentication
   */
  private async authenticateKubernetes(): Promise<void> {
    const jwtPath = this.config.kubernetesJwtPath || '/var/run/secrets/kubernetes.io/serviceaccount/token';
    const fs = await import('fs/promises');
    const jwt = await fs.readFile(jwtPath, 'utf-8');

    const response = await this.request<{ auth: VaultAuthResponse }>(
      'POST',
      '/v1/auth/kubernetes/login',
      {
        role: this.config.kubernetesRole,
        jwt: jwt.trim(),
      },
      false
    );

    this.token = response.auth.client_token;
    this.tokenExpiry = new Date(Date.now() + response.auth.lease_duration * 1000);
  }

  /**
   * Read a secret from Vault
   */
  async getSecret(path: string, options?: { cache?: boolean; cacheTtl?: number }): Promise<VaultSecret> {
    const cacheKey = path;
    const cached = this.secretsCache.get(cacheKey);

    if (options?.cache !== false && cached && cached.expiry > new Date()) {
      return cached.value;
    }

    await this.authenticate();

    const response = await this.request<{ data: VaultSecret }>(
      'GET',
      `/v1/secret/data/${path}`
    );

    const secret = response.data;

    // Cache the secret
    if (options?.cache !== false) {
      const ttl = options?.cacheTtl || 300000; // 5 minutes default
      this.secretsCache.set(cacheKey, {
        value: secret,
        expiry: new Date(Date.now() + ttl),
      });
    }

    return secret;
  }

  /**
   * Get a specific key from a secret
   */
  async getSecretKey(path: string, key: string): Promise<string | null> {
    const secret = await this.getSecret(path);
    return secret.data.data?.[key] || null;
  }

  /**
   * Write a secret to Vault
   */
  async putSecret(path: string, data: Record<string, string>): Promise<VaultSecret> {
    await this.authenticate();

    const response = await this.request<{ data: VaultSecret }>(
      'POST',
      `/v1/secret/data/${path}`,
      { data }
    );

    // Invalidate cache
    this.secretsCache.delete(path);

    return response.data;
  }

  /**
   * Delete a secret
   */
  async deleteSecret(path: string): Promise<void> {
    await this.authenticate();
    await this.request('DELETE', `/v1/secret/data/${path}`);
    this.secretsCache.delete(path);
  }

  /**
   * List secrets at a path
   */
  async listSecrets(path: string): Promise<string[]> {
    await this.authenticate();

    const response = await this.request<{ data: { keys: string[] } }>(
      'LIST',
      `/v1/secret/metadata/${path}`
    );

    return response.data.keys;
  }

  /**
   * Generate dynamic database credentials
   */
  async getDatabaseCredentials(role: string): Promise<{
    username: string;
    password: string;
    leaseId: string;
    leaseDuration: number;
  }> {
    await this.authenticate();

    const response = await this.request<{
      data: { username: string; password: string };
      lease_id: string;
      lease_duration: number;
    }>('GET', `/v1/database/creds/${role}`);

    return {
      username: response.data.username,
      password: response.data.password,
      leaseId: response.lease_id,
      leaseDuration: response.lease_duration,
    };
  }

  /**
   * Encrypt data using Transit secrets engine
   */
  async encrypt(keyName: string, plaintext: string): Promise<string> {
    await this.authenticate();

    const base64Plaintext = Buffer.from(plaintext).toString('base64');

    const response = await this.request<{ data: { ciphertext: string } }>(
      'POST',
      `/v1/transit/encrypt/${keyName}`,
      { plaintext: base64Plaintext }
    );

    return response.data.ciphertext;
  }

  /**
   * Decrypt data using Transit secrets engine
   */
  async decrypt(keyName: string, ciphertext: string): Promise<string> {
    await this.authenticate();

    const response = await this.request<{ data: { plaintext: string } }>(
      'POST',
      `/v1/transit/decrypt/${keyName}`,
      { ciphertext }
    );

    return Buffer.from(response.data.plaintext, 'base64').toString();
  }

  /**
   * Renew token lease
   */
  async renewToken(): Promise<void> {
    if (!this.token) return;

    const response = await this.request<{ auth: VaultAuthResponse }>(
      'POST',
      '/v1/auth/token/renew-self'
    );

    this.tokenExpiry = new Date(Date.now() + response.auth.lease_duration * 1000);
  }

  /**
   * Check Vault health
   */
  async healthCheck(): Promise<{
    initialized: boolean;
    sealed: boolean;
    standby: boolean;
    version: string;
  }> {
    const response = await fetch(`${this.config.address}/v1/sys/health`, {
      method: 'GET',
    });

    const data = await response.json();

    return {
      initialized: data.initialized,
      sealed: data.sealed,
      standby: data.standby,
      version: data.version,
    };
  }

  /**
   * Clear secrets cache
   */
  clearCache(): void {
    this.secretsCache.clear();
  }

  /**
   * Make HTTP request to Vault
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    authenticated: boolean = true
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (authenticated && this.token) {
      headers['X-Vault-Token'] = this.token;
    }

    if (this.config.namespace) {
      headers['X-Vault-Namespace'] = this.config.namespace;
    }

    const url = `${this.config.address}${path}`;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= (this.config.retries || 0); attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(
          () => controller.abort(),
          this.config.timeout || 30000
        );

        const response = await fetch(url, {
          method: method === 'LIST' ? 'GET' : method,
          headers: method === 'LIST' ? { ...headers, 'X-Vault-Request': 'true' } : headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new VaultError(
            `HTTP_${response.status}`,
            error.errors?.[0] || response.statusText,
            response.status
          );
        }

        return (await response.json()) as T;
      } catch (error) {
        lastError = error as Error;

        if (attempt < (this.config.retries || 0)) {
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * Math.pow(2, attempt))
          );
        }
      }
    }

    throw lastError;
  }
}

// =============================================================================
// Error Class
// =============================================================================

export class VaultError extends Error {
  constructor(
    public code: string,
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = 'VaultError';
  }
}

// =============================================================================
// Singleton & Helper Functions
// =============================================================================

let vaultClient: VaultClient | null = null;

export function getVaultClient(config?: Partial<VaultConfig>): VaultClient {
  if (!vaultClient) {
    vaultClient = new VaultClient(config);
  }
  return vaultClient;
}

/**
 * Load secrets from Vault into environment variables
 */
export async function loadSecretsToEnv(
  paths: string[],
  options?: { prefix?: string; overwrite?: boolean }
): Promise<void> {
  const client = getVaultClient();

  for (const path of paths) {
    const secret = await client.getSecret(path);

    for (const [key, value] of Object.entries(secret.data.data || {})) {
      const envKey = options?.prefix ? `${options.prefix}${key}` : key;

      if (options?.overwrite || !process.env[envKey]) {
        process.env[envKey] = value;
      }
    }
  }
}

/**
 * Create a connection string with dynamic credentials
 */
export async function getDynamicConnectionString(
  template: string,
  role: string
): Promise<{ connectionString: string; leaseId: string; leaseDuration: number }> {
  const client = getVaultClient();
  const creds = await client.getDatabaseCredentials(role);

  const connectionString = template
    .replace('{{username}}', creds.username)
    .replace('{{password}}', creds.password);

  return {
    connectionString,
    leaseId: creds.leaseId,
    leaseDuration: creds.leaseDuration,
  };
}
