#!/bin/sh
# Install the reboot-to-windows pieces. Root files go under /etc and
# /usr/local via sudo; the extension goes to the calling user's
# ~/.local/share/gnome-shell/extensions.
set -eu

here=$(cd "$(dirname "$0")" && pwd)
uuid=reboot-to-windows@lieyan
ext_dir="${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions/$uuid"

for f in \
    /etc/default/reboot-to-windows:644 \
    /usr/local/libexec/reboot-to-windows:755 \
    /etc/systemd/system/reboot-to-windows.service:644 \
    /etc/polkit-1/rules.d/50-reboot-to-windows.rules:644
do
    path=${f%:*}
    sudo install -D -m "${f#*:}" "$here/root$path" "$path"
done
sudo systemctl daemon-reload

mkdir -p "$ext_dir"
cp "$here/extension/$uuid/metadata.json" "$here/extension/$uuid/extension.js" "$ext_dir/"

if gnome-extensions enable "$uuid" 2>/dev/null; then
    echo "Installed and enabled."
else
    # GNOME Shell on Wayland only scans for new extensions at login.
    echo "Installed. Log out and back in, then run: gnome-extensions enable $uuid"
fi
