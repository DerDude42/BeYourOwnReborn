/* =================================================================
   REGIONEN (Kapitel IV-VII): Nebelmoor, Kaltgrat, Aschenruinen und der Tempel.
   Jede Region: Auftrag -> Erkunden -> Training -> Kämpfe (Raum, Boss) -> Bericht an den Dorfvorsteher.
   Ablauf: Boss besiegen gibt einen Siegelstein; mit drei Siegelsteinen öffnet sich die Tempelpforte.
   Alle Werte sind Startwerte und werden per Bot-Simulation abgestimmt (siehe REGION_TUNING).
   ================================================================= */
const REGION_TUNING = { time: 1 }; // Multiplikator auf Dauern (zum Abstimmen der Spielzeit)
const T = (n) => Math.max(1, Math.round(n * REGION_TUNING.time));

const REGION_CONFIG = [
    {
        k: 1, name: "Nebelmoor", fame: 25, capFlag: "fameCap45",
        missionDesc: "Harwin schickt dich ins Nebelmoor, wo der erste Siegelstein liegen soll. Es braucht Ruhm 25, damit dir die Dörfler folgen.",
        explore: { name: "Nebelmoor durchstreifen", drain: { health: 0.8, energy: 0.8, food: 0.2 }, duration: 20,
                   loot: [ { chance: 0.4, item: "moorHerb", amount: 1 }, { chance: 0.1, item: "swampPearl", amount: 1 } ] },
        train: { name: "Moorlauf", cost: { money: 20 }, drain: { energy: 1, health: 0.3 }, duration: 30, levelBonus: { health: 2, energy: 1 }, atkPerUse: 0.1 },
        room: { name: "Moorgeister", enemies: [ { name: "Irrlicht", hp: 20, atk: 1.5, speed: 0.7 }, { name: "Sumpfkröte", hp: 40, atk: 2.5, speed: 0.6 } ], pet: { id: "toad", enemy: "Sumpfkröte", egg: "eggToad", name: "Sumpfkröte", effects: { maxEnergy: 2 }, atk: 0.6, speed: 0.6, hatch: 150, desc: "+2 max. Energie" },
                gear: { id: "swampPearlNeck", name: "Sumpfperle", desc: "+4 max. Energie · +0,05 Energie/Tick", effects: { maxEnergy: 4, energyRegen: 0.05 }, slot: "neck", category: "Amulett" } },
        boss: { name: "Hexe Morwen", hp: 70, atk: 2.6, speed: 0.8, seal: "Siegelstein des Moores",
                gear: [ { id: "willowBlade", name: "Irrlichtklinge", desc: "+2 Angriff", effects: { atk: 2 }, slot: "weapon", category: "Waffe 1-Hand" },
                        { id: "mooreather", name: "Moorleder", desc: "+10 max. Gesundheit", effects: { maxHealth: 10 }, slot: "body", category: "Körper" } ] },
        materials: { moorHerb: { name: "Moorkraut", value: 2 }, swampPearl: { name: "Sumpfperle (roh)", value: 6 } }
    },
    {
        k: 2, name: "Kaltgrat", fame: 45, capFlag: "fameCap70",
        missionDesc: "Der zweite Siegelstein liegt hoch im Kaltgrat, dem Gebirge im Norden. Es braucht Ruhm 45.",
        explore: { name: "Kaltgrat erkunden", drain: { health: 1.0, energy: 1.0, food: 0.25 }, duration: 25,
                   loot: [ { chance: 0.4, item: "iceCrystal", amount: 1 }, { chance: 0.1, item: "mountainGem", amount: 1 } ] },
        train: { name: "Klettern am Kaltgrat", cost: { money: 40 }, drain: { energy: 1.5, health: 0.5 }, duration: 40, levelBonus: { health: 3, energy: 1 }, atkPerUse: 0.15 },
        room: { name: "Eiswind-Pass", enemies: [ { name: "Eiswolf", hp: 60, atk: 3.5, speed: 0.8 }, { name: "Bergluchs", hp: 90, atk: 5, speed: 0.7 } ], pet: { id: "lynx", enemy: "Bergluchs", egg: "eggLynx", name: "Bergluchs", effects: { atk: 0.3 }, atk: 1, speed: 0.7, hatch: 200, desc: "+0,3 Angriff" },
                gear: { id: "iceAmulet", name: "Bergkristall-Anhänger", desc: "+6 max. Energie", effects: { maxEnergy: 6 }, slot: "neck", category: "Amulett" } },
        boss: { name: "Frostriese Hrungnir", hp: 120, atk: 3.5, speed: 0.7, seal: "Siegelstein des Gebirges",
                gear: [ { id: "frostAxe", name: "Frostaxt", desc: "+3,5 Angriff", effects: { atk: 3.5 }, slot: "weapon", category: "Waffe 1-Hand" },
                        { id: "frostMantle", name: "Eisbärenmantel", desc: "+18 max. Gesundheit", effects: { maxHealth: 18 }, slot: "body", category: "Körper" } ] },
        materials: { iceCrystal: { name: "Eiskristall", value: 4 }, mountainGem: { name: "Bergkristall", value: 10 } }
    },
    {
        k: 3, name: "Aschenruinen", fame: 70, capFlag: "fameCap100",
        missionDesc: "Der dritte Siegelstein ruht in den Aschenruinen im Süden, dem Rest einer alten Stadt. Es braucht Ruhm 70.",
        explore: { name: "Aschenruinen durchsuchen", drain: { health: 1.3, energy: 1.5, food: 0.3 }, duration: 30,
                   loot: [ { chance: 0.4, item: "ashCoal", amount: 1 }, { chance: 0.1, item: "emberStone", amount: 1 } ] },
        train: { name: "Aschenmarsch", cost: { money: 60 }, drain: { energy: 2, health: 0.8 }, duration: 50, levelBonus: { health: 4, energy: 2 }, atkPerUse: 0.2 },
        room: { name: "Verbrannte Gassen", enemies: [ { name: "Aschegeist", hp: 100, atk: 6, speed: 0.9 }, { name: "Aschenrabe", hp: 140, atk: 8, speed: 0.8 } ], pet: { id: "raven", enemy: "Aschenrabe", egg: "eggRaven", name: "Aschenrabe", effects: { maxHealth: 5 }, atk: 1.5, speed: 0.8, hatch: 250, desc: "+5 max. Gesundheit" },
                gear: { id: "emberRing", name: "Glutamulett", desc: "+8 max. Energie · +0,1 Energie/Tick", effects: { maxEnergy: 8, energyRegen: 0.1 }, slot: "neck", category: "Amulett" } },
        boss: { name: "Ascheritter Valdric", hp: 160, atk: 4.4, speed: 0.8, seal: "Siegelstein der Ruinen",
                gear: [ { id: "ashSword", name: "Aschenschwert", desc: "+5 Angriff", effects: { atk: 5 }, slot: "weapon", category: "Waffe 1-Hand" },
                        { id: "ashPlate", name: "Aschenharnisch", desc: "+30 max. Gesundheit", effects: { maxHealth: 30 }, slot: "body", category: "Körper" } ] },
        materials: { ashCoal: { name: "Aschekohle", value: 6 }, emberStone: { name: "Glutstein", value: 15 } }
    }
];

