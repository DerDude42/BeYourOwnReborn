/* =================================================================
   2. SPIELZUSTAND
   ================================================================= */
const SAVE_KEY = "chronicle_minimal_v1";
const SAVE_VERSION = 1;
const AUTOSAVE_MS = 10000;

let state = { resources: {} };
let lastTick = Date.now();
let storageOk = true;

function initDefaultState() {
    state.resources = {};
    state.unlocked = [];   // IDs der freigeschalteten Shop-Items
    state.inventory = {};  // Item-ID -> Anzahl
    state.active = [];     // laufende Aktivitäten (wird nicht gespeichert)
    state.forcedSleepTicks = 0; // Restticks des Zwangsschlafs mit reduzierter Erholung (nicht gespeichert)
    state.upgrades = {};   // Upgrade-ID -> Level
    state.uses = {};       // Aktivität-ID -> Anzahl Abschlüsse
    state.runTicks = {};   // bisher gelaufene Ticks zeitbegrenzter Aktionen (nicht gespeichert)
    state.lastResult = {}; // letztes Ergebnis/Beute je Aktivität (nicht gespeichert)
    state.loot = {};       // Beute-Items: ID -> Anzahl
    state.flags = {};      // freigeschaltete Schalter (siehe FLAGS)
    state.equipped = {};   // Slot -> ausgerüstete Item-ID
    state.battle = null;   // laufender Kampf (nicht gespeichert)
    state.wins = {};       // Kampf-ID -> Siege
    state.pets = {};       // geschlüpfte Pets (ID -> true)
    state.activePet = null;
    state.incubation = null; // { pet, left, total }
    state.bestiary = {};   // Gegnername -> { kills }
    state.seenItems = {};  // Inventar-Zeilen, die schon einmal besessen wurden (bleiben sichtbar)
    state.skills = {};     // Skill-ID -> { level, xp, tier }
    state.meta = defaultMeta(); // bleibt beim Prestige erhalten: Ewiger Ruhm, Seiten, Vermächtnisse
    state.story = {};      // freigeschaltete Geschichts-Einträge (bleiben beim Prestige erhalten)
    state.ticksPerSec = BASE_TICKS_PER_SEC; // Spielgeschwindigkeit (Regler in den Stats)
    for (const u of UPGRADE_CONFIG) state.upgrades[u.id] = 0;
    for (const [key, cfg] of Object.entries(RESOURCE_CONFIG)) {
        state.resources[key] = { current: cfg.start };
    }
}

// Zwei-Schritt-Bestätigung im Button (confirm() wird in Vorschauen/Mobil-Browsern teils blockiert)
let resetArmed = false;
let resetTimer = null;

function disarmReset() {
    resetArmed = false;
    clearTimeout(resetTimer);
    if (ui.resetBtn) ui.resetBtn.textContent = "Hard Reset";
}

function onResetClick() {
    if (!resetArmed) {
        resetArmed = true;
        ui.resetBtn.textContent = "Sicher? Nochmal tippen = alles löschen";
        resetTimer = setTimeout(disarmReset, 5000);
        return;
    }
    disarmReset();
    hardReset();
}

function hardReset() {
    initDefaultState();
    lastTick = Date.now();
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignorieren */ }
    if (ui.sellQty) ui.sellQty = {};
    if (ui.battle) ui.battle.hidden = true;
    saveGame();
    updateUI();
    showTab('actions');
    setStatus("Spiel zurückgesetzt – Neustart.");
}

// Passiver Verbrauch einer Ressource pro Tick (0, solange der zugehörige Schalter nicht freigeschaltet ist)
function passiveDrainOf(key) {
    const cfg = RESOURCE_CONFIG[key];
    if (!cfg.drainPerTick) return 0;
    return (!cfg.drainFlag || state.flags[cfg.drainFlag]) ? cfg.drainPerTick : 0;
}

function critEligible(a) {
    return a.tab !== "loop" && a.tab !== "upgrades" && !a.noCrit;
}

function critChance() {
    return Math.min(1, BASE_CRIT_CHANCE + itemBonus("crit"));
}

function clampRes(key, value) {
    const cfg = RESOURCE_CONFIG[key];
    const v = Math.max(0, value);
    return cfg.hasMax ? Math.min(resMax(key), v) : v;
}

/* =================================================================
   3. SPIELLOGIK
   ================================================================= */
function canAfford(costObj) {
    for (const [resKey, amount] of Object.entries(costObj || {})) {
        const res = state.resources[resKey];
        if (!res || res.current < amount - 1e-9) return false;
    }
    return true;
}

// Regeneration pro Tick inkl. Ausrüstung (z. B. Amulett: energyRegen)
function regenOf(key) {
    const cfg = RESOURCE_CONFIG[key];
    const base = cfg.regenPerTick || 0;
    return base > 0 || itemBonus(key + "Regen") > 0 ? base + itemBonus(key + "Regen") : 0;
}

