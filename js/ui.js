/* =================================================================
   4. UI & UHR
   (Elemente werden einmal gebaut und danach nur noch aktualisiert)
   ================================================================= */
const ui = { res: {}, resBox: {}, buttons: {}, rewardSpans: {} };

function formatResMap(resMap, prefix = "") {
    return Object.entries(resMap || {}).map(([key, val]) => {
        const name = RESOURCE_CONFIG[key] ? RESOURCE_CONFIG[key].name : key;
        return `${prefix}${val} ${name}`;
    }).join(", ");
}

function setText(el, text) {
    if (el.textContent !== text) el.textContent = text;
}

function buildUI() {
    // Ressourcen-Anzeige oben
    const resBar = document.getElementById('resource-bar');
    resBar.textContent = "";
    for (const [key, cfg] of Object.entries(RESOURCE_CONFIG)) {
        const box = document.createElement('div');
        box.className = 'res-box';
        box.appendChild(document.createTextNode(`${cfg.name}: `));
        const valueSpan = document.createElement('span');
        box.appendChild(valueSpan);
        resBar.appendChild(box);
        ui.res[key] = valueSpan;
        ui.resBox[key] = box;
    }

    // Aktions-Buttons
    const actContainer = document.getElementById('actions-container');
    actContainer.textContent = "";
    const actTitle = document.createElement('h2');
    actTitle.className = 'card-title';
    actTitle.textContent = 'Aktionen';
    actContainer.appendChild(actTitle);
    for (const action of ACTION_CONFIG) {
        const costKeys = Object.keys(action.cost || {});
        const costText = costKeys.length > 0 ? `Kosten: ${formatResMap(action.cost)}` : "Kostenlos";

        const btn = document.createElement('button');
        btn.className = 'action-btn';
        btn.type = 'button';
        btn.addEventListener('click', () => executeAction(action.id));

        const header = document.createElement('div');
        header.className = 'btn-header';
        const nameSpan = document.createElement('span');
        nameSpan.textContent = action.name;
        const rewardSpan = document.createElement('span');
        rewardSpan.className = 'btn-reward';
        rewardSpan.textContent = formatResMap(action.reward, "+");
        ui.rewardSpans[action.id] = rewardSpan;
        header.append(nameSpan, rewardSpan);

        const desc = document.createElement('div');
        desc.className = 'btn-desc';
        const helpSpan = document.createElement('span');
        helpSpan.className = 'btn-help';
        helpSpan.textContent = action.desc;
        desc.appendChild(helpSpan);
        const costSpan = document.createElement('span');
        costSpan.className = 'btn-cost';
        costSpan.textContent = costText;
        desc.appendChild(costSpan);

        btn.append(header, desc);
        actContainer.appendChild(btn);
        ui.buttons[action.id] = btn;
    }

    // Shop (Karte bleibt versteckt, bis das erste Item freigeschaltet ist)
    ui.shopCard = document.getElementById('shop-card');
    ui.items = {};
    const shopContainer = document.getElementById('shop-items');
    shopContainer.textContent = "";
    for (const item of ITEM_CONFIG) {
        const btn = document.createElement('button');
        btn.className = 'action-btn';
        btn.type = 'button';
        btn.hidden = true;
        btn.addEventListener('click', () => buyItem(item.id));

        const header = document.createElement('div');
        header.className = 'btn-header';
        const nameSpan = document.createElement('span');
        nameSpan.textContent = item.name;
        const priceSpan = document.createElement('span');
        priceSpan.className = 'btn-price';
        header.append(nameSpan, priceSpan);

        const desc = document.createElement('div');
        desc.className = 'btn-desc';
        desc.appendChild(document.createTextNode(item.category ? `${item.desc} · ${item.category} · ` : item.desc + " · "));
        const ownedSpan = document.createElement('span');
        ownedSpan.className = 'btn-cost';
        desc.appendChild(ownedSpan);

        btn.append(header, desc);
        shopContainer.appendChild(btn);
        ui.items[item.id] = { btn, price: priceSpan, owned: ownedSpan };
    }
}

