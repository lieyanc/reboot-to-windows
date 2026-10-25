import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as SystemActions from 'resource:///org/gnome/shell/misc/systemActions.js';
import * as Dialog from 'resource:///org/gnome/shell/ui/dialog.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

Gio._promisify(Gio.Subprocess.prototype, 'communicate_utf8_async');
Gio._promisify(Gio.DBusConnection.prototype, 'call');

const UNIT = 'reboot-to-windows.service';

// Follow the session language like the surrounding built-in items do.
const ZH = GLib.get_language_names()[0].startsWith('zh');
const T = ZH ? {
    item: '重启到 Windows…',
    title: '重启到 Windows',
    description: '仅下一次启动进入 Windows，之后再重启会回到 Ubuntu。',
    cancel: '取消',
    confirm: '重启',
    error: '无法重启到 Windows',
} : {
    item: 'Restart to Windows…',
    title: 'Restart to Windows',
    description: 'Only the next boot goes to Windows; restarting from there returns to Ubuntu.',
    cancel: 'Cancel',
    confirm: 'Restart',
    error: 'Could not restart to Windows',
};

function confirm(onConfirm) {
    const dialog = new ModalDialog.ModalDialog();
    dialog.contentLayout.add_child(new Dialog.MessageDialogContent({
        title: T.title,
        description: T.description,
    }));
    dialog.setButtons([
        {label: T.cancel, action: () => dialog.close(), key: Clutter.KEY_Escape},
        {
            label: T.confirm,
            action: () => {
                dialog.close();
                onConfirm();
            },
            default: true,
        },
    ]);
    dialog.open();
}

async function rebootToWindows() {
    // BootNext is only set once the user has confirmed, so cancelling the
    // dialog never leaves a pending one-shot boot behind.
    const proc = Gio.Subprocess.new(['systemctl', 'start', UNIT],
        Gio.SubprocessFlags.STDERR_PIPE);
    const [, stderr] = await proc.communicate_utf8_async(null, null);
    if (!proc.get_successful())
        throw new Error(stderr.trim() || `systemctl start ${UNIT} failed`);

    // Same path as the built-in Restart minus its confirmation prompt, so
    // applications still get to save state and inhibitors are honoured.
    await Gio.DBus.session.call('org.gnome.SessionManager',
        '/org/gnome/SessionManager', 'org.gnome.SessionManager',
        'RequestReboot', null, null, Gio.DBusCallFlags.NONE, -1, null);
}

export default class RebootToWindowsExtension extends Extension {
    enable() {
        this._attach();
    }

    _attach() {
        const system = Main.panel.statusArea.quickSettings._system;
        if (!system) {
            // Quick settings indicators are created asynchronously at startup.
            this._retryId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
                this._retryId = 0;
                this._attach();
                return GLib.SOURCE_REMOVE;
            });
            return;
        }

        this._item = new PopupMenu.PopupMenuItem(T.item);
        this._item.connect('activate', () => {
            Main.panel.closeQuickSettings();
            confirm(() => rebootToWindows().catch(e =>
                Main.notifyError(T.error, e.message)));
        });
        this._binding = SystemActions.getDefault().bind_property('can-restart',
            this._item, 'visible', GObject.BindingFlags.SYNC_CREATE);

        // Directly below "Restart…".
        system._systemItem.menu.addMenuItem(this._item, 2);
    }

    disable() {
        if (this._retryId) {
            GLib.Source.remove(this._retryId);
            this._retryId = 0;
        }
        this._binding?.unbind();
        this._binding = null;
        this._item?.destroy();
        this._item = null;
    }
}