// Ohne Essen sinkt die normale Regeneration von Gesundheit und Energie auf 20 %
const STARVED_REGEN_FACTOR = 0.2;
function regenFactor() { return state.resources.food.current <= 1e-9 ? STARVED_REGEN_FACTOR : 1; }

// Regeneration für eine vergangene Zeitspanne (Sekunden) anwenden
function regenerate(ticks, mult = 1) {
    if (!(ticks > 0)) return;
    for (const [key, cfg] of Object.entries(RESOURCE_CONFIG)) {
        if (regenOf(key) > 0) {
            const res = state.resources[key];
            const f = (key === "health" || key === "energy") ? regenFactor() : 1;
            res.current = clampRes(key, res.current + regenOf(key) * ticks * f * (key === "energy" ? mult : 1));
        }
    }
}

// Zeitbasiert statt zählerbasiert: bleibt korrekt, auch wenn der Tab gedrosselt wird
// Holt alle fälligen Ticks nach (feste Schrittweite = 1000 / Ticks pro Sekunde ms)
function tick() {
    const now = Date.now();
    const tickMs = 1000 / state.ticksPerSec;
    let due = Math.floor((now - lastTick) / tickMs);
    if (due <= 0) {
        if (now < lastTick) lastTick = now; // Systemuhr wurde zurückgestellt
        return;
    }
    if (due > MAX_CATCHUP_TICKS) {
        due = MAX_CATCHUP_TICKS;
        lastTick = now;
    } else {
        lastTick += due * tickMs; // Rest-Bruchteil bleibt für den nächsten Tick erhalten
    }
    for (let i = 0; i < due; i++) gameTick();
}

// Ein Spiel-Tick: Regeneration + alle laufenden Aktivitäten
/* ---- Pets: Funktionen ---- */
function petById(id) { return PET_CONFIG.find(p => p.id === id); }
function activePetCfg() { return state.activePet ? petById(state.activePet) || null : null; }
// Pet fehlt noch komplett (nicht geschlüpft, nicht in der Brutstätte, kein Ei im Besitz)
function petFree(id) {
    const p = petById(id);
    return !state.pets[id] && !(state.incubation && state.incubation.pet === id) && (state.loot[p.egg] || 0) <= 0;
}
function petsUnlocked() { return !!state.flags.petsUnlocked; }
function startIncubation(petId) {
    const p = petById(petId);
    if (!p) return;
    tick();
    if (state.incubation) { showToast("Die Brutstätte ist belegt"); return; }
    if ((state.loot[p.egg] || 0) <= 0) return;
    state.loot[p.egg] -= 1;
    state.incubation = { pet: petId, left: p.hatchTicks, total: p.hatchTicks };
    updateUI();
    saveGame();
}
function incubationTick() {
    const inc = state.incubation;
    if (!inc) return;
    inc.left -= 1;
    if (inc.left <= 0) {
        const p = petById(inc.pet);
        state.pets[inc.pet] = true;
        if (!state.activePet) state.activePet = inc.pet;
        state.incubation = null;
        setStatus(`${p.name} ist geschlüpft!`);
        notifyPetTab();
    }
}
function setActivePet(id) {
    if (!state.pets[id]) return;
    tick();
    state.activePet = state.activePet === id ? null : id;
    clampAll();
    updateUI();
    saveGame();
}
function seeEnemy(name) { if (!state.bestiary[name]) state.bestiary[name] = { kills: 0 }; }
function lootText(table) {
    return table.map(e => {
        const parts = [];
        for (const [key, amount] of Object.entries(e.give || {})) parts.push(`+${amount} ${RESOURCE_CONFIG[key].name}`);
        if (e.item) parts.push(LOOT_ITEMS[e.item].name);
        return parts.join(", ") + (e.chance < 1 ? ` (${Math.round(e.chance * 100)} %)` : "");
    }).join(" · ");
}