function updateUI() {
    for (const [key, cfg] of Object.entries(RESOURCE_CONFIG)) {
        const current = Math.floor(state.resources[key].current + 1e-9);
        if (cfg.visible) { const show = !!cfg.visible(); if (ui.resBox[key].hidden === show) ui.resBox[key].hidden = !show; }
        setText(ui.res[key], cfg.hasMax ? `${current}/${resMax(key)}` : `${current}`);
    }
    for (const action of ACTION_CONFIG) {
        const btn = ui.buttons[action.id];
        btn.classList.toggle('lacking', !canAfford(action.cost));
    }

    for (const action of ACTION_CONFIG) {
        setText(ui.rewardSpans[action.id], formatResMap(rewardOf(action), "+"));
    }

    if (ui.invTab) ui.invTab.classList.toggle('buyable', hasBuyableItem());

    // Shop
    const shopOpen = state.unlocked.length > 0;
    if (ui.shopCard.hidden === shopOpen) ui.shopCard.hidden = !shopOpen;
    for (const item of ITEM_CONFIG) {
        const el = ui.items[item.id];
        const visible = state.unlocked.includes(item.id) && !isMaxed(item); // Gekauftes verschwindet aus dem Shop
        if (el.btn.hidden === visible) el.btn.hidden = !visible;
        if (!visible) continue;

        const maxed = isMaxed(item);
        setText(el.price, maxed ? "Im Besitz" : formatResMap(item.cost));
        setText(el.owned, `Besitz: ${ownedCount(item)}`);
        if (el.btn.disabled !== maxed) el.btn.disabled = maxed;
        el.btn.classList.toggle('lacking', !maxed && !canAfford(item.cost));
    }

    updateMenus();
}

// Gemeinsamer Button-Baustein für Loop, Training und Upgrades
function createCardButton(name, onClick, rightClass) {
    const btn = document.createElement('button');
    btn.className = 'action-btn';
    btn.type = 'button';
    btn.addEventListener('click', onClick);

    const bar = document.createElement('div');
    bar.className = 'progress';
    btn.appendChild(bar);

    const header = document.createElement('div');
    header.className = 'btn-header';
    const nameSpan = document.createElement('span');
    nameSpan.textContent = name;
    const right = document.createElement('span');
    right.className = rightClass;
    header.append(nameSpan, right);

    // Hilfetext: nur bei Hover (Maus) oder nach dem Antippen (Touch) sichtbar; Kosten/Fortschritt bleiben immer sichtbar
    const desc = document.createElement('div');
    desc.className = 'btn-desc';
    const help = document.createElement('span');
    help.className = 'btn-help';
    const extra = document.createElement('span');
    extra.className = 'btn-cost';
    desc.append(help, extra);

    btn.append(header, desc);
    return { btn, right, desc: help, extra, bar };
}

// Touch: Antippen blendet den Hilfetext ein, bis woanders getippt wird
document.addEventListener('click', (e) => {
    const hit = e.target.closest ? e.target.closest('.action-btn') : null;
    for (const el of document.querySelectorAll('.action-btn.help-open')) if (el !== hit) el.classList.remove('help-open');
    if (hit && e.pointerType && e.pointerType !== 'mouse') hit.classList.add('help-open');
});

