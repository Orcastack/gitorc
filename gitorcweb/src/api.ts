export type Provider = {
  id: string;
  name: string;
  status: string;
  repos: number;
  latency: string;
  identity: string;
  connected: boolean;
};

export type Repository = {
  id: string;
  provider_id: string;
  name: string;
  branch: string;
  default_branch: string;
  commit: string;
  last_commit_at: string;
  reviewer: string;
  summary: string;
  clone_url: string;
  identity: string;
  security: SecurityState;
};

export type SecurityState = {
  ldap_registered: boolean;
  rbac_verified: boolean;
  attestation_signed: boolean;
  verified: boolean;
};

export type CloneOperation = {
  repository_id: string;
  status: string;
  clone_url: string;
  command: string;
  upi: string;
  updated_at: string;
};

export type Review = {
  id: string;
  repository_id: string;
  title: string;
  status: string;
  required_approvals: number;
  approvals: number;
  reviewers: string[];
  last_updated: string;
};

export type Pipeline = {
  id: string;
  repository_id: string;
  name: string;
  branch: string;
  last_run: string;
  status: string;
  stages: PipelineStage[];
  run_history: PipelineRun[];
  log_channel: string;
  upi: string;
  security: SecurityState;
  updated_at: string;
};

export type PipelineStage = {
  name: string;
  status: string;
};

export type PipelineRun = {
  id: string;
  started_at: string;
  status: string;
  trigger: string;
};

export type Deployment = {
  id: string;
  repository_id: string;
  service_name: string;
  version: string;
  environment: string;
  status: string;
  cluster: string;
  artifact: string;
  target_commit: string;
  previous_version: string;
  log_channel: string;
  upi: string;
  security: SecurityState;
};

export type Container = {
  name: string;
  upi: string;
  state: string;
  host: string;
  actions: string[];
  cpu: string;
  memory: string;
  restarts: number;
  metrics_url: string;
  log_channel: string;
  security: SecurityState;
};

export type DashboardSecurity = {
  repository_identity: string;
  ui_process_identity: string;
  directory: SecurityState;
};

export type EventEntry = {
  id: string;
  time: string;
  component: string;
  kind: string;
  repository_id: string;
  action: string;
  result: string;
  upi: string;
  summary: string;
};

export type Metric = {
  label: string;
  value: string;
  hint: string;
};

export type Overview = {
  providers: Provider[];
  repositories: Repository[];
  clone_operations: CloneOperation[];
  reviews: Review[];
  pipelines: Pipeline[];
  deployments: Deployment[];
  containers: Container[];
  security: DashboardSecurity;
  events: EventEntry[];
  updated_at: string;
  metrics: Metric[];
  activity: string[];
};

export type RepositoryMutationResult = {
  repository: Repository;
  clone_operation: CloneOperation;
};

export type CreateRepositoryInput = {
  name: string;
  summary: string;
  defaultBranch: string;
};

export type ImportRepositoryInput = {
  name: string;
  summary: string;
  defaultBranch: string;
  sourceUrl: string;
};

const configuredGatewayBase = import.meta.env.VITE_GITORC_GATEWAY_URL;

function isLocalHostname(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function shouldUseStaticOverview() {
  if (configuredGatewayBase) {
    return false;
  }

  if (typeof window === 'undefined') {
    return false;
  }

  return !isLocalHostname(window.location.hostname);
}

function resolveGatewayCandidates() {
  if (configuredGatewayBase) {
    return [configuredGatewayBase];
  }

  if (typeof window === 'undefined') {
    return ['http://localhost:8080', 'http://localhost:18080'];
  }

  if (isLocalHostname(window.location.hostname)) {
    return ['http://localhost:8080', 'http://localhost:18080'];
  }

  return [];
}

const gatewayCandidates = resolveGatewayCandidates();

let lastResolvedGatewayBase = gatewayCandidates[0] ?? 'gateway unavailable';

async function requestGateway<T>(path: string, init?: RequestInit): Promise<T> {
  let lastError: Error | null = null;

  for (const base of gatewayCandidates) {
    try {
      const response = await fetch(`${base}${path}`, init);
      if (!response.ok) {
        let message = `Gateway returned ${response.status}`;
        try {
          const errorPayload = await response.json() as { error?: string };
          if (errorPayload.error) {
            message = errorPayload.error;
          }
        } catch {
          // fall through to the default status message
        }
        throw new Error(message);
      }

      lastResolvedGatewayBase = base;
      return response.json() as Promise<T>;
    } catch (error) {
      if (init?.signal?.aborted) {
        throw error;
      }
      lastError = error instanceof Error ? error : new Error('Unknown gateway error');
    }
  }

  throw lastError ?? new Error('Failed to reach any configured gateway endpoint');
}

export async function fetchOverview(signal?: AbortSignal): Promise<Overview> {
  return requestGateway<Overview>('/api/overview', { signal });
}

export async function createRepository(input: CreateRepositoryInput): Promise<RepositoryMutationResult> {
  return requestGateway<RepositoryMutationResult>('/api/repositories', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: input.name,
      summary: input.summary,
      default_branch: input.defaultBranch,
    }),
  });
}

export async function importRepository(input: ImportRepositoryInput): Promise<RepositoryMutationResult> {
  return requestGateway<RepositoryMutationResult>('/api/repositories/import', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: input.name,
      summary: input.summary,
      default_branch: input.defaultBranch,
      source_url: input.sourceUrl,
    }),
  });
}

export function getGatewayBase() {
  return lastResolvedGatewayBase;
}

export function isStaticOverviewMode() {
  return shouldUseStaticOverview();
}

export { configuredGatewayBase as gatewayBase, gatewayCandidates };