function fillFame() { state.resources.fame.current = resMax("fame"); }
function winsOf(id) { return state.wins[id] || 0; }
function attackSpeed() { return BASE_ATTACK_SPEED + itemBonus("attackSpeed"); }
function battleById(id) { return BATTLE_CONFIG.find(b => b.id === id); }
function combatUnlocked() { return !!state.flags.combatUnlocked || state.resources.fame.current >= COMBAT_UNLOCK_FAME - 1e-9; }
function blog(msg) {
    const b = state.battle;
    if (!b) return;
    b.log.push(msg);
    if (b.log.length > BATTLE_LOG_MAX) b.log.shift();
}
function stopBattle() {
    state.battle = null;
    if (ui.battle) ui.battle.hidden = true;
}
function startBattle(id) {
    const cfg = battleById(id);
    if (!cfg) return;
    tick();
    if (state.resources.health.current <= 1e-9) { showToast("Zu wenig Gesundheit für einen Kampf"); return; }
    for (const other of [...state.active]) stopActivity(other);
    const enemies = cfg.enemies.map(e => scaledEnemy(cfg, e));
    state.battle = { id, idx: 0, enemies, enemyHp: enemies[0].hp, pProg: 0, petProg: 0, eProg: 0, log: [], over: false, result: "" };
    blog(`Du betrittst: ${cfg.name}.`);
    blog(`${enemies[0].name} erscheint.`);
    seeEnemy(enemies[0].name);
    ui.battle.hidden = false;
    updateUI();
}
// Gegner einer Region/des Wolfs werden mit jeder Seite stärker
function scaledEnemy(cfg, e) {
    if (!cfg.scale) return { ...e };
    const k = enemyScale();
    return { ...e, hp: Math.round(e.hp * k), atk: Math.round(e.atk * k * 100) / 100 };
}
function onBattleClick(id) {
    if (state.battle && state.battle.id === id && !state.battle.over) { ui.battle.hidden = false; updateUI(); return; }
    startBattle(id);
}
// Ein Kampf-Tick: Spieler, Pet und Gegner sammeln Angriffsfortschritt (Angriffe/Tick) und schlagen bei >= 1 zu
function battleTick() {
    const b = state.battle;
    if (!b || b.over) return;
    const cfg = battleById(b.id);
    const enemy = () => b.enemies[b.idx];

    // Schaden am Gegner; kümmert sich um Sieg bzw. nächsten Gegner
    const hitEnemy = (dmg, who) => {
        b.enemyHp = Math.max(0, b.enemyHp - dmg);
        blog(`${who} greift ${enemy().name} an: ${fmt(dmg)} Schaden.`);
        if (b.enemyHp > 1e-9) return;
        blog(`${enemy().name} besiegt!`);
        seeEnemy(enemy().name);
        state.bestiary[enemy().name].kills += 1;
        b.idx += 1;
        if (b.idx >= b.enemies.length) {
            b.over = true;
            b.result = "win";
            state.wins[b.id] = (state.wins[b.id] || 0) + 1;
            blog(`${cfg.name} abgeschlossen!`);
            setStatus(`${cfg.name} gewonnen.`);
            if (cfg.onWin) {
                const loot = cfg.onWin();
                if (loot) blog("Beute: " + loot);
                checkUnlocks();
            }
        } else {
            b.enemyHp = enemy().hp;
            b.eProg = 0;
            blog(`${enemy().name} erscheint.`);
            seeEnemy(enemy().name);
        }
    };

    addSkillXp("combat");
    b.pProg += attackSpeed();
    while (b.pProg >= 1 && !b.over) { b.pProg -= 1; hitEnemy(atk(), "Du"); }

    const pet = activePetCfg();
    if (pet && !b.over) {
        b.petProg += pet.speed;
        while (b.petProg >= 1 && !b.over) { b.petProg -= 1; hitEnemy(pet.atk, pet.name); }
    }
    if (b.over) { b.idx = Math.min(b.idx, b.enemies.length - 1); return; }

    b.eProg += enemy().speed;
    while (b.eProg >= 1 && !b.over) {
        b.eProg -= 1;
        const hp = state.resources.health;
        hp.current = Math.max(0, hp.current - enemy().atk);
        blog(`${enemy().name} trifft dich: ${fmt(enemy().atk)} Schaden.`);
        if (hp.current <= 1e-9) {
            b.over = true;
            b.result = "lose";
        }
    }
    if (b.result === "lose") { // verloren: Kampf wird beendet und muss neu begonnen werden
        stopBattle();
        setStatus("Kampf verloren");
        showToast("Kampf verloren. Du solltest härter trainieren!");
    }
}

function gameTick() {
    regenerate(1, regenMult());
    if (regenFlat() > 0) state.resources.energy.current = clampRes("energy", state.resources.energy.current + regenFlat());
    // Passiver Verbrauch (z. B. Nahrung), bis die Ressource leer ist
    for (const [key, cfg] of Object.entries(RESOURCE_CONFIG)) {
        const passive = passiveDrainOf(key);
        if (passive > 0) {
            state.resources[key].current = Math.max(0, state.resources[key].current - passive);
        }
    }
    for (const id of [...state.active]) {
        const activity = activityById(id);
        if (activity) runActivity(activity);
    }
    incubationTick();
    if (state.battle) battleTick();
    storyCheck();
    if (state.resources.health.current <= 1e-9 && !isActive("sleep")) forceSleep();
}