const registerGear = (g, source) => { GEAR[g.id] = { id: g.id, name: g.name, desc: g.desc, slot: g.slot, category: g.category, effects: g.effects, source: "loot", manual: false }; };

const reportOf = (k) => `report${k}`;
const missionOf = (k) => `mission${k}`;
const exploreOf = (k) => `explore${k}`;
const bossOf = (k) => `boss${k}`;

for (const r of REGION_CONFIG) {
    const k = r.k;
    // Items
    LOOT_ITEMS[`seal${k}`] = { name: r.boss.seal, desc: "Eines von drei Siegeln der Tempelpforte", maxOwned: 1 };
    for (const [id, m] of Object.entries(r.materials)) LOOT_ITEMS[id] = { name: m.name, desc: `Wert ${m.value} Gold`, value: { money: m.value } };
    for (const g of [r.room.gear, ...r.boss.gear]) {
        LOOT_ITEMS[g.id] = { name: g.name, desc: g.desc, effects: g.effects, maxOwned: 1, slot: g.slot, category: g.category };
        registerGear(g);
    }
    const p = r.room.pet;
    LOOT_ITEMS[p.egg] = { name: `${p.name}-Ei`, desc: "Im Reiter Pets ausbrüten", maxOwned: 1 };
    PET_CONFIG.push({ id: p.id, name: p.name, egg: p.egg, hatchTicks: p.hatch, effects: p.effects, atk: p.atk, speed: p.speed, desc: p.desc });

    const prevDone = k === 1 ? () => !!state.flags.chronikOpen : () => usesOf(reportOf(k - 1)) >= 1;
    const noFame = () => state.resources.fame.current + 1e-9 < r.fame ? `Ruhm zu niedrig: benötigt ${r.fame} (aktuell ${Math.floor(state.resources.fame.current)})` : "";

    ACTIVITY_CONFIG.push(
        { id: missionOf(k), tab: "training", name: `Auftrag: ${r.name}`, desc: r.missionDesc, visible: prevDone, problem: noFame,
          duration: T(10), maxUses: 1, noCrit: true,
          onComplete: () => { const m = `Neuer Auftrag: ${r.name}`; setStatus(m); showToast(m); return m; },
          info: () => `Dauer ${T(10)} Ticks · benötigt Ruhm ${r.fame}` },
        { id: exploreOf(k), tab: "actions", name: `${r.name}: erkunden`, desc: `Du durchstreifst das Gebiet. Nach 3 Erkundungen findest du die ersten Gegner, nach 8 das Versteck des Wächters.`,
          visible: () => usesOf(missionOf(k)) >= 1, drain: r.explore.drain, duration: T(r.explore.duration), noCrit: true,
          onComplete: () => {
              const text = rollLoot(r.explore.loot);
              const n = usesOf(exploreOf(k)) + 1;
              if (n === 3) { setStatus(`${r.name}: Gegner entdeckt`); showToast(`${r.name}: Du hast Gegner aufgespürt.`); }
              if (n === 8) { setStatus(`${r.name}: Versteck gefunden`); showToast(`${r.name}: Du hast das Versteck des Wächters gefunden!`); }
              return text;
          },
          info: () => `-${r.explore.drain.health} Gesundheit/Tick · -${r.explore.drain.energy} Energie/Tick · -${r.explore.drain.food} Essen/Tick · Dauer ${T(r.explore.duration)} Ticks · ${Math.min(usesOf(exploreOf(k)), 8)}/8 bis zum Versteck` },
        { id: `train${k}`, tab: "training", name: r.train.name, desc: `Hartes Training im Gelände. Kostet ${r.train.cost.money} Gold je Durchgang.`,
          visible: () => usesOf(missionOf(k)) >= 1, cost: r.train.cost, drain: r.train.drain, duration: T(r.train.duration), maxUses: 10,
          levelBonus: r.train.levelBonus, atkPerUse: r.train.atkPerUse,
          info: () => `Level ${usesOf(`train${k}`)}/10 · ${r.train.cost.money} Gold · -${r.train.drain.energy} Energie/Tick · Dauer ${T(r.train.duration)} Ticks · +${r.train.levelBonus.health} max. Gesundheit, +${r.train.levelBonus.energy} max. Energie, +${r.train.atkPerUse} Angriff je Level` },
        { id: reportOf(k), tab: "training", name: `Bericht an den Dorfvorsteher: ${r.name}`, desc: `Berichte von deinem Sieg. Belohnung: Der maximale Ruhm steigt.`,
          visible: () => winsOf(bossOf(k)) >= 1, duration: T(5), maxUses: 1, noCrit: true,
          onComplete: () => { state.flags[r.capFlag] = true; const m = `Max. Ruhm erhöht (${resMax("fame")})`; showToast(m); return m; },
          info: () => `Dauer ${T(5)} Ticks · Belohnung: max. Ruhm +${FAME_CAP_FLAGS[r.capFlag]}` }
    );

    BATTLE_CONFIG.push(
        { id: `room${k}`, scale: true, name: r.room.name, desc: `Gegner im Gebiet ${r.name}.`, visible: () => usesOf(exploreOf(k)) >= 3,
          enemies: r.room.enemies,
          loot: [ { chance: 1, item: r.room.gear.id, amount: 1 }, { chance: 0.1, item: p.egg, amount: 1, when: () => petFree(p.id) }, { chance: 0.5, give: { money: 5 * k } } ],
          onWin: () => rollLoot(BATTLE_CONFIG.find(b => b.id === `room${k}`).loot) },
        { id: bossOf(k), scale: true, name: `Wächter: ${r.boss.name}`, desc: `Der Wächter des Siegelsteins in ${r.name}.`, visible: () => usesOf(exploreOf(k)) >= 8,
          enemies: [ { name: r.boss.name, hp: r.boss.hp, atk: r.boss.atk, speed: r.boss.speed } ],
          loot: [ { chance: 1, item: `seal${k}`, amount: 1 }, ...r.boss.gear.map(g => ({ chance: 1, item: g.id, amount: 1 })), { chance: 1, give: { fame: 5 }, when: () => winsOf(bossOf(k)) <= 1 } ], // Ruhm nur für den ersten Sieg
          onWin: () => rollLoot(BATTLE_CONFIG.find(b => b.id === bossOf(k)).loot) }
    );
}

