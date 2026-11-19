// Undersurface — ecosystem model (deterministic, one step = one simulated day)
const SPECIES = {
  dustmite: { name: 'Dust mite', latin: 'Dermatophagoides pteronyssinus', tier: 2, color: '#E8DCC2', ink: '#8A7650',
    r: 0.09, K0: 600, rhOpt: 75, rhW: 22, rhMin: 52, dry: 0.09, food: true, per: 40, speed: 0.05,
    facts: ['About 0.3 mm long, so you need a microscope to see one.', 'Eats flakes of dead human skin. One person sheds enough each day to feed thousands.', 'Cannot drink. It absorbs water from humid air, so dry air below about 50% humidity slowly kills it.'] },
  predmite: { name: 'Predatory mite', latin: 'Cheyletus eruditus', tier: 2, color: '#D9653B', ink: '#8C3517',
    prey: { dustmite: 1, booklouse: 0.5 }, a: 1.4, H: 180, e: 0.06, m: 0.045, per: 3, speed: 0.11,
    facts: ['A hunter that ambushes dust mites and grabs them with hooked mouthparts.', 'Its numbers rise and fall a step behind its prey.', 'Like dust mites, it needs humid air to survive.'], rhMin: 45, dry: 0.05 },
  beetle: { name: 'Carpet beetle larva', latin: 'Anthrenus verbasci', tier: 1, color: '#7A5634', ink: '#3F2A17',
    r: 0.03, K0: 14, rhOpt: 60, rhW: 30, food: true, per: 1.2, speed: 0.025,
    facts: ['A fuzzy, striped larva often called a "woolly bear".', 'Eats wool, hair, feathers and dead insects. It can chew holes in rugs.', 'Adults are small round beetles that fly outside to eat pollen.'] },
  booklouse: { name: 'Booklouse', latin: 'Liposcelis bostrychophila', tier: 2, color: '#F1EBDD', ink: '#9C8F72',
    prey: { mold: 1 }, a: 0.3, H: 40, e: 0.5, m: 0.04, rhMin: 58, dry: 0.08, per: 4, speed: 0.07,
    facts: ['Under 1 mm long. Not a real louse, and harmless to people.', 'Grazes on microscopic mold, so it shows up where things are damp.', 'Dries out fast when the air gets dry.'] },
  mold: { name: 'Mold', latin: 'Aspergillus / Cladosporium', tier: 3, color: '#4E6B57', ink: '#2C3D31',
    r: 0.14, K0: 200, rhOpt: 88, rhW: 26, rhMin: 50, dry: 0.08, per: 18, speed: 0, colony: true,
    facts: ['A fungus made of thread-like hyphae that spread through damp material.', 'Releases spores that drift on the air. They are everywhere, waiting for moisture.', 'Grows fastest in damp air above about 70% humidity. Dry air makes it die back.'] },
  silverfish: { name: 'Silverfish', latin: 'Lepisma saccharinum', tier: 1, color: '#A9B1B8', ink: '#5B656E',
    r: 0.04, K0: 40, rhOpt: 80, rhW: 22, rhMin: 55, dry: 0.03, food: true, per: 2, speed: 0.06,
    facts: ['One of the oldest kinds of insect, with no wings and a silvery body.', 'Eats starches such as wallpaper paste, glue and paper inside walls.', 'Likes dark, damp spaces and can live for months without food.'] },
  spider: { name: 'House spider', latin: 'Parasteatoda tepidariorum', tier: 1, color: '#5A4A3C', ink: '#2B221A',
    prey: { silverfish: 1, booklouse: 0.3 }, a: 0.15, H: 12, e: 0.12, m: 0.012, per: 1, speed: 0.012,
    facts: ['Builds tangled cobwebs in quiet corners and wall cavities.', 'Eats silverfish, booklice and other small insects.', 'A single spider can keep a silverfish population in check.'] },
  springtail: { name: 'Springtail', latin: 'Entomobrya sp.', tier: 2, color: '#8E9AAF', ink: '#4A556B',
    prey: { fungus: 1 }, a: 0.15, H: 60, e: 0.5, m: 0.02, rhMin: 55, dry: 0.07, per: 4, speed: 0.09,
    facts: ['Not an insect: a six-legged relative with a spring-loaded tail called a furcula.', 'Flicks its tail to jump many times its own length.', 'Eats fungi and needs moisture. A sign of damp wood or soil.'] },
  fungus: { name: 'Wet-rot fungus', latin: 'Coniophora puteana', tier: 3, color: '#E9E4D6', ink: '#8E8670',
    r: 0.1, K0: 150, rhOpt: 85, rhW: 26, rhMin: 48, dry: 0.07, per: 16, speed: 0, colony: true,
    facts: ['Grows white threads through wood that stays damp.', 'Digests the cellulose in wood, making it soft and crumbly.', 'Softened wood is easier for wood-boring larvae to eat.'] },
  woodworm: { name: 'Furniture beetle larva', latin: 'Anobium punctatum', tier: 1, color: '#EFE3C8', ink: '#8A6F3E',
    r: 0.02, K0: 10, rhOpt: 75, rhW: 25, food: false, boost: 'fungus', per: 1, speed: 0.008,
    facts: ['A C-shaped grub, better known as woodworm, that tunnels inside wood for years.', 'Prefers damp wood, especially wood already softened by fungi.', 'Adults chew their way out, leaving tiny round exit holes.'] },
};

const BIOMES = {
  carpet: { name: 'Carpet', rh: 60, start: { dustmite: 380, predmite: 6, beetle: 5, booklouse: 12, mold: 30 } },
  wall:   { name: 'Wall',   rh: 58, start: { silverfish: 10, spider: 2, booklouse: 18, mold: 40 } },
  floor:  { name: 'Floor',  rh: 57, start: { springtail: 30, fungus: 25, woodworm: 3, dustmite: 120, predmite: 0 } },
};