function buildMenus() {
    ui.act = {};
    ui.up = {};
    ui.stats = [];

    ui.speedSlider = document.getElementById('speed-slider');
    ui.speedValue = document.getElementById('speed-value');
    ui.speedSlider.max = MAX_TICKS_PER_SEC;
    ui.speedSlider.addEventListener('input', () => {
        tick(); // bis jetzt noch mit der alten Geschwindigkeit nachholen
        const v = parseInt(ui.speedSlider.value, 10);
        if (Number.isInteger(v)) state.ticksPerSec = Math.min(MAX_TICKS_PER_SEC, Math.max(1, v));
        lastTick = Date.now();
        updateUI();
    });
    ui.speedSlider.addEventListener('change', saveGame);

    ui.resetBtn = document.getElementById('reset-btn');
    ui.resetBtn.addEventListener('click', onResetClick);

    ui.exploreCard = document.getElementById('explore-card');
    const lateUpgradeButtons = [];
    const lists = {
        actions: document.getElementById('explore-list'),
        loop: document.getElementById('loop-list'),
        training: document.getElementById('training-list')
    };
    for (const a of ACTIVITY_CONFIG) {
        const c = createCardButton(a.name, () => toggleActivity(a.id), 'btn-reward');
        c.desc.textContent = a.desc;
        if (a.tab === 'upgrades') lateUpgradeButtons.push(c.btn); else lists[a.tab].appendChild(c.btn);
        ui.act[a.id] = c;
    }

    // Kampf-Tab und Kampfansicht
    ui.combat = {};
    ui.combatTab = document.getElementById('tab-btn-combat');
    const combatList = document.getElementById('combat-list');
    for (const bc of BATTLE_CONFIG) {
        const c = createCardButton(bc.name, () => onBattleClick(bc.id), 'btn-reward');
        c.desc.textContent = bc.desc;
        combatList.appendChild(c.btn);
        ui.combat[bc.id] = c;
    }
    // Bestiarium
    ui.bestiary = [];
    const bestList = document.getElementById('bestiary-list');
    for (const bc of BATTLE_CONFIG) {
        for (const en of bc.enemies) {
            const row = document.createElement('div');
            row.className = 'bestiary-entry';
            const nm = document.createElement('div');
            nm.className = 'bestiary-name';
            const info = document.createElement('div');
            info.className = 'bestiary-info';
            row.append(nm, info);
            bestList.appendChild(row);
            ui.bestiary.push({ bc, en, nm, info });
        }
    }
    // Pets: Brutstätte, Eier, Pet-Liste
    ui.petTab = document.getElementById('tab-btn-pets');
    ui.petEmpty = document.getElementById('pet-empty');
    const incList = document.getElementById('incubator-list');
    ui.incubator = createCardButton("Brutstätte", () => {}, 'btn-reward');
    incList.appendChild(ui.incubator.btn);
    ui.eggBtn = {};
    ui.petBtn = {};
    const petList = document.getElementById('pet-list');
    for (const p of PET_CONFIG) {
        const eb = createCardButton(`${LOOT_ITEMS[p.egg].name} ausbrüten`, () => startIncubation(p.id), 'btn-reward');
        eb.desc.textContent = `Brutdauer ${p.hatchTicks} Ticks`;
        incList.appendChild(eb.btn);
        ui.eggBtn[p.id] = eb;
        const pb = createCardButton(p.name, () => setActivePet(p.id), 'btn-reward');
        pb.desc.textContent = `${p.desc} · greift im Kampf mit (${fmt(p.atk)} ATK, ${fmt(p.speed)}/Tick)`;
        petList.appendChild(pb.btn);
        ui.petBtn[p.id] = pb;
    }
    ui.filterBtn = document.getElementById('filter-max');
    ui.filterBtn.addEventListener('click', () => { state.flags.showMaxed = !state.flags.showMaxed; updateUI(); saveGame(); });
    ui.battle = document.getElementById('battle');
    ui.bEl = {};
    for (const id of ['battle-room-name', 'battle-room-count', 'b-you-hp', 'b-you-hp-text', 'b-you-atk', 'b-you-atk-text', 'b-pet-bar', 'b-pet-atk', 'b-pet-atk-text',
                      'b-enemy-name', 'b-enemy-hp', 'b-enemy-hp-text', 'b-enemy-atk', 'b-enemy-atk-text', 'battle-log', 'battle-again']) {
        ui.bEl[id] = document.getElementById(id);
    }
    document.getElementById('battle-back').addEventListener('click', () => { ui.battle.hidden = true; });
    document.getElementById('battle-quit').addEventListener('click', () => { stopBattle(); updateUI(); });
    ui.bEl['battle-again'].addEventListener('click', () => { if (state.battle) startBattle(state.battle.id); });
    ui.battleLogText = "";

    // Inventar: Zeile je Shop-Item und Beute-Item, sichtbar sobald im Besitz
    ui.inv = [];
    const invList = document.getElementById('inventory-list');
    ui.invEmpty = document.getElementById('inventory-empty');
    ui.sellQty = {};
    const mkBtn = (text, cls, label, onClick) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = cls;
        b.textContent = text;
        if (label) b.setAttribute('aria-label', label);
        b.addEventListener('click', onClick);
        return b;
    };
    const addInvRow = (o) => {
        o.key = (o.gearId || o.sellId || o.name);
        const row = document.createElement('div');
        row.className = 'stat-row inv-row';
        row.hidden = true;
        const left = document.createElement('span');
        left.textContent = (o.desc ? `${o.name} (${o.desc})` : o.name) + (o.category ? ` · ${o.category}` : "");
        const wrap = document.createElement('span');
        wrap.className = 'inv-right';
        const right = document.createElement('span');
        wrap.appendChild(right);
        const e = { key: o.key, row, right, getCount: o.getCount, max: o.max, gearId: o.gearId, sellId: o.sellId };
        if (o.sellId) {
            const id = o.sellId;
            ui.sellQty[id] = 1;
            e.minus = mkBtn('▼', 'step-btn', 'Menge verringern', () => { ui.sellQty[id] = Math.max(1, (ui.sellQty[id] || 1) - 1); updateUI(); });
            e.qty = document.createElement('span');
            e.qty.className = 'qty';
            e.qty.title = 'Tippen = alle';
            e.qty.addEventListener('click', () => { ui.sellQty[id] = Math.max(1, freeCount(id)); updateUI(); });
            e.plus = mkBtn('▲', 'step-btn', 'Menge erhöhen', () => { ui.sellQty[id] = Math.min(Math.max(1, freeCount(id)), (ui.sellQty[id] || 1) + 1); updateUI(); });
            e.sellBtn = mkBtn('Verkaufen', 'sell-btn', null, () => sellLoot(id, ui.sellQty[id] || 1));
            wrap.append(e.minus, e.qty, e.plus, e.sellBtn);
        }
        if (o.gearId) {
            e.equipBtn = mkBtn('Ausrüsten', 'sell-btn', null, () => toggleEquip(o.gearId));
            wrap.appendChild(e.equipBtn);
        }
        row.append(left, wrap);
        invList.appendChild(row);
        ui.inv.push(e);
    };
    for (const item of ITEM_CONFIG) {
        addInvRow({ name: item.name, desc: item.desc, category: item.category, getCount: () => ownedCount(item), gearId: item.slot ? item.id : null });
    }
    for (const [id, it] of Object.entries(LOOT_ITEMS)) {
        addInvRow({ name: it.name, desc: it.desc, category: it.category, getCount: () => state.loot[id] || 0, max: it.maxOwned,
                    sellId: it.value ? id : null, gearId: it.slot ? id : null });
    }

    // Personenansicht
    ui.picker = document.getElementById('picker');
    ui.pickerTitle = document.getElementById('picker-title');
    ui.pickerList = document.getElementById('picker-list');
    document.getElementById('picker-close').addEventListener('click', closePicker);
    ui.picker.addEventListener('click', (ev) => { if (ev.target === ui.picker) closePicker(); });
    ui.slots = {};
    const doll = document.getElementById('paperdoll');
    doll.textContent = "";
    for (const [slot, cfg] of Object.entries(SLOT_CONFIG)) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'slot-btn';
        btn.style.gridColumn = String(cfg.col);
        btn.style.gridRow = String(cfg.row);
        const nm = document.createElement('span');
        nm.className = 'slot-name';
        nm.textContent = cfg.name;
        const it = document.createElement('span');
        btn.append(nm, it);
        btn.addEventListener('click', () => onSlotClick(slot));
        doll.appendChild(btn);
        ui.slots[slot] = { btn, item: it };
    }

    const upList = document.getElementById('upgrade-list');
    for (const u of UPGRADE_CONFIG) {
        const c = createCardButton(u.name, () => buyUpgrade(u.id), 'btn-price');
        c.desc.textContent = u.desc;
        upList.appendChild(c.btn);
        ui.up[u.id] = c;
    }
    for (const b of lateUpgradeButtons) upList.appendChild(b);

    const statsList = document.getElementById('stats-list');
    for (const stat of STAT_CONFIG) {
        const row = document.createElement('div');
        row.className = 'stat-row';
        const label = document.createElement('span');
        label.textContent = stat.label;
        const value = document.createElement('span');
        row.append(label, value);
        statsList.appendChild(row);
        ui.stats.push(value);
    }
}

