/* =================================================================
   1. KONFIGURATION (EINFACH ERWEITERBAR)
   regenPerTick: Regeneration pro Tick (optional, nur sinnvoll mit hasMax)
   ================================================================= */
const RESOURCE_CONFIG = {
    health: { name: "Gesundheit", hasMax: true, start: 5, max: 5 },
    energy: { name: "Energie", hasMax: true,  start: 5, max: 5, regenPerTick: 0.25 }, // 1 Energie alle 4 Ticks
    money:  { name: "Gold",    hasMax: true,  start: 0,  max: 20 },
    fame:   { name: "Ruhm",    hasMax: true,  start: 0, max: 20, visible: () => state.resources.fame.current > 0 }, // wird erst angezeigt, wenn Ruhm vorhanden ist
    food:   { name: "Essen",   hasMax: true,  start: 5,  max: 20, drainPerTick: 0.05, drainFlag: "foodDrain" } // Verbrauch pro Tick, erst aktiv, wenn state.flags.foodDrain gesetzt ist
};

const ACTION_CONFIG = [
    {
        id: "beg",
        name: "Betteln",
        desc: "Bitte Passanten um eine kleine Münze.",
        cost:   { energy: 1 },
        reward: { money: 0.5 },
        bonus:  { money: "begBonus" } // zusätzlich itemBonus("begBonus")
    }
];

// unlock: Gold-Stand, ab dem der Gegenstand im Shop erscheint (bleibt danach dauerhaft sichtbar)
// unlockWhen: alternativ eine Bedingung (Funktion), z. B. nach N Abschlüssen einer Aktivität
// effects: maxHealth / maxEnergy / maxMoney / maxFood erhöhen das Maximum der jeweiligen Ressource
// maxOwned: maximale Anzahl, die man besitzen kann (null = unbegrenzt)
// effects: dauerhafte Boni, die mit itemBonus(name) abgefragt werden
const ITEM_CONFIG = [
    {
        id: "pants",
        slot: "legs", category: "Beine",
        name: "Zerrissene Hose",
        desc: "+1 Gold beim Betteln",
        unlock: { money: 15 },
        cost:   { money: 10 },
        maxOwned: 1,
        effects: { begBonus: 1 }
    },
    {
        id: "woodstaff",
        slot: "weapon", category: "Waffe 1-Hand",
        name: "Speer",
        desc: "+2 Angriff",
        unlock: { money: 30 },
        cost:   { money: 50 },
        maxOwned: 1,
        effects: { atk: 2 }
    },
    {
        id: "blanket",
        name: "Wolldecke",
        desc: "Ausruhen: +0,5 Gesundheit/Tick zusätzlich",
        unlock: { money: 25 },
        cost:   { money: 15 },
        maxOwned: 1,
        effects: { sleepBonus: 0.5 }
    },
    {
        id: "shirt",
        slot: "body", category: "Körper",
        name: "T-Shirt",
        desc: "Wärmt und schützt beim Jagen vor Kratzern: -0,2 Gesundheit/Tick weniger beim Jagen",
        unlock: { money: 25 },
        cost:   { money: 18 },
        maxOwned: 1,
        effects: { huntHealthSave: 0.2 }
    },
    {
        id: "bow",
        slot: "weapon", category: "Waffe 2-Hand",
        name: "Bogen",
        desc: "Jagen: +1 Essen",
        unlock: { money: 30 },
        cost:   { money: 40 },
        maxOwned: 1,
        effects: { huntFood: 1 }
    },
    {
        id: "shoes",
        slot: "feet", category: "Schuhe",
        name: "Schuhe",
        desc: "Jagen: -0,3 Gesundheit/Tick · +2 max. Energie",
        unlock: { money: 25 },
        cost:   { money: 35 },
        maxOwned: 1,
        effects: { huntHealthSave: 0.3, maxEnergy: 2 }
    },
    {
        id: "cap",
        slot: "head", category: "Kopf",
        name: "Löchrige Mütze",
        desc: "+2 max. Gesundheit",
        unlock: { money: 10 },
        cost:   { money: 5 },
        maxOwned: 1,
        effects: { maxHealth: 2 }
    },
    {
        id: "gloves",
        slot: "hands", category: "Hände",
        name: "Löchrige Handschuhe",
        desc: "+3 max. Energie",
        unlock: { money: 15 },
        cost:   { money: 12 },
        maxOwned: 1,
        effects: { maxEnergy: 3 }
    },
    {
        id: "apron",
        name: "Küchenschürze",
        desc: "Schaltet die Loop-Aktion Küchenhilfe frei",
        unlock: { money: 10 },
        cost:   { money: 15 },
        maxOwned: 1
    },
    {
        id: "chefHat",
        slot: "head", category: "Kopf",
        name: "Küchenmütze",
        desc: "Küchenhilfe: +0,1 Essen/Tick (nach 10x Küchenhilfe)",
        unlockWhen: () => usesOf("kitchen") >= 10,
        cost:   { money: 10 },
        maxOwned: 1,
        effects: { kitchenFood: 0.1 }
    }
];

