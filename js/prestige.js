/* =================================================================
   PRESTIGE: "Neue Seite aufschlagen" wandelt Ruhm in Ewigen Ruhm um und setzt den Lauf zurück.
   Ewiger Ruhm gibt dauerhaft einen passiven Bonus und lässt sich in Vermächtnisse investieren.
   Erhalten bleiben: Ewiger Ruhm, Vermächtnisse, Fähigkeiten, Pets, Bestiarium, Geschichte.
   ================================================================= */
const ETERNAL_PCT_FIRST = 0.005;   // +0,5 % max. Gesundheit/Energie und Gold je Ewigem Ruhm (bis 100)
const ETERNAL_PCT_AFTER = 0.00125; // danach nur noch +0,125 % je Ewigem Ruhm
const ETERNAL_PER_FAME = 0.4;      // Ewiger Ruhm je Ruhmpunkt
const ETERNAL_PER_BOSS = 4;        // zusätzlich je besiegtem Regions-Boss
const ETERNAL_FINALE = 10;         // zusätzlich für den Tempelwächter
const ETERNAL_ATK_SHARE = 0.5;      // Ewiger Ruhm wirkt zur Hälfte auch auf den Angriff
const PAGE_FAME_BONUS = 10;        // max. Ruhm je abgeschlossener Seite
// max. Ruhm wächst mit den Berichten an den Dorfvorsteher: 20 -> 25 -> 45 -> 70 -> 100
const FAME_CAP_FLAGS = { fameCap25: 5, fameCap45: 20, fameCap70: 25, fameCap100: 30 };
const PAGE_ENEMY_SCALE = 0.1;      // Gegner werden je Seite um 10 % stärker (nur Regionen und Wolf)

// effects: Bonus je Stufe (über itemBonus abfragbar) | Erbstücke und Narben wirken beim Start einer Seite
const LEGACY_CONFIG = [
    { id: "beg",      name: "Bettlerroutine",  desc: "Betteln bringt +0,25 Gold mehr je Stufe.", max: 5,  costs: [3, 6, 9, 12, 15], effects: { begBonus: 0.25 } },
    { id: "heirloom", name: "Erbstücke",       desc: "Du beginnst jede Seite mit Ausrüstung. Stufe 1: Küchenschürze, 2: Küchenmesser, 3: Geldbörse Stufe 3, 4: Hemd, Hose, Handschuhe und Schuhe.", max: 4, costs: [5, 10, 20, 40] },
    { id: "scars",    name: "Alte Narben",     desc: "Du beginnst jede Seite mit 2 Ganzkörper-Leveln mehr je Stufe.", max: 5, costs: [4, 8, 12, 16, 20] },
    { id: "learner",  name: "Wissensdurst",    desc: "+10 % Fähigkeiten-XP je Stufe.", max: 10, costs: [6, 6, 9, 9, 12, 12, 15, 15, 18, 18] },
    { id: "soul",     name: "Kräftige Seele",  desc: "+1 max. Gesundheit und +1 max. Energie je Stufe.", max: 10, costs: [3, 5, 7, 9, 11, 13, 15, 17, 19, 21], effects: { maxHealth: 1, maxEnergy: 1 } },
    { id: "purse",    name: "Prall gefüllter Beutel", desc: "+10 max. Gold je Stufe.", max: 8, costs: [2, 4, 6, 8, 10, 12, 14, 16], effects: { maxMoney: 10 } }
];
const legacyCfg = (id) => LEGACY_CONFIG.find(l => l.id === id);