const PREDATOR_FOR = { carpet: ['predmite', 12], wall: ['spider', 2], floor: ['predmite', 10] };

const ACTIONS = {
  water:      { label: 'Spill water', note: 'Humidity jumps, then dries out over a few days.' },
  vacuum:     { label: 'Vacuum', note: 'Removes many larger creatures and some food.' },
  dehumidify: { label: 'Dehumidifier', note: 'Runs for three weeks and keeps the air dry.' },
  predator:   { label: 'Add predator', note: 'Releases predators into this patch.' },
  food:       { label: 'Add food', note: 'Adds crumbs, skin flakes or paper, depending on the surface.' },
};

function hash(n) { // deterministic 0..1
  n = (n ^ 61) ^ (n >>> 16); n = (n + (n << 3)) | 0; n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15);
  return ((n >>> 0) % 100000) / 100000;
}
function noise(seed, d, k) { return hash(seed * 7919 + d * 131 + k * 17) * 2 - 1; }

function envAt(site, d) {
  const b = BIOMES[site.biome];
  let rh = (site.rh0 || b.rh) + 4 * Math.sin(2 * Math.PI * d / 30 + (site.seed % 7)) + 1.5 * noise(site.seed, d, 1);
  let temp = 21 + 1.2 * Math.sin(2 * Math.PI * d / 30 + 1 + (site.seed % 5)) + 0.4 * noise(site.seed, d, 2);
  let food = 1;
  for (const e of site.events) {
    const dt = d - e.day; if (dt < 0) continue;
    if (e.type === 'water') rh += 30 * Math.exp(-dt / 4);
    if (e.type === 'dehumidify') rh -= 24 * (dt < 21 ? 1 : Math.exp(-(dt - 21) / 4));
    if (e.type === 'heating') { rh -= 30 * Math.min(1, dt / 3); temp += 3 * Math.min(1, dt / 3); }
    if (e.type === 'food') food += 1.4 * Math.exp(-dt / 10);
    if (e.type === 'vacuum') food -= 0.6 * Math.exp(-dt / 7);
  }
  return { rh: Math.max(18, Math.min(98, rh)), temp, food: Math.max(0.15, food) };
}

function step(site, pops, d) {
  const env = envAt(site, d);
  for (const e of site.events) if (e.day === d) {
    if (e.type === 'vacuum') for (const s in pops) { const t = SPECIES[s].tier; pops[s] *= t === 1 ? 0.35 : t === 2 ? 0.6 : 0.9; }
    if (e.type === 'predator') { const [p, n] = PREDATOR_FOR[site.biome]; pops[p] = (pops[p] || 0) + n; }
  }
  const next = { ...pops };
  const eaten = {};
  for (const s in pops) {
    const sp = SPECIES[s]; if (!sp.prey) continue;
    let gain = 0;
    for (const p in sp.prey) {
      if (!(p in pops)) continue;
      const c = sp.a * sp.prey[p] * pops[s] * pops[p] / (pops[p] + sp.H);
      eaten[p] = (eaten[p] || 0) + c; gain += c;
    }
    next[s] += sp.e * gain - sp.m * pops[s];
  }
  for (const s in pops) {
    const sp = SPECIES[s];
    if (sp.r) {
      const suit = Math.exp(-Math.pow((env.rh - sp.rhOpt) / sp.rhW, 2));
      let K = sp.K0 * Math.max(0.05, suit) * (sp.food ? env.food : 1);
      if (sp.boost && pops[sp.boost] != null) K *= 0.4 + Math.min(1.2, pops[sp.boost] / 100);
      next[s] += Math.max(-0.12 * pops[s], sp.r * (1 + 0.15 * noise(site.seed, d, s.length)) * pops[s] * (1 - pops[s] / K));
    }
    if (sp.rhMin && env.rh < sp.rhMin) next[s] -= sp.dry * pops[s] * Math.min(1.2, (sp.rhMin - env.rh) / 14);
    next[s] -= eaten[s] || 0;
    next[s] = Math.max(0, next[s]);
    if (next[s] < 0.3) next[s] = 0;
  }
  return { pops: next, env };
}

const _cache = new Map();
function historyFor(site, toDay) {
  const key = site.id + '|' + site.seed + '|' + JSON.stringify(site.events);
  let c = _cache.get(key);
  if (!c) { const b = BIOMES[site.biome]; c = { states: [{ pops: { ...(site.start || b.start) }, env: envAt(site, 0) }] }; _cache.set(key, c); }
  while (c.states.length <= toDay) {
    const d = c.states.length;
    c.states.push(step(site, c.states[d - 1].pops, d));
  }
  return c.states;
}
function stateLerp(site, dayF) {
  const d0 = Math.max(0, Math.floor(dayF)), f = Math.max(0, dayF - d0), a = stateAt(site, d0); if (f < 0.01) return a;
  const b = stateAt(site, d0 + 1), pops = {}; for (const k in a.pops) pops[k] = a.pops[k] + (b.pops[k] - a.pops[k]) * f;
  return { pops, env: { rh: a.env.rh + (b.env.rh - a.env.rh) * f, temp: a.env.temp + (b.env.temp - a.env.temp) * f, food: a.env.food } };
}
function stateAt(site, day) { day = Math.max(0, Math.round(day)); return historyFor(site, day)[day]; }

if (typeof module !== 'undefined') module.exports = { SPECIES, BIOMES, ACTIONS, PREDATOR_FOR, envAt, stateAt, historyFor };
