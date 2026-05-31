output "network_id" {
  value = module.network.network_id
}

output "ingress_floating_ip" {
  value = module.network.ingress_floating_ip
}

output "keystone_project_id" {
  value = module.identity.project_id
}

output "barbican_secret_id" {
  value = module.storage.barbican_secret_id
}

output "runner_instance_ids" {
  value = module.runners.instance_ids
}

output "platform_namespace" {
  value = module.platform.namespace
}