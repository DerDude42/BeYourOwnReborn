/* =================================================================
   5. SPEICHERN & LADEN
   ================================================================= */
function saveGame() {
    tick();
    const payload = {
        version: SAVE_VERSION,
        lastSaved: Date.now(),
        resources: {},
        unlocked: [...state.unlocked],
        inventory: { ...state.inventory },
        upgrades: { ...state.upgrades },
        uses: { ...state.uses },
        loot: { ...state.loot },
        ticksPerSec: state.ticksPerSec,
        flags: { ...state.flags },
        equipped: { ...state.equipped },
        wins: { ...state.wins },
        pets: { ...state.pets },
        activePet: state.activePet,
        incubation: state.incubation ? { ...state.incubation } : null,
        bestiary: JSON.parse(JSON.stringify(state.bestiary)),
        seenItems: { ...state.seenItems },
        skills: JSON.parse(JSON.stringify(state.skills))
    };
    for (const key of Object.keys(RESOURCE_CONFIG)) {
        payload.resources[key] = { current: state.resources[key].current };
    }

    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
        storageOk = true;
        setStatus(`Zuletzt gespeichert: ${new Date().toLocaleTimeString('de-DE')}`);
    } catch (e) {
        storageOk = false;
        console.error("Speichern fehlgeschlagen:", e);
        setStatus("⚠ Speichern nicht möglich (Browser-Speicher gesperrt oder voll)");
    }
}

