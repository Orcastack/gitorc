terraform {
  required_providers {
    openstack = {
      source = "terraform-provider-openstack/openstack"
    }
  }
}

variable "name_prefix" {
  type = string
}

variable "image_name" {
  type = string
}

variable "flavor_name" {
  type = string
}

variable "key_pair" {
  type = string
}

variable "instance_count" {
  type = number
}

variable "network_id" {
  type = string
}

variable "security_group_id" {
  type = string
}

resource "openstack_compute_servergroup_v2" "runners" {
  name     = "${var.name_prefix}-runner-group"
  policies = ["soft-anti-affinity"]
}

resource "openstack_compute_instance_v2" "runners" {
  count       = var.instance_count
  name        = format("%s-runner-%02d", var.name_prefix, count.index + 1)
  image_name  = var.image_name
  flavor_name = var.flavor_name
  key_pair    = var.key_pair

  network {
    uuid = var.network_id
  }

  security_groups = [var.security_group_id]

  scheduler_hints {
    group = openstack_compute_servergroup_v2.runners.id
  }

  metadata = {
    role       = "cicd-runner"
    scheduler  = "private-cloud"
    governance = "identity-linked"
  }
}

output "instance_ids" {
  value = [for runner in openstack_compute_instance_v2.runners : runner.id]
}