package gitorc.runtime

default allow := false

approved_environments := {"dev", "stage", "prod"}
approved_actions := {"build", "test", "sign", "deploy", "rollback"}

allow if {
  input.repository.identity != ""
  input.actor.identity != ""
  input.action in approved_actions
  input.environment in approved_environments
  input.artifact.signed == true
  input.pipeline.approval.required == false
}

allow if {
  input.repository.identity != ""
  input.actor.identity != ""
  input.action in approved_actions
  input.environment in approved_environments
  input.artifact.signed == true
  input.pipeline.approval.required == true
  input.pipeline.approval.granted == true
}

deny[msg] if {
  not input.artifact.signed
  msg := "unsigned artifact cannot enter the deployment plane"
}

deny[msg] if {
  input.action == "deploy"
  input.environment == "prod"
  not input.pipeline.approval.granted
  msg := "production deployment requires explicit governance approval"
}