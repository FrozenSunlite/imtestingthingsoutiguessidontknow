// Small annotated pictures for the first-run tutorial. Each one is a wireframe
// of the screen the lesson talks about, with the important parts labelled, so
// a new player can recognise the interface without hunting for screenshots.

const BG = "hsl(var(--background))";
const CARD = "hsl(var(--card))";
const BORDER = "hsl(var(--border))";
const MUTED = "hsl(var(--muted))";
const INK = "hsl(var(--foreground))";
const SUB = "hsl(var(--muted-foreground))";
const HOT = "#22d3ee";

const FONT = "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif";

function Frame({ label, children }) {
  return (
    <svg
      viewBox="0 0 720 280"
      className="h-auto w-full"
      role="img"
      aria-label={label}
      style={{ fontFamily: FONT }}
    >
      <rect x="1" y="1" width="718" height="278" rx="14" fill={BG} stroke={BORDER} />
      <path d="M1 15a14 14 0 0 1 14-14h690a14 14 0 0 1 14 14v17H1z" fill={CARD} />
      <circle cx="20" cy="17" r="4" fill="#f87171" />
      <circle cx="33" cy="17" r="4" fill="#fbbf24" />
      <circle cx="46" cy="17" r="4" fill="#4ade80" />
      <text x="62" y="21" fontSize="11" fill={SUB}>
        {label}
      </text>
      {children}
    </svg>
  );
}

function Tag({ x, y, children, filled = false }) {
  const px = Number(x);
  const py = Number(y);
  const width = Math.max(46, String(children).length * 5.9 + 16);
  return (
    <g>
      <rect
        x={px}
        y={py}
        width={width}
        height="18"
        rx="9"
        fill={filled ? HOT : BG}
        stroke={filled ? HOT : BORDER}
        opacity={filled ? 0.95 : 1}
      />
      <text
        x={px + width / 2}
        y={py + 12.5}
        textAnchor="middle"
        fontSize="9.5"
        fontWeight="600"
        fill={filled ? "#083344" : SUB}
      >
        {children}
      </text>
    </g>
  );
}

function Callout({ x1, y1, x2, y2, children, anchor = "start" }) {
  const ax = Number(x1);
  const ay = Number(y1);
  const bx = Number(x2);
  const by = Number(y2);
  return (
    <g>
      <path
        d={`M${ax} ${ay} L${bx} ${by}`}
        stroke={HOT}
        strokeWidth="1.2"
        strokeDasharray="3 2"
        fill="none"
      />
      <circle cx={ax} cy={ay} r="2.6" fill={HOT} />
      <text
        x={bx + (anchor === "end" ? -4 : 4)}
        y={by + 3}
        textAnchor={anchor}
        fontSize="10"
        fontWeight="600"
        fill={HOT}
      >
        {children}
      </text>
    </g>
  );
}

function Row({ x, y, w, label, active = false, height = 24 }) {
  const px = Number(x);
  const py = Number(y);
  const pw = Number(w);
  const ph = Number(height);
  return (
    <g>
      <rect
        x={px}
        y={py}
        width={pw}
        height={ph}
        rx="6"
        fill={active ? HOT : CARD}
        fillOpacity={active ? 0.14 : 1}
        stroke={active ? HOT : BORDER}
      />
      <circle
        cx={px + 13}
        cy={py + ph / 2}
        r="4.5"
        fill={active ? HOT : SUB}
        opacity={active ? 1 : 0.5}
      />
      <text
        x={px + 25}
        y={py + ph / 2 + 3.5}
        fontSize="10.5"
        fontWeight={active ? 700 : 500}
        fill={active ? INK : SUB}
      >
        {label}
      </text>
    </g>
  );
}

function Node({ x, y, label, active = false, r = 17 }) {
  const px = Number(x);
  const py = Number(y);
  const pr = Number(r);
  return (
    <g>
      <circle
        cx={px}
        cy={py}
        r={pr}
        fill={active ? HOT : CARD}
        fillOpacity={active ? 0.18 : 1}
        stroke={active ? HOT : BORDER}
        strokeWidth={active ? 2 : 1.4}
      />
      <text
        x={px}
        y={py + 3.5}
        textAnchor="middle"
        fontSize="9"
        fontWeight="700"
        fill={active ? INK : SUB}
      >
        {label}
      </text>
    </g>
  );
}