function executeAction(actionId) {
    const action = ACTION_CONFIG.find(a => a.id === actionId);
    if (!action) return;

    tick(); // Regeneration bis jetzt berücksichtigen
    const cost = action.cost || {};
    const reward = rewardOf(action);

    if (!canAfford(cost)) { failFeedback(ui.buttons[action.id], missingText(cost)); updateUI(); return; }

    // Konfigurationsfehler abfangen, bevor etwas abgezogen wird
    for (const resKey of Object.keys(reward)) {
        if (!state.resources[resKey]) {
            console.error(`Aktion "${action.id}": unbekannte Belohnungs-Ressource "${resKey}"`);
            return;
        }
    }

    for (const other of [...state.active]) stopActivity(other); // Betteln beendet z. B. die Meditation
    if (state.battle) stopBattle();
    for (const [resKey, amount] of Object.entries(cost)) {
        state.resources[resKey].current -= amount;
    }
    const crit = Math.random() < critChance();
    const gained = {};
    for (const [resKey, amount] of Object.entries(reward)) {
        const res = state.resources[resKey];
        gained[resKey] = amount * (crit ? CRIT_MULT : 1);
        res.current = clampRes(resKey, res.current + gained[resKey]);
    }

    checkUnlocks();
    updateUI();
    saveGame(); // sofort speichern, nicht erst beim nächsten Intervall
    if (crit) setStatus(`★ Kritischer Treffer x${CRIT_MULT}! ${formatResMap(gained, "+")}`);
}

/* ---- Shop ---- */
// Schaltet Items frei, deren Gold-Schwelle erreicht wurde (bleibt dauerhaft freigeschaltet)
function checkUnlocks() {
    if ((state.loot.foxTail || 0) > 0) state.flags.foxTailFound = true;
    if (state.resources.fame.current >= COMBAT_UNLOCK_FAME - 1e-9) state.flags.combatUnlocked = true;
    if (usesOf("patrol") >= 5 && !state.flags.caveFound) {
        state.flags.caveFound = true;
        setStatus("Wolfshöhle entdeckt");
        showToast("Du hast die Wolfshöhle entdeckt!");
    }
    if (state.incubation || PET_CONFIG.some(p => state.pets[p.id] || (state.loot[p.egg] || 0) > 0)) state.flags.petsUnlocked = true;
    for (const item of ITEM_CONFIG) {
        const reached = item.unlockWhen ? item.unlockWhen() : canAfford(item.unlock);
        if (!state.unlocked.includes(item.id) && reached) {
            state.unlocked.push(item.id);
            flashInventoryTab();
        }
    }
}

// Pets-Reiter leuchtet, bis er geöffnet wird
function notifyPetTab() {
    if (ui.petTab && currentTab !== 'pets') ui.petTab.classList.add('glow');
}

// Lässt den Inventar-Reiter aufblinken (nicht, wenn man ihn gerade ansieht)
function flashInventoryTab() {
    const el = ui.invTab;
    if (!el || currentTab === 'inventory') return;
    el.classList.remove('flash');
    void el.offsetWidth; // Animation neu starten
    el.classList.add('flash');
}

// Gesamtbonus: Items + Abschlüsse von Aktivitäten mit bonusPerUse
function statBonus(name) {
    let total = itemBonus(name);
    for (const a of ACTIVITY_CONFIG) {
        if (a.bonusPerUse && a.bonusPerUse[name]) total += usesOf(a.id) * a.bonusPerUse[name];
    }
    return total;
}

function hasBuyableItem() {
    return ITEM_CONFIG.some(item => state.unlocked.includes(item.id) && !isMaxed(item) && canAfford(item.cost));
}

function ownedCount(item) {
    return state.inventory[item.id] || 0;
}

function isMaxed(item) {
    return item.maxOwned != null && ownedCount(item) >= item.maxOwned;
}

function buyItem(itemId) {
    const item = ITEM_CONFIG.find(i => i.id === itemId);
    if (!item || !state.unlocked.includes(item.id)) return;

    tick();
    if (isMaxed(item)) { updateUI(); return; }
    if (!canAfford(item.cost)) { failFeedback(ui.items[item.id].btn, missingText(item.cost)); updateUI(); return; }

    for (const [resKey, amount] of Object.entries(item.cost)) {
        state.resources[resKey].current -= amount;
    }
    state.inventory[item.id] = ownedCount(item) + 1;
    offerEquip(item.id);

    updateUI();
    saveGame();
}

/* ---- Boni & dynamische Maxima ---- */
// Passive Items (ohne Slot) wirken im Besitz, Ausrüstung nur, solange sie angelegt ist
function itemBonus(name) {
    let total = 0;
    for (const item of ITEM_CONFIG) {
        if (item.slot) continue;
        total += ownedCount(item) * ((item.effects && item.effects[name]) || 0);
    }
    for (const id of Object.values(state.equipped || {})) {
        const g = GEAR[id];
        if (g) total += g.effects[name] || 0;
    }
    for (const u of UPGRADE_CONFIG) { // Upgrades mit dauerhaften Effekten pro Level
        if (u.effects) total += upgradeLevel(u.id) * (u.effects[name] || 0);
    }
    const pet = activePetCfg();
    if (pet) total += pet.effects[name] || 0;
    total += skillBonus(name);
    total += legacyBonus(name);
    return total;
}

