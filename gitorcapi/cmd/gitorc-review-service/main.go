package main

import (
	"context"
	"log"

	"github.com/atonixdev/gitorc/gitorcapi/internal/platform/app"
	"github.com/atonixdev/gitorc/gitorcapi/internal/platform/config"
	"github.com/atonixdev/gitorc/gitorcapi/internal/platform/security"
)

func main() {
	err := app.Run(context.Background(), app.Config{
		Name:               "gitorc-review-service",
		Role:               "code-review",
		Summary:            "Manages changes, patchsets, comments, approvals, and merge rules.",
		HTTPPort:           config.String("GITORC_REVIEW_HTTP_PORT", "8082"),
		GRPCPort:           config.String("GITORC_REVIEW_GRPC_PORT", "9082"),
		ComponentType:      "service",
		ComponentIdentity:  config.String("GITORC_REVIEW_IDENTITY", ""),
		RepositoryIdentity: config.String("GITORC_REPOSITORY_IDENTITY", security.DefaultRepositoryIdentity),
		BuildHash:          config.String("GITORC_BUILD_HASH", "sha256:unavailable"),
		PrivateKeyPath:     config.String("GITORC_SIGNING_PRIVATE_KEY_PATH", ""),
		PublicKeyPath:      config.String("GITORC_SIGNING_PUBLIC_KEY_PATH", ""),
		EnforceSigning:     config.Bool("GITORC_ENFORCE_SIGNING", false),
		EnforceDirectory:   config.Bool("GITORC_ENFORCE_DIRECTORY", false),
		LDAP: security.LDAPConfig{
			Address:          config.String("GITORC_LDAP_ADDRESS", ""),
			ServiceAccountDN: config.String("GITORC_LDAP_SERVICE_ACCOUNT_DN", ""),
			ComponentBaseDN:  config.String("GITORC_LDAP_COMPONENT_BASE_DN", ""),
			RepositoryBaseDN: config.String("GITORC_LDAP_REPOSITORY_BASE_DN", ""),
			AuditBaseDN:      config.String("GITORC_LDAP_AUDIT_BASE_DN", ""),
		},
		RBAC: security.RBACConfig{
			Realm: config.String("GITORC_RBAC_REALM", ""),
		},
	})
	if err != nil {
		log.Fatal(err)
	}
}
