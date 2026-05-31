import React, { useEffect, useMemo, useState } from 'react';

import {
  createRepository,
  fetchOverview,
  getGatewayBase,
  importRepository,
  isStaticOverviewMode,
  type CreateRepositoryInput,
  type CloneOperation,
  type Container,
  type Deployment,
  type EventEntry,
  type ImportRepositoryInput,
  type Overview,
  type Pipeline,
  type Repository,
  type RepositoryMutationResult,
  type Review,
  type SecurityState,
} from './api';

const capabilityCards = [
  {
    name: 'Repository Governance',
    role: 'Unify owned Git, provider federation, branch policy, and change control under a single operating model.',
  },
  {
    name: 'Review Enforcement',
    role: 'Tie approvals, policy checks, and merge decisions directly to platform-defined release gates.',
  },
  {
    name: 'Pipeline Orchestration',
    role: 'Coordinate CI execution, artifact traceability, and promotion readiness across delivery lanes.',
  },
  {
    name: 'Release Control',
    role: 'Drive staged deployments, rollback discipline, and environment accountability from one control surface.',
  },
  {
    name: 'Runtime Trust',
    role: 'Expose signed identities, attestation status, and operational evidence for platform actions.',
  },
  {
    name: 'Operational Visibility',
    role: 'Surface platform state, event flow, and security posture for engineering and release teams.',
  },
];

const proofPoints = [
  'Owned control plane for repository, review, CI/CD, and runtime policy.',
  'Designed for private infrastructure, regulated teams, and high-assurance delivery environments.',
  'Separates public product communication from authenticated operator workflows.',
];

const platformPillars = [
  {
    title: 'Repository ownership',
    description: 'Manage source of truth, provider connectivity, and branch governance without fragmenting control across multiple tools.',
  },
  {
    title: 'Delivery policy',
    description: 'Promote builds through review-aware pipelines and controlled deployment lanes with clear operational accountability.',
  },
  {
    title: 'Trust and evidence',
    description: 'Connect runtime identity, signatures, and operational events so teams can explain not just what changed, but why it was authorized.',
  },
];

const audienceCards = [
  {
    title: 'Platform engineering',
    description: 'Standardize repository workflows, internal controls, and release mechanics across teams and environments.',
  },
  {
    title: 'Security and compliance',
    description: 'Add operational evidence, identity-aware approval flows, and auditable release behavior to the DevOps lifecycle.',
  },
  {
    title: 'Delivery leadership',
    description: 'Create one place to understand software change, deployment readiness, and runtime accountability.',
  },
];

const routeTabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'repositories', label: 'Repositories' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'pipelines', label: 'Pipelines' },
  { id: 'deployments', label: 'Deployments' },
  { id: 'containers', label: 'Containers' },
] as const;

type RouteName = (typeof routeTabs)[number]['id'];

type RouteState = {
  name: RouteName;
  repositoryId?: string;
};

type FocusState =
  | { kind: 'repository'; id: string }
  | { kind: 'pipeline'; id: string }
  | { kind: 'deployment'; id: string }
  | { kind: 'process'; id: string };

type PublicPage = 'home' | 'signin';

type ProjectFormMode = 'closed' | 'create' | 'import';

type ProjectDraft = {
  name: string;
  summary: string;
  defaultBranch: string;
  sourceUrl: string;
};

const emptyProjectDraft: ProjectDraft = {
  name: '',
  summary: '',
  defaultBranch: 'main',
  sourceUrl: '',
};