function LaunchVisual() {
  return (
    <Frame label="Launch menu">
      <rect x="34" y="48" width="330" height="206" rx="10" fill={CARD} stroke={BORDER} />
      <text x="54" y="70" fontSize="12" fontWeight="700" fill={INK}>
        I'm Trying's Terrific Talent Tree
      </text>
      <Row x="54" y="82" w="290" label="Continue" active />
      <Row x="54" y="112" w="138" label="New" />
      <Row x="206" y="112" w="138" label="Save / Load" />
      <Row x="54" y="142" w="138" label="Reference Index" />
      <Row x="206" y="142" w="138" label="Character" />
      <Row x="54" y="172" w="138" label="Dungeon" />
      <Row x="206" y="172" w="138" label="World" />
      <rect x="386" y="48" width="300" height="206" rx="10" fill={CARD} stroke={BORDER} />
      <text x="404" y="70" fontSize="11" fontWeight="700" fill={INK}>
        The hub for every tool
      </text>
      <text x="404" y="88" fontSize="9.5" fill={SUB}>
        New starts fresh · Continue resumes · Save / Load moves a project
      </text>
      <rect x="404" y="104" width="264" height="54" rx="8" fill={MUTED} stroke={BORDER} />
      <text x="416" y="122" fontSize="9.5" fill={SUB}>
        Project data stays on this device.
      </text>
      <text x="416" y="138" fontSize="9.5" fill={SUB}>
        No account, no cloud step.
      </text>
      <Tag x="404" y="172">Ctrl/⌘+K searches everything</Tag>
      <Tag x="404" y="198" filled>Settings → Help → Start tutorial</Tag>
      <Callout x1="404" y1="207" x2="356" y2="242">Reopen the tutorial any time</Callout>
    </Frame>
  );
}

function CanvasVisual() {
  return (
    <Frame label="Tree workspace">
      <rect x="30" y="46" width="46" height="212" rx="8" fill={CARD} stroke={BORDER} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect key={i} x="40" y={58 + i * 31} width="26" height="22" rx="4" fill={MUTED} stroke={BORDER} />
      ))}
      <rect x="88" y="46" width="410" height="212" rx="8" fill={CARD} stroke={BORDER} />
      {[120, 200, 280, 360, 440].map((x) => (
        <line key={x} x1={x} y1="56" x2={x} y2="248" stroke={BORDER} strokeWidth="0.6" opacity="0.55" />
      ))}
      {[90, 140, 190, 240].map((y) => (
        <line key={y} x1="98" y1={y} x2="488" y2={y} stroke={BORDER} strokeWidth="0.6" opacity="0.55" />
      ))}
      <path d="M170 150 L240 110 L310 150 L380 110" stroke={SUB} strokeWidth="1.8" fill="none" />
      <path d="M240 110 L250 190 L330 195" stroke={SUB} strokeWidth="1.8" fill="none" />
      <Node x={170} y={150} label="Root" active />
      <Node x={240} y={110} label="A" />
      <Node x={310} y={150} label="B" />
      <Node x={380} y={110} label="C" />
      <Node x={250} y={190} label="D" />
      <Node x={330} y={195} label="E" />
      <rect x="510" y="46" width="180" height="212" rx="8" fill={CARD} stroke={BORDER} />
      <text x="526" y="68" fontSize="11" fontWeight="700" fill={INK}>
        Node editor
      </text>
      {["Name", "Type", "Points", "Description", "Image"].map((label, i) => (
        <g key={label}>
          <text x="526" y={92 + i * 26} fontSize="9" fill={SUB}>
            {label}
          </text>
          <rect x="526" y={97 + i * 26} width="148" height="14" rx="4" fill={MUTED} stroke={BORDER} />
        </g>
      ))}
      <Callout x1="53" y1="72" x2="36" y2="42">Toolbar</Callout>
      <Callout x1="318" y1="182" x2="334" y2="214">Canvas</Callout>
      <Callout x1="690" y1="70" x2="694" y2="36" anchor="end">Editor</Callout>
      <Tag x="98" y="232">Scroll = zoom · right-drag = pan</Tag>
    </Frame>
  );
}

