package gatewayapi

import (
	"encoding/json"
	"net/http"
	"strings"
)

type Provider struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Status    string `json:"status"`
	Repos     int    `json:"repos"`
	Latency   string `json:"latency"`
	Identity  string `json:"identity"`
	Connected bool   `json:"connected"`
}

type SecurityState struct {
	LDAPRegistered    bool `json:"ldap_registered"`
	RBACVerified      bool `json:"rbac_verified"`
	AttestationSigned bool `json:"attestation_signed"`
	Verified          bool `json:"verified"`
}

type Repository struct {
	ID            string        `json:"id"`
	ProviderID    string        `json:"provider_id"`
	Name          string        `json:"name"`
	Branch        string        `json:"branch"`
	DefaultBranch string        `json:"default_branch"`
	Commit        string        `json:"commit"`
	LastCommitAt  string        `json:"last_commit_at"`
	Reviewer      string        `json:"reviewer"`
	Summary       string        `json:"summary"`
	CloneURL      string        `json:"clone_url"`
	Identity      string        `json:"identity"`
	Security      SecurityState `json:"security"`
}

type CloneOperation struct {
	RepositoryID string `json:"repository_id"`
	Status       string `json:"status"`
	CloneURL     string `json:"clone_url"`
	Command      string `json:"command"`
	UPI          string `json:"upi"`
	UpdatedAt    string `json:"updated_at"`
}

type Review struct {
	ID                string   `json:"id"`
	RepositoryID      string   `json:"repository_id"`
	Title             string   `json:"title"`
	Status            string   `json:"status"`
	RequiredApprovals int      `json:"required_approvals"`
	Approvals         int      `json:"approvals"`
	Reviewers         []string `json:"reviewers"`
	LastUpdated       string   `json:"last_updated"`
}

type PipelineStage struct {
	Name   string `json:"name"`
	Status string `json:"status"`
}

type PipelineRun struct {
	ID        string `json:"id"`
	StartedAt string `json:"started_at"`
	Status    string `json:"status"`
	Trigger   string `json:"trigger"`
}

type Pipeline struct {
	ID           string          `json:"id"`
	RepositoryID string          `json:"repository_id"`
	Name         string          `json:"name"`
	Branch       string          `json:"branch"`
	LastRun      string          `json:"last_run"`
	Status       string          `json:"status"`
	Stages       []PipelineStage `json:"stages"`
	RunHistory   []PipelineRun   `json:"run_history"`
	LogChannel   string          `json:"log_channel"`
	UPI          string          `json:"upi"`
	Security     SecurityState   `json:"security"`
	UpdatedAt    string          `json:"updated_at"`
}

type Deployment struct {
	ID              string        `json:"id"`
	RepositoryID    string        `json:"repository_id"`
	ServiceName     string        `json:"service_name"`
	Version         string        `json:"version"`
	Environment     string        `json:"environment"`
	Status          string        `json:"status"`
	Cluster         string        `json:"cluster"`
	Artifact        string        `json:"artifact"`
	TargetCommit    string        `json:"target_commit"`
	PreviousVersion string        `json:"previous_version"`
	LogChannel      string        `json:"log_channel"`
	UPI             string        `json:"upi"`
	Security        SecurityState `json:"security"`
}

type Container struct {
	Name       string        `json:"name"`
	UPI        string        `json:"upi"`
	State      string        `json:"state"`
	Host       string        `json:"host"`
	Actions    []string      `json:"actions"`
	CPU        string        `json:"cpu"`
	Memory     string        `json:"memory"`
	Restarts   int           `json:"restarts"`
	MetricsURL string        `json:"metrics_url"`
	LogChannel string        `json:"log_channel"`
	Security   SecurityState `json:"security"`
}

type DashboardSecurity struct {
	RepositoryIdentity string        `json:"repository_identity"`
	UIProcessIdentity  string        `json:"ui_process_identity"`
	Directory          SecurityState `json:"directory"`
}