function updateBattleView() {
    const b = state.battle;
    if (!b) { if (!ui.battle.hidden) ui.battle.hidden = true; return; }
    if (ui.battle.hidden) return;
    const cfg = battleById(b.id);
    const enemy = b.enemies[Math.min(b.idx, b.enemies.length - 1)];
    const E = ui.bEl;
    const hp = state.resources.health.current, maxHp = resMax("health");
    const pct = (v) => Math.max(0, Math.min(100, v * 100)).toFixed(1) + '%';
    setText(E['battle-room-name'], cfg.name);
    setText(E['battle-room-count'], `${Math.min(b.over && b.result === "win" ? b.enemies.length : b.idx + 1, b.enemies.length)} / ${b.enemies.length}`);
    setText(E['b-enemy-name'], enemy.name);
    E['b-you-hp'].style.width = pct(hp / maxHp);
    setText(E['b-you-hp-text'], `${fmt(hp)} / ${fmt(maxHp)}`);
    E['b-enemy-hp'].style.width = pct(b.enemyHp / enemy.hp);
    setText(E['b-enemy-hp-text'], `${fmt(b.enemyHp)} / ${fmt(enemy.hp)}`);
    E['b-you-atk'].style.width = pct(b.pProg);
    setText(E['b-you-atk-text'], `Angriff x${fmt(atk())} · ${fmt(attackSpeed())}/Tick`);
    const petCfg = activePetCfg();
    if (E['b-pet-bar'].hidden === !!petCfg) E['b-pet-bar'].hidden = !petCfg;
    if (petCfg) {
        E['b-pet-atk'].style.width = pct(b.petProg || 0);
        setText(E['b-pet-atk-text'], `${petCfg.name} x${fmt(petCfg.atk)} · ${fmt(petCfg.speed)}/Tick`);
    }
    E['b-enemy-atk'].style.width = pct(b.eProg);
    setText(E['b-enemy-atk-text'], `Schlag x${fmt(enemy.atk)} · ${fmt(enemy.speed)}/Tick`);
    E['battle-again'].hidden = !b.over;
    const text = b.log.join("\n");
    if (text !== ui.battleLogText) {
        ui.battleLogText = text;
        E['battle-log'].textContent = text;
        E['battle-log'].scrollTop = E['battle-log'].scrollHeight;
    }
}