function TabsVisual() {
  return (
    <Frame label="Tabs and subtrees">
      <rect x="34" y="46" width="652" height="30" rx="8" fill={MUTED} stroke={BORDER} />
      <rect x="42" y="52" width="112" height="18" rx="6" fill={CARD} stroke={HOT} />
      <text x="98" y="65" textAnchor="middle" fontSize="9.5" fontWeight="700" fill={INK}>
        Class tree
      </text>
      {["Heritage", "Specialization", "+ Add tab"].map((label, i) => (
        <text key={label} x={176 + i * 128} y="65" fontSize="9.5" fill={SUB}>
          {label}
        </text>
      ))}
      <rect x="34" y="88" width="652" height="170" rx="10" fill={CARD} stroke={BORDER} />
      <Node x={130} y={150} label="Base" active />
      <Node x={240} y={110} label="A" />
      <Node x={240} y={190} label="B" />
      <Node x={350} y={150} label="C" />
      <path d="M147 150 L223 112 M147 150 L223 188 M257 112 L333 148 M257 190 L333 152" stroke={SUB} strokeWidth="1.6" fill="none" />
      <rect x="420" y="106" width="230" height="132" rx="8" fill={BG} stroke={HOT} strokeDasharray="4 3" />
      <text x="438" y="128" fontSize="10" fontWeight="700" fill={HOT}>
        Subtree
      </text>
      <text x="438" y="144" fontSize="9" fill={SUB}>
        A nested tree attached to one node.
      </text>
      <Node x={470} y={190} label="S1" />
      <Node x={550} y={170} label="S2" />
      <Node x={600} y={210} label="S3" />
      <path d="M487 188 L533 173 M567 173 L590 203" stroke={SUB} strokeWidth="1.4" fill="none" />
      <Callout x1="150" y1="60" x2="150" y2="34">One tab = one tree</Callout>
      <Callout x1="420" y1="170" x2="392" y2="244" anchor="end">Nested subtree</Callout>
    </Frame>
  );
}

function NodeVisual() {
  return (
    <Frame label="Editing a node">
      <rect x="34" y="46" width="330" height="212" rx="10" fill={CARD} stroke={BORDER} />
      <Node x={190} y={145} label="Fireball" active r={38} />
      <Tag x="118" y="196" filled>Selected node</Tag>
      <rect x="382" y="46" width="308" height="212" rx="10" fill={CARD} stroke={BORDER} />
      <text x="398" y="68" fontSize="11" fontWeight="700" fill={INK}>
        Node editor
      </text>
      {[
        ["Name", "Fireball"],
        ["Type", "Talent · active"],
        ["Cost / max", "1 point · 3 ranks"],
        ["Prerequisite", "Elemental Focus"],
      ].map(([label, value], i) => (
        <g key={label}>
          <text x="398" y={90 + i * 30} fontSize="8.5" fill={SUB}>
            {label}
          </text>
          <rect x="398" y={95 + i * 30} width="276" height="16" rx="4" fill={MUTED} stroke={BORDER} />
          <text x="406" y={106 + i * 30} fontSize="9.5" fill={INK}>
            {value}
          </text>
        </g>
      ))}
      <rect x="398" y="212" width="82" height="30" rx="6" fill={MUTED} stroke={BORDER} />
      <text x="439" y="231" textAnchor="middle" fontSize="8.5" fill={SUB}>
        Upload image
      </text>
      <rect x="490" y="212" width="184" height="30" rx="6" fill={MUTED} stroke={BORDER} />
      <text x="504" y="231" fontSize="8.5" fill={SUB}>
        Description supports [[links]]
      </text>
      <Callout x1="398" y1="66" x2="362" y2="34" anchor="end">Everything about the node</Callout>
    </Frame>
  );
}

function PointsVisual() {
  return (
    <Frame label="Points and prerequisites">
      <rect x="34" y="46" width="652" height="212" rx="10" fill={CARD} stroke={BORDER} />
      <Node x={130} y={140} label="Root" active />
      <Node x={280} y={100} label="A" />
      <Node x={280} y={190} label="B" />
      <Node x={440} y={145} label="C" />
      <path d="M147 140 L261 103 M147 140 L261 187 M299 104 L420 141" stroke={SUB} strokeWidth="1.8" fill="none" />
      <circle cx="205" cy="120" r="10" fill={HOT} />
      <text x="205" y="124" textAnchor="middle" fontSize="12" fontWeight="700" fill="#083344">
        +
      </text>
      <circle cx="330" cy="145" r="10" fill={MUTED} stroke={BORDER} />
      <text x="330" y="149" textAnchor="middle" fontSize="12" fontWeight="700" fill={SUB}>
        −
      </text>
      <Tag x="60" y="66">Talent points 4 / 7</Tag>
      <Tag x="212" y="66">Heritage 1 / 3</Tag>
      <Tag x="364" y="66">Attribute 2 / 5</Tag>
      <Tag x="440" y="204" filled>Unlocks when A has a point</Tag>
      <Callout x1="420" y1="145" x2="432" y2="82" anchor="end">Prerequisite gate</Callout>
      <text x="60" y="236" fontSize="9" fill={SUB}>
        Click + to invest · click − to refund · undo works on points too.
      </text>
    </Frame>
  );
}

