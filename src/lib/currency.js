// Reward currency shared by the Dungeon Builder and the Architect
// (home / business) tools. The suffix is stored on the project settings so a
// table can pay out in silver, electrum or a custom unit instead of gold.
export const CURRENCY_OPTIONS = [
  { value: "cp", label: "Copper (cp)" },
  { value: "sp", label: "Silver (sp)" },
  { value: "ep", label: "Electrum (ep)" },
  { value: "gp", label: "Gold (gp)" },
  { value: "pp", label: "Platinum (pp)" },
];

export const DEFAULT_CURRENCY = "gp";

export const currencyOf = (settings) => {
  const raw = settings?.rewardCurrency;
  if (typeof raw !== "string") return DEFAULT_CURRENCY;
  const value = raw.trim();
  return value || DEFAULT_CURRENCY;
};

export const formatCurrency = (amount, settings) => {
  const n = Number(amount);
  const safe = Number.isFinite(n) ? n : 0;
  return `${safe.toLocaleString()} ${currencyOf(settings)}`;
};
