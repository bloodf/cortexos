# CortexOS — top-level Makefile.
#
# Currently only the Vagrant rehearsal targets live here. Targets are
# .PHONY because they wrap external tools.

# === Vagrant rehearsal ===

.PHONY: vm-fedora-up vm-ubuntu-up vm-ubuntu22-up vm-rocky-up vm-rocky-ssh \
        vm-alma-up vm-alma-ssh vm-down vm-destroy vm-rehearse vm-snapshot vm-restore

vm-fedora-up:
	vagrant up fedora-41

vm-ubuntu-up:
	vagrant up ubuntu-2404

vm-ubuntu22-up:
	vagrant up ubuntu-2204

vm-rocky-up:
	vagrant up rocky-9

vm-rocky-ssh:
	vagrant ssh rocky-9

vm-alma-up:
	vagrant up alma-9

vm-alma-ssh:
	vagrant ssh alma-9

vm-down:
	vagrant halt fedora-41 ubuntu-2404 ubuntu-2204 rocky-9 alma-9 || vagrant halt

vm-destroy:
	vagrant destroy -f

# FAMILY is the OS family routed inside the VM (ubuntu | fedora | rhel).
# BOX is optional and selects which rhel-family VM to use (rocky | alma).
vm-rehearse:
	@if [ -z "$(FAMILY)" ]; then echo "usage: make vm-rehearse FAMILY=<ubuntu|fedora|rhel|rocky|alma> [BOX=<rocky|alma>]"; exit 2; fi
	@case "$(FAMILY)" in \
	  ubuntu) box=ubuntu-2404; fam=ubuntu ;; \
	  fedora) box=fedora-41;   fam=fedora ;; \
	  rocky)  box=rocky-9;     fam=rhel ;; \
	  alma)   box=alma-9;      fam=rhel ;; \
	  rhel)   case "$(BOX)" in \
	            alma)  box=alma-9 ;; \
	            ""|rocky) box=rocky-9 ;; \
	            *) echo "unknown BOX=$(BOX)"; exit 2 ;; \
	          esac; fam=rhel ;; \
	  *) echo "unknown FAMILY=$(FAMILY)"; exit 2 ;; \
	esac; \
	vagrant ssh $$box -c "bash /opt/cortexos/scripts/local-prompt-runner.sh --family $$fam --prompts os/00,os/10-$$fam,tools/00..tools/99"

vm-snapshot:
	@if [ -z "$(NAME)" ]; then echo "usage: make vm-snapshot NAME=<tag>"; exit 2; fi
	bash vagrant/snapshots.sh take "$(NAME)"

vm-restore:
	@if [ -z "$(NAME)" ]; then echo "usage: make vm-restore NAME=<tag>"; exit 2; fi
	bash vagrant/snapshots.sh restore "$(NAME)"