function readPublicPage(): PublicPage {
  if (typeof window === 'undefined') {
    return 'home';
  }

  const hash = window.location.hash.replace(/^#/, '');
  return hash.startsWith('/signin') ? 'signin' : 'home';
}

function readRoute(): RouteState {
  const hash = window.location.hash.replace(/^#/, '') || '/overview';
  const [pathPart, queryPart] = hash.split('?');
  const route = pathPart.replace(/^\//, '') as RouteName;
  const params = new URLSearchParams(queryPart || '');

  return {
    name: routeTabs.some((item) => item.id === route) ? route : 'overview',
    repositoryId: params.get('repo') || undefined,
  };
}

function toHash(name: RouteName, repositoryId?: string) {
  if (!repositoryId) {
    return `#/${name}`;
  }

  const params = new URLSearchParams({ repo: repositoryId });
  return `#/${name}?${params.toString()}`;
}

function formatStatus(status: string) {
  return status.replace(/-/g, ' ');
}

function formatTime(value: string) {
  return new Date(value).toLocaleString();
}

function statusClass(status: string) {
  if (['running', 'passed', 'completed', 'connected', 'primary', 'success', 'verified'].includes(status)) {
    return 'tone-success';
  }
  if (['pending', 'queued', 'ready', 'review-gated', 'standby'].includes(status)) {
    return 'tone-warn';
  }
  if (['failed', 'crashed', 'blocked', 'rolling-back', 'changes-requested', 'stopped'].includes(status)) {
    return 'tone-danger';
  }
  return 'tone-neutral';
}

function securityLabel(security: SecurityState) {
  return security.verified ? 'verified' : 'attention required';
}

function hasWorkspaceData(overview: Overview | null) {
  if (!overview) {
    return false;
  }

  return [
    overview.providers.length,
    overview.repositories.length,
    overview.reviews.length,
    overview.pipelines.length,
    overview.deployments.length,
    overview.containers.length,
    overview.events.length,
  ].some((count) => count > 0);
}

export function App() {
  const publicLandingMode = isStaticOverviewMode();
  const [route, setRoute] = useState<RouteState>(() => readRoute());
  const [publicPage, setPublicPage] = useState<PublicPage>(() => readPublicPage());
  const [overview, setOverview] = useState<Overview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState<FocusState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [eventKindFilter, setEventKindFilter] = useState<'all' | 'repository' | 'pipeline' | 'deployment' | 'process'>('all');
  const [eventRepositoryFilter, setEventRepositoryFilter] = useState<string>('all');
  const [activeGatewayBase, setActiveGatewayBase] = useState(getGatewayBase());
  const [projectFormMode, setProjectFormMode] = useState<ProjectFormMode>('closed');
  const [projectDraft, setProjectDraft] = useState<ProjectDraft>(emptyProjectDraft);
  const [isSubmittingProject, setIsSubmittingProject] = useState(false);
  const workspaceHasData = hasWorkspaceData(overview);

  const loadOverview = async (signal?: AbortSignal) => {
    const payload = await fetchOverview(signal);
    setOverview(payload);
    setActiveGatewayBase(getGatewayBase());
    setError(null);
    return payload;
  };

  useEffect(() => {
    const onHashChange = () => {
      setRoute(readRoute());
      setPublicPage(readPublicPage());
    };

    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    let active = true;
    let interval: number | undefined;

    if (publicLandingMode) {
      setIsLoading(false);
      setError(null);
      return () => {
        active = false;
      };
    }

    const refresh = async () => {
      try {
        const payload = await fetchOverview();
        if (!active) {
          return;
        }
        setOverview(payload);
        setActiveGatewayBase(getGatewayBase());
        setError(null);
      } catch (fetchError) {
        if (!active) {
          return;
        }
        setError(fetchError instanceof Error ? fetchError.message : 'Unknown gateway error');
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void refresh();
    interval = window.setInterval(() => {
      void refresh();
    }, 8000);

    return () => {
      active = false;
      if (interval) {
        window.clearInterval(interval);
      }
    };
  }, [publicLandingMode]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const selectedRepository = useMemo(() => {
    if (!overview) {
      return null;
    }

    return (
      overview.repositories.find((repository) => repository.id === route.repositoryId) ?? overview.repositories[0] ?? null
    );
  }, [overview, route.repositoryId]);

  const selectedReview = useMemo(() => {
    if (!overview || !selectedRepository) {
      return null;
    }

    return overview.reviews.find((review) => review.repository_id === selectedRepository.id) ?? null;
  }, [overview, selectedRepository]);

  const selectedPipeline = useMemo(() => {
    if (!overview || !selectedRepository) {
      return null;
    }

    return overview.pipelines.find((pipeline) => pipeline.repository_id === selectedRepository.id) ?? null;
  }, [overview, selectedRepository]);

  const selectedDeployment = useMemo(() => {
    if (!overview || !selectedRepository) {
      return null;
    }

    return overview.deployments.find((deployment) => deployment.repository_id === selectedRepository.id) ?? null;
  }, [overview, selectedRepository]);

  const selectedClone = useMemo(() => {
    if (!overview || !selectedRepository) {
      return null;
    }

    return overview.clone_operations.find((operation) => operation.repository_id === selectedRepository.id) ?? null;
  }, [overview, selectedRepository]);

  const selectedContainer = useMemo(() => {
    if (!overview) {
      return null;
    }

    if (focus?.kind === 'process') {
      return overview.containers.find((container) => container.name === focus.id) ?? overview.containers[0] ?? null;
    }

    return overview.containers[0] ?? null;
  }, [focus, overview]);

  const focusedSecurity = useMemo(() => {
    if (!overview || !selectedRepository) {
      return null;
    }

    if (focus?.kind === 'deployment') {
      const deployment = overview.deployments.find((item) => item.id === focus.id);
      if (deployment) {
        return {
          label: `${deployment.service_name} deployment`,
          upi: deployment.upi,
          security: deployment.security,
          detail: `${deployment.environment} • ${deployment.version}`,
        };
      }
    }

    if (focus?.kind === 'pipeline') {
      const pipeline = overview.pipelines.find((item) => item.id === focus.id);
      if (pipeline) {
        return {
          label: `${pipeline.name} pipeline`,
          upi: pipeline.upi,
          security: pipeline.security,
          detail: `${pipeline.branch} • ${formatStatus(pipeline.status)}`,
        };
      }
    }

    if (focus?.kind === 'process') {
      const container = overview.containers.find((item) => item.name === focus.id);
      if (container) {
        return {
          label: `${container.name} process`,
          upi: container.upi,
          security: container.security,
          detail: `${container.host} • ${formatStatus(container.state)}`,
        };
      }
    }

    return {
      label: `${selectedRepository.name} repository`,
      upi: selectedRepository.identity,
      security: selectedRepository.security,
      detail: `${selectedRepository.provider_id} • ${selectedRepository.default_branch}`,
    };
  }, [focus, overview, selectedRepository]);

  const filteredEvents = useMemo(() => {
    if (!overview) {
      return [];
    }

    return overview.events.filter((event) => {
      const matchesKind = eventKindFilter === 'all' || event.kind === eventKindFilter;
      const matchesRepository = eventRepositoryFilter === 'all' || event.repository_id === eventRepositoryFilter;
      return matchesKind && matchesRepository;
    });
  }, [eventKindFilter, eventRepositoryFilter, overview]);

  const navigateTo = (name: RouteName, repositoryId?: string) => {
    window.location.hash = toHash(name, repositoryId);
    setRoute({ name, repositoryId });
  };

  const navigatePublic = (page: PublicPage) => {
    window.location.hash = page === 'signin' ? '#/signin' : '#/';
    setPublicPage(page);
  };

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setToast(`${label} copied to clipboard.`);
    } catch {
      setToast(`${label}: ${value}`);
    }
  };

  const pushCommandForRepository = (repository: Repository, operation: CloneOperation | null) => {
    const remote = operation?.clone_url || repository.clone_url;
    return `git remote add origin ${remote} && git push -u origin ${repository.default_branch}`;
  };

  const openProjectForm = (mode: ProjectFormMode) => {
    setProjectFormMode(mode);
    setProjectDraft(emptyProjectDraft);
  };

  const closeProjectForm = () => {
    setProjectFormMode('closed');
    setProjectDraft(emptyProjectDraft);
  };

  const handleProjectFieldChange = (field: keyof ProjectDraft, value: string) => {
    setProjectDraft((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleProjectSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (projectFormMode === 'closed') {
      return;
    }

    setIsSubmittingProject(true);
    try {
      let result: RepositoryMutationResult;
      if (projectFormMode === 'create') {
        const payload: CreateRepositoryInput = {
          name: projectDraft.name,
          summary: projectDraft.summary,
          defaultBranch: projectDraft.defaultBranch,
        };
        result = await createRepository(payload);
      } else {
        const payload: ImportRepositoryInput = {
          name: projectDraft.name,
          summary: projectDraft.summary,
          defaultBranch: projectDraft.defaultBranch,
          sourceUrl: projectDraft.sourceUrl,
        };
        result = await importRepository(payload);
      }

      await loadOverview();
      setFocus({ kind: 'repository', id: result.repository.id });
      navigateTo('repositories', result.repository.id);
      closeProjectForm();
      setToast(projectFormMode === 'create' ? `Project ${result.repository.name} created.` : `Repository ${result.repository.name} imported.`);
    } catch (submitError) {
      setToast(submitError instanceof Error ? submitError.message : 'Project operation failed.');
    } finally {
      setIsSubmittingProject(false);
    }
  };

  const handleRepositoryAction = async (repository: Repository, operation: CloneOperation | null, action: 'clone' | 'push' | 'review') => {
    setFocus({ kind: 'repository', id: repository.id });
    navigateTo('repositories', repository.id);

    if (action === 'clone') {
      await copyText(`git clone ${operation?.clone_url || repository.clone_url}`, 'Clone command');
      return;
    }

    if (action === 'push') {
      await copyText(pushCommandForRepository(repository, operation), 'Push command');
      return;
    }

    if (action === 'review') {
      setToast(`Opening review board for ${repository.name}.`);
      navigateTo('reviews', repository.id);
    }
  };

  const handlePipelineAction = (pipeline: Pipeline, action: 'overview' | 'history' | 'logs') => {
    setFocus({ kind: 'pipeline', id: pipeline.id });
    navigateTo('pipelines', pipeline.repository_id);
    setToast(
      action === 'overview'
        ? `Showing pipeline summary for ${pipeline.name}.`
        : action === 'history'
          ? `Showing run history for ${pipeline.name}.`
          : `Log channel: ${pipeline.log_channel}`,
    );
  };

  const handleDeploymentAction = (deployment: Deployment, action: 'details' | 'history' | 'logs') => {
    setFocus({ kind: 'deployment', id: deployment.id });
    navigateTo('deployments', deployment.repository_id);
    setToast(
      action === 'details'
        ? `Showing release details for ${deployment.service_name}.`
        : action === 'history'
          ? `Showing release history for ${deployment.service_name}.`
          : `Deployment channel: ${deployment.log_channel}`,
    );
  };

  const handleContainerAction = (container: Container, action: string) => {
    setFocus({ kind: 'process', id: container.name });
    navigateTo('containers', selectedRepository?.id);
    setToast(`${container.name}: ${action} selected.`);
  };

  const renderRepositoriesPanel = () => {
    if (!overview || !selectedRepository) {
      return null;
    }

    return (
      <section className="panel stack-panel dashboard-block">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Repositories & clone panel</p>
            <h2>Connected source inventory and clone intents</h2>
          </div>
          <span className="status-badge status-primary">Live from gateway</span>
        </div>

        <div className="provider-grid">
          {overview.providers.map((provider) => (
            <article key={provider.id} className="provider-card">
              <div className="provider-row">
                <strong>{provider.name}</strong>
                <span className={`mini-badge ${statusClass(provider.status)}`}>{formatStatus(provider.status)}</span>
              </div>
              <span>{provider.repos} repositories</span>
              <span>{provider.latency} latency</span>
              <span className="identity-chip">{provider.identity}</span>
            </article>
          ))}
        </div>

        <div className="entity-grid entity-grid-wide">
          <div className="repo-list">
            {overview.repositories.map((repository) => {
              const operation = overview.clone_operations.find((item) => item.repository_id === repository.id) ?? null;

              return (
                <article key={repository.id} className={`repo-card ${selectedRepository.id === repository.id ? 'repo-card-active' : ''}`}>
                  <div className="provider-row">
                    <strong>{repository.name}</strong>
                    <span className={`mini-badge ${statusClass(operation?.status || 'pending')}`}>{formatStatus(operation?.status || 'pending')}</span>
                  </div>
                  <p>{repository.summary}</p>
                  <div className="repo-meta">
                    <span>{repository.provider_id}</span>
                    <span>{repository.default_branch}</span>
                    <span>{repository.commit}</span>
                    <span>{formatTime(repository.last_commit_at)}</span>
                  </div>
                  <div className="action-row">
                    <button className="button button-primary" onClick={() => void handleRepositoryAction(repository, operation, 'clone')} type="button">Clone</button>
                    <button className="button button-ghost" onClick={() => void handleRepositoryAction(repository, operation, 'push')} type="button">Push</button>
                    <button className="button button-ghost" onClick={() => void handleRepositoryAction(repository, operation, 'review')} type="button">Open review</button>
                  </div>
                </article>
              );
            })}
          </div>

          <article className="trace-card detail-card">
            <p className="section-kicker">Selected repository remote</p>
            <h3>{selectedRepository.name}</h3>
            <ul>
              <li>Clone URL: {selectedClone?.clone_url || selectedRepository.clone_url}</li>
              <li>Clone command: {selectedClone?.command || `git clone ${selectedRepository.clone_url}`}</li>
              <li>Push command: {pushCommandForRepository(selectedRepository, selectedClone)}</li>
              <li>Status: {formatStatus(selectedClone?.status || 'pending')}</li>
              <li>UPI: {selectedClone?.upi || selectedRepository.identity}</li>
              <li>Default branch: {selectedRepository.default_branch}</li>
            </ul>
          </article>
        </div>
      </section>
    );
  };

  const renderGitlabOverview = () => {
    if (!overview || !selectedRepository) {
      return null;
    }

    return (
      <section className="gitlab-shell">
        <aside className="gitlab-sidebar panel">
          <div className="sidebar-group">
            <p className="section-kicker">Workspace sections</p>
            {routeTabs.map((tab) => (
              <button
                key={tab.id}
                className={`button ${route.name === tab.id ? 'button-primary' : 'button-ghost'} sidebar-button`}
                onClick={() => navigateTo(tab.id, selectedRepository.id)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="sidebar-group">
            <p className="section-kicker">Tracked projects</p>
            <div className="project-nav-list">
              {overview.repositories.map((repository) => (
                <button
                  key={repository.id}
                  className={`project-nav-item ${selectedRepository.id === repository.id ? 'project-nav-item-active' : ''}`}
                  onClick={() => {
                    setFocus({ kind: 'repository', id: repository.id });
                    navigateTo('overview', repository.id);
                  }}
                  type="button"
                >
                  <strong>{repository.name}</strong>
                  <span>{repository.provider_id}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="gitlab-main">
          <section className="gitlab-header panel">
            <div>
              <p className="eyebrow">operator workspace</p>
              <h2>Connected repositories, delivery flow, runtime state, and trust records</h2>
              <p className="lede">This workspace reflects what the gateway currently knows about your repositories, review flow, delivery state, runtime services, and signed platform evidence.</p>
            </div>
            <div className="header-actions">
              <button className="button button-primary" onClick={() => openProjectForm('create')} type="button">
                Create project
              </button>
              <button className="button button-ghost" onClick={() => openProjectForm('import')} type="button">
                Import Git repository
              </button>
              <button className="button button-primary" onClick={() => navigateTo('repositories', selectedRepository.id)} type="button">
                Repositories
              </button>
              <button className="button button-ghost" onClick={() => navigateTo('pipelines', selectedRepository.id)} type="button">
                Pipelines
              </button>
              <button className="button button-ghost" onClick={() => navigateTo('deployments', selectedRepository.id)} type="button">
                Deployments
              </button>
            </div>
          </section>

          <section className="metrics-grid metrics-grid-compact">
            {overview.metrics.map((metric) => (
              <article key={metric.label} className="metric-card metric-card-compact">
                <p>{metric.label}</p>
                <strong>{metric.value}</strong>
                <span>{metric.hint}</span>
              </article>
            ))}
          </section>

          <section className="panel stack-panel dashboard-block">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Project inventory</p>
                <h2>Repositories and gateway actions</h2>
              </div>
              <span className="status-badge status-primary">Updated {formatTime(overview.updated_at)}</span>
            </div>

            <div className="table-shell">
              <div className="table-head table-projects">
                <span>Project</span>
                <span>Provider</span>
                <span>Default branch</span>
                <span>Last commit</span>
                <span>Clone</span>
                <span>Actions</span>
              </div>
              {overview.repositories.map((repository) => {
                const operation = overview.clone_operations.find((item) => item.repository_id === repository.id) ?? null;

                return (
                  <div key={repository.id} className={`table-row table-projects ${selectedRepository.id === repository.id ? 'table-row-active' : ''}`}>
                    <div>
                      <strong>{repository.name}</strong>
                      <p>{repository.summary}</p>
                    </div>
                    <span>{repository.provider_id}</span>
                    <span>{repository.default_branch}</span>
                    <span>{repository.commit}</span>
                    <span className={`mini-badge ${statusClass(operation?.status || 'pending')}`}>{formatStatus(operation?.status || 'pending')}</span>
                    <div className="table-actions">
                      <button className="button button-primary" onClick={() => void handleRepositoryAction(repository, operation, 'clone')} type="button">Clone</button>
                      <button className="button button-ghost" onClick={() => void handleRepositoryAction(repository, operation, 'push')} type="button">Push</button>
                      <button className="button button-ghost" onClick={() => void handleRepositoryAction(repository, operation, 'review')} type="button">Review</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="gitlab-grid-two">
            <section className="panel stack-panel dashboard-block">
              <div className="section-heading">
                <div>
                  <p className="section-kicker">Deployments</p>
                  <h2>Environment rollout status</h2>
                </div>
              </div>
              <div className="table-shell">
                <div className="table-head table-deployments">
                  <span>Service</span>
                  <span>Version</span>
                  <span>Environment</span>
                  <span>Status</span>
                  <span>Actions</span>
                </div>
                {overview.deployments.map((deployment) => (
                  <div key={deployment.id} className={`table-row table-deployments ${selectedDeployment?.id === deployment.id ? 'table-row-active' : ''}`}>
                    <span>{deployment.service_name}</span>
                    <span>{deployment.version}</span>
                    <span>{deployment.environment}</span>
                    <span className={`mini-badge ${statusClass(deployment.status)}`}>{formatStatus(deployment.status)}</span>
                    <div className="table-actions">
                      <button className="button button-ghost" onClick={() => handleDeploymentAction(deployment, 'details')} type="button">Details</button>
                      <button className="button button-ghost" onClick={() => handleDeploymentAction(deployment, 'logs')} type="button">Logs</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel stack-panel dashboard-block">
              <div className="section-heading">
                <div>
                  <p className="section-kicker">Pipelines / CI</p>
                  <h2>Recent pipeline health</h2>
                </div>
              </div>
              <div className="table-shell">
                <div className="table-head table-pipelines">
                  <span>Pipeline</span>
                  <span>Branch</span>
                  <span>Last run</span>
                  <span>Status</span>
                  <span>Actions</span>
                </div>
                {overview.pipelines.map((pipeline) => (
                  <div key={pipeline.id} className={`table-row table-pipelines ${selectedPipeline?.id === pipeline.id ? 'table-row-active' : ''}`}>
                    <div>
                      <strong>{pipeline.name}</strong>
                      <p>{pipeline.repository_id}</p>
                    </div>
                    <span>{pipeline.branch}</span>
                    <span>{formatTime(pipeline.last_run)}</span>
                    <span className={`mini-badge ${statusClass(pipeline.status)}`}>{formatStatus(pipeline.status)}</span>
                    <div className="table-actions">
                      <button className="button button-ghost" onClick={() => handlePipelineAction(pipeline, 'overview')} type="button">Summary</button>
                      <button className="button button-ghost" onClick={() => handlePipelineAction(pipeline, 'logs')} type="button">Logs</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </section>

          <section className="gitlab-grid-two">
            <section className="panel stack-panel dashboard-block">
              <div className="section-heading">
                <div>
                  <p className="section-kicker">Live processes & containers</p>
                  <h2>Runtime monitor</h2>
                </div>
              </div>
              <div className="table-shell">
                <div className="table-head table-processes">
                  <span>Process</span>
                  <span>UPI</span>
                  <span>Host</span>
                  <span>Status</span>
                  <span>Metrics</span>
                </div>
                {overview.containers.map((container) => (
                  <div key={container.name} className={`table-row table-processes ${selectedContainer?.name === container.name ? 'table-row-active' : ''}`}>
                    <span>{container.name}</span>
                    <span className="table-code">{container.upi}</span>
                    <span>{container.host}</span>
                    <span className={`mini-badge ${statusClass(container.state)}`}>{formatStatus(container.state)}</span>
                    <button className="button button-ghost" onClick={() => handleContainerAction(container, 'metrics')} type="button">Open metrics</button>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel stack-panel dashboard-block">
              <div className="section-heading">
                <div>
                  <p className="section-kicker">Identity & security</p>
                  <h2>Trust chain for the selected subject</h2>
                </div>
              </div>
              <div className="security-panel-list">
                <article className="trace-card detail-card">
                  <h3>{focusedSecurity?.label || 'Selected subject'}</h3>
                  <ul>
                    <li>UPI: {focusedSecurity?.upi || 'Unavailable'}</li>
                    <li>Repository identity: {overview.security.repository_identity}</li>
                    <li>UI process: {overview.security.ui_process_identity}</li>
                    <li>LDAP: {focusedSecurity?.security.ldap_registered ? 'registered' : 'pending'}</li>
                    <li>RBAC: {focusedSecurity?.security.rbac_verified ? 'verified' : 'pending'}</li>
                    <li>Attestation: {focusedSecurity?.security.attestation_signed ? 'signed' : 'pending'}</li>
                  </ul>
                </article>
              </div>
            </section>
          </section>

          <section className="panel stack-panel dashboard-block">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Logs / events stream</p>
                <h2>Recent system activity</h2>
              </div>
            </div>
            <div className="filter-row">
              <label>
                Kind
                <select value={eventKindFilter} onChange={(event) => setEventKindFilter(event.target.value as typeof eventKindFilter)}>
                  <option value="all">All</option>
                  <option value="repository">Repository</option>
                  <option value="pipeline">Pipeline</option>
                  <option value="deployment">Deployment</option>
                  <option value="process">Process</option>
                </select>
              </label>
              <label>
                Repository
                <select value={eventRepositoryFilter} onChange={(event) => setEventRepositoryFilter(event.target.value)}>
                  <option value="all">All</option>
                  {overview.repositories.map((repository) => (
                    <option key={repository.id} value={repository.id}>{repository.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="events-list events-list-compact">
              {filteredEvents.map((event) => (
                <article key={event.id} className="event-row">
                  <div className="event-grid">
                    <span>{formatTime(event.time)}</span>
                    <strong>{event.component}</strong>
                    <span>{event.action}</span>
                    <span className={`mini-badge ${statusClass(event.result)}`}>{formatStatus(event.result)}</span>
                    <span className="table-code">{event.upi}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    );
  };

  const renderReviewsPanel = () => {
    if (!overview || !selectedRepository) {
      return null;
    }

    return (
      <section className="panel stack-panel dashboard-block">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Code review gate</p>
            <h2>Review state decides whether pipelines can move</h2>
          </div>
          <span className={`status-badge ${statusClass(selectedReview?.status || 'pending')}`}>{selectedReview ? formatStatus(selectedReview.status) : 'No review'}</span>
        </div>
        <div className="entity-grid">
          {overview.reviews.map((review: Review) => (
            <article key={review.id} className={`trace-card ${selectedReview?.id === review.id ? 'repo-card-active' : ''}`}>
              <div className="provider-row">
                <strong>{review.title}</strong>
                <span className={`mini-badge ${statusClass(review.status)}`}>{formatStatus(review.status)}</span>
              </div>
              <p>{review.approvals}/{review.required_approvals} approvals</p>
              <ul>
                <li>Repository: {review.repository_id}</li>
                <li>Updated: {formatTime(review.last_updated)}</li>
                <li>Reviewers: {review.reviewers.join(', ')}</li>
              </ul>
              <div className="action-row">
                <button className="button button-ghost" onClick={() => navigateTo('pipelines', review.repository_id)} type="button">Open pipeline</button>
                <button className="button button-ghost" onClick={() => setFocus({ kind: 'repository', id: review.repository_id })} type="button">Trace identity</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  };

  const renderDeploymentsPanel = () => {
    if (!overview || !selectedRepository) {
      return null;
    }

    return (
      <section className="panel stack-panel dashboard-block">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Deployments panel</p>
            <h2>Live deployment lanes across environments</h2>
          </div>
          <span className={`status-badge ${statusClass(selectedDeployment?.status || 'pending')}`}>{selectedDeployment ? formatStatus(selectedDeployment.status) : 'No deployment'}</span>
        </div>

        <div className="entity-grid entity-grid-wide">
          <div className="repo-list">
            {overview.deployments.map((deployment) => (
              <article key={deployment.id} className={`repo-card ${selectedDeployment?.id === deployment.id ? 'repo-card-active' : ''}`}>
                <div className="provider-row">
                  <strong>{deployment.service_name}</strong>
                  <span className={`mini-badge ${statusClass(deployment.status)}`}>{formatStatus(deployment.status)}</span>
                </div>
                <p>{deployment.version} → {deployment.environment}</p>
                <div className="repo-meta">
                  <span>{deployment.cluster}</span>
                  <span>{deployment.artifact}</span>
                </div>
                <div className="action-row">
                  <button className="button button-primary" onClick={() => handleDeploymentAction(deployment, 'details')} type="button">Release details</button>
                  <button className="button button-ghost" onClick={() => handleDeploymentAction(deployment, 'history')} type="button">Release history</button>
                  <button className="button button-ghost" onClick={() => handleDeploymentAction(deployment, 'details')} type="button">Details</button>
                </div>
              </article>
            ))}
          </div>

          <article className="trace-card detail-card">
            <p className="section-kicker">Selected deployment</p>
            <h3>{selectedDeployment?.service_name || selectedRepository.name}</h3>
            <ul>
              <li>Environment: {selectedDeployment?.environment || 'Unavailable'}</li>
              <li>Status: {selectedDeployment ? formatStatus(selectedDeployment.status) : 'Unavailable'}</li>
              <li>Target commit: {selectedDeployment?.target_commit || selectedRepository.commit}</li>
              <li>Previous version: {selectedDeployment?.previous_version || 'Unavailable'}</li>
              <li>Identity: {selectedDeployment?.upi || selectedRepository.identity}</li>
              <li>Log channel: {selectedDeployment?.log_channel || 'Unavailable'}</li>
            </ul>
          </article>
        </div>
      </section>
    );
  };

  const renderPipelinesPanel = () => {
    if (!overview || !selectedRepository) {
      return null;
    }

    return (
      <section className="panel stack-panel dashboard-block">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Pipelines / CI panel</p>
            <h2>Transform CI and downstream stages</h2>
          </div>
          <span className={`status-badge ${statusClass(selectedPipeline?.status || 'queued')}`}>{selectedPipeline ? formatStatus(selectedPipeline.status) : 'No pipeline'}</span>
        </div>

        <div className="entity-grid entity-grid-wide">
          <div className="repo-list">
            {overview.pipelines.map((pipeline) => (
              <article key={pipeline.id} className={`repo-card ${selectedPipeline?.id === pipeline.id ? 'repo-card-active' : ''}`}>
                <div className="provider-row">
                  <strong>{pipeline.name}</strong>
                  <span className={`mini-badge ${statusClass(pipeline.status)}`}>{formatStatus(pipeline.status)}</span>
                </div>
                <p>{pipeline.repository_id} • {pipeline.branch} • last run {formatTime(pipeline.last_run)}</p>
                <div className="stage-strip">
                  {pipeline.stages.map((stage) => (
                    <span key={stage.name} className={`stage-pill ${statusClass(stage.status)}`}>{stage.name}: {formatStatus(stage.status)}</span>
                  ))}
                </div>
                <div className="action-row">
                  <button className="button button-primary" onClick={() => handlePipelineAction(pipeline, 'overview')} type="button">Pipeline summary</button>
                  <button className="button button-ghost" onClick={() => handlePipelineAction(pipeline, 'history')} type="button">Run history</button>
                  <button className="button button-ghost" onClick={() => handlePipelineAction(pipeline, 'logs')} type="button">Logs</button>
                </div>
              </article>
            ))}
          </div>

          <article className="trace-card detail-card">
            <p className="section-kicker">Selected pipeline</p>
            <h3>{selectedPipeline?.name || 'Unavailable'}</h3>
            <ul>
              <li>Repository: {selectedPipeline?.repository_id || selectedRepository.id}</li>
              <li>UPI: {selectedPipeline?.upi || 'Unavailable'}</li>
              <li>Log channel: {selectedPipeline?.log_channel || 'Unavailable'}</li>
              <li>Status: {selectedPipeline ? formatStatus(selectedPipeline.status) : 'Unavailable'}</li>
            </ul>
            <div className="history-list">
              {(selectedPipeline?.run_history || []).map((run) => (
                <div key={run.id} className="history-row">
                  <strong>{run.id}</strong>
                  <span>{run.trigger}</span>
                  <span className={`mini-badge ${statusClass(run.status)}`}>{formatStatus(run.status)}</span>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>
    );
  };

  const renderProcessesPanel = () => {
    if (!overview || !selectedContainer) {
      return null;
    }

    return (
      <section className="panel stack-panel dashboard-block">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Live processes & containers</p>
            <h2>Runtime state, host placement, and controls</h2>
          </div>
          <span className={`status-badge ${statusClass(selectedContainer.state)}`}>{formatStatus(selectedContainer.state)}</span>
        </div>

        <div className="entity-grid entity-grid-wide">
          <div className="repo-list">
            {overview.containers.map((container) => (
              <article key={container.name} className={`repo-card ${selectedContainer.name === container.name ? 'repo-card-active' : ''}`}>
                <div className="provider-row">
                  <strong>{container.name}</strong>
                  <span className={`mini-badge ${statusClass(container.state)}`}>{formatStatus(container.state)}</span>
                </div>
                <div className="repo-meta">
                  <span>{container.upi}</span>
                  <span>{container.host}</span>
                </div>
                <p>CPU {container.cpu} • Memory {container.memory} • Restarts {container.restarts}</p>
                <div className="action-row">
                  {container.actions.map((action) => (
                    <button key={action} className="button button-ghost" onClick={() => handleContainerAction(container, action)} type="button">
                      {formatStatus(action)}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <article className="trace-card detail-card">
            <p className="section-kicker">Selected process</p>
            <h3>{selectedContainer.name}</h3>
            <ul>
              <li>UPI: {selectedContainer.upi}</li>
              <li>Host: {selectedContainer.host}</li>
              <li>Log channel: {selectedContainer.log_channel}</li>
              <li>Metrics: {selectedContainer.metrics_url}</li>
              <li>Restarts: {selectedContainer.restarts}</li>
            </ul>
          </article>
        </div>
      </section>
    );
  };

  const renderSecurityPanel = () => {
    if (!overview || !focusedSecurity) {
      return null;
    }

    return (
      <section className="panel stack-panel dashboard-block">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Identity chain & security</p>
            <h2>Known, authorized, and signed runtime subjects</h2>
          </div>
          <span className={`status-badge ${statusClass(securityLabel(focusedSecurity.security))}`}>{securityLabel(focusedSecurity.security)}</span>
        </div>

        <div className="trace-grid security-grid">
          <article className="trace-card">
            <h3>Global identities</h3>
            <ul>
              <li>Repository identity: {overview.security.repository_identity || 'Not reported yet'}</li>
              <li>UI process identity: {overview.security.ui_process_identity || 'Not reported yet'}</li>
              <li>Updated at: {formatTime(overview.updated_at)}</li>
            </ul>
          </article>
          <article className="trace-card">
            <h3>Directory status</h3>
            <div className="security-checks">
              <span className={`stage-pill ${overview.security.directory.ldap_registered ? 'tone-success' : 'tone-danger'}`}>LDAP registered</span>
              <span className={`stage-pill ${overview.security.directory.rbac_verified ? 'tone-success' : 'tone-danger'}`}>RBAC verified</span>
              <span className={`stage-pill ${overview.security.directory.attestation_signed ? 'tone-success' : 'tone-danger'}`}>Attestation signed</span>
            </div>
          </article>
          <article className="trace-card detail-card">
            <h3>{focusedSecurity.label}</h3>
            <ul>
              <li>UPI: {focusedSecurity.upi}</li>
              <li>Context: {focusedSecurity.detail}</li>
              <li>LDAP: {focusedSecurity.security.ldap_registered ? 'registered' : 'missing'}</li>
              <li>RBAC: {focusedSecurity.security.rbac_verified ? 'verified' : 'not verified'}</li>
              <li>Signature: {focusedSecurity.security.attestation_signed ? 'signed' : 'unsigned'}</li>
            </ul>
          </article>
        </div>
      </section>
    );
  };

  const renderEventsPanel = () => {
    if (!overview) {
      return null;
    }

    return (
      <section className="panel stack-panel dashboard-block">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Logs / events stream</p>
            <h2>Recent platform activity</h2>
          </div>
          <span className="status-badge status-primary">Polling every 8s</span>
        </div>

        <div className="filter-row">
          <label>
            Kind
            <select value={eventKindFilter} onChange={(event) => setEventKindFilter(event.target.value as typeof eventKindFilter)}>
              <option value="all">All</option>
              <option value="repository">Repository</option>
              <option value="pipeline">Pipeline</option>
              <option value="deployment">Deployment</option>
              <option value="process">Process</option>
            </select>
          </label>
          <label>
            Repository
            <select value={eventRepositoryFilter} onChange={(event) => setEventRepositoryFilter(event.target.value)}>
              <option value="all">All</option>
              {overview.repositories.map((repository) => (
                <option key={repository.id} value={repository.id}>{repository.name}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="events-list">
          {filteredEvents.map((event: EventEntry) => (
            <article key={event.id} className="event-row">
              <div className="event-meta">
                <strong>{event.component}</strong>
                <span>{formatTime(event.time)}</span>
                <span className="identity-chip">{event.upi}</span>
              </div>
              <div className="event-body">
                <span className={`mini-badge ${statusClass(event.kind)}`}>{event.kind}</span>
                <span>{event.action}</span>
                <span className={`mini-badge ${statusClass(event.result)}`}>{formatStatus(event.result)}</span>
              </div>
              <p>{event.summary}</p>
            </article>
          ))}
        </div>
      </section>
    );
  };

  const renderEmptyWorkspace = () => {
    if (!overview) {
      return null;
    }

    const setupMetrics = [
      { label: 'Providers', value: String(overview.providers.length), hint: 'Connected' },
      { label: 'Projects', value: String(overview.repositories.length), hint: 'Available' },
      { label: 'Pipelines', value: String(overview.pipelines.length), hint: 'Tracked' },
      { label: 'Events', value: String(overview.events.length), hint: 'Recorded' },
    ];

    return (
      <section className="gitlab-shell">
        <aside className="gitlab-sidebar panel">
          <div className="sidebar-group">
            <p className="section-kicker">Workspace</p>
            <span className="status-badge status-primary">Gateway connected</span>
            <button className="button button-primary sidebar-button" onClick={() => openProjectForm('create')} type="button">
              Create project
            </button>
            <button className="button button-ghost sidebar-button" onClick={() => openProjectForm('import')} type="button">
              Import Git repository
            </button>
          </div>
        </aside>

        <div className="gitlab-main">
          <section className="gitlab-header panel">
            <div>
              <p className="eyebrow">operator workspace</p>
              <h2>Start with a project</h2>
            </div>
            <div className="header-actions">
              <button className="button button-primary" onClick={() => openProjectForm('create')} type="button">
                Create project
              </button>
              <button className="button button-ghost" onClick={() => openProjectForm('import')} type="button">
                Import Git repository
              </button>
              <span className="status-badge status-primary">Updated {formatTime(overview.updated_at)}</span>
            </div>
          </section>

          <section className="metrics-grid metrics-grid-compact">
            {setupMetrics.map((metric) => (
              <article key={metric.label} className="metric-card metric-card-compact">
                <p>{metric.label}</p>
                <strong>{metric.value}</strong>
                <span>{metric.hint}</span>
              </article>
            ))}
          </section>

          <section className="panel stack-panel dashboard-block">
            <div className="section-heading">
              <div>
                <p className="section-kicker">First use</p>
                <h2>No projects yet</h2>
              </div>
            </div>
            <div className="trace-grid">
              <article className="trace-card">
                <h3>Import</h3>
                <p>Bring in an existing Git repository.</p>
              </article>
              <article className="trace-card">
                <h3>Create</h3>
                <p>Create a new remote and push your code.</p>
              </article>
              <article className="trace-card">
                <h3>Operate</h3>
                <p>Repositories and activity appear here after setup.</p>
              </article>
            </div>
          </section>
        </div>
      </section>
    );
  };

  const renderProjectForm = () => {
    if (publicLandingMode || projectFormMode === 'closed') {
      return null;
    }

    const title = projectFormMode === 'create' ? 'Create project' : 'Import Git repository';
    const description = projectFormMode === 'create'
      ? 'Create a new bare Git repository in the local gitorc store. After creation you can clone it and push your project into it.'
      : 'Mirror an existing Git remote into the local gitorc store so the dashboard can manage clone and push access locally.';

    return (
      <section className="panel stack-panel form-panel">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Project control</p>
            <h2>{title}</h2>
          </div>
          <span className="status-badge status-primary">Gateway: {activeGatewayBase}</span>
        </div>
        <p>{description}</p>
        <form className="project-form" onSubmit={handleProjectSubmit}>
          <div className="form-grid">
            <label className="form-field">
              <span>Project name</span>
              <input
                onChange={(event) => handleProjectFieldChange('name', event.target.value)}
                placeholder={projectFormMode === 'import' ? 'Optional, inferred from remote if empty' : 'example-project'}
                required={projectFormMode === 'create'}
                type="text"
                value={projectDraft.name}
              />
            </label>
            <label className="form-field">
              <span>Default branch</span>
              <input
                onChange={(event) => handleProjectFieldChange('defaultBranch', event.target.value)}
                placeholder="main"
                type="text"
                value={projectDraft.defaultBranch}
              />
            </label>
            {projectFormMode === 'import' ? (
              <label className="form-field form-field-wide">
                <span>Source Git URL</span>
                <input
                  onChange={(event) => handleProjectFieldChange('sourceUrl', event.target.value)}
                  placeholder="https://github.com/owner/repository.git"
                  required
                  type="text"
                  value={projectDraft.sourceUrl}
                />
              </label>
            ) : null}
            <label className="form-field form-field-wide">
              <span>Summary</span>
              <textarea
                onChange={(event) => handleProjectFieldChange('summary', event.target.value)}
                placeholder="Short description for the dashboard"
                rows={3}
                value={projectDraft.summary}
              />
            </label>
          </div>
          <div className="project-form-actions">
            <button className="button button-primary" disabled={isSubmittingProject} type="submit">
              {isSubmittingProject ? 'Working…' : title}
            </button>
            <button className="button button-ghost" onClick={closeProjectForm} type="button">
              Cancel
            </button>
          </div>
        </form>
      </section>
    );
  };

  const renderLandingPage = () => {
    return (
      <div className="landing-shell">
        <section className="hero-panel">
          <article className="panel hero-copy">
            <p className="eyebrow">gitorc platform</p>
            <h1>DevOps control for teams that need governance, delivery discipline, and runtime trust.</h1>
            <p className="lede">
              gitorc is a Git-centric DevOps platform for organizations that want stronger ownership of source control, review policy,
              CI/CD orchestration, and operational evidence across the software delivery lifecycle.
            </p>
            <div className="hero-actions">
              <button className="button button-primary" onClick={() => navigatePublic('signin')} type="button">Open control plane</button>
              <a className="button button-ghost" href="#platform">Explore platform capabilities</a>
            </div>
            <div className="badge-stack landing-badges">
              {proofPoints.map((point) => (
                <span key={point} className="status-badge status-primary">{point}</span>
              ))}
            </div>
          </article>

          <aside className="hero-side">
            <article className="identity-card">
              <div>
                <dt>Deployment model</dt>
                <dd>Built for private infrastructure where the operator surface remains inside authenticated platform boundaries.</dd>
              </div>
              <div>
                <dt>Control surface</dt>
                <dd>Repository governance, policy-driven delivery, deployment orchestration, and runtime oversight in one system.</dd>
              </div>
              <div>
                <dt>Public experience</dt>
                <dd>This page describes the platform. Operational workflows are intentionally reserved for the authenticated workspace.</dd>
              </div>
            </article>

            <article className="panel landing-panel-accent">
              <p className="section-kicker">Platform narrative</p>
              <h3>One operating model across code, delivery, and runtime assurance</h3>
              <ul>
                <li>Consolidate repository governance and delivery policy into a single control plane.</li>
                <li>Move beyond disconnected tooling with review-aware pipeline and release workflows.</li>
                <li>Connect operational decisions to verifiable identity, authorization, and evidence.</li>
              </ul>
            </article>
          </aside>
        </section>

        <section className="landing-grid landing-grid-equal">
          {platformPillars.map((pillar) => (
            <article key={pillar.title} className="metric-card landing-feature-card">
              <p className="section-kicker">Core pillar</p>
              <strong>{pillar.title}</strong>
              <span>{pillar.description}</span>
            </article>
          ))}
        </section>

        <section id="platform" className="panel stack-panel dashboard-block">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Platform capabilities</p>
              <h2>Purpose-built for serious DevOps operations</h2>
            </div>
            <span className="status-badge status-primary">Private infrastructure ready</span>
          </div>
          <div className="service-grid">
            {capabilityCards.map((service) => (
              <article key={service.name} className="service-card landing-service-card">
                <h3>{service.name}</h3>
                <p>{service.role}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-grid">
          <article className="panel stack-panel">
            <div className="section-heading compact-heading">
              <div>
                <p className="section-kicker">Authenticated workspace</p>
                <h2>What operators access inside the platform boundary</h2>
              </div>
            </div>
            <div className="trace-grid">
              <article className="trace-card">
                <h3>Repository control</h3>
                <ul>
                  <li>Connected providers and repository inventory.</li>
                  <li>Clone commands, push remotes, and review entrypoints.</li>
                  <li>Commit and branch context tied to identity records.</li>
                </ul>
              </article>
              <article className="trace-card">
                <h3>Delivery orchestration</h3>
                <ul>
                  <li>Pipeline lanes with run history and gating state.</li>
                  <li>Deployment lanes with rollback targets and artifact traceability.</li>
                  <li>Environment and cluster rollout visibility.</li>
                </ul>
              </article>
              <article className="trace-card">
                <h3>Runtime trust</h3>
                <ul>
                  <li>Process identity, LDAP registration, RBAC verification.</li>
                  <li>Attestation status for repositories, pipelines, and services.</li>
                  <li>Live event stream and container state monitoring.</li>
                </ul>
              </article>
            </div>
          </article>

          <article className="panel stack-panel">
            <div className="section-heading compact-heading">
              <div>
                <p className="section-kicker">Who it is for</p>
                <h2>Teams that need tighter operational control</h2>
              </div>
            </div>
            <div className="repo-list">
              {audienceCards.map((audience) => (
                <article key={audience.title} className="repo-card landing-audience-card">
                  <div className="provider-row">
                    <strong>{audience.title}</strong>
                  </div>
                  <p>{audience.description}</p>
                </article>
              ))}
            </div>
          </article>
        </section>

        <section className="panel stack-panel dashboard-block">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Access model</p>
              <h2>The public site introduces the platform. Operational control belongs behind authenticated access.</h2>
            </div>
          </div>
          <div className="landing-steps">
            <article className="trace-card">
              <span className="step-index">1</span>
              <h3>Present the platform</h3>
              <p>Use the public experience to explain the operating model, trust posture, and delivery governance story.</p>
            </article>
            <article className="trace-card">
              <span className="step-index">2</span>
              <h3>Authenticate into operations</h3>
              <p>Move authorized users into the private control plane where repository, pipeline, and deployment actions are allowed.</p>
            </article>
            <article className="trace-card">
              <span className="step-index">3</span>
              <h3>Operate with evidence</h3>
              <p>Use the authenticated surface for delivery decisions, runtime oversight, and auditable operational traceability.</p>
            </article>
          </div>
        </section>
      </div>
    );
  };

  const renderSignInPage = () => {
    return (
      <section className="signin-shell">
        <article className="panel signin-panel">
          <p className="eyebrow">control plane access</p>
          <h1 className="signin-title">Access the operator workspace through your authenticated deployment boundary.</h1>
          <p className="lede">
            The public site is intentionally informational. Repository actions, review policy, CI orchestration, release operations,
            and runtime oversight belong in the authenticated gitorc control plane provisioned inside your environment.
          </p>
          <div className="hero-actions">
            <button className="button button-primary" type="button">Private access required</button>
            <button className="button button-ghost" onClick={() => navigatePublic('home')} type="button">Back to landing page</button>
          </div>
        </article>

        <section className="signin-grid">
          <article className="panel stack-panel">
            <div className="section-heading compact-heading">
              <div>
                <p className="section-kicker">Expected operator flow</p>
                <h2>What opens after sign-in</h2>
              </div>
            </div>
            <div className="trace-grid">
              <article className="trace-card">
                <h3>Projects and repositories</h3>
                <p>Provision repositories, inspect connected providers, and review live inventory reported by the gateway.</p>
              </article>
              <article className="trace-card">
                <h3>Pipelines and deployments</h3>
                <p>Inspect stage health, promotion readiness, deployments, and rollback state once delivery systems are connected.</p>
              </article>
              <article className="trace-card">
                <h3>Runtime and trust</h3>
                <p>Trace live processes, security posture, attestations, and signed operational events.</p>
              </article>
            </div>
          </article>

          <article className="panel stack-panel">
            <div className="section-heading compact-heading">
              <div>
                <p className="section-kicker">Local bootstrap</p>
                <h2>Before opening the workspace</h2>
              </div>
            </div>
            <div className="landing-steps signin-steps">
              <article className="trace-card">
                <span className="step-index">1</span>
                <h3>Provision access</h3>
                <p>Expose the operator surface only inside the approved deployment boundary for your team.</p>
              </article>
              <article className="trace-card">
                <span className="step-index">2</span>
                <h3>Enforce policy</h3>
                <p>Connect repository, review, CI/CD, and operational controls to the organization’s security model.</p>
              </article>
              <article className="trace-card">
                <span className="step-index">3</span>
                <h3>Operate with confidence</h3>
                <p>Use the authenticated workspace for governed delivery workflows and runtime decision making.</p>
              </article>
            </div>
          </article>
        </section>
      </section>
    );
  };

  const renderScreen = () => {
    if (!overview) {
      return null;
    }

    if (!workspaceHasData || !selectedRepository) {
      return renderEmptyWorkspace();
    }

    switch (route.name) {
      case 'repositories':
        return <>{renderRepositoriesPanel()}{renderSecurityPanel()}{renderEventsPanel()}</>;
      case 'reviews':
        return <>{renderReviewsPanel()}{renderSecurityPanel()}{renderEventsPanel()}</>;
      case 'pipelines':
        return <>{renderPipelinesPanel()}{renderSecurityPanel()}{renderEventsPanel()}</>;
      case 'deployments':
        return <>{renderDeploymentsPanel()}{renderSecurityPanel()}{renderEventsPanel()}</>;
      case 'containers':
        return <>{renderProcessesPanel()}{renderSecurityPanel()}{renderEventsPanel()}</>;
      case 'overview':
      default:
        return (
          <>
            {renderGitlabOverview()}
          </>
        );
    }
  };

  return (
    <main className="shell">
      {toast ? <section className="panel toast-panel">{toast}</section> : null}
      {renderProjectForm()}

      {isLoading ? <section className="panel loading-panel">Loading gateway data…</section> : null}
      {error ? (
        <section className="panel loading-panel">
          <h2>Gateway connection failed</h2>
          <p>{error}</p>
          <p>The operator workspace could not retrieve overview data from the configured gateway.</p>
        </section>
      ) : null}

      {!isLoading && !error && publicLandingMode && publicPage === 'home' ? renderLandingPage() : null}
      {!isLoading && !error && publicLandingMode && publicPage === 'signin' ? renderSignInPage() : null}
      {!isLoading && !error && !publicLandingMode ? renderScreen() : null}
    </main>
  );
}
