// Export the generated setting as Foundry-friendly Journal Entries and Actors.
// Foundry's exact Actor schema changes between game systems/versions, so this
// produces conservative dnd5e-shaped data plus clean journal pages that can be
// imported with a small macro or copied into a world.

const esc = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const nl = (value) => esc(value).replace(/\n/g, "<br>");

const page = (name, html, level = 1) => ({
  name,
  type: "text",
  title: { show: true, level },
  text: { content: html, format: 1 },
  sort: 0,
});

const listHtml = (items = []) =>
  items.length ? `<ul>${items.map((item) => `<li>${nl(item)}</li>`).join("")}</ul>` : "";

const actorFor = (npc) => ({
  name: npc.name || "NPC",
  type: "npc",
  img: npc.image || "",
  system: {
    abilities: Object.fromEntries(
      ["STR", "DEX", "CON", "INT", "WIS", "CHA"].map((key) => [
        key.toLowerCase(),
        { value: Number(npc.abilities?.[key] || 10) },
      ])
    ),
    attributes: {
      ac: { flat: 10 },
      hp: { max: 4, value: 4 },
      movement: { walk: 30 },
    },
    details: {
      cr: 0.125,
      type: { value: "humanoid", subtype: "" },
      alignment: "",
      biography: {
        value: [
          npc.occupation,
          npc.personality?.trait,
          npc.personality?.ideal,
          npc.personality?.bond,
          npc.personality?.flaw,
          npc.personality?.background,
        ]
          .filter(Boolean)
          .join("<br>"),
      },
    },
    traits: { size: "med" },
  },
  items: [],
  flags: {
    "terrific-talent-tree": {
      role: npc.role,
      culture: npc.culture,
      personality: npc.personality,
      homeBuildingId: npc.homeBuildingId,
      workBuildingId: npc.workBuildingId,
    },
  },
});