function CharacterVisual() {
  return (
    <Frame label="Character sheet">
      <rect x="34" y="46" width="200" height="212" rx="10" fill={CARD} stroke={BORDER} />
      <text x="48" y="68" fontSize="10.5" fontWeight="700" fill={INK}>
        Details & abilities
      </text>
      {["STR 16  +3", "DEX 14  +2", "CON 15  +2", "INT 10  +0", "WIS 12  +1", "CHA 8  −1"].map((row, i) => (
        <text key={row} x="48" y={90 + i * 24} fontSize="9.5" fill={SUB}>
          {row}
        </text>
      ))}
      <rect x="246" y="46" width="220" height="212" rx="10" fill={CARD} stroke={BORDER} />
      <text x="260" y="68" fontSize="10.5" fontWeight="700" fill={INK}>
        Vitals & skills
      </text>
      <rect x="260" y="80" width="190" height="34" rx="6" fill={MUTED} stroke={BORDER} />
      <text x="270" y="94" fontSize="8.5" fill={SUB}>Hit points</text>
      <text x="270" y="108" fontSize="12" fontWeight="700" fill={INK}>42 / 48</text>
      {["Athletics +5", "Arcana +2", "Stealth +4", "Perception +3"].map((row, i) => (
        <text key={row} x="260" y={138 + i * 22} fontSize="9.5" fill={SUB}>
          {row}
        </text>
      ))}
      <rect x="478" y="46" width="212" height="212" rx="10" fill={CARD} stroke={BORDER} />
      <text x="492" y="68" fontSize="10.5" fontWeight="700" fill={INK}>
        Actions & inventory
      </text>
      {["Attack", "Spell", "Short rest", "Long rest"].map((row, i) => (
        <Row key={row} x="492" y={80 + i * 30} w="184" label={row} height={24} />
      ))}
      <Tag x="492" y="210">Weight 38 / 90 lb</Tag>
      <Callout x1="100" y1="46" x2="100" y2="30">Filled in by the tree</Callout>
    </Frame>
  );
}

function IndexVisual() {
  return (
    <Frame label="Reference Index">
      <rect x="34" y="46" width="196" height="212" rx="10" fill={CARD} stroke={BORDER} />
      <text x="48" y="68" fontSize="10.5" fontWeight="700" fill={INK}>
        Source & category
      </text>
      <rect x="48" y="78" width="168" height="20" rx="5" fill={MUTED} stroke={BORDER} />
      <text x="56" y="92" fontSize="9" fill={SUB}>5eTools · official</text>
      {["Spells", "Monsters", "Items", "Conditions"].map((row, i) => (
        <Row key={row} x="48" y={110 + i * 30} w="168" label={row} active={i === 0} height={24} />
      ))}
      <rect x="246" y="46" width="240" height="212" rx="10" fill={CARD} stroke={BORDER} />
      <text x="260" y="68" fontSize="10.5" fontWeight="700" fill={INK}>
        Files
      </text>
      <rect x="260" y="78" width="212" height="18" rx="4" fill={MUTED} stroke={BORDER} />
      <text x="268" y="91" fontSize="8.5" fill={SUB}>Find a file…</text>
      {["book-phb.json", "book-xge.json", "spells.json"].map((row, i) => (
        <Row key={row} x="260" y={104 + i * 28} w="212" label={row} height={22} />
      ))}
      <rect x="502" y="46" width="188" height="212" rx="10" fill={CARD} stroke={BORDER} />
      <text x="516" y="68" fontSize="10.5" fontWeight="700" fill={INK}>
        Preview
      </text>
      <text x="516" y="88" fontSize="9" fill={SUB}>Fireball</text>
      <rect x="516" y="98" width="160" height="44" rx="5" fill={MUTED} stroke={BORDER} />
      <text x="524" y="116" fontSize="8" fill={SUB}>3rd-level evocation</text>
      <text x="524" y="130" fontSize="8" fill={SUB}>8d6 fire damage…</text>
      <rect x="516" y="154" width="160" height="22" rx="5" fill={HOT} />
      <text x="596" y="169" textAnchor="middle" fontSize="9" fontWeight="700" fill="#083344">Import selected</text>
      <rect x="516" y="182" width="160" height="22" rx="5" fill={MUTED} stroke={BORDER} />
      <text x="596" y="197" textAnchor="middle" fontSize="9" fill={SUB}>Import all</text>
      <Tag x="516" y="216">Import history can undo</Tag>
    </Frame>
  );
}