/* ---- Grundwerte ---- */
const BASE_ACTION_POINTS = 1;      // so viele Aktivitäten laufen gleichzeitig
const MEDITATION_FLAT_REGEN = 1;  // fixe Energie pro Tick, solange Meditation läuft (zusätzlich zum Multiplikator)
const SLEEP_ENERGY_GAIN = 0.8;     // Energie pro Tick beim Schlafen
const FORCED_SLEEP_TICKS = 5;      // Zwangsschlaf bei 0 Gesundheit: so viele Ticks mit reduzierter Erholung
const FORCED_SLEEP_FACTOR = 0.5;   // ... und dieser Rate (50 %)
const BASE_CRIT_CHANCE = 0.05;     // Crit-Chance aller Nicht-Loop-Aktionen zu Beginn (+ itemBonus("crit"))
const CRIT_MULT = 3;               // Bei einem Crit wird das Ergebnis x3
const FLAGS = ["foodDrain", "foxTailFound", "combatUnlocked", "houseFame", "showMaxed", "petsUnlocked", "caveFound"];       // Freischaltbare Schalter (z. B. später über Automatisierung)
const BASE_ATK = 1;                // Grund-Angriff (+ Items + Ganzkörpertraining)

// Beute-Gegenstände (landen in state.loot und in den Stats)
const LOOT_ITEMS = {
    // maxOwned: so viele kann man höchstens besitzen (weitere Funde verfallen) | value: Verkaufswert je Stück
    weed:  { name: "Unkraut", desc: "Wert 0,5 Gold", maxOwned: 20, value: { money: 0.5 } },
    foxTail: { name: "Fuchsschwanz", desc: "Wert 10 Gold · als Talisman: +5 max. Gesundheit, +3 max. Energie", value: { money: 10 },
               effects: { maxHealth: 5, maxEnergy: 3 }, slot: "talisman", category: "Talisman", manualEquip: true },
    helm:    { name: "Helm", desc: "+10 max. Gesundheit · +0,1 Gesundheit/Tick", effects: { maxHealth: 10, healthRegen: 0.1 }, maxOwned: 1, slot: "head", category: "Kopf" },
    eggWolf: { name: "Wolfsei", desc: "Im Reiter Pets ausbrüten", maxOwned: 1 },
    eggFox: { name: "Fuchs-Ei", desc: "Im Reiter Pets ausbrüten", maxOwned: 1 },
    kitchenKnife: { name: "Küchenmesser", desc: "+0,5 Angriff", effects: { atk: 0.5 }, maxOwned: 1, slot: "weapon", category: "Waffe 1-Hand" }, // Belohnung der Küchenhilfe
    amulet:  { name: "Amulett", desc: "+0,2 Energie-Regeneration", effects: { energyRegen: 0.2 }, maxOwned: 1, slot: "neck", category: "Amulett" },
    herbs:   { name: "Kräuter", desc: "Wert 1 Gold", value: { money: 1 } }
};