/* ---- Ausrüstung ---- */
function gearCount(id) {
    const g = GEAR[id];
    if (!g) return 0;
    return g.source === "shop" ? (state.inventory[id] || 0) : (state.loot[id] || 0);
}
function slotOf(id) {
    for (const [slot, eid] of Object.entries(state.equipped)) if (eid === id) return slot;
    return null;
}
function isEquipped(id) { return !!GEAR[id] && slotOf(id) !== null; }
// Beute-Stücke, die nicht gerade getragen werden (verkaufbar / vergrabbar)
function freeCount(id) { return (state.loot[id] || 0) - (isEquipped(id) ? 1 : 0); }
function slotsOfGroup(group) { return Object.keys(SLOT_CONFIG).filter(k => SLOT_CONFIG[k].group === group); }
// Legt neues Gear automatisch in einen freien passenden Slot (Talisman nur manuell)
function autoEquip(id) {
    const g = GEAR[id];
    if (!g || g.manual || gearCount(id) <= 0 || isEquipped(id)) return;
    const free = slotsOfGroup(g.slot).find(k => !state.equipped[k]);
    if (free) state.equipped[free] = id;
}
// Neues Gear: im Browser fragt ein Dialog nach (mit Vergleich), ohne Oberfläche (Tests/Bot) wird direkt angelegt
const HAS_DIALOGS = typeof window !== 'undefined' && typeof window.innerWidth === 'number';
const equipOffers = [];
function offerEquip(id) {
    const g = GEAR[id];
    if (!g || g.manual || gearCount(id) <= 0 || isEquipped(id)) return;
    if (!HAS_DIALOGS) { autoEquip(id); return; }
    if (!equipOffers.includes(id)) equipOffers.push(id);
    showNextEquipOffer();
}
// Ziel-Slot für ein neues Teil: freier Slot, sonst der mit dem schwächsten Teil
function effectSum(id) { const e = (GEAR[id] && GEAR[id].effects) || {}; return Object.values(e).reduce((a, v) => a + v, 0); }
function targetSlotFor(id) {
    const slots = slotsOfGroup(GEAR[id].slot);
    const free = slots.find(k => !state.equipped[k]);
    if (free) return free;
    return slots.slice().sort((a, b) => effectSum(state.equipped[a]) - effectSum(state.equipped[b]))[0];
}
function autoEquipAll() { for (const id of Object.keys(GEAR)) autoEquip(id); }
// Setzt (oder leert mit null) einen Slot; ein Item wandert dabei aus seinem alten Slot
function setSlot(slot, id) {
    tick();
    if (id === null) {
        delete state.equipped[slot];
    } else {
        if (!GEAR[id] || gearCount(id) <= 0 || GEAR[id].slot !== SLOT_CONFIG[slot].group) return;
        const old = slotOf(id);
        if (old) delete state.equipped[old];
        state.equipped[slot] = id;
    }
    clampAll();
    updateUI();
    saveGame();
}
function toggleEquip(id) {
    const g = GEAR[id];
    if (!g) return;
    tick();
    const cur = slotOf(id);
    if (cur) {
        delete state.equipped[cur];
    } else if (gearCount(id) > 0) {
        const slots = slotsOfGroup(g.slot);
        state.equipped[slots.find(k => !state.equipped[k]) || slots[0]] = id;
    }
    clampAll();
    updateUI();
    saveGame();
}

// Auswahl-Fenster für einen Slot
function closePicker() { ui.picker.hidden = true; }
function onSlotClick(slot) {
    tick();
    const cfg = SLOT_CONFIG[slot];
    ui.pickerTitle.textContent = cfg.name + " – Auswahl";
    ui.pickerList.textContent = "";
    const add = (title, sub, fn) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'action-btn';
        const h = document.createElement('div');
        h.className = 'btn-header';
        h.textContent = title;
        const d = document.createElement('div');
        d.className = 'btn-desc';
        d.textContent = sub;
        btn.append(h, d);
        btn.addEventListener('click', () => { closePicker(); fn(); });
        ui.pickerList.appendChild(btn);
    };
    const current = state.equipped[slot];
    if (current) add("– Ablegen –", GEAR[current].name + " zurück ins Inventar", () => setSlot(slot, null));
    let options = 0;
    for (const g of Object.values(GEAR)) {
        if (g.slot !== cfg.group || gearCount(g.id) <= 0 || g.id === current) continue;
        const other = slotOf(g.id);
        add(g.name, `${g.category} · ${g.desc}` + (other ? ` · (aktuell in ${SLOT_CONFIG[other].name})` : ""), () => setSlot(slot, g.id));
        options++;
    }
    if (!current && options === 0) { showToast("Kein passendes Item im Inventar"); return; }
    ui.picker.hidden = false;
}

// Verbrauch pro Tick inkl. Item-Boni (z. B. T-Shirt beim Jagen)
function drainOf(activity) {
    const out = {};
    for (const [key, perTick] of Object.entries(activity.drain || {})) {
        const bonusName = activity.drainBonus && activity.drainBonus[key];
        out[key] = Math.max(0, perTick - (bonusName ? statBonus(bonusName) : 0));
    }
    return out;
}