function LibraryVisual() {
  return (
    <Frame label="Reference Library">
      <rect x="34" y="46" width="300" height="212" rx="10" fill={CARD} stroke={BORDER} />
      {["Monsters", "Spells", "Items", "Rooms"].map((row, i) => (
        <rect key={row} x={44 + i * 70} y="54" width="64" height="22" rx="5" fill={i === 0 ? HOT : MUTED} fillOpacity={i === 0 ? 0.16 : 1} stroke={i === 0 ? HOT : BORDER} />
      ))}
      {["Monsters", "Spells", "Items", "Rooms"].map((row, i) => (
        <text key={row} x={76 + i * 70} y="69" textAnchor="middle" fontSize="8.5" fontWeight={i === 0 ? 700 : 500} fill={i === 0 ? INK : SUB}>
          {row}
        </text>
      ))}
      {["Ancient Red Dragon", "Adult Black Dragon", "Goblin Boss", "Owlbear", "Stirge"].map((row, i) => (
        <g key={row}>
          <rect x="44" y={88 + i * 30} width="280" height="24" rx="5" fill={i === 0 ? MUTED : BG} stroke={BORDER} />
          <text x="54" y={104 + i * 30} fontSize="9" fill={SUB}>{row}</text>
          <text x="300" y={104 + i * 30} textAnchor="end" fontSize="8" fill={SUB}>CR</text>
        </g>
      ))}
      <Tag x="44" y="240">Editable: imports are a starting point</Tag>
      <rect x="358" y="46" width="328" height="212" rx="10" fill={CARD} stroke={BORDER} />
      <text x="374" y="68" fontSize="10.5" fontWeight="700" fill={INK}>Drag an entry onto the canvas</text>
      <Node x={520} y={160} label="Dragon" active r={30} />
      <path d="M340 160 C380 160 420 160 486 160" stroke={HOT} strokeWidth="2" fill="none" strokeDasharray="5 4" />
      <path d="M478 153 L488 160 L478 167" fill={HOT} />
      <Tag x="392" y="200" filled>Drop here</Tag>
      <text x="374" y="236" fontSize="9" fill={SUB}>Name, stat block, text and artwork arrive together.</text>
    </Frame>
  );
}

function DragVisual() {
  return (
    <Frame label="Drag data onto the workspace">
      <rect x="34" y="46" width="280" height="212" rx="10" fill={CARD} stroke={BORDER} />
      <text x="48" y="68" fontSize="10.5" fontWeight="700" fill={INK}>5eTools Imports</text>
      {["Fireball", "Mage Armor", "Shield", "Misty Step"].map((row, i) => (
        <g key={row}>
          <rect x="48" y={80 + i * 34} width="252" height="26" rx="5" fill={i === 1 ? MUTED : BG} stroke={i === 1 ? HOT : BORDER} strokeDasharray={i === 1 ? "4 2" : undefined} />
          <text x="58" y={97 + i * 34} fontSize="9" fill={SUB}>{row}</text>
          {i === 1 && <text x="292" y={97 + i * 34} textAnchor="end" fontSize="8" fill={HOT}>grabbed</text>}
        </g>
      ))}
      <Node x={470} y={140} label="New" active r={34} />
      <path d="M300 108 C360 108 404 122 436 138" stroke={HOT} strokeWidth="2.2" fill="none" strokeDasharray="6 4" />
      <path d="M428 130 L440 139 L426 145" fill={HOT} />
      <Tag x="330" y="166" filled>Drop to create a node</Tag>
      <text x="330" y="200" fontSize="9" fill={SUB}>The entry text and artwork come with it.</text>
      <rect x="330" y="216" width="320" height="28" rx="6" fill={MUTED} stroke={BORDER} />
      <text x="342" y="234" fontSize="8.5" fill={SUB}>Ctrl/⌘+K also finds entries you have not imported yet.</text>
    </Frame>
  );
}

function RulebookVisual() {
  return (
    <Frame label="Rulebook">
      <rect x="34" y="46" width="170" height="212" rx="10" fill={CARD} stroke={BORDER} />
      <text x="48" y="68" fontSize="10.5" fontWeight="700" fill={INK}>Contents</text>
      {["Credits", "Chapter 1", "Chapter 2", "Appendix"].map((row, i) => (
        <text key={row} x="48" y={92 + i * 24} fontSize="9.5" fill={i === 1 ? HOT : SUB} fontWeight={i === 1 ? 700 : 400}>{row}</text>
      ))}
      <rect x="216" y="46" width="474" height="212" rx="10" fill={CARD} stroke={BORDER} />
      <text x="238" y="76" fontSize="15" fontWeight="700" fill={INK}>Chapter 1 · The Sundered Coast</text>
      <rect x="238" y="88" width="180" height="2" fill={HOT} />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x="238" y={106 + i * 12} width={i === 3 ? 260 : 420} height="5" rx="2.5" fill={SUB} opacity="0.45" />
      ))}
      <rect x="238" y="164" width="230" height="76" rx="6" fill={MUTED} stroke={BORDER} />
      <text x="353" y="206" textAnchor="middle" fontSize="9" fill={SUB}>Illustration</text>
      <Tag x="484" y="164">Image</Tag>
      <Tag x="540" y="164">Page break</Tag>
      <Tag x="484" y="188">.md</Tag>
      <Tag x="528" y="188">Print / PDF</Tag>
      <text x="484" y="226" fontSize="8.5" fill={SUB}>Markdown, Homebrewery style.</text>
    </Frame>
  );
}