/* ---- Ausrüstung: Slots (Position in der Personenansicht) und Gear-Verzeichnis ---- */
// group: welche Item-Slots hier passen (zwei Waffen-Slots teilen sich die Gruppe "weapon")
const SLOT_CONFIG = {
    talisman: { name: "Talisman", group: "talisman", col: 1, row: 1 },
    head:     { name: "Kopf",     group: "head",     col: 2, row: 1 },
    neck:     { name: "Hals",     group: "neck",     col: 3, row: 1 },
    weapon:   { name: "Waffe 1",  group: "weapon",   col: 1, row: 2 },
    body:     { name: "Körper",   group: "body",     col: 2, row: 2 },
    weapon2:  { name: "Waffe 2",  group: "weapon",   col: 3, row: 2 },
    hands:    { name: "Hände",    group: "hands",    col: 1, row: 3 },
    legs:     { name: "Beine",    group: "legs",     col: 2, row: 3 },
    feet:     { name: "Füße",     group: "feet",     col: 2, row: 4 }
};
// Alle ausrüstbaren Items (Shop und Beute); Items ohne slot wirken passiv, solange sie im Besitz sind
const GEAR = {};
for (const i of ITEM_CONFIG) {
    if (i.slot) GEAR[i.id] = { id: i.id, name: i.name, desc: i.desc, slot: i.slot, category: i.category, effects: i.effects || {}, source: "shop" };
}
for (const [id, it] of Object.entries(LOOT_ITEMS)) {
    if (it.slot) GEAR[id] = { id, name: it.name, desc: it.desc, slot: it.slot, category: it.category, effects: it.effects || {}, source: "loot", manual: !!it.manualEquip };
}

/* ---- Pets: schlüpfen aus Eiern (Beute), ein aktives Pet gibt Boni und kämpft mit ---- */
// Ein Pet ist immer ein besiegbares Tier (Bestiarium); sein Ei fällt als Beute dieses Gegners
// egg: ID des Ei-Items in LOOT_ITEMS · hatchTicks: Brutdauer · effects: Boni, solange das Pet aktiv ist · atk/speed: Kampfwerte
const PET_CONFIG = [
    { id: "fox", name: "Fuchs", egg: "eggFox", hatchTicks: 80, effects: { maxHealth: 2 }, atk: 0.5, speed: 0.6, desc: "+2 max. Gesundheit" },
    // WOLF-PET: Werte hier selbst festlegen (Platzhalter, bisher ohne Bonus)
    { id: "wolf", name: "Wolf", egg: "eggWolf", hatchTicks: 120, effects: {}, atk: 1, speed: 0.6, desc: "Boni noch offen" }
];

/* ---- Kampf: Gegner und Räume (einfach erweiterbar) ---- */
const BASE_ATTACK_SPEED = 0.5;   // Angriffe pro Tick (Spieler); Items können "attackSpeed" ergänzen
const BATTLE_LOG_MAX = 40;
const COMBAT_UNLOCK_FAME = 5;
const HOUSE_FULLBODY_LEVEL = 5; // Ganzkörper-Level, ab dem das Haus erscheint (Ganzkörper selbst geht bis Level 10)
const KITCHEN_KNIFE_USES = 5; // Küchenhilfe-Abschlüsse bis zum Küchenmesser
// enemies: nacheinander zu besiegen; speed = Angriffe pro Tick; Schaden = atk
const BATTLE_CONFIG = [
    {
        id: "trainroom",
        name: "Trainingsraum",
        desc: "Übe den Kampf an einer Holzpuppe.",
        visible: () => true,
        enemies: [ { name: "Holzpuppe", hp: 5, atk: 1, speed: 0.4 } ]
    },
    {
        id: "lodge",
        name: "Jagdhütte",
        desc: "Kampf gegen einen lebenden Fuchs. Freigeschaltet nach 20x Jagen.",
        visible: () => usesOf("hunt") >= 20 && winsOf("lodge") < 1,
        enemies: [ { name: "Fuchs", hp: 10, atk: 0.5, speed: 0.8 } ],
        loot: [
            { chance: 1.0, give: { fame: 10 } },
            { chance: 1.0, item: "foxTail", amount: 1 },
            { chance: 1.0, item: "herbs",   amount: 1 },
            { chance: 1.0, item: "eggFox", amount: 1, when: () => petFree("fox") }
        ],
        onWin: () => rollLoot(BATTLE_CONFIG.find(b => b.id === "lodge").loot)
    },
    {
        id: "cave",
        name: "Wolfshöhle",
        desc: "Kampf gegen einen Wolf. Entdeckt nach 5x Patrouille. Mit voller Ausrüstung aber ohne ausreichendes Training verlierst du knapp.",
        visible: () => usesOf("patrol") >= 5,
        enemies: [ { name: "Wolf", hp: 36, atk: 3, speed: 0.85 } ], // WERTE ANPASSBAR: Balance siehe unten im Test-Hinweis
        loot: [
            { chance: 1.0, give: { money: 10 } },
            { chance: 0.1, item: "eggWolf", amount: 1, when: () => petFree("wolf") }
        ],
        onWin: () => rollLoot(BATTLE_CONFIG.find(b => b.id === "cave").loot)
    }
];