export function worldToFoundry(world, character = null) {
  if (!world) return { journal: [], actors: [], tables: [], meta: {} };
  const journal = [];
  journal.push({
    name: `${world.name} — Setting`,
    pages: [
      page(
        "Overview",
        `<h1>${esc(world.name)}</h1>
        <p><strong>Era:</strong> ${esc(world.eraLabel)}<br>
        <strong>Theme:</strong> ${esc(world.theme)}<br>
        <strong>Scale:</strong> ${esc(world.scaleLabel)}<br>
        <strong>Seed:</strong> ${esc(world.seed)}</p>
        <p>${esc(world.logs?.[0]?.text || "")}</p>
        <h2>Realms</h2>${listHtml((world.realms || []).map((r) => `${r.name} (${r.kind}) — ${r.biomeLabels?.join(", ")}`))}
        <h2>Nations</h2>${listHtml((world.nations || []).map((n) => `${n.name} — ${n.culture}, ${n.government}`))}`
      ),
    ],
  });

  (world.realms || []).forEach((realm) => {
    journal.push({
      name: `Realm — ${realm.name}`,
      pages: [
        page(
          realm.name,
          `<h1>${esc(realm.name)}</h1><p>${esc(realm.kind)} · ${esc(realm.biomeLabels?.join(", "))}</p>
          <p>${(realm.nationIds || []).length} nations · ${(realm.settlementIds || []).length} settlements</p>`
        ),
      ],
    });
  });

  (world.nations || []).forEach((nation) => {
    const kingdom = (world.kingdoms || []).find((k) => k.id === nation.kingdomId);
    const settlements = (world.settlements || []).filter((s) => s.nationId === nation.id);
    journal.push({
      name: `Nation — ${nation.name}`,
      pages: [
        page(
          nation.name,
          `<h1>${esc(nation.name)}</h1>
          <p><strong>Culture:</strong> ${esc(nation.culture)}<br>
          <strong>Government:</strong> ${esc(nation.government)}<br>
          <strong>Ruler:</strong> ${esc(kingdom?.ruler?.name || "—")}<br>
          <strong>Capital:</strong> ${esc(settlements.find((s) => s.id === nation.capitalId)?.name || "—")}</p>
          <h2>Settlements</h2>${listHtml(settlements.map((s) => `${s.name} (${s.typeLabel}, ${s.population.toLocaleString()})`))}`
        ),
      ],
    });
  });

  (world.kingdoms || []).forEach((kingdom) => {
    journal.push({
      name: `Kingdom — ${kingdom.name}`,
      pages: [
        page(
          kingdom.name,
          `<h1>${esc(kingdom.name)}</h1>
          <p><strong>Ruler:</strong> ${esc(kingdom.ruler?.name || "—")}<br>
          <strong>Government:</strong> ${esc(kingdom.government)}<br>
          <strong>Turn:</strong> ${kingdom.turn || 1}</p>
          <h2>Stats</h2><p>ECO ${kingdom.stats?.economy} · MIL ${kingdom.stats?.military} · INF ${kingdom.stats?.influence} · PRO ${kingdom.stats?.prosperity}</p>
          <h2>Council</h2>${listHtml((kingdom.council || []).map((npc) => `${npc.role}: ${npc.name}`))}
          <h2>Provinces</h2>${listHtml((kingdom.provinces || []).map((p) => `${p.name} — ${p.comfort}, loyalty ${kingdom.loyalty?.[p.settlementId] ?? p.loyalty}`))}
          <h2>Buildings</h2>${listHtml((kingdom.buildings || []).map((b) => `${b.name} (${b.tier})`))}
          <h2>Wars & Trade</h2><p>Wars: ${esc((kingdom.wars || []).join(", ") || "None")}<br>Trade: ${esc((kingdom.tradeRoutes || []).join(", ") || "None")}</p>`
        ),
      ],
    });
  });

  (world.settlements || []).forEach((settlement) => {
    const buildings = (settlement.buildings || []).map((b) => `${b.name} — ${b.type}, ${b.floors}F, ${b.size.w}×${b.size.d}`);
    const people = (world.npcs || [])
      .filter((npc) => npc.settlementId === settlement.id)
      .map((npc) => `${npc.name} — ${npc.occupation}: ${npc.personality?.trait || ""}`);
    journal.push({
      name: `Settlement — ${settlement.name}`,
      pages: [
        page(
          settlement.name,
          `<h1>${esc(settlement.name)}</h1>
          <p><strong>Type:</strong> ${esc(settlement.typeLabel)}<br>
          <strong>Nation:</strong> ${esc((world.nations || []).find((n) => n.id === settlement.nationId)?.name || "")}<br>
          <strong>Population:</strong> ${settlement.population.toLocaleString()}<br>
          <strong>Biome:</strong> ${esc(settlement.biomeLabel)}</p>
          <h2>Districts</h2>${listHtml(settlement.districts || [])}
          <h2>Buildings</h2>${listHtml(buildings)}
          <h2>People</h2>${listHtml(people)}`
        ),
      ],
    });
  });

  (world.npcs || []).forEach((npc) => {
    journal.push({
      name: `NPC — ${npc.name}`,
      pages: [
        page(
          npc.name,
          `<h1>${esc(npc.name)}</h1>
          <p><strong>Role:</strong> ${esc(npc.occupation)}<br>
          <strong>Culture:</strong> ${esc(npc.culture)}<br>
          <strong>Home:</strong> ${esc(npc.homeBuildingId || "—")}<br>
          <strong>Work:</strong> ${esc(npc.workBuildingId || "—")}</p>
          <p><strong>Trait:</strong> ${esc(npc.personality?.trait)}<br>
          <strong>Ideal:</strong> ${esc(npc.personality?.ideal)}<br>
          <strong>Bond:</strong> ${esc(npc.personality?.bond)}<br>
          <strong>Flaw:</strong> ${esc(npc.personality?.flaw)}<br>
          <strong>Quirk:</strong> ${esc(npc.personality?.quirk)}<br>
          <strong>Voice:</strong> ${esc(npc.personality?.voice)}</p>
          <p>${esc(npc.personality?.background)}</p>`
        ),
      ],
    });
  });

  (world.quests || []).forEach((quest) => {
    journal.push({
      name: `Quest — ${quest.title}`,
      pages: [
        page(
          quest.title,
          `<h1>${esc(quest.title)}</h1>
          <p><strong>Type:</strong> ${esc(quest.typeLabel)}<br>
          <strong>Patron:</strong> ${esc(quest.patronName)}<br>
          <strong>Level:</strong> ${quest.level}<br>
          <strong>Status:</strong> ${esc(quest.status)}<br>
          <strong>Reward:</strong> ${quest.rewardGold} gp</p>
          <p>${esc(quest.objective)}</p>
          <p><em>${esc(quest.complication)}</em></p>
          <h2>Steps</h2>${listHtml(quest.steps || [])}`
        ),
      ],
    });
  });

  (world.developments || []).forEach((development) => {
    const nation = (world.nations || []).find((item) => item.id === development.nationId);
    journal.push({
      name: `Development — ${development.name}`,
      pages: [
        page(
          development.name,
          `<h1>${esc(development.name)}</h1>
          <p><strong>Kingdom:</strong> ${esc(nation?.name || "")}<br>
          <strong>Status:</strong> ${esc(development.status)}<br>
          <strong>Terrain:</strong> ${esc(development.terrain)} (${esc(development.biomeLabel || development.biome)})<br>
          <strong>Build time:</strong> ${development.months} month(s)</p>
          <p>${esc(development.benefit)}</p>`
        ),
      ],
    });
  });

  const actors = (world.npcs || []).map(actorFor);
  if (character?.name) {
    actors.unshift({
      name: character.name,
      type: "character",
      system: {
        abilities: Object.fromEntries(
          ["STR", "DEX", "CON", "INT", "WIS", "CHA"].map((key) => [
            key.toLowerCase(),
            { value: Number(character.stats?.[key] || 10) },
          ])
        ),
        details: { level: Number(character.level) || 1, biography: { value: "" } },
        attributes: { hp: { max: 0, value: 0 }, ac: { flat: 10 } },
      },
      items: [],
      flags: { "terrific-talent-tree": { character: true } },
    });
  }

  const tables = (world.encounterTables || []).slice(0, 80).map((table) => ({
    name: table.name,
    formula: "1d100",
    results: (table.rows || []).map((row, index) => ({
      text: `${row.count}× ${row.monster}`,
      range: [index + 1, index + 1],
      weight: 1,
    })),
  }));

  return {
    journal,
    actors,
    tables,
    meta: {
      system: "D&D 5e / Foundry",
      exportedAt: new Date().toISOString(),
      source: "Terrific Talent Tree",
      note: "Import journal entries as Journal Entries; actors as NPCs. Exact schema may need adjustment for your Foundry version.",
    },
  };
}

export function downloadFoundryExport(world, character) {
  if (!world) return;
  const payload = worldToFoundry(world, character);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(world.name || "setting").replace(/[^\w-]+/g, "_")}.foundry.json`;
  a.click();
  URL.revokeObjectURL(url);
}
