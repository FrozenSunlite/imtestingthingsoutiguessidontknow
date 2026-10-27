// Document library: the app's rulebook — chapters of Homebrewery-style
// markdown, stored locally. Chapter 1 doubles as the quick start guide on
// the app's first page.
const KEY = "skilltree:rulebook";

export const newChapterId = () =>
  "ch" + Date.now() + "-" + Math.floor(Math.random() * 1000);

export const newBookId = () =>
  "bk" + Date.now() + "-" + Math.floor(Math.random() * 1000);

export const QUICK_START = `# Quick Start Guide

Welcome, adventurer! This guide gets you playing in five minutes.

> ### The three pools
> - **Talent Points** — buy most talents on the tree
> - **Heritage Points** — buy your heritage's innate traits
> - **Attribute Points** — raise your ability scores

## 1. Get a tree
Pick **New** on the menu for a blank project, or **Load** to continue a saved character. Homebrew trees live in tabs along the top of the canvas.

## 2. Invest points
Open the **View** mode, click a node's **+** to invest, and the character sheet on the right updates live — stats, resources, actions and proficiencies all follow the tree.

## 3. Read the details
Hover a node for a summary, or **hold Alt** over a node to open its full description. Descriptions can carry links: type \`[[Node Name]]\` when editing to jump between notes, and \`[[Node Name / Subtree]]\` to open a subtree.

## 4. Design your own
- **Edit** mode — double-click empty canvas to create nodes, drag to arrange, right-click for options
- **Values** mode — tune the numbers: pools, level rules and the Reference Library
- **Homebuilder** — design the home, business or bastion your character lives in

## Writing your own rulebook

Chapters here are written in [Homebrewery](https://homebrewery.naturalcrit.com) markdown, so you can paste straight from your homebrew:

| You type | You get |
| --- | --- |
| \`# Title\` | A chapter heading |
| \`**bold**\`, \`*italics*\` | **bold**, *italics* |
| \`> quote\` | A highlighted callout |
| \`| a | b |\` rows | A table |

Use \\pagebreak between sections, keep one chapter per topic, and players can read everything from the **Rulebook** tab on their character screen.
`;

export const DEFAULT_RULEBOOK = {
  title: "Rulebook",
  books: [{ id: "bk-default", title: "Rulebook", chapters: [{ id: "ch-quick-start", title: "Quick Start Guide", content: QUICK_START }] }],
  activeBookId: "bk-default",
};

export function loadRulebook() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (saved && Array.isArray(saved.books) && saved.books.length) {
      return { title: "Rulebook", books: saved.books, activeBookId: saved.activeBookId || saved.books[0].id };
    }
    if (saved && Array.isArray(saved.chapters) && saved.chapters.length) {
      const b = { id: "bk-migrated", title: saved.title || "Rulebook", chapters: saved.chapters };
      return { title: "Rulebook", books: [b], activeBookId: b.id };
    }
  } catch {
    /* ignore */
  }
  return JSON.parse(JSON.stringify(DEFAULT_RULEBOOK));
}

export function saveRulebook(rb) {
  try {
    localStorage.setItem(KEY, JSON.stringify(rb));
  } catch {
    /* quota */
  }
}