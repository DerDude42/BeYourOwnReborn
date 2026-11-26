/* =================================================================
   CHRONIK-TAB: Fähigkeiten, Ewiger Ruhm / neue Seite, Vermächtnisse, Geschichte
   ================================================================= */
// Mobil: Zusatzinfos bleiben verborgen; langes Drücken (Finger auflegen) blendet sie ein
function makeLongPressInfo(btn) {
    btn.classList.add('skill-btn');
    let timer = null, fired = false;
    const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
    btn.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse') return;
        fired = false; cancel();
        timer = setTimeout(() => { fired = true; btn.classList.toggle('long-open'); }, 450);
    });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel', 'pointermove']) btn.addEventListener(ev, cancel);
    btn.addEventListener('click', (e) => { if (fired) { e.stopImmediatePropagation(); e.preventDefault(); fired = false; } }, true);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
}

function buildChronik() {
    ui.chronikTab = document.getElementById('tab-btn-chronik');
    ui.chronik = { skills: {}, legacy: {}, storyRows: {}, confirm: false };
    const c = ui.chronik;

    const skillList = document.getElementById('skill-list');
    for (const cfg of SKILL_CONFIG) {
        const b = createCardButton(cfg.names[0], () => evolveSkill(cfg.id), 'btn-reward');
        skillList.appendChild(b.btn);
        makeLongPressInfo(b.btn);
        c.skills[cfg.id] = b;
    }

    c.page = createCardButton("Neue Seite aufschlagen", () => {
        if (!c.confirm) { c.confirm = true; updateChronik(); return; }
        c.confirm = false;
        doPrestige();
    }, 'btn-reward');
    document.getElementById('prestige-list').appendChild(c.page.btn);

    const legList = document.getElementById('legacy-list');
    for (const l of LEGACY_CONFIG) {
        const b = createCardButton(l.name, () => buyLegacy(l.id), 'btn-reward');
        b.desc.textContent = l.desc;
        legList.appendChild(b.btn);
        c.legacy[l.id] = b;
    }
    for (const a of ACTIVITY_CONFIG) if (a.skill && ui.act[a.id]) makeLongPressInfo(ui.act[a.id].btn);
    c.storyBox = document.getElementById('story-list');
}

function updateChronik() {
    const c = ui.chronik;
    if (!c) return;
    // Tab sichtbar ab Chronik-Fund (oder wenn schon Seiten geschrieben wurden)
    const show = !!state.flags.chronikOpen || state.meta.pages > 0;
    if (ui.chronikTab.hidden === show) ui.chronikTab.hidden = !show;

    for (const cfg of SKILL_CONFIG) {
        const b = c.skills[cfg.id], s = skillOf(cfg.id);
        setText(b.btn.querySelector('.btn-header span'), skillName(cfg.id));
        setText(b.right, skillCanEvolve(cfg.id) ? "Entwickeln" : `Lv ${s.level}/${SKILL_TIER_CAP}`);
        const cur = skillValue(cfg.id), next = skillCanEvolve(cfg.id) ? cfg.per[s.tier + 1] : cfg.per[s.tier];
        setText(b.desc, `Aktuell: ${skillValueText(cfg, cur)}`);
        setText(b.extra, skillCanEvolve(cfg.id)
            ? `Weiterentwicklung: dann ${skillValueText(cfg, next).replace("+", "+")} je Level`
            : skillMaxed(cfg.id) ? "Höchststufe erreicht" : `XP ${Math.floor(s.xp)}/${skillNeed(s.level, s.tier)}`);
        b.btn.disabled = !skillCanEvolve(cfg.id);
        b.bar.style.width = skillPct(cfg.id).toFixed(1) + '%';
    }

    const gain = eternalGain(), p = c.page;
    setText(p.right, `+${gain} EF`);
    if (!prestigeAvailable()) {
        setText(p.desc, "Noch nicht verfügbar.");
        p.btn.disabled = true;
    } else {
        setText(p.desc, `Ruhm ${fmt(state.resources.fame.current)} → ${gain} Ewiger Ruhm (Boss-Siege und Finale zählen mit). Du beginnst neu, behältst aber Fähigkeiten, Pets, Vermächtnisse und die Geschichte. Gegner werden stärker, max. Ruhm +${PAGE_FAME_BONUS} je Seite.`);
        p.btn.disabled = gain < 1;
    }
    setText(p.extra, c.confirm ? "Nochmal tippen zum Bestätigen" : `Seite ${state.meta.pages + 1}`);
    if (c.confirm && gain < 1) c.confirm = false;

    setText(document.getElementById('eternal-info'),
        `Ewiger Ruhm: ${eternalAvail()} frei (${state.meta.eternal} gesamt) · Bonus: +${(eternalPct() * 100).toFixed(1)} % max. Gesundheit/Energie und Gold`);

    for (const l of LEGACY_CONFIG) {
        const b = c.legacy[l.id], lv = legacyLevel(l.id), cost = legacyCost(l.id);
        setText(b.right, cost == null ? `Stufe ${lv}/${l.max} · Max` : `Stufe ${lv}/${l.max} · ${cost} EF`);
        setText(b.extra, "");
        b.btn.disabled = cost == null || eternalAvail() < cost;
    }

    // Geschichte: nur freigeschaltete Einträge, nach Kapitel gruppiert
    const sig = STORY_CONFIG.filter(e => state.story[e.id]).map(e => e.id).join(",");
    if (c.storySig !== sig) {
        c.storySig = sig;
        c.storyBox.textContent = "";
        STORY_CHAPTERS.forEach((chName, i) => {
            const es = STORY_CONFIG.filter(e => e.ch === i && state.story[e.id]);
            if (!es.length) return;
            const h = document.createElement('h3'); h.className = 'story-chapter'; h.textContent = chName;
            c.storyBox.appendChild(h);
            for (const e of es) {
                const d = document.createElement('div'); d.className = 'story-entry';
                const t = document.createElement('div'); t.className = 'story-title'; t.textContent = e.title;
                const x = document.createElement('div'); x.className = 'btn-desc story-text'; x.textContent = e.text;
                d.append(t, x); c.storyBox.appendChild(d);
            }
        });
    }
}

function skillValueText(cfg, v) {
    return `+${Number(v.toFixed(cfg.digits))} ${cfg.unit}`;
}