function updateMenus() {
    setText(ui.filterBtn, `Abgeschlossene Trainings/Upgrades: ${state.flags.showMaxed ? "angezeigt" : "ausgeblendet"}`);
    if (ui.combatTab) { const show = combatUnlocked(); if (ui.combatTab.hidden === show) ui.combatTab.hidden = !show; }
    for (const bc of BATTLE_CONFIG) {
        const c = ui.combat[bc.id];
        const shown = !bc.visible || bc.visible();
        if (c.btn.hidden === shown) c.btn.hidden = !shown;
        if (!shown) continue;
        const running = !!state.battle && state.battle.id === bc.id && !state.battle.over;
        const en = bc.enemies.map(e => scaledEnemy(bc, e)).map(e => `${e.name} (${fmt(e.hp)} HP, ${fmt(e.atk)} ATK, ${fmt(e.speed)}/Tick)`).join(", ");
        setText(c.right, running ? "● Läuft – zurück zum Kampf" : "Start");
        setText(c.extra, ` · Gegner: ${en} · Siege: ${state.wins[bc.id] || 0}`);
        c.btn.classList.toggle('running', running);
    }
    updateBattleView();
    // Bestiarium (nur Kampf-Gegner)
    for (const e of ui.bestiary) {
        const seen = state.bestiary[e.en.name];
        const row = e.nm.parentNode;
        setText(e.nm, seen ? e.en.name : "???");
        setText(e.info, seen
            ? `${fmt(scaledEnemy(e.bc, e.en).hp)} HP · ${fmt(scaledEnemy(e.bc, e.en).atk)} ATK · ${fmt(e.en.speed)}/Tick · Besiegt: ${seen.kills} · Beute: ${lootText(e.bc.loot || [])}`
            : "Noch nicht begegnet");
    }
    updateChronik();
    // Pets
    const pu = petsUnlocked();
    if (ui.petTab.hidden === pu) ui.petTab.hidden = !pu;
    const inc = state.incubation;
    const incP = inc ? petById(inc.pet) : null;
    setText(ui.incubator.right, inc ? `${inc.left} Ticks` : "leer");
    setText(ui.incubator.desc, inc ? `Brütet: ${LOOT_ITEMS[incP.egg].name}` : "Lege ein Ei zum Ausbrüten ein.");
    ui.incubator.btn.disabled = true;
    ui.incubator.bar.style.width = inc ? ((1 - inc.left / inc.total) * 100).toFixed(1) + '%' : '0%';
    let anyPet = false;
    for (const p of PET_CONFIG) {
        const have = (state.loot[p.egg] || 0) > 0;
        const eb = ui.eggBtn[p.id];
        if (eb.btn.hidden === have) eb.btn.hidden = !have;
        eb.btn.disabled = !!inc;
        setText(eb.right, "Einlegen");
        const owned = !!state.pets[p.id];
        anyPet = anyPet || owned;
        const pb = ui.petBtn[p.id];
        if (pb.btn.hidden === owned) pb.btn.hidden = !owned;
        const act = state.activePet === p.id;
        setText(pb.right, act ? "● Aktiv" : "Aktivieren");
        pb.btn.classList.toggle('running', act);
    }
    ui.petEmpty.hidden = anyPet;
    let exploreVisible = false;
    for (const a of ACTIVITY_CONFIG) {
        const c = ui.act[a.id];
        const visible = isVisible(a);
        if (c.btn.hidden === visible) c.btn.hidden = !visible;
        if (!visible) continue;
        if (a.tab === "actions") exploreVisible = true;

        const running = isActive(a.id);
        const maxed = isMaxedActivity(a);
        const progressed = a.duration && (state.runTicks[a.id] || 0) > 0;
        setText(c.right, maxed ? "Abgeschlossen" : (running ? (pausedBy(a) ? "⏸ Pause" : "● Läuft") : (progressed ? "Fortsetzen" : "Start")));
        setText(c.extra, activityInfo(a));
        c.btn.classList.toggle('running', running);
        let pct = 0;
        if (a.skill) {
            pct = skillPct(a.id);
        } else if (a.duration) {
            pct = Math.min(100, (state.runTicks[a.id] || 0) / a.duration * 100);
        }
        const w = pct.toFixed(1) + '%';
        if (c.bar.style.width !== w) c.bar.style.width = w;
        c.bar.classList.toggle('skill', !!a.skill);
        const disabled = !running && maxed;
        if (c.btn.disabled !== disabled) c.btn.disabled = disabled;
        c.btn.classList.toggle('lacking', !running && !maxed && (!meetsRequirements(a) || !canAfford(startNeeds(a))));
    }
    if (ui.exploreCard.hidden === exploreVisible) ui.exploreCard.hidden = !exploreVisible;

    for (const u of UPGRADE_CONFIG) {
        const c = ui.up[u.id];
        const cost = upgradeCost(u);
        const maxed = u.maxLevel != null && upgradeLevel(u.id) >= u.maxLevel;
        const shownUp = !maxed || !!state.flags.showMaxed;
        if (c.btn.hidden === shownUp) c.btn.hidden = !shownUp;
        setText(c.right, maxed ? "Max" : formatResMap(cost));
        setText(c.extra, u.info());
        if (c.btn.disabled !== maxed) c.btn.disabled = maxed;
        c.btn.classList.toggle('lacking', !maxed && !canAfford(cost));
    }

    STAT_CONFIG.forEach((stat, i) => setText(ui.stats[i], stat.get()));

    let anyOwned = false;
    for (const e of ui.inv) {
        const n = e.getCount();
        if (n > 0) state.seenItems[e.key] = true;
        const has = !!state.seenItems[e.key]; // einmal besessen: bleibt sichtbar (auch bei Anzahl 0)
        if (has) anyOwned = true;
        if (e.row.hidden === has) e.row.hidden = !has;
        const eq = e.gearId && isEquipped(e.gearId);
        setText(e.right, (e.max != null ? `x${n}/${e.max}` : `x${n}`) + (e.gearId ? (eq ? " · ✓ ausgerüstet" : " · im Inventar") : ""));
        if (e.equipBtn) setText(e.equipBtn, eq ? 'Ablegen' : 'Ausrüsten');
        if (e.sellBtn) {
            const free = e.sellId ? freeCount(e.sellId) : 0;
            const q = Math.min(Math.max(1, ui.sellQty[e.sellId] || 1), Math.max(1, free));
            ui.sellQty[e.sellId] = q;
            setText(e.qty, String(q));
            e.minus.disabled = q <= 1;
            e.plus.disabled = q >= free;
            e.sellBtn.disabled = free <= 0;
        }
    }
    for (const [slot, el] of Object.entries(ui.slots)) {
        const id = state.equipped[slot];
        setText(el.item, id && GEAR[id] ? GEAR[id].name : "–");
        el.btn.classList.toggle('filled', !!id);
    }
    if (ui.invEmpty.hidden === !anyOwned) ui.invEmpty.hidden = anyOwned;

    setText(ui.speedValue, String(state.ticksPerSec));
    if (document.activeElement !== ui.speedSlider && ui.speedSlider.value !== String(state.ticksPerSec)) {
        ui.speedSlider.value = state.ticksPerSec;
    }
}

let currentTab = 'actions';

function showTab(name) {
    currentTab = name;
    if (name === 'inventory' && ui.invTab) ui.invTab.classList.remove('flash');
    if (name === 'pets' && ui.petTab) ui.petTab.classList.remove('glow');
    if (name === 'chronik' && ui.chronikTab) ui.chronikTab.classList.remove('glow');
    document.querySelectorAll('.tab-panel').forEach(p => { p.hidden = p.id !== 'tab-' + name; });
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
}

function initTabs() {
    ui.invTab = document.querySelector('.tab-btn[data-tab="inventory"]');
    if (ui.invTab) ui.invTab.addEventListener('animationend', () => ui.invTab.classList.remove('flash'));
    document.querySelectorAll('.tab-btn').forEach(b => {
        b.addEventListener('click', () => showTab(b.dataset.tab));
    });
    showTab('actions');
}

function updateClock() {
    document.getElementById('clock-display').textContent = new Date().toLocaleTimeString('de-DE');
}

function setStatus(text) {
    document.getElementById('save-status').textContent = text;
}
