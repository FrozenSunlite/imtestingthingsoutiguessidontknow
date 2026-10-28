// Shared biome catalogue for the World Builder, city generator and world
// developments. Kept separate from worldGen so the development and city
// modules can use it without a circular import.

export const BIOMES = [
  { id: "grassland", label: "Grassland", color: "#7c9a4a", assets: ["grass", "plain", "meadow"] },
  { id: "forest", label: "Forest", color: "#3f6b3f", assets: ["forest", "woods", "pine", "tree"] },
  { id: "jungle", label: "Jungle", color: "#2f7a4f", assets: ["jungle", "rainforest", "palm"] },
  { id: "hills", label: "Hills", color: "#8b7d53", assets: ["hill", "highland", "moor"] },
  { id: "mountains", label: "Mountains", color: "#6e6a63", assets: ["mountain", "peak", "ridge"] },
  { id: "desert", label: "Desert", color: "#c9a55a", assets: ["desert", "sand", "dune"] },
  { id: "swamp", label: "Swamp", color: "#5f7247", assets: ["swamp", "marsh", "bog"] },
  { id: "tundra", label: "Tundra", color: "#a7b6b8", assets: ["tundra", "snow", "ice"] },
  { id: "coast", label: "Coast", color: "#4a8f9a", assets: ["coast", "shore", "beach"] },
  { id: "ocean", label: "Ocean", color: "#2b5f7a", assets: ["sea", "ocean", "water"] },
  { id: "volcanic", label: "Volcanic", color: "#7a3a2e", assets: ["volcanic", "lava", "ash"] },
  { id: "underground", label: "Underground", color: "#4b4455", assets: ["cave", "underground", "cavern"] },
  { id: "void", label: "Void", color: "#241f38", assets: ["starfield", "space", "void"] },
  { id: "celestial", label: "Celestial", color: "#8d86c9", assets: ["celestial", "star", "cloud"] },
];

export const biomeById = (id) => BIOMES.find((biome) => biome.id === id) || BIOMES[0];
