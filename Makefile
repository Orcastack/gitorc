API_DIR := gitorcapi
WEB_DIR := gitorcweb
TF_ENV_DIR := infra/terraform/environments/private-cloud

.PHONY: api-build api-run gateway git review ci cd analytics web-install web-build up down infra-fmt infra-validate bootstrap-local deploy-private-cloud

api-build:
	cd $(API_DIR) && go build ./...

gateway:
	cd $(API_DIR) && go run ./cmd/gitorc-gateway

git:
	cd $(API_DIR) && go run ./cmd/gitorc-git-service

review:
	cd $(API_DIR) && go run ./cmd/gitorc-review-service

ci:
	cd $(API_DIR) && go run ./cmd/gitorc-ci-service

cd:
	cd $(API_DIR) && go run ./cmd/gitorc-cd-service

analytics:
	cd $(API_DIR) && go run ./cmd/gitorc-analytics-service

web-install:
	cd $(WEB_DIR) && npm install

web-build:
	cd $(WEB_DIR) && npm run build

up:
	docker compose up --build

down:
	docker compose down

infra-fmt:
	terraform fmt -recursive infra/terraform

infra-validate:
	terraform -chdir=$(TF_ENV_DIR) init -backend=false
	terraform -chdir=$(TF_ENV_DIR) validate
	terraform fmt -check -recursive infra/terraform

bootstrap-local:
	docker compose up -d postgres redpanda namenode datanode hbase gateway git-service review-service ci-service cd-service analytics-service web

deploy-private-cloud:
	kubectl apply -f infra/kubernetes/base/namespace.yaml
	kubectl apply -k infra/kubernetes/platform