function defaultMeta() { return { eternal: 0, spent: 0, pages: 0, legacy: {} }; }
function legacyLevel(id) { return (state.meta.legacy && state.meta.legacy[id]) || 0; }
function eternalAvail() { return state.meta.eternal - state.meta.spent; }
function eternalPct() {
    const e = state.meta.eternal;
    return ETERNAL_PCT_FIRST * Math.min(e, 100) + ETERNAL_PCT_AFTER * Math.max(0, e - 100);
}
function goldMult() { return 1 + eternalPct(); }
function enemyScale() { return 1 + PAGE_ENEMY_SCALE * state.meta.pages; }
function skillXpMult() { return 1 + 0.1 * legacyLevel("learner"); }
function legacyBonus(name) {
    let total = 0;
    for (const l of LEGACY_CONFIG) if (l.effects && l.effects[name]) total += legacyLevel(l.id) * l.effects[name];
    return total;
}

function legacyCost(id) {
    const l = legacyCfg(id), lv = legacyLevel(id);
    return lv >= l.max ? null : l.costs[lv];
}
function buyLegacy(id) {
    const cost = legacyCost(id);
    if (cost == null) return;
    if (eternalAvail() < cost) { showToast(`Zu wenig Ewiger Ruhm (${cost} nötig)`); return; }
    state.meta.spent += cost;
    state.meta.legacy[id] = legacyLevel(id) + 1;
    clampAll();
    updateUI();
    saveGame();
}

/* ---- Prestige ---- */
function bossesBeaten() { return ["boss1", "boss2", "boss3"].filter(id => winsOf(id) >= 1).length; }
function eternalGain() {
    return Math.floor(state.resources.fame.current * ETERNAL_PER_FAME + 1e-9)
        + ETERNAL_PER_BOSS * bossesBeaten()
        + (winsOf("finale") >= 1 ? ETERNAL_FINALE : 0);
}
function prestigeAvailable() { return !!state.flags.chronikOpen; }

// Erbstücke und Alte Narben beim Start einer neuen Seite anwenden
function applyLegacyStart() {
    const h = legacyLevel("heirloom");
    const give = (id) => { state.inventory[id] = 1; if (!state.unlocked.includes(id)) state.unlocked.push(id); };
    if (h >= 1) give("apron");
    if (h >= 2) { state.loot.kitchenKnife = 1; }
    if (h >= 3) state.upgrades.purse = Math.max(state.upgrades.purse || 0, 3);
    if (h >= 4) for (const id of ["shirt", "pants", "gloves", "shoes"]) give(id);
    const s = legacyLevel("scars");
    if (s > 0) state.uses.fullbody = Math.min(activityById("fullbody").maxUses, 2 * s);
    autoEquipAll();
}

function doPrestige() {
    if (!prestigeAvailable()) return;
    const gain = eternalGain();
    if (gain < 1) { showToast("Du hast noch zu wenig Ruhm, um eine Seite zu füllen"); return; }
    const keep = {
        meta: state.meta, skills: state.skills, pets: state.pets, activePet: state.activePet,
        bestiary: state.bestiary, seenItems: state.seenItems, story: state.story,
        ticksPerSec: state.ticksPerSec, petsUnlocked: !!state.flags.petsUnlocked
    };
    keep.meta.eternal += gain;
    keep.meta.pages += 1;
    initDefaultState();
    Object.assign(state, { meta: keep.meta, skills: keep.skills, pets: keep.pets, activePet: keep.activePet,
        bestiary: keep.bestiary, seenItems: keep.seenItems, story: keep.story, ticksPerSec: keep.ticksPerSec });
    if (keep.petsUnlocked) state.flags.petsUnlocked = true;
    applyLegacyStart();
    for (const key of Object.keys(RESOURCE_CONFIG)) state.resources[key].current = Math.min(RESOURCE_CONFIG[key].start, resMax(key));
    lastTick = Date.now();
    if (ui.battle) ui.battle.hidden = true;
    showTab('actions');
    updateUI();
    saveGame();
    setStatus(`Seite ${state.meta.pages + 1} aufgeschlagen (+${gain} Ewiger Ruhm)`);
    showToast(`Neue Seite! +${gain} Ewiger Ruhm`);
}
