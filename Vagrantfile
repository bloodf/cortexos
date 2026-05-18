# -*- mode: ruby -*-
# vi: set ft=ruby :
#
# CortexOS rehearsal harness — Vagrant + libvirt/QEMU.
#
# Defined boxes:
#   fedora-41    generic/fedora41   (active)
#   ubuntu-2404  generic/ubuntu2404 (active)
#   ubuntu-2204  generic/ubuntu2204 (active)
#   rocky-9      generic/rocky9     (P6 placeholder, disabled)
#   alma-9       generic/alma9      (P6 placeholder, disabled)
#
# Provider: libvirt. macOS host runs x86_64 boxes under QEMU-TCG (slow on
# Apple Silicon). See vagrant/README.md for the aarch64 migration note.

Vagrant.configure("2") do |config|
  config.vm.synced_folder ".", "/vagrant", disabled: true

  boxes = [
    { name: "fedora-41",   box: "generic/fedora41",   ip: "192.168.121.11", active: true  },
    { name: "ubuntu-2404", box: "generic/ubuntu2404", ip: "192.168.121.12", active: true  },
    { name: "ubuntu-2204", box: "generic/ubuntu2204", ip: "192.168.121.13", active: true  },
    # enabled in P6
    { name: "rocky-9",     box: "generic/rocky9",     ip: "192.168.121.14", active: false },
    # enabled in P6
    { name: "alma-9",      box: "generic/alma9",      ip: "192.168.121.15", active: false },
  ]

  boxes.each do |b|
    next unless b[:active]

    config.vm.define b[:name] do |vm|
      vm.vm.box = b[:box]
      vm.vm.box_check_update = false
      vm.vm.hostname = b[:name]

      vm.vm.network :private_network, ip: b[:ip]

      # rsync sync — 9p is fragile under QEMU-TCG on macOS.
      vm.vm.synced_folder ".", "/opt/cortexos",
        type: "rsync",
        rsync__exclude: [".git/", "node_modules/", ".omc/", "dashboard/.next/", "dashboard/node_modules/"]

      vm.vm.provider :libvirt do |lv|
        lv.cpus   = 4
        lv.memory = 6144
        lv.machine_virtual_size = 40
        lv.driver = "qemu"
      end

      vm.vm.provision :shell, path: "vagrant/provision.sh"
    end
  end
end
