'use strict';

const config = require('./config');
const EnergyManager = require('./energy-manager');
const createWebServer = require('./web/server');

function buildVersion() {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mi = String(now.getMinutes()).padStart(2, '0');
    return `0.${yy}${mm}${dd}.${hh}${mi}`;
}

async function main() {
    const version = buildVersion();
    process.env.EMS_BUILD_VERSION = version;
    console.log('╔══════════════════════════════════════════╗');
    console.log('║   ioBroker Energy Management System      ║');
    console.log(`║   EMS v${version}                       ║`);
    console.log('╚══════════════════════════════════════════╝');

    // Konfiguration laden
    const cfg = config.load();
    console.log(`[Main] Standort: ${cfg.location.latitude}°N, ${cfg.location.longitude}°E`);
    console.log(`[Main] PV-Anlagen: ${cfg.pvSystems.map(p => p.name).join(', ')}`);
    console.log(`[Main] Verbraucher: ${cfg.consumers.map(c => c.name).join(', ')}`);

    // Energy Manager starten
    const ems = new EnergyManager();
    await ems.start();

    // Web-Server starten
    const server = createWebServer(ems, cfg.web.port);

    // Graceful Shutdown
    const shutdown = () => {
        console.log('\n[Main] Beende...');
        ems.stop();
        server.close();
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

main().catch(err => {
    console.error('Fataler Fehler:', err);
    process.exit(1);
});
