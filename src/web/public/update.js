'use strict';

let _fullConfig = null;
let _updateInfo = null;

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-check').addEventListener('click', checkUpdate);
    document.getElementById('btn-apply').addEventListener('click', applyUpdate);
    document.getElementById('btn-save-update').addEventListener('click', saveUpdateConfig);
    loadPage();
});

async function loadPage() {
    try {
        const verRes = await fetch('/api/version');
        const ver = await verRes.json();
        document.getElementById('current-version').textContent = ver.version || '–';
        const bv = document.getElementById('build-version');
        if (bv) bv.textContent = 'Version ' + (ver.version || '–');
    } catch (e) {
        console.warn('Version fetch failed', e);
    }

    try {
        const res = await fetch('/api/config/full');
        _fullConfig = await res.json();
        renderUpdateSettings(_fullConfig.update || {});
    } catch (e) {
        showStatus('Konfiguration konnte nicht geladen werden', 'error');
    }

    // auto-check on page open
    checkUpdate();
}

function renderUpdateSettings(upd) {
    document.getElementById('cfg-update-enabled').value = (upd.enabled === false) ? 'false' : 'true';
    document.getElementById('cfg-update-remote').value = upd.remote || 'origin';
    document.getElementById('cfg-update-branch').value = upd.branch || 'main';
    document.getElementById('cfg-update-sshkey').value = upd.sshKey || '';
    document.getElementById('cfg-update-sshcmd').value = upd.sshCommand || '';
    document.getElementById('cfg-update-sshopts').value = upd.sshOptions || '-o IdentitiesOnly=yes -o StrictHostKeyChecking=no';
    document.getElementById('cfg-update-npmargs').value = upd.npmInstallArgs || '--omit=dev';
    document.getElementById('cfg-update-restart').value = upd.restartCommand || '';
}

function collectUpdateSettings() {
    return {
        enabled: document.getElementById('cfg-update-enabled').value === 'true',
        remote: document.getElementById('cfg-update-remote').value.trim(),
        branch: document.getElementById('cfg-update-branch').value.trim(),
        sshKey: document.getElementById('cfg-update-sshkey').value.trim(),
        sshCommand: document.getElementById('cfg-update-sshcmd').value.trim(),
        sshOptions: document.getElementById('cfg-update-sshopts').value.trim(),
        npmInstallArgs: document.getElementById('cfg-update-npmargs').value.trim(),
        restartCommand: document.getElementById('cfg-update-restart').value.trim()
    };
}

async function saveUpdateConfig() {
    if (!_fullConfig) {
        showStatus('Konfiguration nicht geladen', 'error');
        return;
    }
    const btn = document.getElementById('btn-save-update');
    btn.disabled = true;
    btn.textContent = '⏳ Speichere...';

    const upd = collectUpdateSettings();
    _fullConfig.update = upd;

    try {
        const res = await fetch('/api/config', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(_fullConfig)
        });
        const data = await res.json();
        if (res.ok) {
            showStatus('✓ Einstellungen gespeichert. Neustart für einige Änderungen nötig', 'success');
        } else {
            showStatus('Fehler: ' + (data.error || 'Unbekannt'), 'error');
        }
    } catch (e) {
        showStatus('Speichern fehlgeschlagen: ' + e.message, 'error');
    }

    btn.disabled = false;
    btn.textContent = '💾 Einstellungen speichern';
}

async function checkUpdate() {
    const btn = document.getElementById('btn-check');
    btn.disabled = true;
    btn.textContent = '⏳ Prüfe...';
    document.getElementById('commit-log').innerHTML = '';
    document.getElementById('check-result').textContent = '';
    try {
        const res = await fetch('/api/update/check');
        const data = await res.json();
        _updateInfo = data;
        if (!data || data.enabled === false) {
            document.getElementById('check-result').textContent = 'Updates sind deaktiviert.';
            return;
        }
        if (data.updateAvailable) {
            document.getElementById('check-result').textContent = `Update verfügbar: ${data.behind} Commit(s)`;
            document.getElementById('commit-log').innerHTML = `<pre style="white-space:pre-wrap">${data.commits || ''}</pre>`;
        } else {
            document.getElementById('check-result').textContent = 'Keine Updates verfügbar.';
        }
    } catch (e) {
        document.getElementById('check-result').textContent = 'Prüfung fehlgeschlagen: ' + e.message;
    }
    btn.disabled = false;
    btn.textContent = '🔎 Auf Updates prüfen';
}

async function applyUpdate() {
    const btn = document.getElementById('btn-apply');
    btn.disabled = true;
    btn.textContent = '⏳ Aktualisiere...';
    try {
        const res = await fetch('/api/update/apply', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            document.getElementById('check-result').innerHTML = '<span style="color:var(--green)">✅ Update gestartet. Server wird neu gestartet.</span>';
            btn.style.display = 'none';
            setTimeout(() => location.reload(), 5000);
        } else {
            document.getElementById('check-result').innerHTML = `<span style="color:var(--red)">❌ Fehler: ${data.error}</span>`;
            btn.disabled = false;
            btn.textContent = '⬇ Update anwenden';
        }
    } catch (e) {
        document.getElementById('check-result').textContent = 'Update fehlgeschlagen: ' + e.message;
        btn.disabled = false;
        btn.textContent = '⬇ Update anwenden';
    }
}

function showStatus(msg, type) {
    const el = document.getElementById('update-status');
    el.textContent = msg;
    el.className = 'status ' + type;
    setTimeout(() => { el.textContent = ''; el.className = 'status'; }, 6000);
}