function DungeonVisual() {
  return (
    <Frame label="Dungeon Builder">
      <rect x="34" y="46" width="500" height="212" rx="10" fill={CARD} stroke={BORDER} />
      {[[70, 70, 90, 56], [170, 70, 74, 56], [70, 136, 60, 66], [138, 146, 90, 56], [254, 70, 110, 100], [374, 106, 120, 76], [254, 182, 240, 20]].map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} rx="3" fill={HOT} fillOpacity={i === 4 ? 0.16 : 0.07} stroke={i === 4 ? HOT : BORDER} />
      ))}
      <text x="94" y="102" textAnchor="middle" fontSize="10" fontWeight="700" fill={INK}>1</text>
      <text x="207" y="102" textAnchor="middle" fontSize="10" fontWeight="700" fill={INK}>2</text>
      <text x="183" y="178" textAnchor="middle" fontSize="10" fontWeight="700" fill={INK}>3</text>
      <text x="309" y="126" textAnchor="middle" fontSize="10" fontWeight="700" fill={INK}>4</text>
      <text x="434" y="148" textAnchor="middle" fontSize="10" fontWeight="700" fill={INK}>5</text>
      <circle cx="309" cy="118" r="4" fill={HOT} />
      <text x="319" y="121" fontSize="8.5" fill={HOT}>current</text>
      <Callout x1="180" y1="178" x2="170" y2="238" anchor="end">Fog of war in Session</Callout>
      <rect x="550" y="46" width="140" height="212" rx="10" fill={CARD} stroke={BORDER} />
      <text x="564" y="68" fontSize="10" fontWeight="700" fill={INK}>Generate</text>
      <Tag x="564" y="78">Dungeon</Tag>
      <Tag x="564" y="102">Spire</Tag>
      <rect x="564" y="130" width="112" height="20" rx="5" fill={MUTED} stroke={BORDER} />
      <text x="572" y="144" fontSize="8.5" fill={SUB}>Rank · seed</text>
      <rect x="564" y="160" width="112" height="24" rx="5" fill={HOT} />
      <text x="620" y="176" textAnchor="middle" fontSize="9" fontWeight="700" fill="#083344">Generate</text>
      <Tag x="564" y="194">Export PNG/PDF</Tag>
      <Tag x="564" y="218">Universal VTT</Tag>
    </Frame>
  );
}

function WorldVisual() {
  return (
    <Frame label="World Builder">
      <rect x="34" y="46" width="500" height="212" rx="10" fill={CARD} stroke={BORDER} />
      <path d="M60 210 C90 150 120 160 140 120 C160 80 220 92 250 70 C290 40 360 60 400 90 C440 120 470 118 500 150 L500 240 L60 240 Z" fill={HOT} fillOpacity="0.08" stroke={HOT} strokeOpacity="0.4" />
      <path d="M120 180 C170 160 210 190 260 150 C300 118 350 140 420 120" stroke={SUB} strokeWidth="1.6" fill="none" strokeDasharray="4 3" />
      {[[120, 180, "Capital"], [260, 150, "Port"], [420, 120, "Keep"], [330, 190, "Village"]].map(([x, y, label]) => (
        <g key={label}>
          <circle cx={x} cy={y} r="5" fill={HOT} />
          <text x={x + 9} y={y + 3} fontSize="8.5" fill={SUB}>{label}</text>
        </g>
      ))}
      <text x="70" y="70" fontSize="10" fontWeight="700" fill={INK}>The Sundered Coast</text>
      <Tag x="60" y="220">Zoom · drag · paint territory · draw roads</Tag>
      <rect x="550" y="46" width="140" height="212" rx="10" fill={CARD} stroke={BORDER} />
      {["Realms", "Kingdoms", "Settlements", "People", "Quests", "Clock"].map((row, i) => (
        <Row key={row} x="562" y={58 + i * 29} w="116" label={row} active={i === 2} height={22} />
      ))}
      <text x="562" y="244" fontSize="8" fill={SUB}>Monthly kingdom turns</text>
    </Frame>
  );
}

