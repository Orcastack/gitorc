package main

import (
	"context"
	"log"

	"github.com/gitorc/gitorcapi/internal/platform/app"
	"github.com/gitorc/gitorcapi/internal/platform/config"
)

func main() {
	err := app.Run(context.Background(), app.WithServiceSecurity(app.Config{
		Name:               "gitorc-review-service",
		Role:               "code-review",
		Summary:            "Manages changes, patchsets, comments, approvals, and merge rules.",
		HTTPPort:           config.String("GITORC_REVIEW_HTTP_PORT", "8082"),
		GRPCPort:           config.String("GITORC_REVIEW_GRPC_PORT", "9082"),
	}, "GITORC_REVIEW_IDENTITY", app.DefaultReviewIdentity))
	if err != nil {
		log.Fatal(err)
	}
}
