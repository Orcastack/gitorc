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

variable "barbican_secret_payload" {
  type      = string
  sensitive = true
}

variable "ceph_monitors" {
  type = list(string)
}

resource "openstack_blockstorage_volume_type_v3" "artifacts" {
  name        = "${var.name_prefix}-artifacts"
  description = "Cinder volume type for artifact staging and metadata backups"
}

resource "openstack_keymanager_secret_v1" "platform" {
  name                 = "${var.name_prefix}-bootstrap"
  payload              = var.barbican_secret_payload
  payload_content_type = "text/plain"
}

locals {
  storage_class_name = "${var.name_prefix}-ceph-rbd"
}

output "barbican_secret_id" {
  value = openstack_keymanager_secret_v1.platform.secret_ref
}

output "storage_class_name" {
  value = local.storage_class_name
}

output "ceph_monitors" {
  value = var.ceph_monitors
}