function ArchitectVisual() {
  return (
    <Frame label="Architect">
      <rect x="34" y="46" width="500" height="212" rx="10" fill={CARD} stroke={BORDER} />
      {[0, 1, 2, 3, 4].map((i) => (
        <line key={`v${i}`} x1={70 + i * 88} y1="66" x2={70 + i * 88} y2="234" stroke={BORDER} strokeWidth="0.7" />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <line key={`h${i}`} x1={70} y1={74 + i * 40} x2={422} y2={74 + i * 40} stroke={BORDER} strokeWidth="0.7" />
      ))}
      <rect x="70" y="74" width="176" height="120" rx="3" fill={MUTED} stroke={INK} strokeWidth="1.4" />
      <rect x="246" y="74" width="176" height="80" rx="3" fill={MUTED} stroke={INK} strokeWidth="1.4" />
      <rect x="246" y="154" width="88" height="80" rx="3" fill={MUTED} stroke={INK} strokeWidth="1.4" />
      <rect x="334" y="154" width="88" height="80" rx="3" fill={MUTED} stroke={INK} strokeWidth="1.4" />
      <text x="158" y="112" textAnchor="middle" fontSize="9" fill={SUB}>Great room</text>
      <text x="334" y="110" textAnchor="middle" fontSize="9" fill={SUB}>Kitchen</text>
      <text x="290" y="196" textAnchor="middle" fontSize="9" fill={SUB}>Bed</text>
      <text x="378" y="196" textAnchor="middle" fontSize="9" fill={SUB}>Bed</text>
      <rect x="150" y="194" width="34" height="16" rx="2" fill={SUB} opacity="0.4" />
      <rect x="360" y="88" width="30" height="18" rx="2" fill={SUB} opacity="0.4" />
      <path d="M246 194 L270 194 M334 194 L358 194" stroke={CARD} strokeWidth="4" />
      <path d="M158 154 L158 174 M178 154 L178 174 M166 154 L166 166" stroke={INK} strokeWidth="1.2" />
      <Tag x="70" y="222">Walls · doors · stairs · furniture</Tag>
      <rect x="550" y="46" width="140" height="212" rx="10" fill={CARD} stroke={BORDER} />
      <text x="564" y="68" fontSize="10" fontWeight="700" fill={INK}>Property</text>
      {[["Build cost", "4,850 gp"], ["Build time", "6 weeks"], ["Upkeep", "35 gp / mo"], ["Space", "18 / 24"]].map(([k, v], i) => (
        <g key={k}>
          <text x="564" y={92 + i * 30} fontSize="8" fill={SUB}>{k}</text>
          <text x="564" y={104 + i * 30} fontSize="10" fontWeight="700" fill={INK}>{v}</text>
        </g>
      ))}
      <Tag x="564" y="220" filled>Buy land tiles</Tag>
    </Frame>
  );
}

function DmVisual() {
  return (
    <Frame label="DM Screen">
      <rect x="34" y="46" width="300" height="212" rx="10" fill={CARD} stroke={BORDER} />
      <text x="48" y="68" fontSize="10.5" fontWeight="700" fill={INK}>Dice</text>
      <circle cx="90" cy="118" r="26" fill={HOT} fillOpacity="0.14" stroke={HOT} />
      <text x="90" y="123" textAnchor="middle" fontSize="16" fontWeight="700" fill={INK}>d20</text>
      <circle cx="168" cy="118" r="22" fill={MUTED} stroke={BORDER} />
      <text x="168" y="122" textAnchor="middle" fontSize="11" fill={SUB}>d12</text>
      <circle cx="232" cy="118" r="22" fill={MUTED} stroke={BORDER} />
      <text x="232" y="122" textAnchor="middle" fontSize="11" fill={SUB}>d8</text>
      <rect x="62" y="164" width="180" height="26" rx="6" fill={HOT} />
      <text x="152" y="181" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#083344">Roll 1d20 + 5</text>
      <Tag x="62" y="204">Advantage / disadvantage</Tag>
      <rect x="350" y="46" width="336" height="212" rx="10" fill={CARD} stroke={BORDER} />
      <text x="366" y="68" fontSize="10.5" fontWeight="700" fill={INK}>Initiative & conditions</text>
      {[["1", "Ancient Red Dragon", "21"], ["2", "Kaelen", "18"], ["3", "Goblin boss", "15"], ["4", "Mira", "12"]].map(([n, name, init], i) => (
        <g key={name}>
          <rect x="366" y={80 + i * 32} width="304" height="26" rx="5" fill={i === 1 ? MUTED : BG} stroke={BORDER} />
          <text x="378" y={97 + i * 32} fontSize="9" fontWeight="700" fill={SUB}>{n}</text>
          <text x="396" y={97 + i * 32} fontSize="9.5" fill={INK}>{name}</text>
          <text x="652" y={97 + i * 32} textAnchor="end" fontSize="9" fontWeight="700" fill={HOT}>{init}</text>
        </g>
      ))}
      <Tag x="366" y="212">HP · conditions · activity log</Tag>
    </Frame>
  );
}

