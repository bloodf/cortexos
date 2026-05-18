# CortexOS — top-level Makefile.
#
# Lima-based rehearsal harness for macOS-native Linux VMs.
# Targets are .PHONY because they wrap external tools.

.PHONY: vm-debian-up vm-ubuntu24-up vm-ubuntu25-up vm-shell vm-rehearse vm-down vm-list

vm-debian-up:
	limactl start --name=cortex-debian   lima/debian-13.yaml --tty=false

vm-ubuntu24-up:
	limactl start --name=cortex-ubuntu24 lima/ubuntu-24.yaml  --tty=false

vm-ubuntu25-up:
	limactl start --name=cortex-ubuntu25 lima/ubuntu-25.yaml  --tty=false

# NAME is the VM short name (debian | ubuntu24 | ubuntu25).
vm-shell:
	@if [ -z "$(NAME)" ]; then echo "usage: make vm-shell NAME=<debian|ubuntu24|ubuntu25>"; exit 2; fi
	limactl shell cortex-$(NAME)

# FAMILY selects which VM to drive (debian | ubuntu24 | ubuntu25).
# VM name is cortex-$(FAMILY); runner gets the apt family (ubuntu|debian).
vm-rehearse:
	@if [ -z "$(FAMILY)" ]; then echo "usage: make vm-rehearse FAMILY=<debian|ubuntu24|ubuntu25>"; exit 2; fi
	@case "$(FAMILY)" in \
	  debian) runner_family=debian ;; \
	  ubuntu24|ubuntu25) runner_family=ubuntu ;; \
	  *) echo "unknown FAMILY=$(FAMILY)"; exit 2 ;; \
	esac; \
	limactl shell cortex-$(FAMILY) bash -c "cd /opt/cortexos && bash scripts/local-prompt-runner.sh --family $$runner_family"

vm-down:
	-limactl stop -f cortex-debian cortex-ubuntu24 cortex-ubuntu25 2>/dev/null
	-limactl delete -f cortex-debian cortex-ubuntu24 cortex-ubuntu25 2>/dev/null
	@true

vm-list:
	limactl list
