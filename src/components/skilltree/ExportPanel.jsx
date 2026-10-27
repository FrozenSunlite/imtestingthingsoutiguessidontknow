import { useRef, useState } from "react";
import { useTree, aggregateResources, poolUsage, effectivePools } from "@/lib/treeStore";
import { PresentationSheet } from "@/components/skilltree/PresentationSheet";
import { ActionsSection } from "@/components/skilltree/ActionsSection";
import { InventorySection } from "@/components/skilltree/InventorySection";
import { SpellListSection } from "@/components/skilltree/SpellListSection";
import { groupUnlocked } from "@/lib/unlocked";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { FileText, Image as ImageIcon, FileType, FileDown } from "lucide-react";

const STATS = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];

function profLines(character) {
  const p = character.proficiencies || {};
  const out = [];
  [
    ["skills", "Skill"],
    ["tools", "Tool"],
    ["languages", "Language"],
    ["instruments", "Instrument"],
  ].forEach(([k, label]) => {
    (p[k] || []).forEach((it) =>
      out.push(
        `${label}: ${it.name || "—"}${k === "languages" ? "" : ` ×${it.times ?? 1}`}${it.expertise ? " (Expertise)" : ""}`
      )
    );
  });
  return out;
}

function SheetDocument({ innerRef }) {
  const { mergedTree: tree, character, pools, settings } = useTree();
  const levels = settings?.library?.levels || [];
  const usage = poolUsage(tree);
  const eff = effectivePools(pools, character, tree, levels);
  const resources = aggregateResources(tree, character, levels);
  const { heritage: heritageNodes, talentGroups } = groupUnlocked(
    tree.nodes.filter((n) => (n.currentPoints || 0) > 0)
  );

  return (
    <div
      ref={innerRef}
      className="bg-white p-8 text-black"
      style={{ width: "460px", fontFamily: "Georgia, serif" }}
    >
      <h1 className="mb-1 text-center text-2xl font-bold">
        {character.name || "Unnamed Character"}
      </h1>
      <p className="mb-4 text-center text-sm text-gray-600">
        {character.class} {character.race ? `· ${character.race}` : ""}
        {character.alignment ? ` · ${character.alignment}` : ""}
      </p>
      <div className="mb-4 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
        <div><b>Race:</b> {character.race || "—"}</div>
        <div><b>Class:</b> {character.class || "—"}</div>
        <div><b>Background:</b> {character.background || "—"}</div>
        <div><b>Age:</b> {character.age || "—"}</div>
        <div><b>Alignment:</b> {character.alignment || "—"}</div>
        <div><b>Level:</b> {character.level}</div>
        <div><b>Size:</b> {character.size || "—"}</div>
      </div>
      <h2 className="mb-2 border-b border-gray-400 text-sm font-bold uppercase">Ability Scores</h2>
      <div className="mb-4 grid grid-cols-6 gap-1 text-center text-sm">
        {STATS.map((s) => (
          <div key={s} className="rounded border border-gray-400 p-1">
            <div className="text-[10px] font-bold">{s}</div>
            <div className="text-lg font-bold">{character.stats[s]}</div>
          </div>
        ))}
      </div>
      <h2 className="mb-2 border-b border-gray-400 text-sm font-bold uppercase">Point Pools</h2>
      <div className="mb-4 text-sm">
        <div>Heritage: {usage.heritage} / {eff.heritage.total}</div>
        <div>Talent: {usage.talent} / {eff.talent.total}</div>
        <div>Attribute: {usage.attribute} / {eff.attribute.total}</div>
      </div>
      {resources.length > 0 && (
        <>
          <h2 className="mb-2 border-b border-gray-400 text-sm font-bold uppercase">Resources</h2>
          <ul className="mb-4 list-disc pl-5 text-sm">
            {resources.map((r) => (
              <li key={r.name}><b>{r.name}:</b> {r.value}</li>
            ))}
          </ul>
        </>
      )}
      {profLines(character).length > 0 && (
        <>
          <h2 className="mb-2 border-b border-gray-400 text-sm font-bold uppercase">Proficiencies</h2>
          <ul className="mb-4 list-disc pl-5 text-sm">
            {profLines(character).map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </>
      )}
      {heritageNodes.length > 0 && (
        <>
          <h2 className="mb-2 border-b border-gray-400 text-sm font-bold uppercase">Heritage Traits</h2>
          <ul className="mb-4 list-disc pl-5 text-sm">
            {heritageNodes.map((n) => (
              <li key={n.id}>{n.name}{n.maxPoints > 1 ? ` (${n.currentPoints}/${n.maxPoints})` : ""}</li>
            ))}
          </ul>
        </>
      )}
      <h2 className="mb-2 border-b border-gray-400 text-sm font-bold uppercase">Unlocked Talents</h2>
      {talentGroups.map((g) => (
        <div key={g.type || "__untyped"} className="mb-2">
          <div className="text-[11px] font-bold uppercase">{g.type || "Untyped"}</div>
          <ul className="list-disc pl-5 text-sm">
            {g.nodes.map((n) => (
              <li key={n.id}>{n.name}{n.maxPoints > 1 ? ` (${n.currentPoints}/${n.maxPoints})` : ""}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function buildText(character, tree, pools, usage, resources, raw, levels) {
  const eff = effectivePools(pools, character, tree, levels);
  const { heritage: heritageNodes, talentGroups } = groupUnlocked(
    tree.nodes.filter((n) => (n.currentPoints || 0) > 0)
  );
  const L = [];
  if (raw) {
    L.push(`name=${character.name || ""}`);
    L.push(`class=${character.class || ""}`);
    L.push(`race=${character.race || ""}`);
    L.push(`background=${character.background || ""}`);
    L.push(`age=${character.age || ""}`);
    L.push(`alignment=${character.alignment || ""}`);
    L.push(`level=${character.level}`);
    STATS.forEach((s) => L.push(`${s}=${character.stats[s]}`));
    L.push(`size=${character.size || ""}`);
    L.push(`size_count_as=${character.sizeCountAs || "medium"}`);
    L.push(`heritage_points=${usage.heritage}/${eff.heritage.total}`);
    L.push(`talent_points=${usage.talent}/${eff.talent.total}`);
    L.push(`attribute_points=${usage.attribute}/${eff.attribute.total}`);
    profLines(character).forEach((l) => L.push(`proficiency:${l}`));
    resources.forEach((r) => L.push(`resource:${r.name}=${r.value}`));
    heritageNodes.forEach((n) => L.push(`heritage:${n.name}=${n.currentPoints}/${n.maxPoints}`));
    talentGroups.forEach((g) =>
      g.nodes.forEach((n) => L.push(`skill:${n.name}=${n.currentPoints}/${n.maxPoints}`))
    );
    return L.join("\n");
  }
  L.push(`${character.name || "Unnamed Character"}`.toUpperCase());
  L.push(`${character.class || ""} | ${character.race || ""} | ${character.alignment || ""} | Level ${character.level}`);
  L.push("");
  L.push("ABILITY SCORES");
  L.push(STATS.map((s) => `${s} ${character.stats[s]}`).join("   "));
  L.push("");
  L.push("POINT POOLS");
  L.push(`Heritage: ${usage.heritage} / ${eff.heritage.total}`);
  L.push(`Talent:   ${usage.talent} / ${eff.talent.total}`);
  L.push(`Attribute:${usage.attribute} / ${eff.attribute.total}`);
  if (character.size) L.push(`Size: ${character.size}`);
  const profs = profLines(character);
  if (profs.length) {
    L.push("");
    L.push("PROFICIENCIES");
    profs.forEach((l) => L.push(`  • ${l}`));
  }
  if (resources.length) {
    L.push("");
    L.push("RESOURCES");
    resources.forEach((r) => L.push(`  ${r.name}: ${r.value}`));
  }
  if (heritageNodes.length) {
    L.push("");
    L.push("HERITAGE TRAITS");
    heritageNodes.forEach((n) =>
      L.push(`  • ${n.name}${n.maxPoints > 1 ? ` (${n.currentPoints}/${n.maxPoints})` : ""}`)
    );
  }
  L.push("");
  L.push("UNLOCKED TALENTS");
  talentGroups.forEach((g) => {
    if (g.type) L.push(`  ${g.type}:`);
    g.nodes.forEach((n) =>
      L.push(`  • ${n.name}${n.maxPoints > 1 ? ` (${n.currentPoints}/${n.maxPoints})` : ""}`)
    );
  });
  return L.join("\n");
}

export function ExportPanel({ open, onClose }) {
  const { mergedTree: tree, character, pools, settings } = useTree();
  // One export page per View tab (Shop excluded): Character, Actions,
  // Inventory and Spells, each captured separately and paginated in the PDF.
  const PAGE_LABELS = ["Character", "Actions", "Inventory", "Spells"];
  const refs = [useRef(null), useRef(null), useRef(null), useRef(null)];
  const [busy, setBusy] = useState("");

  const usage = poolUsage(tree);
  const resources = aggregateResources(tree, character, settings?.library?.levels || []);

  const download = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const captureAll = async () => {
    const canvases = [];
    for (const r of refs) {
      if (!r.current) continue;
      const canvas = await html2canvas(r.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
      });
      canvases.push(canvas);
    }
    return canvases;
  };

  // Stack the per-tab canvases vertically into one tall image.
  const composite = (canvases) => {
    const gap = 16;
    const width = Math.max(...canvases.map((c) => c.width));
    const height = canvases.reduce((a, c) => a + c.height, 0) + gap * (canvases.length - 1);
    const out = document.createElement("canvas");
    out.width = width;
    out.height = height;
    const ctx = out.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    let y = 0;
    canvases.forEach((c) => {
      ctx.drawImage(c, (width - c.width) / 2, y);
      y += c.height + gap;
    });
    return out;
  };

  const exportPNG = async () => {
    setBusy("png");
    const canvases = await captureAll();
    if (canvases.length) {
      composite(canvases).toBlob((b) =>
        download(b, `${(character.name || "character").replace(/\s+/g, "-")}.png`)
      );
    }
    setBusy("");
  };

  const exportJPEG = async () => {
    setBusy("jpeg");
    const canvases = await captureAll();
    if (canvases.length) {
      composite(canvases).toBlob(
        (b) => download(b, `${(character.name || "character").replace(/\s+/g, "-")}.jpg`),
        "image/jpeg",
        0.95
      );
    }
    setBusy("");
  };

  const exportPDF = async (editable) => {
    setBusy(editable ? "epdf" : "pdf");
    const canvases = await captureAll();
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    canvases.forEach((canvas, i) => {
      if (i > 0) pdf.addPage("a4", "pt");
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const ratio = canvas.width / canvas.height;
      let w = pw - 40, h = w / ratio;
      if (h > ph - 40) { h = ph - 40; w = h * ratio; }
      const x = (pw - w) / 2, y = 20;
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", x, y, w, h);
    });

    if (editable) {
      // Add form fields over the document for the core fields.
      const fields = [
        ["Name", character.name, 20, 60],
        ["Class", character.class, 20, 80],
        ["Race", character.race, 20, 100],
        ["Background", character.background, 20, 120],
        ["Level", String(character.level), 20, 140],
      ];
      fields.forEach(([label, val, fx, fy]) => {
        try {
          pdf.text(`${label}:`, fx, fy);
          pdf.addField({
            fieldType: "Text",
            name: label,
            x: fx + 90,
            y: fy - 12,
            width: 200,
            height: 16,
            value: String(val || ""),
          });
        } catch {
          pdf.text(`${label}: ${val || ""}`, fx + 90, fy);
        }
      });
    }
    pdf.save(`${(character.name || "character").replace(/\s+/g, "-")}.pdf`);
    setBusy("");
  };

  const exportText = (raw) => {
    const text = buildText(
      character,
      tree,
      pools,
      usage,
      resources,
      raw,
      settings?.library?.levels || []
    );
    download(new Blob([text], { type: "text/plain" }), `${(character.name || "character").replace(/\s+/g, "-")}.${raw ? "txt" : "txt"}`);
  };

  const formats = [
    { id: "pdf", label: "PDF", icon: FileDown, run: () => exportPDF(false) },
    { id: "epdf", label: "Editable PDF", icon: FileDown, run: () => exportPDF(true) },
    { id: "png", label: "PNG Image", icon: ImageIcon, run: exportPNG },
    { id: "jpeg", label: "JPEG Image", icon: ImageIcon, run: exportJPEG },
    { id: "ftxt", label: "Formatted Text", icon: FileType, run: () => exportText(false) },
    { id: "rtxt", label: "Raw Text", icon: FileText, run: () => exportText(true) },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle>Export Character Sheet</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-[1fr_220px] gap-4">
          <div className="max-h-[70vh] space-y-3 overflow-auto rounded-md border bg-muted/30 p-4">
            {PAGE_LABELS.map((label, i) => (
              <div key={label}>
                <p className="mb-1 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {i + 1}. {label}
                </p>
                <div className="flex justify-center">
                  {i === 0 ? (
                    <PresentationSheet innerRef={refs[0]} />
                  ) : (
                    <div ref={refs[i]} className="bg-white p-8" style={{ width: "760px" }}>
                      {i === 1 && <ActionsSection />}
                      {i === 2 && <InventorySection />}
                      {i === 3 && <SpellListSection />}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Choose an export format. Each View tab (except Shop) exports as its own page.
            </p>
            {formats.map((f) => (
              <Button
                key={f.id}
                variant="outline"
                className="w-full justify-start"
                disabled={busy !== ""}
                onClick={f.run}
              >
                <f.icon className="mr-2 h-4 w-4" /> {f.label}
                {busy === f.id && " …"}
              </Button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}