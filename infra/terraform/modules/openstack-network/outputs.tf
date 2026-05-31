output "network_id" {
  value = openstack_networking_network_v2.platform.id
}

output "subnet_id" {
  value = openstack_networking_subnet_v2.platform.id
}

output "runner_security_group_id" {
  value = openstack_networking_secgroup_v2.runners.id
}

output "ingress_floating_ip" {
  value = openstack_networking_floatingip_v2.ingress.address
}