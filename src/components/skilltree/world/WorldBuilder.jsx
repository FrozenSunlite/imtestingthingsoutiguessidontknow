import { useEffect, useMemo, useState } from "react";
import { useTree, statVars, aggregateResources, profBonusFor } from "@/lib/treeStore";
import { derivedSheet } from "@/lib/resources";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { SettingForm } from "./SettingForm";
import { WorldMap } from "./WorldMap";
import { PlayPanel } from "./PlayPanel";
import { WorldHealthPanel } from "./WorldHealthPanel";
import { SettlementView } from "./SettlementView";
import { KingdomPanel } from "./KingdomPanel";
import { QuestsPanel } from "./QuestsPanel";
import { CombatStage } from "./CombatStage";
import { DevelopmentsPanel } from "./DevelopmentsPanel";
import {
  ERAS,
  SCALES,
  generateWorld,
} from "@/lib/worldGen";
import {
  FLOOR_TEXTURES,
  ROOM_ASSET_BUNDLES,
  fetchAssetCategories,
  fetchAssetStatus,
  fetchAssetsSmart,
  importAsset,
  listImportedImages,
  pickStickerFolder,
  roomBundle,
  setStickerRoot,
} from "@/lib/worldAssets";
import {
  applyCityLayout,
  ensureCityLayout,
  BUILDING_COMFORT,
  adjustComfort,
  footprintFor,
} from "@/lib/cityLayout";
import { ensureInterior } from "@/lib/interiorGen";
import { roomStickerList, logicalStickerPlacement } from "@/lib/roomStickers";
import { collectStickerUsage, stickerFileName } from "@/lib/stickerUsage";
import { BIOMES } from "@/lib/worldBiomes";
import { buildWorldEncounterTables } from "@/lib/worldEncounters";
import { rollEncounter } from "@/lib/dmLoot";
import { advanceWorldTime, currentLocationText, setWorldTime, timeLabel } from "@/lib/worldSim";
import {
  DISPOSITIONS,
  DISPOSITION_BY_ID,
  dispositionFor,
  dispositionRank,
} from "@/lib/dispositions";
import { downloadFoundryExport } from "@/lib/foundryExport";
import { upgradeWorld } from "@/lib/worldUpgrade";
import { ensurePlayer } from "@/lib/player";
import {
  eventResolutionCost,
  recentKingdomEvents,
  resolveKingdomEvent,
} from "@/lib/kingdom";
import {
  ArrowLeft,
  Castle,
  Clock,
  Compass,
  Construction,
  Download,
  Dices,
  Globe2,
  Image as ImageIcon,
  Map,
  Play,
  ScrollText,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Swords,
  Users,
} from "lucide-react";

const TABS = [
  ["overview", "Overview", Compass],
  ["play", "Play", Play],
  ["health", "World Health", ShieldCheck],
  ["map", "World Map", Map],
  ["settlements", "Settlements", Castle],
  ["developments", "Developments", Construction],
  ["kingdoms", "Kingdoms", CrownIcon],
  ["people", "People", Users],
  ["quests", "Quests", ScrollText],
  ["encounters", "Encounters", Shield],
  ["combat", "Combat", Swords],
  ["assets", "Stickers", ImageIcon],
];

function CrownIcon(props) {
  return <Sparkles {...props} />;
}

