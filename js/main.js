/* =================================================================
   6. START
   ================================================================= */
loadGame();
lastTick = Date.now();
buildUI();
buildMenus();
buildChronik();
initTabs();
updateUI();
updateClock();

setInterval(() => { tick(); updateUI(); }, 100); // Regeneration & Button-Status
setInterval(updateClock, 1000);
setInterval(saveGame, AUTOSAVE_MS);

// Speichern, wenn der Tab verlassen oder im Hintergrund pausiert wird
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        saveGame();
    } else {
        tick();          // Zeit im Hintergrund nachrechnen
        updateUI();
    }
});
window.addEventListener('pagehide', saveGame);

// Mehrere Tabs: Stand des zuletzt speichernden Tabs übernehmen
window.addEventListener('storage', (e) => {
    if (e.key !== SAVE_KEY || !e.newValue) return;
    try {
        applySave(JSON.parse(e.newValue));
        lastTick = Date.now();
        updateUI();
    } catch (err) {
        console.error("Synchronisation fehlgeschlagen:", err);
    }
});