/* ---- Skills (Meditation, Ausruhen): 1 Tick Ausführung = 1 XP ---- */
const SKILL_BASE_NEED = 100;        // Ausführungen für Level 1
const SKILL_NEED_GROWTH = 1.15;     // Bedarf steigt je Level um 15 %

/* ---- Tick-System: 1 Tick = eine Spiel-Runde; Basis ist 1 Tick pro Sekunde ---- */
const BASE_TICKS_PER_SEC = 1;
const MAX_TICKS_PER_SEC = 50;      // Obergrenze des Test-Reglers
const MAX_CATCHUP_TICKS = 200000;  // Obergrenze beim Nachholen (z. B. nach langer Pause)

const fmt = (n, digits = 2) => n.toLocaleString('de-DE', { maximumFractionDigits: digits });

// Aktivitäten belegen Aktionspunkte. Ohne duration laufen sie als Loop, bis man sie stoppt.
// tab: "actions" | "loop" | "training"; cost: Einmalkosten beim Start; drain: Verbrauch pro Tick
// duration: Dauer in Ticks (Aktion endet danach); maxUses: max. Anzahl Abschlüsse
// atkPerUse / levelBonus: Bonus pro Abschluss (Angriff / Maximum einer Ressource)
// requires: { atk }: Mindest-Angriff; visible: Sichtbarkeit; onComplete: liefert Ergebnistext
// bonusPerUse: { name: x }: Bonus pro Abschluss, abfragbar über statBonus(name) | tab "upgrades": erscheint im Upgrade-Reiter
// repeat: startet nach dem Abschluss automatisch neu, solange die Ressourcen reichen
// gain: Zuwachs pro Tick (Funktion)
const ACTIVITY_CONFIG = [
    {
        id: "meditation",
        tab: "loop",
        name: "Meditation",
        desc: "Gibt fix +1 Energie pro Tick. Freigeschaltet, wenn Geist trainieren Level 5 erreicht hat.",
        visible: () => upgradeLevel("mind") >= 5,
        skill: true,
        info: () => `${skillText("meditation")} · +${MEDITATION_FLAT_REGEN} Energie/Tick fix`
    },
    {
        id: "sleep",
        tab: "loop",
        name: "Ausruhen",
        desc: "Erholt Gesundheit und Energie.",
        skill: true,
        gain: () => {
            const f = sleepFactor();
            return { health: (1 + itemBonus("sleepBonus")) * f, energy: SLEEP_ENERGY_GAIN * f };
        },
        onTick: () => { if (state.forcedSleepTicks > 0) state.forcedSleepTicks--; },
        info: () => {
            const f = sleepFactor();
            const text = `${skillText("sleep")} · +${fmt((1 + itemBonus("sleepBonus")) * f)} Gesundheit/Tick · +${fmt(SLEEP_ENERGY_GAIN * f)} Energie/Tick`;
            return state.forcedSleepTicks > 0
                ? `${text} · erschöpft: noch ${state.forcedSleepTicks} Ticks mit ${fmt(FORCED_SLEEP_FACTOR * 100, 0)} %`
                : text;
        }
    },
    {
        id: "fullbody",
        tab: "training",
        name: "Ganzkörpertraining",
        desc: "Pro Level: +0,2 Angriff, +1 max. Gesundheit, +1 max. Energie.",
        drain: { energy: 0.5 },
        duration: 10,
        maxUses: 10,
        atkPerUse: 0.2,
        levelBonus: { health: 1, energy: 1 },
        info: () => `Level ${usesOf("fullbody")}/10 · -0,5 Energie/Tick · Dauer 10 Ticks`
    },
    {
        id: "sparring",
        tab: "training",
        name: "Übungskampf",
        desc: "Pro Abschluss: +2 max. Gesundheit. Freigeschaltet bei 20 Ruhm.",
        visible: () => state.resources.fame.current >= 20 - 1e-9 || usesOf("sparring") > 0,
        drain: { health: 0.5, energy: 0.5 },
        duration: 10,
        maxUses: 5,
        noCrit: true,
        levelBonus: { health: 2 },
        info: () => `Level ${usesOf("sparring")}/5 · -0,5 Gesundheit/Tick · -0,5 Energie/Tick (5 Energie je Kampf) · Dauer 10 Ticks`
    },
    {
        id: "apprentice",
        tab: "training",
        name: "Lehre",
        desc: "Schaltet nach 5 Abschlüssen die Lohnarbeit frei.",
        visible: () => resMax("health") >= 10 && resMax("energy") >= 10,
        cost: { money: 10 },
        duration: 10,
        maxUses: 5,
        info: () => `Fortschritt ${usesOf("apprentice")}/5 · Kosten: 10 Gold · Dauer 10 Ticks`
    },
    {
        id: "labor",
        tab: "loop",
        name: "Lohnarbeit",
        desc: "Arbeiten gegen Bezahlung. Wiederholt sich, solange die Ressourcen reichen. Die ersten 3 Abschlüsse geben je +1 max. Gesundheit und +1 max. Energie.",
        visible: () => usesOf("apprentice") >= activityById("apprentice").maxUses,
        drain: { energy: 0.2, food: 0.5 },
        duration: 10,
        repeat: true,
        levelBonus: { health: 1, energy: 1 },
        bonusUses: 3, // levelBonus gilt nur für die ersten 3 Abschlüsse
        onComplete: () => rollLoot([{ chance: 1, give: { money: 10 } }]),
        info: () => `-0,2 Energie/Tick · -0,5 Essen/Tick · Dauer 10 Ticks · Lohn: 10 Gold · Bonus ${Math.min(usesOf("labor"), 3)}/3`
    },
    {
        id: "kitchen",
        tab: "loop",
        name: "Küchenhilfe",
        desc: `Hilft in der Küche und bringt Essen. Nach ${KITCHEN_KNIFE_USES} Abschlüssen bekommst du ein Küchenmesser. Muss nach jedem Abschluss neu gestartet werden.`,
        visible: () => (state.inventory.apron || 0) > 0 || usesOf("kitchen") > 0,
        drain: { energy: 1 },
        duration: 10,
        gain: () => ({ food: 0.2 + statBonus("kitchenFood") }),
        onComplete: () => rollLoot([
            { chance: 1, give: { money: 4 } },
            { chance: 1, item: "kitchenKnife", amount: 1, when: () => usesOf("kitchen") + 1 >= KITCHEN_KNIFE_USES } // usesOf zählt erst nach onComplete hoch
        ]),
        info: () => `Dauer 10 Ticks · +${fmt(0.2 + statBonus("kitchenFood"))} Essen/Tick · -1 Energie/Tick · +4 Gold bei Abschluss · ${usesOf("kitchen")}x abgeschlossen`
    },
    {
        id: "hunt",
        tab: "actions",
        name: "Jagen",
        desc: "Bringt sicher Essen. Freigeschaltet, sobald du das Küchenmesser erhalten hast.",
        visible: () => gearCount("kitchenKnife") > 0 || usesOf("hunt") > 0,
        drain: { health: 0.8, energy: 0.8 },
        drainBonus: { health: "huntHealthSave", energy: "huntEnergySave" },
        duration: 3,
        onComplete: (a, mult) => rollLoot([{ chance: 1, give: { food: 1 + statBonus("huntFood") } }], mult),
        info: () => {
            const d = drainOf(activityById("hunt"));
            return `Dauer 3 Ticks · -${fmt(d.health)} Gesundheit/Tick · -${fmt(d.energy)} Energie/Tick · Ertrag: ${1 + statBonus("huntFood")} Essen · ${usesOf("hunt")}x durchgeführt`;
        }
    },
    {
        id: "stalk",
        tab: "upgrades",
        name: "Anpirschen",
        desc: "Senkt den Energie-Verbrauch beim Jagen um 0,1 pro Level. Freigeschaltet nach 10x Jagen.",
        visible: () => usesOf("hunt") >= 10,
        drain: { energy: 1 },
        duration: 10,
        maxUses: 5,
        bonusPerUse: { huntEnergySave: 0.1 },
        info: () => `Level ${usesOf("stalk")}/5 · -1 Energie/Tick über 10 Ticks · Jagen: -${fmt(usesOf("stalk") * 0.1)} Energie/Tick`
    },
    {
        id: "house",
        tab: "actions",
        name: "Verlassenes Haus durchsuchen",
        desc: "Riskant, aber es gibt Beute.",
        visible: () => usesOf("fullbody") >= HOUSE_FULLBODY_LEVEL,
        requires: { atk: 3 },
        drain: { energy: 0.6, health: 0.6 },
        duration: 15,
        loot: [
            { chance: 0.5, give: { money: 5 } },
            { chance: 0.7, give: { food: 2 } },
            { chance: 0.5, item: "weed",  amount: 1 }
        ],
        onComplete: (a, mult) => {
            let text = rollLoot(a.loot, mult);
            if (!state.flags.houseFame) { // einmalig: das Haus macht dich im Dorf bekannt
                state.flags.houseFame = true;
                text += " · " + rollLoot([{ chance: 1, give: { fame: 5 } }]);
            }
            return text;
        },
        info: () => `Benötigt Angriff 3 (du: ${fmt(atk())}) · Dauer 15 Ticks · -0,6 Energie/Tick · -0,6 Gesundheit/Tick · beim ersten Mal +5 Ruhm`
    },
    {
        id: "elder",
        tab: "training",
        name: "Dem Dorfvorsteher vorsprechen",
        desc: "Dein Ruhm öffnet dir die Tür. Nach 5 Besuchen schaltet er die Patrouille frei.",
        visible: () => winsOf("lodge") >= 1,
        drain: { energy: 0.5 },
        duration: 20,
        maxUses: 5,
        info: () => `Level ${usesOf("elder")}/5 · -0,5 Energie/Tick (10 Energie je Besuch) · Dauer 20 Ticks`
    },
    {
        id: "patrol",
        tab: "loop",
        name: "Patrouille",
        desc: "Dreht eine Runde durchs Dorf. Freigeschaltet nach 5 Besuchen beim Dorfvorsteher. Wiederholt sich, solange die Ressourcen reichen.",
        visible: () => usesOf("elder") >= activityById("elder").maxUses,
        drain: { health: 0.5, energy: 1, food: 0.1 },
        duration: 10,
        repeat: true,
        onComplete: () => rollLoot([
            { chance: 1, give: { fame: 1 } },
            { chance: 1, give: { money: 10 } },
            { chance: 0.2, item: "helm", amount: 1 }
        ]),
        info: () => `-0,5 Gesundheit/Tick · -1 Energie/Tick · -0,1 Essen/Tick · Dauer 10 Ticks · +1 Ruhm, +10 Gold, 20 % Helm`
    },
    {
        id: "wearTail",
        tab: "actions",
        name: "Fuchsschwanz als Talisman tragen",
        desc: "Ausgerüstet: +5 max. Gesundheit, +3 max. Energie. Entweder-oder: danach kannst du ihn nicht mehr vergraben.",
        visible: () => !!state.flags.foxTailFound && foxChoiceOpen(),
        duration: 1,
        maxUses: 1,
        noCrit: true,
        problem: () => isEquipped("foxTail") ? "Der Fuchsschwanz ist bereits ausgerüstet" : ((state.loot.foxTail || 0) <= 0 ? "Kein Fuchsschwanz vorhanden" : ""),
        onComplete: () => {
            if ((state.loot.foxTail || 0) <= 0) return "Kein Fuchsschwanz mehr vorhanden";
            state.equipped.talisman = "foxTail";
            clampAll();
            return "Fuchsschwanz ausgerüstet";
        },
        info: () => isEquipped("foxTail") ? "Aktuell ausgerüstet (Ablegen im Inventar)" : "Kostenlos · Dauer 1 Tick"
    },
    {
        id: "buryTail",
        tab: "actions",
        name: "Fuchsschwanz vergraben",
        desc: "Bei Vollmond unter einem Baumstamm vergraben – beim Graben findest du etwas. Entweder-oder: danach kannst du ihn nicht mehr als Talisman tragen.",
        visible: () => !!state.flags.foxTailFound && foxChoiceOpen(),
        drain: { energy: 1 },
        duration: 10,
        maxUses: 1,
        noCrit: true,
        problem: () => freeCount("foxTail") > 0 ? "" : (isEquipped("foxTail") ? "Der Fuchsschwanz ist ausgerüstet – erst ablegen" : "Kein Fuchsschwanz vorhanden"),
        onComplete: () => {
            if (freeCount("foxTail") <= 0) return "Fuchsschwanz fehlt – nichts vergraben";
            state.loot.foxTail -= 1;
            return "Beim Graben gefunden: " + rollLoot([{ chance: 1, item: "amulet" }]);
        },
        info: () => `-1 Energie/Tick · Dauer 10 Ticks · verbraucht 1 Fuchsschwanz · einmalig`
    }
];