function resMax(key) {
    const cfg = RESOURCE_CONFIG[key];
    if (!cfg.hasMax) return Infinity;
    let max = cfg.max;
    for (const a of ACTIVITY_CONFIG) {
        if (a.levelBonus && a.levelBonus[key]) max += Math.min(usesOf(a.id), a.bonusUses != null ? a.bonusUses : Infinity) * a.levelBonus[key];
    }
    max += itemBonus("max" + key.charAt(0).toUpperCase() + key.slice(1)); // z. B. maxEnergy
    if (key === "fame") { // Berichte an den Dorfvorsteher erweitern den möglichen Ruhm, jede Seite zusätzlich
        for (const [flag, add] of Object.entries(FAME_CAP_FLAGS)) if (state.flags[flag]) max += add;
        max += PAGE_FAME_BONUS * state.meta.pages;
    }
    if (key === "health" || key === "energy") max *= 1 + eternalPct(); // passiver Bonus des Ewigen Ruhms
    return max;
}

function clampAll() {
    for (const key of Object.keys(RESOURCE_CONFIG)) {
        state.resources[key].current = clampRes(key, state.resources[key].current);
    }
}

function rewardOf(action) {
    const out = {};
    for (const [key, amount] of Object.entries(action.reward || {})) {
        const bonusName = action.bonus && action.bonus[key];
        out[key] = (amount + (bonusName ? itemBonus(bonusName) : 0)) * (key === "money" ? goldMult() : 1);
    }
    return out;
}

/* ---- Aktivitäten (Loop & Training) ---- */
function activityById(id) { return ACTIVITY_CONFIG.find(a => a.id === id); }
function isActive(id) { return state.active.includes(id); }
function apTotal() { return BASE_ACTION_POINTS; }
function upgradeLevel(id) { return state.upgrades[id] || 0; }
function maxHealth() { return resMax("health"); }

function regenFlat() { return isActive("meditation") ? MEDITATION_FLAT_REGEN : 0; }
// Multiplikatoren (Meditation, Ausruhen-Skill) sind vorerst entfernt – sie kommen später als Offline-System zurück
function regenMult() { return 1; }

// Erholungsfaktor beim Schlafen: reduziert, solange der Zwangsschlaf-Zähler läuft
function sleepFactor() {
    return state.forcedSleepTicks > 0 ? FORCED_SLEEP_FACTOR : 1;
}

// Gesundheit bei 0: Schlafen wird erzwungen (alles andere wird beendet)
function forceSleep() {
    state.active = ["sleep"];
    state.forcedSleepTicks = FORCED_SLEEP_TICKS;
    setStatus("Erschöpft! Du musst dich zwangsweise ausruhen.");
}

function stopActivity(id) {
    state.active = state.active.filter(x => x !== id); // Fortschritt (runTicks) bleibt bis zum Abschluss erhalten
    if (id === "sleep") state.forcedSleepTicks = 0;
}

function usesOf(id) { return state.uses[id] || 0; }
function isMaxedActivity(a) { return a.maxUses != null && usesOf(a.id) >= a.maxUses; }
// Abgeschlossene (maxUses erreicht) Training-/Aktions-Einträge verschwinden; Loop-Aktionen ohne maxUses bleiben
// Entweder-oder beim Fuchsschwanz: sobald eine Option gewählt wurde, verschwinden beide
function foxChoiceOpen() { return usesOf("wearTail") === 0 && usesOf("buryTail") === 0; }
function isVisible(a) {
    const ok = !a.visible || a.visible();
    if (isMaxedActivity(a)) return ok && !!state.flags.showMaxed && (a.tab === "training" || a.tab === "upgrades"); // Filter: Abgeschlossenes anzeigen
    return ok;
}

// Angriff = Grundwert + Items + Ganzkörpertraining
function atk() {
    let total = BASE_ATK + itemBonus("atk");
    for (const a of ACTIVITY_CONFIG) {
        if (a.atkPerUse) total += usesOf(a.id) * a.atkPerUse;
    }
    return total * (1 + eternalPct() * ETERNAL_ATK_SHARE);
}

// Liefert einen Hinweistext, wenn eine Voraussetzung fehlt, sonst ""
function requirementProblem(a) {
    if (a.problem) { const p = a.problem(); if (p) return p; }
    const r = a.requires;
    if (!r) return "";
    if (r.atk && atk() < r.atk - 1e-9) {
        return `Angriff zu niedrig: benötigt ${fmt(r.atk)} (aktuell ${fmt(atk())})`;
    }
    if (r.maxEnergy && resMax("energy") < r.maxEnergy) {
        return `Max. Energie zu niedrig: benötigt ${r.maxEnergy} (aktuell ${resMax("energy")})`;
    }
    return "";
}

function meetsRequirements(a) {
    return !requirementProblem(a);
}

