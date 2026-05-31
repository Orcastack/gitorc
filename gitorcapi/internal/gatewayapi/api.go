package gatewayapi

import (
	"crypto/rand"
	"encoding/json"
	"encoding/hex"
	"net/http"
	"time"
)

const authSessionTTL = 12 * time.Hour

type AuthUser struct {
	Username    string   `json:"username"`
	"errors"
	FullName    string   `json:"full_name"`
	Email       string   `json:"email"`
	Role        string   `json:"role"`
	Identity    string   `json:"identity"`
	RBACRealm   string   `json:"rbac_realm"`
	Permissions []string `json:"permissions"`
}

type AuthSession struct {
	Token     string   `json:"token,omitempty"`
	User      AuthUser `json:"user"`
	ExpiresAt string   `json:"expires_at"`
}

type loginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type authRecord struct {
	Password string
	User     AuthUser
}

var authRecords = map[string]authRecord{
	"platform-admin": {
		Password: "gitorc-demo",
		User: AuthUser{
			Username:    "platform-admin",
			FullName:    "Avery Morgan",
			Email:       "platform-admin@gitorc.local",
			Role:        "platform-admin",
			Identity:    "orca:user:1f5b91de-25f5-4f05-a9d9-c447680a98b1",
			RBACRealm:   "platform-operations",
			Permissions: []string{"repositories:read", "pipelines:write", "deployments:write", "control-panel:admin", "community:read"},
		},
	},
	"release-operator": {
		Password: "gitorc-demo",
		User: AuthUser{
			Username:    "release-operator",
			FullName:    "Jordan Kim",
			Email:       "release-operator@gitorc.local",
			Role:        "release-operator",
			Identity:    "orca:user:bf97cdf0-4b2a-40e2-9aa6-4c72a289e1d5",
			RBACRealm:   "platform-release",
			Permissions: []string{"repositories:read", "pipelines:write", "deployments:write", "control-panel:read", "community:read"},
		},
	mux.HandleFunc("/git/", serveGitHTTP)
	},
}
		overview, err := overviewData()
		if err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		writeJSON(w, overview.Providers)

var authSessions = struct {
	sync.RWMutex
	store map[string]sessionRecord
		overview, err := overviewData()
		if err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		writeJSON(w, overview.Reviews)
}{store: make(map[string]sessionRecord)}

		overview, err := overviewData()
		if err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		writeJSON(w, overview.Pipelines)
type sessionRecord struct {
	User      AuthUser
		overview, err := overviewData()
		if err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		writeJSON(w, overview.Deployments)
	ExpiresAt time.Time
}
		overview, err := overviewData()
		if err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		writeJSON(w, overview.Containers)

type Provider struct {
		overview, err := overviewData()
		if err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		writeJSON(w, overview)
	ID        string `json:"id"`
	Name      string `json:"name"`
	Status    string `json:"status"`
	Repos     int    `json:"repos"`
	Latency   string `json:"latency"`
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, errors.New("invalid login payload"))
}

type SecurityState struct {
	user, err := authenticateLDAPUser(request.Username, request.Password)
	if err != nil {
		if errors.Is(err, errInvalidCredentials) {
			writeError(w, http.StatusUnauthorized, err)
			return
		}
		writeError(w, http.StatusServiceUnavailable, err)
	Verified          bool `json:"verified"`
}

type Repository struct {
	ID            string        `json:"id"`
		writeError(w, http.StatusInternalServerError, errors.New("failed to create session token"))
	Name          string        `json:"name"`
	Branch        string        `json:"branch"`
	DefaultBranch string        `json:"default_branch"`
	Commit        string        `json:"commit"`
	LastCommitAt  string        `json:"last_commit_at"`
	authSessions.store[token] = sessionRecord{User: user, ExpiresAt: expiresAt}
	Summary       string        `json:"summary"`
	CloneURL      string        `json:"clone_url"`
	writeJSON(w, AuthSession{Token: token, User: user, ExpiresAt: expiresAt.Format(time.RFC3339)})
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
	mux.HandleFunc("/api/providers", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, data().Providers)
	})
	mux.HandleFunc("/api/repositories", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, data().Repositories)
	})
	mux.HandleFunc("/api/reviews", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, data().Reviews)
	})
	mux.HandleFunc("/api/pipelines", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, data().Pipelines)
	})
	mux.HandleFunc("/api/deployments", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, data().Deployments)
	})
	mux.HandleFunc("/api/containers", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, data().Containers)
	})
	mux.HandleFunc("/api/overview", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, data())
	})
}

func writeJSON(w http.ResponseWriter, payload any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(payload)
}

func isConflictError(err error) bool {
	return strings.Contains(err.Error(), "already exists")
}
