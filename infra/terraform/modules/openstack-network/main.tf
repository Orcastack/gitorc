terraform {
  required_providers {
    openstack = {
      source = "terraform-provider-openstack/openstack"
    }
  }
}

resource "openstack_networking_network_v2" "platform" {
  name           = "${var.name_prefix}-network"
  admin_state_up = true
}

resource "openstack_networking_subnet_v2" "platform" {
  name       = "${var.name_prefix}-subnet"
  network_id = openstack_networking_network_v2.platform.id
  cidr       = "10.42.0.0/24"
  ip_version = 4
  dns_nameservers = [
    "1.1.1.1",
    "9.9.9.9",
  ]
}

resource "openstack_networking_router_v2" "platform" {
  name                = "${var.name_prefix}-router"
  external_network_id = var.external_network_id
}

resource "openstack_networking_router_interface_v2" "platform" {
  router_id = openstack_networking_router_v2.platform.id
  subnet_id = openstack_networking_subnet_v2.platform.id
}

resource "openstack_networking_secgroup_v2" "runners" {
  name        = "${var.name_prefix}-runners"
  description = "CI/CD runner access policy"
}

resource "openstack_networking_secgroup_rule_v2" "runners_ssh" {
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 22
  port_range_max    = 22
  remote_ip_prefix  = "10.0.0.0/8"
  security_group_id = openstack_networking_secgroup_v2.runners.id
}

resource "openstack_networking_floatingip_v2" "ingress" {
  pool = var.floating_ip_pool
}

resource "openstack_lb_loadbalancer_v2" "ingress" {
  name          = "${var.name_prefix}-ingress"
  vip_subnet_id = openstack_networking_subnet_v2.platform.id
}