// baseCost wächst pro Level um costFactor
const UPGRADE_CONFIG = [
    {
        id: "purse",
        name: "Geldbörse erweitern",
        desc: "+10 max. Gold pro Level.",
        costs: [ { money: 5 }, { money: 12 }, { money: 22 }, { money: 34 }, { money: 48 }, { money: 66 } ], // bleibt jeweils unter dem neuen Gold-Maximum
        maxLevel: 6,
        effects: { maxMoney: 10 },
        info: () => `Level ${upgradeLevel("purse")}/6 · max. Gold ${resMax("money")}`
    },
    {
        id: "mind",
        name: "Geist trainieren",
        desc: "Trainiert deinen Geist. Auf Level 5 schaltet er die Meditation frei.",
        baseCost: { money: 10 },
        costFactor: 1.4, // Kosten: 10, 14, 20, 28, 39 Gold (bleibt unter dem Gold-Maximum von 50 mit Geldbörse)
        maxLevel: 5,
        info: () => `Level ${upgradeLevel("mind")}/5`
    }
];

// Stats-Liste: einfach weitere Einträge ergänzen
const STAT_CONFIG = [
    { label: "Gesundheit",           get: () => `${Math.floor(state.resources.health.current + 1e-9)}/${resMax("health")}` },
    { label: "Aktionspunkte",        get: () => `${state.active.length}/${apTotal()} belegt` },
    { label: "Energie",              get: () => `${Math.floor(state.resources.energy.current + 1e-9)}/${resMax("energy")}` },
    { label: "Gesundheits-Regeneration", get: () => `${fmt(regenOf("health") * regenFactor())}/Tick` },
    { label: "Energie-Regeneration", get: () => `${fmt(regenOf("energy") * regenFactor() + regenFlat())}/Tick` },
    { label: "Gold",                 get: () => `${Math.floor(state.resources.money.current + 1e-9)}/${resMax("money")}` },
    { label: "Meditation (Skill)",   get: () => skillText("meditation") },
    { label: "Ausruhen (Skill)",     get: () => skillText("sleep") },
    { label: "Ganzkörper-Level",     get: () => `${usesOf("fullbody")}/${activityById("fullbody").maxUses}` },
    { label: "Ruhm",                 get: () => `${Math.floor(state.resources.fame.current + 1e-9)}/${resMax("fame")}` },
    { label: "Übungskampf",          get: () => `${usesOf("sparring")}/${activityById("sparring").maxUses}` },
    { label: "Dorfvorsteher",       get: () => `${usesOf("elder")}/${activityById("elder").maxUses}` },
    { label: "Lehre",                get: () => `${usesOf("apprentice")}/${activityById("apprentice").maxUses}` },
    { label: "Angriff",              get: () => `${fmt(atk())}` },
    { label: "Angriffsgeschwindigkeit", get: () => `${fmt(attackSpeed())}/Tick` },
    { label: "Aktives Pet",          get: () => activePetCfg() ? activePetCfg().name : "–" },
    { label: "Essen",                get: () => `${Math.floor(state.resources.food.current + 1e-9)}/${resMax("food")}` + (passiveDrainOf("food") > 0 ? ` (-${fmt(passiveDrainOf("food"))}/Tick)` : "") },
    { label: "Crit-Chance",          get: () => `${fmt(critChance() * 100, 0)} % (Ergebnis x${CRIT_MULT})` }
];
for (const [id, it] of Object.entries(LOOT_ITEMS)) {
    STAT_CONFIG.push({ label: it.name, get: () => `${state.loot[id] || 0}` });
}