// Übernimmt nur validierte Werte; max kommt immer aus der aktuellen Konfiguration
function applySave(parsed) {
    if (!parsed || typeof parsed !== 'object') return;

    for (const key of Object.keys(RESOURCE_CONFIG)) {
        const saved = parsed.resources && parsed.resources[key]
            ? parsed.resources[key].current
            : undefined;
        if (typeof saved === 'number' && Number.isFinite(saved)) {
            state.resources[key].current = Math.max(0, saved); // Klemmen erst am Ende (Maxima hängen von Level/Items ab)
        }
    }

    // Shop: freigeschaltete Items und Inventar (nur bekannte IDs, nur gültige Zahlen)
    if (Array.isArray(parsed.unlocked)) {
        state.unlocked = ITEM_CONFIG
            .map(i => i.id)
            .filter(id => parsed.unlocked.includes(id));
    }
    if (parsed.inventory && typeof parsed.inventory === 'object') {
        for (const item of ITEM_CONFIG) {
            const n = parsed.inventory[item.id];
            if (Number.isInteger(n) && n > 0) {
                state.inventory[item.id] = item.maxOwned != null ? Math.min(n, item.maxOwned) : n;
            }
        }
    }

    // Upgrades & Trainingsfortschritt (nur bekannte IDs, nur gültige Zahlen)
    if (parsed.upgrades && typeof parsed.upgrades === 'object') {
        for (const u of UPGRADE_CONFIG) {
            const n = parsed.upgrades[u.id];
            if (Number.isInteger(n) && n > 0) state.upgrades[u.id] = u.maxLevel != null ? Math.min(n, u.maxLevel) : n;
        }
    }
    // Abschlüsse je Aktivität (alte Spielstände: Ganzkörper-Level wird übernommen)
    const savedUses = (parsed.uses && typeof parsed.uses === 'object') ? parsed.uses : {};
    const oldLevel = parsed.progress && parsed.progress.fullbody ? parsed.progress.fullbody.level : undefined;
    for (const a of ACTIVITY_CONFIG) {
        let n = savedUses[a.id];
        if (n === undefined && a.id === "fullbody") n = oldLevel;
        if (Number.isInteger(n) && n > 0) state.uses[a.id] = a.maxUses != null ? Math.min(n, a.maxUses) : n;
    }
    if (parsed.loot && typeof parsed.loot === 'object') {
        for (const id of Object.keys(LOOT_ITEMS)) {
            const n = parsed.loot[id];
            if (Number.isInteger(n) && n > 0) state.loot[id] = LOOT_ITEMS[id].maxOwned != null ? Math.min(n, LOOT_ITEMS[id].maxOwned) : n;
        }
    }

    if (parsed.inventory && parsed.inventory.kitchenKnife > 0) state.loot.kitchenKnife = 1; // alter Stand: Küchenmesser war im Shop kaufbar

    if (parsed.flags && typeof parsed.flags === 'object') {
        for (const f of FLAGS) if (parsed.flags[f] === true) state.flags[f] = true;
    }
    // Kampf-Siege
    if (parsed.wins && typeof parsed.wins === 'object') {
        for (const b of BATTLE_CONFIG) {
            const n = parsed.wins[b.id];
            if (Number.isInteger(n) && n >= 0 && n <= 1e6) state.wins[b.id] = n;
        }
    }
    if (parsed.uses && parsed.uses.lodge > 0 && !state.wins.lodge) state.wins.lodge = 1; // alter Stand: Jagdhütte war eine Aktion
    if (parsed.inventory && parsed.inventory.purse > 0 && upgradeLevel("purse") === 0) state.upgrades.purse = 3; // alter Stand: Geldbörse (+30) -> 3 Upgrade-Level
    // Pets, Brutstätte, Bestiarium
    state.pets = {}; state.activePet = null; state.incubation = null; state.bestiary = {}; state.seenItems = {};
    if (parsed.seenItems && typeof parsed.seenItems === 'object') {
        for (const [k, v] of Object.entries(parsed.seenItems)) if (v === true && k.length < 60) state.seenItems[k] = true;
    }
    if (parsed.pets && typeof parsed.pets === 'object') {
        for (const p of PET_CONFIG) if (parsed.pets[p.id] === true) state.pets[p.id] = true;
    }
    if (typeof parsed.activePet === 'string' && state.pets[parsed.activePet]) state.activePet = parsed.activePet;
    const inc = parsed.incubation;
    if (inc && typeof inc === 'object' && petById(inc.pet) && Number.isFinite(inc.left) && inc.left > 0 && inc.left <= petById(inc.pet).hatchTicks && !state.pets[inc.pet]) {
        state.incubation = { pet: inc.pet, left: Math.floor(inc.left), total: petById(inc.pet).hatchTicks };
    }
    if (parsed.bestiary && typeof parsed.bestiary === 'object') {
        const names = new Set(BATTLE_CONFIG.flatMap(b => b.enemies.map(e => e.name)));
        for (const [name, v] of Object.entries(parsed.bestiary)) {
            if (names.has(name) && v && Number.isInteger(v.kills) && v.kills >= 0 && v.kills <= 1e6) state.bestiary[name] = { kills: v.kills };
        }
    }
    // Skills
    if (parsed.skills && typeof parsed.skills === 'object') {
        for (const a of ACTIVITY_CONFIG.filter(x => x.skill)) {
            const sk = parsed.skills[a.id];
            if (sk && Number.isInteger(sk.level) && sk.level >= 0 && sk.level <= 1000 && typeof sk.xp === 'number' && Number.isFinite(sk.xp) && sk.xp >= 0) {
                state.skills[a.id] = { level: sk.level, xp: Math.min(Math.floor(sk.xp), skillNeed(sk.level) - 1) };
            }
        }
    }
    // Ausrüstung (alte Spielstände ohne Angabe: Besitz wird automatisch angelegt)
    state.equipped = {};
    if (parsed.equipped && typeof parsed.equipped === 'object') {
        for (const slot of Object.keys(SLOT_CONFIG)) {
            const id = parsed.equipped[slot];
            if (typeof id === 'string' && GEAR[id] && GEAR[id].slot === SLOT_CONFIG[slot].group && gearCount(id) > 0 && !isEquipped(id)) state.equipped[slot] = id;
        }
    } else {
        autoEquipAll();
    }
    if (Number.isInteger(parsed.ticksPerSec) && parsed.ticksPerSec >= 1 && parsed.ticksPerSec <= MAX_TICKS_PER_SEC) {
        state.ticksPerSec = parsed.ticksPerSec;
    }

    clampAll();

    // Offline-Fortschritt: Regeneration für die Zeit seit dem letzten Speichern
    if (typeof parsed.lastSaved === 'number' && Number.isFinite(parsed.lastSaved)) {
        regenerate(Math.floor(Math.max(0, (Date.now() - parsed.lastSaved) / 1000) * BASE_TICKS_PER_SEC)); // Offline immer mit Basis-Tempo
    }

    checkUnlocks();
}

function loadGame() {
    initDefaultState();

    let raw = null;
    try {
        raw = localStorage.getItem(SAVE_KEY);
    } catch (e) {
        storageOk = false;
        console.error("Speicher nicht lesbar:", e);
        setStatus("⚠ Speichern nicht möglich (Browser-Speicher gesperrt)");
        return;
    }
    if (!raw) return;

    try {
        applySave(JSON.parse(raw));
    } catch (e) {
        console.error("Speicherstand konnte nicht geladen werden:", e);
    }
}
