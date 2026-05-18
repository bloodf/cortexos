# CortexOS — top-level Makefile.
#
# Currently only the Vagrant rehearsal targets live here. Targets are
# .PHONY because they wrap external tools.

# === Vagrant rehearsal ===

.PHONY: vm-fedora-up vm-ubuntu-up vm-ubuntu22-up vm-rocky-up vm-alma-up \
        vm-down vm-destroy vm-rehearse vm-snapshot vm-restore

vm-fedora-up:
	vagrant up fedora-41

vm-ubuntu-up:
	vagrant up ubuntu-2404

vm-ubuntu22-up:
	vagrant up ubuntu-2204

vm-rocky-up:
	@echo "rocky-9 box is enabled in P6"

vm-alma-up:
	@echo "alma-9 box is enabled in P6"

vm-down:
	vagrant halt

vm-destroy:
	vagrant destroy -f

vm-rehearse:
	@if [ -z "$(FAMILY)" ]; then echo "usage: make vm-rehearse FAMILY=<ubuntu|fedora|rhel>"; exit 2; fi
	@case "$(FAMILY)" in \
	  ubuntu) box=ubuntu-2404 ;; \
	  fedora) box=fedora-41 ;; \
	  rhel)   box=rocky-9 ;; \
	  *) echo "unknown FAMILY=$(FAMILY)"; exit 2 ;; \
	esac; \
	vagrant ssh $$box -c 'bash /opt/cortexos/scripts/local-prompt-runner.sh --family $(FAMILY) --prompts os/00,os/10-$(FAMILY),tools/00..tools/99'

vm-snapshot:
	@if [ -z "$(NAME)" ]; then echo "usage: make vm-snapshot NAME=<tag>"; exit 2; fi
	bash vagrant/snapshots.sh take "$(NAME)"

vm-restore:
	@if [ -z "$(NAME)" ]; then echo "usage: make vm-restore NAME=<tag>"; exit 2; fi
	bash vagrant/snapshots.sh restore "$(NAME)"