/* ---- Finale: Tempelpforte und Wächter der Chronik ---- */
const sealsOwned = () => [1, 2, 3].filter(k => (state.loot[`seal${k}`] || 0) > 0).length;
LOOT_ITEMS.chronicleKey = { name: "Schlüssel der Chronik", desc: "Öffnet die Chronik der Ahnen", maxOwned: 1 };
ACTIVITY_CONFIG.push({
    id: "openTemple", tab: "training", name: "Die Tempelpforte öffnen",
    desc: "Mit allen drei Siegelsteinen kannst du die Pforte des verlassenen Tempels öffnen.",
    visible: () => sealsOwned() >= 3 && usesOf(reportOf(3)) >= 1, drain: { energy: 1 }, duration: T(30), maxUses: 1, noCrit: true,
    onComplete: () => { const m = "Die Pforte schwingt auf. Dahinter wartet der Wächter der Chronik."; setStatus(m); showToast(m); return "Pforte offen"; },
    info: () => `-1 Energie/Tick · Dauer ${T(30)} Ticks`
});
BATTLE_CONFIG.push({
    id: "finale", scale: true, name: "Wächter der Chronik", desc: "Der letzte Wächter hütet die Chronik der Ahnen.",
    visible: () => usesOf("openTemple") >= 1,
    enemies: [ { name: "Wächter der Chronik", hp: 280, atk: 5, speed: 0.9 } ],
    loot: [ { chance: 1, item: "chronicleKey", amount: 1 }, { chance: 1, give: { fame: 10 }, when: () => winsOf("finale") <= 1 } ],
    onWin: () => rollLoot(BATTLE_CONFIG.find(b => b.id === "finale").loot)
});
