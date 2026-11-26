/* =================================================================
   FÄHIGKEITEN: sammeln XP durch passende Aktivitäten, haben pro Stufe ein Level-Maximum
   und lassen sich am Maximum weiterentwickeln (Stufe 1 -> 2 -> 3). Fähigkeiten bleiben beim Prestige erhalten.
   ================================================================= */
const SKILL_BASE_NEED = 100;        // XP für Level 1 (Stufe 1)
const SKILL_NEED_GROWTH = 1.15;     // Bedarf steigt je Level um 15 %
const SKILL_TIER_CAP = 15;          // Level-Maximum je Stufe
const SKILL_TIER_FACTOR = [1, 2.5, 6]; // XP-Bedarf je Stufe (Multiplikator)

// key: Bonus-Name (abfragbar über itemBonus) | per: Bonus je Level in Stufe 1/2/3 (frühere Stufen bleiben voll erhalten)
// sources: Aktivitäts-IDs, die XP geben (1 XP je Tick) | sourceFn: alternativ eine Bedingung | battle: XP je Kampf-Tick
const SKILL_CONFIG = [
    { id: "sleep",      names: ["Ausruhen", "Erholsamer Schlaf", "Heilschlaf"],     sources: ["sleep"],
      key: "sleepBonus", per: [0.02, 0.04, 0.08], unit: "Gesundheit je Tick beim Ausruhen", digits: 2 },
    { id: "meditation", names: ["Meditation", "Tiefe Meditation", "Erleuchtung"],   sources: ["meditation"],
      key: "maxEnergy",  per: [0.5, 1, 2],        unit: "max. Energie", digits: 1 },
    { id: "combat",     names: ["Kampfkunst", "Schwertmeister", "Klingentänzer"],   battle: true,
      key: "atk",        per: [0.05, 0.1, 0.2],   unit: "Angriff", digits: 2 },
    { id: "labor",      names: ["Arbeit", "Handwerk", "Meisterwerk"],               sources: ["labor", "kitchen", "patrol"],
      key: "jobGold",    per: [0.1, 0.2, 0.4],    unit: "Gold je Abschluss einer Arbeit", digits: 1 },
    { id: "explore",    names: ["Wegekunde", "Pfadfinder", "Wildnisläufer"],        sourceFn: (a) => a.tab === "actions" && !!a.duration,
      key: "maxHealth",  per: [0.5, 1, 2],        unit: "max. Gesundheit", digits: 1 }
];
const skillCfg = (id) => SKILL_CONFIG.find(s => s.id === id);

function skillOf(id) { return state.skills[id] || (state.skills[id] = { level: 0, xp: 0, tier: 0 }); }
function skillNeed(level, tier = 0) { return Math.ceil(SKILL_BASE_NEED * Math.pow(SKILL_NEED_GROWTH, level) * SKILL_TIER_FACTOR[tier]); }
function skillName(id) { const s = skillOf(id); return skillCfg(id).names[s.tier]; }
function skillMaxed(id) { const s = skillOf(id); return s.tier >= SKILL_TIER_FACTOR.length - 1 && s.level >= SKILL_TIER_CAP; }
function skillCanEvolve(id) { const s = skillOf(id); return s.level >= SKILL_TIER_CAP && s.tier < SKILL_TIER_FACTOR.length - 1; }
function skillPct(id) { const s = skillOf(id); return s.level >= SKILL_TIER_CAP ? 100 : Math.min(100, s.xp / skillNeed(s.level, s.tier) * 100); }

function skillText(id) {
    const s = skillOf(id);
    const head = `${skillName(id)} · Lv ${s.level}/${SKILL_TIER_CAP}`;
    if (skillMaxed(id)) return `${head} · Maximum`;
    if (skillCanEvolve(id)) return `${head} · bereit zur Weiterentwicklung`;
    return `${head} · XP ${Math.floor(s.xp)}/${skillNeed(s.level, s.tier)}`;
}

// Gesamtbonus einer Fähigkeit: abgeschlossene Stufen voll + aktuelle Stufe pro Level
function skillValue(id) {
    const cfg = skillCfg(id), s = skillOf(id);
    let v = 0;
    for (let t = 0; t < s.tier; t++) v += SKILL_TIER_CAP * cfg.per[t];
    return v + s.level * cfg.per[s.tier];
}
function skillBonus(name) {
    let total = 0;
    for (const cfg of SKILL_CONFIG) if (cfg.key === name) total += skillValue(cfg.id);
    return total;
}

function addSkillXp(id) {
    const s = skillOf(id);
    if (s.level >= SKILL_TIER_CAP) return; // wartet auf Weiterentwicklung bzw. Maximum
    s.xp += skillXpMult();
    while (s.level < SKILL_TIER_CAP && s.xp >= skillNeed(s.level, s.tier)) {
        s.xp -= skillNeed(s.level, s.tier);
        s.level += 1;
        setStatus(`${skillName(id)}: Level ${s.level}`);
        if (s.level >= SKILL_TIER_CAP) {
            s.xp = 0;
            if (skillCanEvolve(id)) showToast(`${skillName(id)} kann weiterentwickelt werden (Chronik)`);
            break;
        }
    }
}
// Aktivität läuft einen Tick: passende Fähigkeiten bekommen XP
function skillsTick(activity) {
    for (const cfg of SKILL_CONFIG) {
        if ((cfg.sources && cfg.sources.includes(activity.id)) || (cfg.sourceFn && cfg.sourceFn(activity))) addSkillXp(cfg.id);
    }
}

function evolveSkill(id) {
    if (!skillCanEvolve(id)) return;
    tick();
    const s = skillOf(id);
    s.tier += 1; s.level = 0; s.xp = 0;
    showToast(`${skillCfg(id).names[s.tier - 1]} wird zu ${skillName(id)}!`);
    setStatus(`${skillName(id)}: neue Stufe`);
    clampAll();
    updateUI();
    saveGame();
}

for (const c of SKILL_CONFIG) STAT_CONFIG.push({ label: `${c.names[0]} (Fähigkeit)`, get: () => skillText(c.id) });