// Bedarf zum Start: Einmalkosten + Verbrauch des ersten Ticks (der Rest wird tickweise bezahlt)
function startNeeds(a) {
    const need = (state.runTicks[a.id] || 0) > 0 ? {} : { ...(a.cost || {}) }; // Einmalkosten nur beim frischen Start
    for (const [key, perTick] of Object.entries(drainOf(a))) {
        need[key] = (need[key] || 0) + perTick + passiveDrainOf(key);
    }
    return need;
}

// Würfelt eine Beutetabelle: jeder Eintrag hat seine eigene Chance; liefert einen Ergebnistext
function rollLoot(table, mult = 1) {
    const parts = [];
    for (const entry of table) {
        if (entry.when && !entry.when()) continue; // z. B. Eier nur, solange das Pet noch fehlt
        if (Math.random() >= entry.chance) continue;
        for (const [key, amount] of Object.entries(entry.give || {})) {
            const res = state.resources[key];
            const before = res.current;
            res.current = clampRes(key, res.current + amount * mult * (key === "money" ? goldMult() : 1));
            parts.push(`+${fmt(res.current - before, 0)} ${RESOURCE_CONFIG[key].name}`);
        }
        if (entry.item) {
            const it = LOOT_ITEMS[entry.item];
            const have = state.loot[entry.item] || 0;
            const room = it.maxOwned != null ? it.maxOwned - have : Infinity;
            const n = Math.min((entry.amount || 1) * mult, room);
            if (n <= 0) continue; // Limit erreicht: nichts mehr zu finden
            state.loot[entry.item] = have + n;
            offerEquip(entry.item);
            if (PET_CONFIG.some(p => p.egg === entry.item)) notifyPetTab();
            parts.push(`${n}x ${it.name}`);
        }
    }
    return parts.length ? parts.join(", ") : "Nichts gefunden";
}

// Verkauft die gewählte Menge (nur nicht getragene Stücke, begrenzt durch das Gold-Maximum)
function sellLoot(id, qty = 1) {
    const it = LOOT_ITEMS[id];
    if (!it || !it.value) return;
    tick();
    const have = freeCount(id);
    let k = Math.min(have, Math.max(1, Math.floor(qty) || 1));
    for (const [key, perItem] of Object.entries(it.value)) {
        const space = resMax(key) - state.resources[key].current;
        k = Math.min(k, Math.floor((space + 1e-9) / perItem));
    }
    if (k <= 0) { setStatus(have > 0 ? "Gold-Maximum erreicht – nichts verkauft." : "Nichts zu verkaufen."); updateUI(); return; }
    for (const [key, perItem] of Object.entries(it.value)) {
        state.resources[key].current = clampRes(key, state.resources[key].current + perItem * k);
    }
    state.loot[id] = (state.loot[id] || 0) - k;
    checkUnlocks();
    setStatus(`${k}x ${it.name} verkauft: ${formatResMap(Object.fromEntries(Object.entries(it.value).map(([key, v]) => [key, v * k])), "+")}`);
    updateUI();
    saveGame();
}

/* ---- Feedback bei fehlenden Ressourcen: rotes Blinken (0,2 s) + schwebende Meldung ---- */
let toastTimer = null;

function showToast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

function flashFail(btn) {
    if (!btn) return;
    btn.classList.add('fail');
    clearTimeout(btn._failTimer);
    btn._failTimer = setTimeout(() => btn.classList.remove('fail'), 200);
}

function failFeedback(btn, msg) {
    flashFail(btn);
    showToast(msg);
}

// Text "Es fehlt: 2 Energie, 5 Gold" für alles, was zur Zeit nicht reicht
function missingText(needs) {
    const parts = [];
    for (const [key, amount] of Object.entries(needs || {})) {
        const have = state.resources[key] ? state.resources[key].current : 0;
        if (have < amount - 1e-9) {
            const missing = Math.ceil((amount - have) * 100 - 1e-6) / 100;
            parts.push(`${fmt(missing)} ${RESOURCE_CONFIG[key] ? RESOURCE_CONFIG[key].name : key}`);
        }
    }
    return parts.length ? "Es fehlt: " + parts.join(", ") : "";
}

function activityInfo(a) {
    let text = a.info();
    if (critEligible(a)) text += ` · Crit ${fmt(critChance() * 100, 0)} %`;
    if (a.duration && (state.runTicks[a.id] || 0) > 0) text += ` · ${state.runTicks[a.id]}/${a.duration} Ticks`;
    const lacking = isActive(a.id) ? pausedBy(a) : null;
    if (lacking) text += ` · ⏸ pausiert: ${RESOURCE_CONFIG[lacking].name} fehlt`;
    if (state.lastResult[a.id]) text += ` · Zuletzt: ${state.lastResult[a.id]}`;
    return text;
}

// Loop, Training und Erkunden sind klickbar: Starten beendet die jeweils anderen Gruppen
function toggleActivity(id) {
    const activity = activityById(id);
    if (!activity) return;
    tick();
    if (isActive(id)) {
        stopActivity(id);
    } else if (isMaxedActivity(activity)) {
        // Button ist in diesem Fall gesperrt
    } else if (!meetsRequirements(activity)) {
        failFeedback(ui.act[id].btn, requirementProblem(activity));
    } else if (!canAfford(startNeeds(activity))) {
        failFeedback(ui.act[id].btn, missingText(startNeeds(activity)));
    } else {
        beginActivity(activity);
    }
    updateUI();
}

