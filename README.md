# reboot-to-windows

Adds **Restart to Windows…** to the GNOME power menu (top-right → power icon),
directly below **Restart…**. Shown in Chinese when the session language is `zh*`.

Clicking it asks for confirmation, then sets UEFI `BootNext` to the Windows Boot
Manager and restarts the session the normal way. `BootNext` is one-shot: the
firmware clears it after that single boot, so restarting from Windows comes back
to Ubuntu through the unchanged `BootOrder`. GRUB is not involved.

## How it fits together

| Piece | Path | Role |
|---|---|---|
| Config | `/etc/default/reboot-to-windows` | PARTUUID of the ESP holding the Windows Boot Manager to use |
| Helper | `/usr/local/libexec/reboot-to-windows` | Finds the matching `Boot####` entry by PARTUUID and runs `efibootmgr --bootnext` |
| Unit | `/etc/systemd/system/reboot-to-windows.service` | Oneshot that runs the helper as root |
| Polkit rule | `/etc/polkit-1/rules.d/50-reboot-to-windows.rules` | Lets local, active `sudo`-group sessions `start` that one unit without a password |
| Extension | `~/.local/share/gnome-shell/extensions/reboot-to-windows@lieyan` | Menu item and confirmation dialog; runs `systemctl start reboot-to-windows.service`, then `org.gnome.SessionManager.RequestReboot` |

`BootNext` is written only after you confirm, so cancelling leaves nothing pending.
The reboot goes through gnome-session like the built-in Restart, so applications
get to save and inhibitors are respected.

The entry is looked up by ESP PARTUUID instead of a hard-coded `Boot####`
number, because firmware or Windows updates can renumber entries. This machine
has two Windows Boot Managers; the configured one is the NVMe Windows 10
(`nvme0n1p1`). To switch, edit the PARTUUID (`lsblk -o NAME,PARTUUID,PARTTYPENAME`).

## Install

```sh
./install.sh     # asks for sudo once
./uninstall.sh
```

On Wayland, GNOME Shell only picks up a new extension at login. Log out and back
in once, then `gnome-extensions enable reboot-to-windows@lieyan`.

## Checking without rebooting

```sh
systemctl start reboot-to-windows.service   # should not ask for a password
efibootmgr | grep BootNext                  # BootNext: 0000
sudo efibootmgr --delete-bootnext           # undo
```

If the extension shows an error notification, see `journalctl -u reboot-to-windows.service`.