function SaveVisual() {
  return (
    <Frame label="Save and load">
      <rect x="34" y="46" width="652" height="212" rx="10" fill={CARD} stroke={BORDER} />
      <text x="52" y="70" fontSize="11" fontWeight="700" fill={INK}>Save / Load</text>
      <Tag x="52" y="82" filled>Project bundle</Tag>
      <Tag x="176" y="82">Tree only</Tag>
      <Tag x="262" y="82">Sheet only</Tag>
      <rect x="52" y="114" width="300" height="60" rx="7" fill={MUTED} stroke={BORDER} />
      <text x="66" y="134" fontSize="9" fill={SUB}>Exports tree + sheet + plots + library</text>
      <text x="66" y="152" fontSize="9" fill={SUB}>Artwork is embedded in the file.</text>
      <rect x="52" y="186" width="120" height="26" rx="6" fill={HOT} />
      <text x="112" y="203" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#083344">Save file</text>
      <rect x="184" y="186" width="120" height="26" rx="6" fill={MUTED} stroke={BORDER} />
      <text x="244" y="203" textAnchor="middle" fontSize="9.5" fill={SUB}>Load file</text>
      <rect x="378" y="114" width="288" height="98" rx="7" fill={BG} stroke={BORDER} />
      <text x="392" y="134" fontSize="9.5" fontWeight="700" fill={INK}>Rotating backups</text>
      {["10:32 · before import", "09:58 · before new project", "Yesterday · manual"].map((row, i) => (
        <g key={row}>
          <text x="392" y={154 + i * 18} fontSize="8.5" fill={SUB}>{row}</text>
          <text x="646" y={154 + i * 18} textAnchor="end" fontSize="8" fill={HOT}>Restore</text>
        </g>
      ))}
      <Tag x="378" y="222">Settings → Project</Tag>
      <Callout x1="52" y1="82" x2="14" y2="60">Portable backup</Callout>
    </Frame>
  );
}

function ShortcutsVisual() {
  return (
    <Frame label="Shortcuts">
      <rect x="34" y="46" width="652" height="212" rx="10" fill={CARD} stroke={BORDER} />
      <text x="52" y="70" fontSize="10.5" fontWeight="700" fill={INK}>Keyboard shortcuts</text>
      {[["Ctrl", "K", "Search everything"], ["Ctrl", "Z", "Undo"], ["Ctrl", "Shift", "Z", "Redo"], ["Alt", "Click", "Connect two nodes"], ["Del", "", "Delete selection"], ["R", "", "Rotate"]].map(([k1, k2, label], i) => (
        <g key={label}>
          <rect x="52" y={84 + i * 26} width="34" height="20" rx="4" fill={MUTED} stroke={BORDER} />
          <text x="69" y={98 + i * 26} textAnchor="middle" fontSize="8.5" fontWeight="600" fill={INK}>{k1}</text>
          {k2 && (
            <>
              <rect x="94" y={84 + i * 26} width="34" height="20" rx="4" fill={MUTED} stroke={BORDER} />
              <text x="111" y={98 + i * 26} textAnchor="middle" fontSize="8.5" fontWeight="600" fill={INK}>{k2}</text>
            </>
          )}
          <text x="146" y={98 + i * 26} fontSize="9" fill={SUB}>{label}</text>
        </g>
      ))}
      <rect x="360" y="84" width="306" height="152" rx="8" fill={BG} stroke={BORDER} />
      <text x="376" y="106" fontSize="9.5" fontWeight="700" fill={INK}>Rebind in Settings</text>
      {["Shortcuts & Hotkeys", "Connectors", "Node Artwork"].map((row, i) => (
        <Row key={row} x="376" y={118 + i * 30} w="274" label={row} active={i === 0} height={24} />
      ))}
      <Tag x="376" y="212">Help has quick-reference cards too</Tag>
    </Frame>
  );
}

const VISUALS = {
  welcome: LaunchVisual,
  launch: LaunchVisual,
  canvas: CanvasVisual,
  tabs: TabsVisual,
  node: NodeVisual,
  points: PointsVisual,
  character: CharacterVisual,
  index: IndexVisual,
  library: LibraryVisual,
  drag: DragVisual,
  rulebook: RulebookVisual,
  dungeon: DungeonVisual,
  world: WorldVisual,
  architect: ArchitectVisual,
  dm: DmVisual,
  save: SaveVisual,
  shortcuts: ShortcutsVisual,
};

export function TutorialVisual({ kind }) {
  const Visual = VISUALS[kind] || LaunchVisual;
  return <Visual />;
}