type Event struct {
	ID           string `json:"id"`
	Time         string `json:"time"`
	Component    string `json:"component"`
	Kind         string `json:"kind"`
	RepositoryID string `json:"repository_id"`
	Action       string `json:"action"`
	Result       string `json:"result"`
	UPI          string `json:"upi"`
	Summary      string `json:"summary"`
}

type Overview struct {
	Providers       []Provider        `json:"providers"`
	Repositories    []Repository      `json:"repositories"`
	CloneOperations []CloneOperation  `json:"clone_operations"`
	Reviews         []Review          `json:"reviews"`
	Pipelines       []Pipeline        `json:"pipelines"`
	Deployments     []Deployment      `json:"deployments"`
	Containers      []Container       `json:"containers"`
	Security        DashboardSecurity `json:"security"`
	Events          []Event           `json:"events"`
	UpdatedAt       string            `json:"updated_at"`
	Metrics         []Metric          `json:"metrics"`
	Activity        []string          `json:"activity"`
}

type Metric struct {
	Label string `json:"label"`
	Value string `json:"value"`
	Hint  string `json:"hint"`
}

func Register(mux *http.ServeMux) {
	mux.HandleFunc("/git/", serveGitHTTP)
	mux.HandleFunc("/api/providers", func(w http.ResponseWriter, _ *http.Request) {
		overview, err := overviewData()
		if err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		writeJSON(w, overview.Providers)
	})
	mux.HandleFunc("/api/repositories", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			overview, err := overviewData()
			if err != nil {
				writeError(w, http.StatusInternalServerError, err)
				return
			}
			writeJSON(w, overview.Repositories)
		case http.MethodPost:
			var req createRepositoryRequest
			if err := decodeJSON(r, &req); err != nil {
				writeError(w, http.StatusBadRequest, err)
				return
			}
			response, err := createRepository(req)
			if err != nil {
				status := http.StatusInternalServerError
				if err.Error() == "repository name is required" {
					status = http.StatusBadRequest
				}
				if isConflictError(err) {
					status = http.StatusConflict
				}
				writeError(w, status, err)
				return
			}
			w.WriteHeader(http.StatusCreated)
			writeJSON(w, response)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})
	mux.HandleFunc("/api/repositories/import", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		var req importRepositoryRequest
		if err := decodeJSON(r, &req); err != nil {
			writeError(w, http.StatusBadRequest, err)
			return
		}

		response, err := importRepository(req)
		if err != nil {
			status := http.StatusInternalServerError
			if err.Error() == "source repository URL is required" || err.Error() == "repository name is required" {
				status = http.StatusBadRequest
			}
			if isConflictError(err) {
				status = http.StatusConflict
			}
			writeError(w, status, err)
			return
		}

		w.WriteHeader(http.StatusCreated)
		writeJSON(w, response)
	})
	mux.HandleFunc("/api/reviews", func(w http.ResponseWriter, _ *http.Request) {
		overview, err := overviewData()
		if err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		writeJSON(w, overview.Reviews)
	})
	mux.HandleFunc("/api/pipelines", func(w http.ResponseWriter, _ *http.Request) {
		overview, err := overviewData()
		if err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		writeJSON(w, overview.Pipelines)
	})
	mux.HandleFunc("/api/deployments", func(w http.ResponseWriter, _ *http.Request) {
		overview, err := overviewData()
		if err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		writeJSON(w, overview.Deployments)
	})
	mux.HandleFunc("/api/containers", func(w http.ResponseWriter, _ *http.Request) {
		overview, err := overviewData()
		if err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		writeJSON(w, overview.Containers)
	})
	mux.HandleFunc("/api/overview", func(w http.ResponseWriter, _ *http.Request) {
		overview, err := overviewData()
		if err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		writeJSON(w, overview)
	})
}

func writeJSON(w http.ResponseWriter, payload any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(payload)
}

func isConflictError(err error) bool {
	return strings.Contains(err.Error(), "already exists")
}