// Bezahlt die Einmalkosten, bricht alle anderen laufenden Aktivitäten ab und startet diese
function beginActivity(activity) {
    if (!(state.runTicks[activity.id] > 0)) {
        for (const [key, amount] of Object.entries(activity.cost || {})) {
            state.resources[key].current -= amount;
        }
    }
    for (const other of [...state.active]) stopActivity(other);
    if (state.battle) stopBattle();
    state.runTicks[activity.id] = state.runTicks[activity.id] || 0;
    state.active.push(activity.id);
}

// Ein Tick einer Aktivität: nur ausführbar, wenn der volle Verbrauch bezahlbar ist, sonst Stopp
// Liefert die Ressource, die für den nächsten Tick fehlt (Gesundheit zählt nicht: sie darf auf 0 fallen), sonst null
function pausedBy(activity) {
    for (const [key, perTick] of Object.entries(drainOf(activity))) {
        if (key !== "health" && state.resources[key].current < perTick - 1e-9) return key;
    }
    return null;
}

// Ein Tick einer Aktivität: fehlt Ressource, pausiert sie (Fortschritt bleibt), sonst läuft sie weiter
function runActivity(activity) {
    if (activity.problem && activity.problem()) { stopActivity(activity.id); return; }
    if (pausedBy(activity)) return;
    const drain = drainOf(activity);
    for (const [key, perTick] of Object.entries(drain)) {
        state.resources[key].current = Math.max(0, state.resources[key].current - perTick);
    }
    const gain = activity.gain ? activity.gain() : {};
    for (const [key, perTick] of Object.entries(gain)) {
        state.resources[key].current = clampRes(key, state.resources[key].current + perTick);
    }
    if (activity.onTick) activity.onTick();
    skillsTick(activity);

    if (activity.duration) {
        state.runTicks[activity.id] = (state.runTicks[activity.id] || 0) + 1;
        if (state.runTicks[activity.id] >= activity.duration) completeActivity(activity);
    }
}

function completeActivity(activity) {
    // Crit: nur bei Nicht-Loop-Aktionen, Ergebnis wird x3
    const crit = critEligible(activity) && Math.random() < critChance();
    const mult = crit ? CRIT_MULT : 1;
    let text = activity.onComplete ? (activity.onComplete(activity, mult) || "") : "";
    const before = usesOf(activity.id);
    // Mit Maximum (Training): ein Crit zählt mehrfach, höchstens bis zum Maximum
    state.uses[activity.id] = activity.maxUses != null ? Math.min(activity.maxUses, before + mult) : before + 1;
    if (crit) {
        const levels = activity.maxUses != null ? ` +${state.uses[activity.id] - before} Level` : "";
        text = `★ Kritisch x${CRIT_MULT}!${levels}${text ? " " + text : ""}`;
    }
    if (activity.jobIncome) { // Arbeits-Fähigkeit: zusätzliches Gold je Abschluss
        const extra = itemBonus("jobGold") * goldMult();
        if (extra > 0) { state.resources.money.current = clampRes("money", state.resources.money.current + extra); text += ` +${fmt(extra)} Gold (Arbeit)`; }
    }
    state.lastResult[activity.id] = text;
    checkUnlocks();
    delete state.runTicks[activity.id];
    stopActivity(activity.id);
    if (activity.repeat && !isMaxedActivity(activity) && meetsRequirements(activity) && canAfford(startNeeds(activity))) {
        beginActivity(activity);
    }
}

/* ---- Upgrades ---- */
function upgradeCost(upgrade) {
    const level = upgradeLevel(upgrade.id);
    if (upgrade.costs) return { ...upgrade.costs[Math.min(level, upgrade.costs.length - 1)] };
    const cost = {};
    for (const [key, base] of Object.entries(upgrade.baseCost)) {
        cost[key] = Math.ceil(base * Math.pow(upgrade.costFactor, level));
    }
    return cost;
}

function buyUpgrade(upgradeId) {
    const upgrade = UPGRADE_CONFIG.find(u => u.id === upgradeId);
    if (!upgrade) return;
    tick();
    if (upgrade.maxLevel != null && upgradeLevel(upgrade.id) >= upgrade.maxLevel) { updateUI(); return; }
    const cost = upgradeCost(upgrade);
    if (!canAfford(cost)) { failFeedback(ui.up[upgrade.id].btn, missingText(cost)); updateUI(); return; }
    for (const [key, amount] of Object.entries(cost)) {
        state.resources[key].current -= amount;
    }
    state.upgrades[upgrade.id] = upgradeLevel(upgrade.id) + 1;
    updateUI();
    saveGame();
}