export function WorldBuilder({ onExit }) {
  const { settings, setSettings, character, mergedTree: tree } = useTree();
  const world = settings?.library?.world || null;
  const [tab, setTab] = useState("overview");
  const [selectedSettlementId, setSelectedSettlementId] = useState("");
  const [focusBuildingId, setFocusBuildingId] = useState("");
  const [selectedKingdomId, setSelectedKingdomId] = useState("");
  const [peopleQuery, setPeopleQuery] = useState("");
  const [peopleNation, setPeopleNation] = useState("__all__");
  const [peopleSort, setPeopleSort] = useState("name");
  const [peopleDisposition, setPeopleDisposition] = useState("__all__");
  const [clockOpen, setClockOpen] = useState(false);
  const [clockDraft, setClockDraft] = useState(null);
  const [assetStatus, setAssetStatus] = useState(null);
  const [stickerRootDraft, setStickerRootDraft] = useState("");
  const [stickerRootBusy, setStickerRootBusy] = useState(false);
  const [importedImages, setImportedImages] = useState([]);
  const [assetCategories, setAssetCategories] = useState({});
  const [assetQuery, setAssetQuery] = useState("");
  const [assetCategory, setAssetCategory] = useState("");
  const [assetResults, setAssetResults] = useState([]);
  const [assetTotal, setAssetTotal] = useState(0);
  const [assetLoading, setAssetLoading] = useState(false);
  const [mapTextureBusy, setMapTextureBusy] = useState(false);
  const [assetTarget, setAssetTarget] = useState(null);
  const [templateRoom, setTemplateRoom] = useState("");
  const [templateFloor, setTemplateFloor] = useState("wood");
  const [templateBusy, setTemplateBusy] = useState(false);
  const [encounterType, setEncounterType] = useState("");
  const [encounterLevel, setEncounterLevel] = useState(1);
  const [encounterResult, setEncounterResult] = useState(null);
  const [combatSeed, setCombatSeed] = useState(null);

  const derived = useMemo(() => {
    if (!character?.name) return null;
    const levels = settings?.library?.levels || [];
    try {
      return derivedSheet(
        character,
        tree,
        levels,
        aggregateResources(tree, character, levels),
        profBonusFor(character.level || 1, levels),
        statVars(character, tree),
        settings?.library
      );
    } catch {
      return null;
    }
  }, [character, tree, settings?.library]);

  const stickerUsage = useMemo(() => collectStickerUsage(world), [world]);
  const usedStickerUrls = useMemo(
    () => new Set(stickerUsage.map((entry) => entry.url)),
    [stickerUsage]
  );
  // Biomes used by any realm, plus any biome that already has a texture, so a
  // terrain image can always be assigned or replaced from the Stickers page.
  const mapBiomes = useMemo(() => {
    const ids = new Set();
    (world?.realms || []).forEach((realm) =>
      (realm.biomeIds || []).forEach((id) => ids.add(id))
    );
    Object.keys(world?.mapTextures || {}).forEach((id) => ids.add(id));
    return BIOMES.filter((biome) => ids.has(biome.id));
  }, [world]);

  useEffect(() => {
    if (!world) return;
    if (!selectedSettlementId) setSelectedSettlementId(world.nations?.[0]?.capitalId || world.settlements?.[0]?.id || "");
    if (!selectedKingdomId) setSelectedKingdomId(world.kingdoms?.[0]?.id || "");
  }, [world, selectedSettlementId, selectedKingdomId]);

  useEffect(() => {
    if (tab !== "assets") return undefined;
    let alive = true;
    // Retry when the folder was unavailable at startup (for example while the
    // local server was still coming up), and refresh the imported-file list
    // every time the Stickers page is opened.
    if (!assetStatus?.available) {
      fetchAssetStatus().then((status) => alive && setAssetStatus(status));
      fetchAssetCategories().then((cats) => alive && setAssetCategories(cats));
    }
    listImportedImages().then((images) => alive && setImportedImages(images));
    return () => {
      alive = false;
    };
  }, [tab, assetStatus?.available]);

  useEffect(() => {
    if (assetStatus?.root) {
      setStickerRootDraft((current) => current || assetStatus.root);
    }
  }, [assetStatus?.root]);

  const saveWorld = (next) =>
    setSettings((s) => ({ ...s, library: { ...s.library, world: next } }));

  const create = (options) => {
    const next = generateWorld(options);
    saveWorld(next);
    setSelectedSettlementId(next.nations?.[0]?.capitalId || next.settlements?.[0]?.id || "");
    setSelectedKingdomId(next.kingdoms?.[0]?.id || "");
    setTab("map");
    toast.success(`Created ${next.name}.`);
  };

  const updateWorld = (next) => saveWorld(next);

  const resolveEventInWorld = (kingdomId, eventId) => {
    const kingdom = (world?.kingdoms || []).find((item) => item.id === kingdomId);
    if (!kingdom) return;
    const result = resolveKingdomEvent(kingdom, eventId);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    saveWorld({
      ...world,
      kingdoms: world.kingdoms.map((item) =>
        item.id === kingdomId ? result.kingdom : item
      ),
    });
    toast.success(
      `${result.event.name} resolved for ${result.cost} ${result.resourceLabel}.`
    );
  };

  // Upgrade settings created before the grid city, council rename and world
  // development layers. The upgrade preserves ids, assets and textures.
  useEffect(() => {
    if (!world) return;
    const next = upgradeWorld(world);
    if (next !== world) saveWorld(next);
  }, [world?.id]);

  useEffect(() => {
    if (!world) return;
    if (!world.player) {
      saveWorld(ensurePlayer(world, character));
    }
  }, [world?.id, character?.name, character?.level]);

  useEffect(() => {
    if (!world?.player) return;
    const level = Math.max(1, Number(character?.level) || world.player.level || 1);
    if (world.player.level !== level) {
      saveWorld({ ...world, player: { ...world.player, level } });
    }
  }, [character?.level, world?.player?.level]);

  // Older projects can still point a map texture at a source-library file.
  // Copy those into the project image folder on load, then save the local URL.
  useEffect(() => {
    if (!world) return undefined;
    const legacy = Object.entries(world.mapTextures || {}).filter(
      ([, url]) => String(url || "").startsWith("/api/assets/file?path=")
    );
    if (!legacy.length) return undefined;
    let alive = true;
    (async () => {
      const next = { ...(world.mapTextures || {}) };
      let changed = false;
      for (const [biome, url] of legacy) {
        let sourcePath = "";
        try {
          sourcePath = new URL(url, window.location.origin).searchParams.get("path") || "";
        } catch {
          sourcePath = "";
        }
        if (!sourcePath) continue;
        const local = await importAsset(sourcePath);
        if (local) {
          next[biome] = local;
          changed = true;
        }
      }
      if (alive && changed) saveWorld({ ...world, mapTextures: next });
    })();
    return () => {
      alive = false;
    };
  }, [world?.id]);

  const loadAssets = async (overrides = {}) => {
    setAssetLoading(true);
    try {
      const result = await fetchAssetsSmart({
        q: overrides.q ?? assetQuery,
        category: overrides.category ?? assetCategory,
        limit: 60,
      });
      setAssetResults(result.items || []);
      setAssetTotal(result.total || 0);
      if (result.items?.length && !assetStatus?.available) {
        setAssetStatus({ available: true, files: result.total });
      }
    } finally {
      setAssetLoading(false);
    }
  };

  useEffect(() => {
    if (tab !== "assets") return;
    if (assetResults.length) return;
    loadAssets();
  }, [tab]);

  const changeStickerRoot = async (root) => {
    const cleaned = String(root || "").trim();
    if (!cleaned) {
      toast.error("Enter or browse to a sticker folder first.");
      return false;
    }
    try {
      const result = await setStickerRoot(cleaned);
      if (result?.error) {
        toast.error(result.error);
        return false;
      }
      setAssetStatus(result);
      setStickerRootDraft(result.root || cleaned);
      setAssetResults([]);
      setAssetTotal(0);
      const cats = await fetchAssetCategories();
      setAssetCategories(cats);
      listImportedImages().then(setImportedImages);
      await loadAssets({ q: assetQuery, category: assetCategory });
      toast.success(
        `Sticker folder set to ${result.root} - ${(result.files || 0).toLocaleString()} images indexed.`
      );
      return true;
    } catch {
      toast.error("Could not change the sticker folder.");
      return false;
    }
  };

  const applyStickerRoot = async () => {
    if (stickerRootBusy) return;
    setStickerRootBusy(true);
    try {
      await changeStickerRoot(stickerRootDraft);
    } finally {
      setStickerRootBusy(false);
    }
  };

  const browseStickerRoot = async () => {
    if (stickerRootBusy) return;
    setStickerRootBusy(true);
    try {
      const picked = await pickStickerFolder();
      if (picked?.canceled || !picked?.root) return;
      await changeStickerRoot(picked.root);
    } catch {
      toast.error("Could not open the folder picker. You can paste the folder path instead.");
    } finally {
      setStickerRootBusy(false);
    }
  };

  const findAssets = (room, building, mode = "assets", stickerId = "") => {
    const bundle = roomBundle(room?.type);
    setAssetTarget({
      settlementId: selectedSettlementId || world?.settlements?.find((s) => s.buildings?.some((b) => b.id === building?.id))?.id,
      buildingId: building?.id,
      roomId: room?.id,
      mode,
      roomType: room?.type,
      stickerId,
    });
    setTab("assets");
    setAssetQuery(bundle.query);
    setAssetCategory("");
    setAssetResults([]);
    setTimeout(() => loadAssets({ q: bundle.query, category: "" }), 0);
  };

  const setFloorTexture = (room, building, textureId) => {
    const nextWorld = {
      ...world,
      settlements: world.settlements.map((settlement) => {
        if (settlement.id !== selectedSettlementId) return settlement;
        return {
          ...settlement,
          buildings: settlement.buildings.map((item) =>
            item.id !== building?.id
              ? item
              : {
                  ...item,
                  rooms: (item.rooms || []).map((candidate) =>
                    candidate.id === room?.id
                      ? { ...candidate, floorTexture: textureId, floorTextureUrl: "" }
                      : candidate
                  ),
                }
          ),
        };
      }),
    };
    saveWorld(nextWorld);
  };

  // Rooms live both on the building and inside its generated interior floors.
  // Patch all three copies so the settlement view updates without a reload.
  const mapBuildingRooms = (building, mapper) => ({
    ...building,
    rooms: (building.rooms || []).map(mapper),
    interior: building.interior
      ? {
          ...building.interior,
          rooms: (building.interior.rooms || []).map(mapper),
          floors: (building.interior.floors || []).map((floorData) => ({
            ...floorData,
            rooms: (floorData.rooms || []).map(mapper),
          })),
        }
      : building.interior,
  });

  const assignAsset = async (asset) => {
    const url = asset?.url || (await importAsset(asset?.path));
    if (!url) {
      toast.error("Could not import that sticker.");
      return;
    }
    listImportedImages().then(setImportedImages);
    if (assetTarget?.mode === "mapTexture" && assetTarget.biome) {
      saveWorld({
        ...world,
        mapTextures: {
          ...(world.mapTextures || {}),
          [assetTarget.biome]: url,
        },
      });
      const label =
        BIOMES.find((biome) => biome.id === assetTarget.biome)?.label ||
        assetTarget.roomType ||
        assetTarget.biome;
      toast.success(`Map texture set for ${label}.`);
      return;
    }
    if (assetTarget?.mode === "buildingIcon" && assetTarget.buildingId) {
      saveWorld({
        ...world,
        settlements: (world.settlements || []).map((settlement) =>
          settlement.id !== assetTarget.settlementId
            ? settlement
            : {
                ...settlement,
                buildings: (settlement.buildings || []).map((building) =>
                  building.id === assetTarget.buildingId
                    ? { ...building, icon: url }
                    : building
                ),
              }
        ),
      });
      toast.success("House icon applied.");
      return;
    }
    if (!assetTarget) {
      toast.success("Sticker imported to the project image folder.");
      navigator.clipboard?.writeText(url).catch(() => {});
      return;
    }
    const nextWorld = {
      ...world,
      settlements: world.settlements.map((settlement) => {
        if (settlement.id !== assetTarget.settlementId) return settlement;
        return {
          ...settlement,
          buildings: settlement.buildings.map((building) => {
            if (building.id !== assetTarget.buildingId) return building;
            return mapBuildingRooms(building, (room) => {
              if (room.id !== assetTarget.roomId) return room;
              if (assetTarget.mode === "texture") {
                return { ...room, floorTexture: "custom", floorTextureUrl: url };
              }
              const templateUrls =
                world.roomAssetTemplates?.[room.type]?.urls || [];
              const existing = roomStickerList(room, templateUrls);
              if (assetTarget.mode === "replaceSticker" && assetTarget.stickerId) {
                const stickers = existing.map((sticker) =>
                  sticker.id === assetTarget.stickerId
                    ? { ...sticker, url, template: false }
                    : sticker
                );
                return {
                  ...room,
                  stickers,
                  stickersCustom: true,
                  assets: stickers.map((sticker) => sticker.url),
                };
              }
              const placement = logicalStickerPlacement(room, existing.length, url);
              const stickers = [
                ...existing,
                {
                  id: `sticker_${room.id}_${Date.now().toString(36)}_${existing.length}`,
                  url,
                  ...placement,
                  template: false,
                },
              ];
              return {
                ...room,
                stickers,
                stickersCustom: true,
                assets: stickers.map((sticker) => sticker.url),
              };
            });
          }),
        };
      }),
    };
    saveWorld(nextWorld);
    toast.success(
      assetTarget.mode === "texture"
        ? "Floor material applied."
        : assetTarget.mode === "replaceSticker"
          ? "Sticker image replaced."
          : "Sticker placed in room."
    );
  };

  const stageBattle = (rows, name = "Encounter") => {
    const monsters = (rows || [])
      .filter((row) => row && row.monster && Number(row.count) > 0)
      .map((row) => ({ name: row.monster, count: Math.max(1, Number(row.count) || 1) }));
    if (!monsters.length) {
      toast.error("No creatures to stage.");
      return;
    }
    setCombatSeed({ at: Date.now(), name, monsters });
    setTab("combat");
    toast.info("Encounter staged. Add allies if you like, then roll initiative.");
  };

  const stageQuestBattle = (quest) => {
    const library = settings?.library?.monsters || [];
    const raw = String(quest?.encounterTable || "").split("\u00b7")[0].trim();
    const name = raw || "Bandit";
    const match =
      library.find((m) => String(m.name).toLowerCase() === name.toLowerCase()) ||
      library.find((m) => String(m.name).toLowerCase().includes(name.toLowerCase())) ||
      library
        .filter((m) => Math.abs((Number(m.cr) || 0) - (Number(quest?.level) || 1)) <= 1)
        .sort((a, b) => (Number(b.cr) || 0) - (Number(a.cr) || 0))[0] ||
      null;
    stageBattle([{ monster: match?.name || name, count: quest?.status === "ready" ? 3 : 2 }], quest?.title || "Quest battle");
  };

  const advanceTime = (hours) => {
    saveWorld(advanceWorldTime(world, hours));
    toast.success(`Time advances ${hours} hour${hours === 1 ? "" : "s"}.`);
  };

  const openClock = () => {
    setClockDraft({ ...(world?.calendar || { year: 1, month: 1, day: 1, hour: 8 }) });
    setClockOpen(true);
  };

  const applyClock = () => {
    if (!clockDraft) return;
    saveWorld(setWorldTime(world, clockDraft));
    setClockOpen(false);
    toast.success("World clock set.");
  };

  const rebuildSettlementPlan = (settlement) => {
    if (!settlement) return;
    const nextWorld = {
      ...world,
      settlements: world.settlements.map((item) => {
        if (item.id !== settlement.id) return item;
        const copy = {
          ...item,
          buildings: (item.buildings || []).map((building) => {
            const comfort =
              building.comfort ||
              adjustComfort(BUILDING_COMFORT[building.type] || "Poor", item.kind);
            const footprintSize = footprintFor(comfort);
            const rooms = (building.rooms || []).map((room) => {
              const {
                x: _x,
                y: _y,
                w: _w,
                h: _h,
                floor: _floor,
                door: _door,
                ...rest
              } = room;
              return rest;
            });
            return {
              ...building,
              comfort,
              footprint: building.footprint || { w: footprintSize, h: footprintSize },
              rooms,
              interior: undefined,
              interiorSize: undefined,
            };
          }),
        };
        delete copy.mapLayout;
        copy.buildings = copy.buildings.map((building) => ensureInterior(building));
        applyCityLayout(copy);
        return copy;
      }),
    };
    saveWorld(nextWorld);
    toast.success("Rebuilt the street grid and room layouts.");
  };

  const applyRoomTemplate = async (roomType) => {
    if (!roomType || templateBusy) return;
    setTemplateBusy(true);
    try {
      const bundle = roomBundle(roomType);
      const result = await fetchAssetsSmart({ q: bundle.query, limit: 12 });
      const urls = [];
      for (const asset of (result.items || []).slice(0, 8)) {
        const url = await importAsset(asset.path);
        if (url) urls.push(url);
      }
      if (!urls.length) {
        toast.error(`No stickers found for ${roomType}.`);
        return;
      }
      const nextWorld = {
        ...world,
        roomAssetTemplates: {
          ...(world.roomAssetTemplates || {}),
          [roomType]: {
            urls,
            floorTexture: templateFloor,
            updatedAt: new Date().toISOString(),
          },
        },
        settlements: world.settlements.map((settlement) => ({
          ...settlement,
          buildings: (settlement.buildings || []).map((building) => ({
            ...building,
            rooms: (building.rooms || []).map((room) =>
              room.type === roomType && room.floorTexture !== "custom"
                ? { ...room, floorTexture: templateFloor, floorTextureUrl: "" }
                : room
            ),
          })),
        })),
      };
      saveWorld(nextWorld);
      toast.success(
        `Saved ${urls.length} ${roomType} stickers and the ${templateFloor} floor as the shared room-template.`
      );
    } finally {
      setTemplateBusy(false);
    }
  };

  const stickerUrlsForRoom = (room) =>
    roomStickerList(room, world.roomAssetTemplates?.[room.type]?.urls || []).map(
      (sticker) => sticker.url
    );

  const useRoomAsTemplate = (room) => {
    if (!room) return;
    const urls = [...new Set(stickerUrlsForRoom(room))];
    if (!urls.length) {
      toast.error("Add some stickers to this room first.");
      return;
    }
    const nextWorld = {
      ...world,
      roomAssetTemplates: {
        ...(world.roomAssetTemplates || {}),
        [room.type]: {
          urls,
          floorTexture: room.floorTexture || "",
          updatedAt: new Date().toISOString(),
        },
      },
    };
    saveWorld(nextWorld);
    toast.success(`${room.type} now uses this sticker set in every interior.`);
  };

  const setRoomStickers = (room, building, stickers) => {
    if (!room || !building) return;
    const settlement =
      world.settlements.find((item) =>
        (item.buildings || []).some((candidate) => candidate.id === building.id)
      ) ||
      world.settlements.find((item) => item.id === selectedSettlementId);
    if (!settlement) return;
    const nextWorld = {
      ...world,
      settlements: world.settlements.map((item) =>
        item.id !== settlement.id
          ? item
          : {
              ...item,
              buildings: (item.buildings || []).map((candidate) =>
                candidate.id !== building.id
                  ? candidate
                  : mapBuildingRooms(candidate, (entry) =>
                      entry.id === room.id
                        ? {
                            ...entry,
                            stickers,
                            stickersCustom: true,
                            assets: stickers.map((sticker) => sticker.url),
                          }
                        : entry
                    )
              ),
            }
      ),
    };
    saveWorld(nextWorld);
  };

  const updateBuilding = (settlement, building, patch) => {
    if (!settlement || !building) return;
    const nextWorld = {
      ...world,
      settlements: (world.settlements || []).map((item) =>
        item.id !== settlement.id
          ? item
          : {
              ...item,
              // A footprint change invalidates the cached street grid; the
              // layout is regenerated from the new building sizes.
              ...(patch?.footprint ? { mapLayout: null } : {}),
              buildings: (item.buildings || []).map((candidate) =>
                candidate.id === building.id ? { ...candidate, ...patch } : candidate
              ),
            }
      ),
    };
    saveWorld(nextWorld);
  };

  const moveBuilding = (settlement, building, x, y) => {
    if (!settlement || !building) return;
    const layout = settlement.mapLayout || ensureCityLayout(settlement);
    const entry = (layout?.buildings || []).find((row) => row.id === building.id);
    if (!entry) return;
    const nextLayout = {
      ...layout,
      buildings: (layout.buildings || []).map((row) =>
        row.id !== entry.id
          ? row
          : {
              ...row,
              x,
              y,
              doorX: row.doorX != null ? row.doorX + (x - row.x) : row.doorX,
              doorY: row.doorY != null ? row.doorY + (y - row.y) : row.doorY,
            }
      ),
    };
    saveWorld({
      ...world,
      settlements: (world.settlements || []).map((item) =>
        item.id === settlement.id ? { ...item, mapLayout: nextLayout } : item
      ),
    });
  };

  const rerollInterior = (settlement, building) => {
    if (!settlement || !building) return;
    const seed = `${building.id || building.name}:${Date.now().toString(36)}`;
    const nextBuilding = ensureInterior(building, settlement, { seed, force: true });
    const nextWorld = {
      ...world,
      settlements: world.settlements.map((item) =>
        item.id !== settlement.id
          ? item
          : {
              ...item,
              buildings: (item.buildings || []).map((candidate) =>
                candidate.id === building.id ? nextBuilding : candidate
              ),
            }
      ),
    };
    saveWorld(nextWorld);
    toast.success(`Room layout rerolled with seed ${seed}.`);
  };

  const targetMapTexture = (biome) => {
    if (!biome) return;
    setAssetTarget({
      mode: "mapTexture",
      biome: biome.id,
      roomType: biome.label || biome.id,
    });
  };

  const clearMapTexture = (biomeId) => {
    if (!world || !biomeId) return;
    const next = { ...(world.mapTextures || {}) };
    delete next[biomeId];
    saveWorld({ ...world, mapTextures: next });
    toast.success(
      `Cleared the ${BIOMES.find((biome) => biome.id === biomeId)?.label || biomeId} map texture.`
    );
  };

  const autoFillMapTextures = async () => {
    if (!world || mapTextureBusy) return;
    setMapTextureBusy(true);
    try {
      const next = { ...(world.mapTextures || {}) };
      const ids = new Set();
      (world.realms || []).forEach((realm) =>
        (realm.biomeIds || []).forEach((id) => ids.add(id))
      );
      for (const id of ids) {
        if (next[id]) continue;
        const biome = BIOMES.find((item) => item.id === id);
        if (!biome) continue;
        const result = await fetchAssetsSmart({
          q: `${biome.assets?.[0] || biome.label} texture`,
          category: "Texture",
          limit: 1,
        });
        const asset = result.items?.[0];
        if (!asset) continue;
        const url = await importAsset(asset.path);
        if (url) next[id] = url;
      }
      saveWorld({ ...world, mapTextures: next });
      listImportedImages().then(setImportedImages);
      toast.success("Missing terrain textures imported from the sticker library.");
    } finally {
      setMapTextureBusy(false);
    }
  };

  const openStickerUsage = (usage) => {
    if (!usage) return;
    if (usage.settlementId) {
      setSelectedSettlementId(usage.settlementId);
      setFocusBuildingId(usage.buildingId || "");
      setTab("settlements");
      return;
    }
    if (usage.kind === "map") {
      const biome = BIOMES.find((item) => item.id === usage.biome);
      targetMapTexture(
        biome || { id: usage.biome, label: usage.biome || "terrain" }
      );
      setTab("assets");
    }
  };

  const generateEncounterTables = () => {
    const tables = buildWorldEncounterTables(settings?.library?.monsters || [], { partySize: 4 });
    if (!tables.length) {
      toast.error("No monsters with a CR are available. Import or add monsters first.");
      return;
    }
    const next = { ...world, encounterTables: tables };
    saveWorld(next);
    setEncounterType(tables[0].monsterType);
    setEncounterLevel(tables[0].level);
    toast.success(`Built ${tables.length} encounter tables.`);
  };

  const currentEncounter = useMemo(() => {
    const tables = world?.encounterTables || [];
    return (
      tables.find(
        (table) =>
          String(table.monsterType).toLowerCase() === String(encounterType).toLowerCase() &&
          Number(table.level) === Number(encounterLevel)
      ) || tables[0] || null
    );
  }, [world, encounterType, encounterLevel]);

  const rollTable = () => {
    if (!currentEncounter) return;
    const result = rollEncounter(currentEncounter, settings?.library?.monsters || []);
    setEncounterResult(result);
  };

  const exportWorld = () => {
    if (!world) return;
    const blob = new Blob([JSON.stringify(world, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(world.name || "setting").replace(/[^\w-]+/g, "_")}.world.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const buildHere = (settlement, building) => {
    const target = {
      settlementId: settlement.id,
      settlementName: settlement.name,
      buildingId: building?.id,
      buildingName: building?.name,
      nationName: world?.nations?.find((n) => n.id === settlement.nationId)?.name || "",
    };
    try {
      localStorage.setItem("skilltree:worldBuildTarget", JSON.stringify(target));
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new CustomEvent("skilltree:open-architect"));
    toast.success(`Opening Architect for ${settlement.name}.`);
  };

  // People are shown with a resolved disposition. Stored dispositions win;
  // otherwise it is derived from the NPC's kingdom relations so older saves
  // still get sensible badges without a migration.
  const people = useMemo(() => {
    const query = peopleQuery.trim().toLowerCase();
    const rows = (world?.npcs || [])
      .map((npc) => ({
        npc,
        disposition: npc.disposition || dispositionFor(world, npc),
        settlement:
          (world?.settlements || []).find((item) => item.id === npc.settlementId) ||
          null,
      }))
      .filter(({ npc }) => peopleNation === "__all__" || npc.nationId === peopleNation)
      .filter(
        ({ npc, disposition }) =>
          peopleDisposition === "__all__" || disposition === peopleDisposition
      )
      .filter(({ npc, disposition }) =>
        `${npc.name} ${npc.occupation} ${npc.role} ${disposition} ${npc.personality?.trait} ${npc.personality?.background}`
          .toLowerCase()
          .includes(query)
      );

    const byName = (a, b) => (a.npc.name || "").localeCompare(b.npc.name || "");
    rows.sort((a, b) => {
      if (peopleSort === "settlement") {
        return (
          (a.settlement?.name || "").localeCompare(b.settlement?.name || "") ||
          byName(a, b)
        );
      }
      if (peopleSort === "occupation") {
        return (a.npc.occupation || "").localeCompare(b.npc.occupation || "") || byName(a, b);
      }
      if (peopleSort === "disposition") {
        return dispositionRank(a.disposition) - dispositionRank(b.disposition) || byName(a, b);
      }
      return byName(a, b);
    });
    return rows.slice(0, 250);
  }, [world, peopleQuery, peopleNation, peopleSort, peopleDisposition]);

  const setNpcDisposition = (npcId, disposition) => {
    if (!world || !npcId) return;
    saveWorld({
      ...world,
      npcs: (world.npcs || []).map((npc) =>
        npc.id === npcId ? { ...npc, disposition } : npc
      ),
    });
  };

  const era = ERAS.find((e) => e.id === world?.eraId);
  const scale = SCALES.find((s) => s.id === world?.scaleId);

  if (!world) {
    return (
      <div className="flex h-full flex-col bg-background">
        <header className="flex items-center gap-2 border-b px-3 py-2">
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={onExit}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="font-display text-base font-semibold">World Builder</h1>
        </header>
        <div className="mx-auto w-full max-w-3xl overflow-y-auto p-3">
          <SettingForm onCreate={create} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <header className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-3 py-2">
        <Button size="icon" variant="outline" className="h-8 w-8" onClick={onExit}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <h1 className="truncate font-display text-base font-semibold">{world.name}</h1>
          <p className="text-[10px] text-muted-foreground">
            {era?.label}  -  {world.theme}  -  {scale?.label}  -  {world.nations.length} nations  - {" "}
            {world.settlements.length} settlements  -  {world.npcs.length} people
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={openClock}>
            <Clock className="mr-1 h-3.5 w-3.5" /> {timeLabel(world)}
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => downloadFoundryExport(world, character)}>
            <Download className="mr-1 h-3.5 w-3.5" /> Foundry
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={exportWorld}>
            <Download className="mr-1 h-3.5 w-3.5" /> Export JSON
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => {
              if (window.confirm("Create a new setting and replace the current one?")) saveWorld(null);
            }}
          >
            New setting
          </Button>
        </div>
      </header>

      {clockOpen && clockDraft && (
        <div className="flex flex-wrap items-end gap-2 border-b bg-muted/20 px-3 py-2">
          <div className="space-y-0.5">
            <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Year</p>
            <Input
              className="h-7 w-16 text-xs"
              type="number"
              value={clockDraft.year}
              onChange={(e) => setClockDraft((d) => ({ ...d, year: Number(e.target.value) }))}
            />
          </div>
          <div className="space-y-0.5">
            <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Month</p>
            <Input
              className="h-7 w-16 text-xs"
              type="number"
              min={1}
              max={12}
              value={clockDraft.month}
              onChange={(e) => setClockDraft((d) => ({ ...d, month: Number(e.target.value) }))}
            />
          </div>
          <div className="space-y-0.5">
            <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Day</p>
            <Input
              className="h-7 w-16 text-xs"
              type="number"
              min={1}
              max={30}
              value={clockDraft.day}
              onChange={(e) => setClockDraft((d) => ({ ...d, day: Number(e.target.value) }))}
            />
          </div>
          <div className="space-y-0.5">
            <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Hour</p>
            <Input
              className="h-7 w-16 text-xs"
              type="number"
              min={0}
              max={23}
              value={clockDraft.hour}
              onChange={(e) => setClockDraft((d) => ({ ...d, hour: Number(e.target.value) }))}
            />
          </div>
          <Button size="sm" className="h-7 text-xs" onClick={applyClock}>Set time</Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setClockOpen(false)}>Cancel</Button>
          <div className="ml-auto flex gap-1">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => advanceTime(1)}>+1 hour</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => advanceTime(8)}>+8 hours</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => advanceTime(24)}>+1 day</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => advanceTime(24 * 7)}>+1 week</Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1 border-b px-3 py-1.5">
        {TABS.map(([id, label, Icon]) => (
          <Button
            key={id}
            size="sm"
            variant={tab === id ? "secondary" : "ghost"}
            className="h-7 text-xs"
            onClick={() => setTab(id)}
          >
            <Icon className="mr-1 h-3.5 w-3.5" /> {label}
          </Button>
        ))}
      </div>

      <main className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === "overview" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <Metric icon={Globe2} label="Realms" value={world.realms.length} />
              <Metric icon={Castle} label="Nations" value={world.nations.length} />
              <Metric icon={Map} label="Settlements" value={world.settlements.length} />
              <Metric icon={Users} label="NPCs" value={world.npcs.length} />
              <Metric icon={Construction} label="Developments" value={(world.developments || []).length} />
            </div>
            <div className="grid gap-2 lg:grid-cols-2">
              <div className="rounded-md border p-3">
                <h2 className="text-sm font-semibold">Setting</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {era?.description} {scale?.description}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-1 text-[10px]">
                  <span>Era: {era?.label}</span>
                  <span>Tech level: {era?.tech}</span>
                  <span>Theme: {world.theme}</span>
                  <span>Seed: {world.seed}</span>
                  <span>Biomes: {world.realms[0]?.biomeLabels?.join(", ")}</span>
                  <span>Routes: {world.routes.length}</span>
                </div>
              </div>
              <div className="rounded-md border p-3">
                <h2 className="text-sm font-semibold">Powers</h2>
                <div className="mt-1 max-h-48 space-y-1 overflow-y-auto text-[10px]">
                  {world.nations.map((nation) => {
                    const kingdom = world.kingdoms.find((k) => k.id === nation.kingdomId);
                    return (
                      <button
                        key={nation.id}
                        type="button"
                        className="flex w-full items-center gap-1 rounded px-1 py-1 text-left hover:bg-accent/50"
                        onClick={() => {
                          setSelectedKingdomId(kingdom?.id || "");
                          setTab("kingdoms");
                        }}
                      >
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: nation.color }} />
                        <span className="min-w-0 flex-1 truncate font-medium">{nation.name}</span>
                        <span className="text-muted-foreground">{nation.culture}</span>
                        <span className="text-muted-foreground">{kingdom?.stats?.military || 0} MIL</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="rounded-md border p-3">
              <h2 className="text-sm font-semibold">Realms / planets / planes</h2>
              <div className="mt-1 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {world.realms.map((realm) => (
                  <div key={realm.id} className="rounded border p-2 text-[10px]">
                    <p className="text-xs font-semibold">{realm.name}</p>
                    <p className="text-muted-foreground">{realm.kind}  -  {realm.biomeLabels?.join(", ")}</p>
                    <p className="mt-1 text-muted-foreground">
                      {realm.nationIds.length} nations  -  {realm.settlementIds.length} settlements
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="rounded-md border p-3">
                <h2 className="flex items-center gap-1 text-sm font-semibold">
                  <Clock className="h-3.5 w-3.5" /> Living world
                </h2>
                <p className="mt-1 text-xs">{timeLabel(world)}</p>
                <p className="text-[10px] text-muted-foreground">
                  {world.calendar?.season || "Spring"}  -  {(world.caravans || []).length} caravans  - {" "}
                  {(world.events || []).length} events
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => advanceTime(1)}>+1 hour</Button>
                  <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => advanceTime(8)}>+8 hours</Button>
                  <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => advanceTime(24)}>+1 day</Button>
                  <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={openClock}>Set time...</Button>
                </div>
                {(world.caravans || []).filter((caravan) => caravan.status === "travelling").slice(0, 4).map((caravan) => {
                  const from = world.settlements.find((s) => s.id === caravan.fromSettlementId);
                  const to = world.settlements.find((s) => s.id === caravan.toSettlementId);
                  return (
                    <div key={caravan.id} className="mt-1 text-[10px]">
                      <div className="flex justify-between">
                        <span className="truncate">{from?.name || "?"}{" -> "}{to?.name || "?"}</span>
                        <span className="text-muted-foreground">{Math.round((caravan.progress || 0) * 100)}%</span>
                      </div>
                      <div className="mt-0.5 h-1 overflow-hidden rounded bg-muted">
                        <div className="h-full bg-primary" style={{ width: `${(caravan.progress || 0) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-1">
                  <h2 className="text-sm font-semibold">Recent events</h2>
                  <span className="text-[9px] text-muted-foreground">
                    {(world.kingdoms || []).reduce(
                      (sum, kingdom) => sum + (kingdom.activeEvents || []).length,
                      0
                    )}{" "}
                    active
                  </span>
                </div>
                <div className="mt-1 max-h-52 space-y-1 overflow-y-auto text-[10px]">
                  {(world.kingdoms || []).flatMap((kingdom) =>
                    (kingdom.activeEvents || []).map((event) => ({
                      kingdom,
                      event,
                    }))
                  ).slice(0, 6).map(({ kingdom, event }) => (
                    <div
                      key={`${kingdom.id}:${event.id}`}
                      className={`rounded border px-1.5 py-1 ${
                        event.positive
                          ? "border-emerald-500/30 bg-emerald-500/5"
                          : "border-amber-500/30 bg-amber-500/5"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <p className="font-medium">
                          {event.name} <span className="text-muted-foreground"> -  {kingdom.name}</span>
                        </p>
                        <span className={event.positive ? "text-emerald-400" : "text-amber-400"}>
                          {event.positive ? "Boon" : "Task"}
                        </span>
                      </div>
                      <p className="text-muted-foreground">{event.ongoing || event.effect}</p>
                      {event.monthsRemaining != null && (
                        <p className="text-muted-foreground">
                          {event.monthsRemaining} month{event.monthsRemaining === 1 ? "" : "s"} remaining
                        </p>
                      )}
                      {event.resolveWith && (
                        <button
                          type="button"
                          className="mt-1 rounded border px-1 py-0.5 text-[9px] hover:bg-accent"
                          onClick={() => resolveEventInWorld(kingdom.id, event.id)}
                        >
                          Resolve  -  {eventResolutionCost(event)} {event.resolveLabel}
                        </button>
                      )}
                    </div>
                  ))}
                  {recentKingdomEvents(world, 6).map((row) => (
                    <p key={`${row.kingdomId}:${row.event?.name}:${row.turn}`} className="text-muted-foreground">
                      - <span className="text-foreground">{row.kingdomName}</span>: {row.event?.name} -{" "}
                      {row.event?.effect}
                      <span className="ml-1 text-[8px] uppercase tracking-wide">{row.status}</span>
                    </p>
                  ))}
                  {!recentKingdomEvents(world, 1).length &&
                    !(world.kingdoms || []).some((kingdom) => (kingdom.activeEvents || []).length) && (
                      <p className="text-muted-foreground">
                        No recent events. Run a kingdom turn to see what happens.
                      </p>
                    )}
                  {(world.events || []).slice(-3).reverse().map((event, index) => (
                    <p key={`world-${index}`} className="text-muted-foreground">
                      - {event.text}
                    </p>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setTab("play")}>
                <Play className="mr-1 h-3.5 w-3.5" /> Enter play
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setTab("health")}>
                <ShieldCheck className="mr-1 h-3.5 w-3.5" /> World health
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setTab("map")}>Open world map</Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={generateEncounterTables}>
                <Dices className="mr-1 h-3.5 w-3.5" /> Build encounter tables
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setTab("kingdoms")}>
                Run a kingdom turn
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setTab("quests")}>
                <ScrollText className="mr-1 h-3.5 w-3.5" /> Quest board
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setTab("developments")}>
                <Construction className="mr-1 h-3.5 w-3.5" /> World developments
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setTab("combat")}>
                <Swords className="mr-1 h-3.5 w-3.5" /> Combat stage
              </Button>
            </div>
            {(world.logs || []).length > 0 && (
              <p className="text-[10px] text-muted-foreground">{world.logs[world.logs.length - 1].text}</p>
            )}
          </div>
        )}

        {tab === "play" && (
          <PlayPanel
            world={world}
            character={character}
            settings={settings}
            onChange={updateWorld}
            onStartCombat={stageBattle}
            onOpenKingdom={(id) => {
              setSelectedKingdomId(id || "");
              setTab("kingdoms");
            }}
          />
        )}

        {tab === "health" && (
          <WorldHealthPanel
            world={world}
            character={character}
            onChange={updateWorld}
          />
        )}

        {tab === "map" && (
          <WorldMap
            world={world}
            selectedId={selectedSettlementId}
            onSelect={setSelectedSettlementId}
            onOpenSettlement={(id) => {
              setSelectedSettlementId(id);
              setTab("settlements");
            }}
            onTextures={(next) => saveWorld({ ...world, mapTextures: next })}
            onEditTextures={() => setTab("assets")}
            onChange={updateWorld}
          />
        )}

        {tab === "settlements" && (
          <SettlementView
            world={world}
            settlementId={selectedSettlementId}
            focusBuildingId={focusBuildingId}
            onSelectSettlement={setSelectedSettlementId}
            onFindAssets={findAssets}
            onSetFloorTexture={setFloorTexture}
            onOpenKingdom={(id) => {
              setSelectedKingdomId(id || "");
              setTab("kingdoms");
            }}
            onBuildHere={buildHere}
            onRegenerateLayout={rebuildSettlementPlan}
            onUpdateRoomStickers={setRoomStickers}
            onUseRoomTemplate={useRoomAsTemplate}
            onRerollInterior={rerollInterior}
            onUpdateBuilding={updateBuilding}
            onMoveBuilding={moveBuilding}
          />
        )}

        {tab === "developments" && (
          <DevelopmentsPanel
            world={world}
            onChange={updateWorld}
            onShowMap={() => setTab("map")}
            onOpenSettlement={(id) => {
              setSelectedSettlementId(id);
              setTab("settlements");
            }}
          />
        )}

        {tab === "kingdoms" && (
          <KingdomPanel
            world={world}
            kingdomId={selectedKingdomId}
            onSelect={setSelectedKingdomId}
            onChange={updateWorld}
          />
        )}

        {tab === "quests" && (
          <QuestsPanel
            world={world}
            character={character}
            onChange={updateWorld}
            onStartCombat={stageQuestBattle}
          />
        )}

        {tab === "combat" && (
          <CombatStage
            world={world}
            character={character}
            derived={derived}
            monsters={settings?.library?.monsters || []}
            seed={combatSeed}
            onChange={updateWorld}
          />
        )}

        {tab === "people" && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-1">
              <Input
                className="h-7 w-56 text-xs"
                placeholder="Search people, jobs, traits..."
                value={peopleQuery}
                onChange={(e) => setPeopleQuery(e.target.value)}
              />
              <Select value={peopleNation} onValueChange={setPeopleNation}>
                <SelectTrigger className="h-7 w-48 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All nations</SelectItem>
                  {world.nations.map((nation) => (
                    <SelectItem key={nation.id} value={nation.id}>{nation.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={peopleDisposition} onValueChange={setPeopleDisposition}>
                <SelectTrigger className="h-7 w-36 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All dispositions</SelectItem>
                  {DISPOSITIONS.map((disposition) => (
                    <SelectItem key={disposition.id} value={disposition.id}>
                      {disposition.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={peopleSort} onValueChange={setPeopleSort}>
                <SelectTrigger className="h-7 w-36 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Sort: name</SelectItem>
                  <SelectItem value="settlement">Sort: settlement</SelectItem>
                  <SelectItem value="occupation">Sort: occupation</SelectItem>
                  <SelectItem value="disposition">Sort: disposition</SelectItem>
                </SelectContent>
              </Select>
              <span className="ml-auto text-[10px] text-muted-foreground">{people.length} shown</span>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => advanceTime(8)}>
                <Clock className="mr-1 h-3.5 w-3.5" /> {timeLabel(world)}  -  +8h
              </Button>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {people.map(({ npc, disposition, settlement }) => {
                const home = settlement?.buildings?.find((b) => b.id === npc.homeBuildingId);
                const work = settlement?.buildings?.find((b) => b.id === npc.workBuildingId);
                const badge = DISPOSITION_BY_ID[disposition] || DISPOSITION_BY_ID.indifferent;
                return (
                  <div key={npc.id} className="rounded-md border p-2 text-[10px]">
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-xs font-semibold">{npc.name}</p>
                      <span className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-medium ${badge.color} ${badge.bg}`}>
                        {badge.label}
                      </span>
                    </div>
                    <p className="text-muted-foreground">{npc.occupation}  -  {settlement?.name || "Unknown"}</p>
                    <label className="mt-1 flex items-center gap-1">
                      <span className="font-medium">Disposition</span>
                      <select
                        className="h-6 flex-1 rounded border bg-background px-1 text-[10px]"
                        value={disposition}
                        onChange={(event) =>
                          setNpcDisposition(npc.id, event.target.value)
                        }
                      >
                        {DISPOSITIONS.map((item) => (
                          <option key={item.id} value={item.id}>{item.label}</option>
                        ))}
                      </select>
                    </label>
                    <p className="mt-1"><span className="font-medium">Trait:</span> {npc.personality?.trait}</p>
                    <p><span className="font-medium">Ideal:</span> {npc.personality?.ideal}</p>
                    <p><span className="font-medium">Bond:</span> {npc.personality?.bond}</p>
                    <p><span className="font-medium">Flaw:</span> {npc.personality?.flaw}</p>
                    <p className="text-muted-foreground">{npc.personality?.background}</p>
                    <p className="mt-1 rounded bg-muted/40 px-1 py-0.5 text-muted-foreground">
                      <span className="font-medium text-foreground">Now:</span>{" "}
                      {npc.currentLocation ? currentLocationText(world, npc) : "Unknown"}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      Home: {home?.name || "Unknown"}  -  Work: {work?.name || "Unknown"}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "encounters" && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-1">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={generateEncounterTables}>
                <Dices className="mr-1 h-3.5 w-3.5" /> Rebuild tables
              </Button>
              <Select value={encounterType} onValueChange={setEncounterType}>
                <SelectTrigger className="h-7 w-44 text-xs"><SelectValue placeholder="Monster type" /></SelectTrigger>
                <SelectContent>
                  {[...new Set((world.encounterTables || []).map((t) => t.monsterType))].map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(encounterLevel)} onValueChange={(v) => setEncounterLevel(Number(v))}>
                <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 20 }, (_, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>Level {i + 1}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={rollTable} disabled={!currentEncounter}>
                Roll encounter
              </Button>
              <span className="ml-auto text-[10px] text-muted-foreground">
                {(world.encounterTables || []).length} tables
              </span>
            </div>
            {currentEncounter ? (
              <div className="grid gap-2 lg:grid-cols-2">
                <div className="rounded-md border p-2">
                  <p className="text-sm font-semibold">{currentEncounter.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {currentEncounter.notes}  -  CR {currentEncounter.crMin} - {currentEncounter.crMax}
                  </p>
                  <div className="mt-2 space-y-1">
                    {currentEncounter.rows.map((row, index) => (
                      <div key={index} className="flex justify-between rounded border px-1.5 py-1 text-[10px]">
                        <span className="font-medium">{row.difficulty}</span>
                        <span>{row.count}x {row.monster}</span>
                        <span className="text-muted-foreground">CR {row.cr}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-md border p-2">
                  <p className="text-sm font-semibold">Roll result</p>
                  {encounterResult ? (
                    <div className="mt-1 space-y-1">
                      {encounterResult.map((row, index) => (
                        <p key={index} className="text-[11px]">{row.count}x {row.monster}</p>
                      ))}
                      {encounterResult.length === 0 && <p className="text-[10px] text-muted-foreground">No creatures rolled.</p>}
                      {encounterResult.length > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-1 h-7 text-xs"
                          onClick={() => stageBattle(encounterResult, currentEncounter.name)}
                        >
                          <Swords className="mr-1 h-3.5 w-3.5" /> Stage battle
                        </Button>
                      )}
                    </div>
                  ) : (
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Roll the table to get a 4-player encounter for the chosen type and level.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No encounter tables yet. Build them from the Monster library.
              </p>
            )}
          </div>
        )}

        {tab === "assets" && (
          <div className="space-y-2">
            <div className="rounded-md border border-primary/30 bg-primary/5 p-2">
              <div className="flex flex-wrap items-center gap-1">
                <p className="text-xs font-semibold">Sticker source folder</p>
                <span className="text-[10px] text-muted-foreground">
                  {assetStatus?.available
                    ? `${assetStatus.files?.toLocaleString()} images indexed`
                    : "Folder not available"}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <Input
                  className="h-7 min-w-0 flex-1 text-xs"
                  value={stickerRootDraft}
                  onChange={(event) => setStickerRootDraft(event.target.value)}
                  placeholder="Example: D:\Sticker Library"
                  title="Folder the sticker browser reads from"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  disabled={stickerRootBusy}
                  onClick={applyStickerRoot}
                >
                  Use folder
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  disabled={stickerRootBusy}
                  onClick={browseStickerRoot}
                >
                  Browse...
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  disabled={stickerRootBusy}
                  onClick={() => assetStatus?.root && setStickerRootDraft(assetStatus.root)}
                >
                  Reset
                </Button>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Browse opens a folder picker on the machine running the local server. This folder is
                only the source for browsing; every image you place is copied into the project image
                folder, so the project keeps working if the source folder moves or disconnects.
              </p>
            </div>

            <div className="rounded-md border p-2">
              <div className="flex flex-wrap items-center gap-1">
                <p className="text-xs font-semibold">Loaded stickers</p>
                <span className="text-[10px] text-muted-foreground">
                  {stickerUsage.length} unique image{stickerUsage.length === 1 ? "" : "s"}  -  click a use to jump to it
                </span>
              </div>
              <div className="mt-1 grid max-h-64 grid-cols-2 gap-1.5 overflow-y-auto sm:grid-cols-4 lg:grid-cols-6">
                {stickerUsage.map((entry) => (
                  <div key={entry.url} className="overflow-hidden rounded border">
                    <img
                      src={entry.url}
                      alt={stickerFileName(entry.url)}
                      loading="lazy"
                      className="h-16 w-full bg-muted/30 object-contain"
                    />
                    <div className="space-y-0.5 p-1">
                      <p className="truncate text-[9px] font-medium" title={entry.url}>
                        {stickerFileName(entry.url)}
                      </p>
                      <p className="text-[8px] text-muted-foreground">
                        {entry.usages.length} use{entry.usages.length === 1 ? "" : "s"}
                      </p>
                      <div className="max-h-16 space-y-0.5 overflow-y-auto">
                        {entry.usages.slice(0, 8).map((usage, index) =>
                          usage.settlementId || usage.kind === "map" ? (
                            <button
                              key={index}
                              type="button"
                              className="block w-full truncate text-left text-[8px] underline-offset-1 hover:underline"
                              onClick={() => openStickerUsage(usage)}
                            >
                              {usage.settlementId
                                ? `${usage.buildingName || usage.settlementName}  -  ${usage.roomType}`
                                : usage.label}
                            </button>
                          ) : (
                            <span key={index} className="block truncate text-[8px] text-muted-foreground">
                              {usage.label}
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {stickerUsage.length === 0 && (
                  <p className="col-span-full p-2 text-[10px] text-muted-foreground">
                    No stickers are loaded into this project yet. Use the sticker library below, or
                    auto-fill a room-type template.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-md border p-2">
              <div className="flex flex-wrap items-center gap-1">
                <p className="text-xs font-semibold">Terrain (map) textures</p>
                <span className="text-[10px] text-muted-foreground">
                  Assign an image to a biome, or replace one already in use.
                </span>
                <div className="ml-auto flex flex-wrap gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[10px]"
                    disabled={mapTextureBusy}
                    onClick={autoFillMapTextures}
                  >
                    {mapTextureBusy ? "Importing..." : "Auto-fill missing"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[10px]"
                    onClick={() => setTab("map")}
                  >
                    Open world map
                  </Button>
                </div>
              </div>
              <div className="mt-1 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                {mapBiomes.map((biome) => {
                  const url = world.mapTextures?.[biome.id] || "";
                  const targeted =
                    assetTarget?.mode === "mapTexture" && assetTarget.biome === biome.id;
                  return (
                    <div
                      key={biome.id}
                      className={`flex items-center gap-1 rounded border px-1 py-1 ${
                        targeted ? "border-primary bg-primary/5" : ""
                      }`}
                    >
                      <span
                        className="h-4 w-4 shrink-0 rounded border"
                        style={{ backgroundColor: biome.color }}
                        title={biome.label}
                      />
                      <span className="w-20 shrink-0 truncate text-[10px] font-medium">
                        {biome.label}
                      </span>
                      {url ? (
                        <img
                          src={url}
                          alt={`${biome.label} texture`}
                          loading="lazy"
                          className="h-7 w-10 rounded border object-cover"
                        />
                      ) : (
                        <span className="text-[9px] text-muted-foreground">No texture</span>
                      )}
                      <div className="ml-auto flex gap-0.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-1 text-[9px]"
                          onClick={() => targetMapTexture(biome)}
                        >
                          {url ? "Change" : "Assign"}
                        </Button>
                        {url && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-1 text-[9px] text-destructive"
                            onClick={() => clearMapTexture(biome.id)}
                          >
                            Clear
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {mapBiomes.length === 0 && (
                  <p className="col-span-full p-1 text-[10px] text-muted-foreground">
                    This setting has no biomes yet. Generate a realm first.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-md border p-2">
              <div className="flex flex-wrap items-center gap-1">
                <p className="text-xs font-semibold">Imported sticker files</p>
                <span className="text-[10px] text-muted-foreground">
                  {importedImages.length} file{importedImages.length === 1 ? "" : "s"} in{" "}
                  <code>userdata/images</code>
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto h-6 text-[10px]"
                  onClick={() => listImportedImages().then(setImportedImages)}
                >
                  Refresh
                </Button>
              </div>
              <div className="mt-1 grid max-h-40 grid-cols-3 gap-1 overflow-y-auto sm:grid-cols-6 lg:grid-cols-10">
                {importedImages.slice(0, 160).map((image) => {
                  const used = usedStickerUrls.has(image.url);
                  return (
                    <button
                      key={image.name}
                      type="button"
                      className="overflow-hidden rounded border text-left hover:border-primary"
                      title={`${image.name}  -  ${used ? "used in the setting" : "not used yet"}`}
                      onClick={() => assignAsset({ url: image.url })}
                    >
                      <img
                        src={image.url}
                        alt={image.name}
                        loading="lazy"
                        className={`h-12 w-full object-contain ${used ? "bg-emerald-500/10" : "bg-muted/20"}`}
                      />
                      <span className="block truncate px-0.5 text-[7px] text-muted-foreground">
                        {used ? "used  -  " : ""}{image.name}
                      </span>
                    </button>
                  );
                })}
                {importedImages.length === 0 && (
                  <p className="col-span-full p-1 text-[9px] text-muted-foreground">
                    No imported sticker files yet.
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1">
              <Input
                className="h-7 w-56 text-xs"
                placeholder="Search the sticker library..."
                value={assetQuery}
                onChange={(e) => setAssetQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") loadAssets();
                }}
              />
              <Select
                value={assetCategory || "__all__"}
                onValueChange={(v) => {
                  const next = v === "__all__" ? "" : v;
                  setAssetCategory(next);
                  setAssetResults([]);
                  setTimeout(() => loadAssets({ q: assetQuery, category: next }), 0);
                }}
              >
                <SelectTrigger className="h-7 w-36 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All categories</SelectItem>
                  {Object.entries(assetCategories).map(([name, count]) => (
                    <SelectItem key={name} value={name}>{name} ({count})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => loadAssets()} disabled={assetLoading}>
                <Search className="mr-1 h-3.5 w-3.5" /> Search
              </Button>
              <span className="text-[10px] text-muted-foreground">
                {assetStatus?.available ? `${assetStatus.files?.toLocaleString()} files` : "Sticker folder not found"}  -  {assetTotal.toLocaleString()} matches
              </span>
            </div>
            {assetTarget && (
              <p className="rounded border border-primary/30 bg-primary/5 px-2 py-1 text-[10px]">
                {assetTarget.mode === "mapTexture" ? (
                  <>
                    Assigning a map texture to{" "}
                    <strong>{assetTarget.roomType || assetTarget.biome}</strong>. Clicking an
                    image paints that terrain with it.
                  </>
                ) : (
                  <>
                    Assigning stickers to <strong>{assetTarget.roomType || "room"}</strong>.
                    {assetTarget.mode === "texture"
                      ? " Clicking an image sets the floor material."
                      : assetTarget.mode === "replaceSticker"
                        ? " Clicking an image replaces that sticker's art."
                        : " Clicking an image places a new sticker in the room."}
                  </>
                )}
                <button type="button" className="ml-2 underline" onClick={() => setAssetTarget(null)}>Clear target</button>
                {assetTarget.mode !== "mapTexture" && (
                  <button
                    type="button"
                    className="ml-2 underline"
                    onClick={() =>
                      setAssetTarget((target) =>
                        target ? { ...target, mode: target.mode === "texture" ? "assets" : "texture" } : target
                      )
                    }
                  >
                    {assetTarget.mode === "texture" ? "Place as sticker instead" : "Use as floor material instead"}
                  </button>
                )}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground">
              Stickers are cosmetic. Imported stickers are copied into the project's image folder;
              the source folder is only for browsing. Stickers can be positioned, resized and
              rotated inside a room, or shared through a room-type template.
            </p>
            <div className="grid max-h-[58vh] grid-cols-2 gap-1.5 overflow-y-auto rounded-md border p-2 sm:grid-cols-4 lg:grid-cols-6">
              {assetResults.map((asset) => (
                <button
                  key={asset.path}
                  type="button"
                  className="group overflow-hidden rounded border text-left hover:border-primary"
                  onClick={() => assignAsset(asset)}
                  title={asset.path}
                >
                  <img src={asset.url} alt={asset.name} loading="lazy" className="h-20 w-full bg-muted/30 object-contain" />
                  <span className="block truncate px-1 py-0.5 text-[8px] text-muted-foreground">{asset.name}</span>
                </button>
              ))}
              {!assetLoading && assetResults.length === 0 && (
                <p className="col-span-full p-2 text-xs text-muted-foreground">
                  No matches. Try a broader sticker search like "wood floor", "bed", "barrel" or "stone wall".
                </p>
              )}
              {assetLoading && <p className="col-span-full p-2 text-xs text-muted-foreground">Searching stickers...</p>}
            </div>
            <div className="grid gap-2 lg:grid-cols-2">
              <div className="rounded-md border p-2">
                <p className="text-xs font-semibold">Floor materials</p>
                <p className="text-[10px] text-muted-foreground">Preset floor materials for rooms and facilities. Assign an imported image as a custom floor from the sticker library.</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {FLOOR_TEXTURES.map((texture) => (
                    <span key={texture.id} className="rounded border px-1.5 py-0.5 text-[9px]" style={{ borderColor: texture.color }}>
                      <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: texture.color }} />
                      {texture.label}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-md border p-2">
                <p className="text-xs font-semibold">Sticker room templates</p>
                <p className="text-[10px] text-muted-foreground">
                  Pick a room type and import a shared sticker set plus floor material. Every empty
                  room of that type in the setting uses the same template, so procedural interiors
                  stay consistent. You can also select a room in a settlement and use "Use as
                  room-type template".
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <Select value={templateRoom || "__none__"} onValueChange={(v) => setTemplateRoom(v === "__none__" ? "" : v)}>
                    <SelectTrigger className="h-6 w-40 text-[10px]"><SelectValue placeholder="Room type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Choose a room type</SelectItem>
                      {Object.keys(ROOM_ASSET_BUNDLES).map((room) => (
                        <SelectItem key={room} value={room}>{room}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={templateFloor} onValueChange={setTemplateFloor}>
                    <SelectTrigger className="h-6 w-32 text-[10px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FLOOR_TEXTURES.map((texture) => (
                        <SelectItem key={texture.id} value={texture.id}>{texture.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[10px]"
                    disabled={!templateRoom || templateBusy}
                    onClick={() => applyRoomTemplate(templateRoom)}
                  >
                    {templateBusy ? "Importing..." : "Seed stickers & floor"}
                  </Button>
                  {templateRoom && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[10px]"
                      onClick={() => {
                        setAssetQuery(roomBundle(templateRoom).query);
                        setAssetCategory("");
                        setAssetResults([]);
                        setTimeout(() => loadAssets({ q: roomBundle(templateRoom).query, category: "" }), 0);
                      }}
                    >
                      Browse
                    </Button>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {Object.entries(world.roomAssetTemplates || {}).map(([room, template]) => (
                    <span key={room} className="rounded border px-1 py-0.5 text-[9px] text-muted-foreground">
                      {room}  -  {(template.urls || []).length} stickers
                      {template.floorTexture ? `  -  ${template.floorTexture}` : ""}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Metric({ icon: Icon, label, value }) {
  return (
    <div className="rounded-md border bg-muted/20 p-2">
      <p className="flex items-center gap-1 text-[9px] uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </p>
      <p className="text-lg font-semibold">{value.toLocaleString()}</p>
    </div>
  );
}


