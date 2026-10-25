#!/bin/sh
# Remove everything install.sh put in place.
set -u

uuid=reboot-to-windows@lieyan

gnome-extensions disable "$uuid" 2>/dev/null
rm -rf "${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions/$uuid"

sudo rm -f /etc/default/reboot-to-windows \
           /usr/local/libexec/reboot-to-windows \
           /etc/systemd/system/reboot-to-windows.service \
           /etc/polkit-1/rules.d/50-reboot-to-windows.rules
sudo systemctl daemon-reload

echo "Removed. A pending BootNext, if any, can be cleared with: sudo efibootmgr --delete-bootnext"
