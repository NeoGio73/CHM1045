// Everything an instructor is likely to edit lives in this file: the chambers,
// their completion codes, the molecules, the questions and the narrator's lines.

export const CONFIG = {
  // Which chamber opens when the link has no ?chamber= on the end.
  // Use ?chamber=2 ... ?chamber=6 to open one directly, or ?chamber=menu for the list.
  defaultChamber: '06',
  maxDomains: 6,
};

// Which model file in assets/ plays which part (names without the .glb ending).
// Each subject below also names the core that stands in for its central atom.
export const MODELS = {
  device: 'portal-gun',
  turrets: ['turret', 'turret-defective', 'turret', 'turret'], // one per subject
  narrator: 'core-adventure', // the supervising core
};

// Outer atoms are drawn as balls in these colours; size 1 is the standard ball.
export const ELEMENTS = {
  H: { name: 'hydrogen', color: '#f4f4f2', size: 0.72 },
  Be: { name: 'beryllium' },
  B: { name: 'boron' },
  C: { name: 'carbon' },
  N: { name: 'nitrogen', color: '#4a78e0' },
  O: { name: 'oxygen', color: '#e8483a' },
  F: { name: 'fluorine', color: '#c9ee6b' },
  P: { name: 'phosphorus' },
  S: { name: 'sulfur' },
  Cl: { name: 'chlorine', color: '#3fbf5a' },
  Br: { name: 'bromine' },
  Xe: { name: 'xenon' },
};

// n outer atoms of one element; order 2 or 3 draws a double or triple bond.
const atoms = (el, n, order = 1) => Array.from({ length: n }, () => ({ el, order }));

const NAMED_FROM_ATOMS = 'describes all the electron domains. The molecular shape is named from the atoms only.';

// Each subject:
//   terminals  the outer atoms, in the order they attach
//   lone       lone pairs on the central atom
//   shape      the right answer to "name the molecular shape"
//   angle      the second question: answer, why, hints, and optionally its own
//              title, prompt and options (otherwise the chamber's angle options)
//   count      the full electron count, shown as the second hint
export const CHAMBERS = [
  {
    id: '02', domains: 2, title: 'Two electron domains', room: 'southwest',
    completionCode: 'LINEAR-180',
    shapeOptions: ['Linear', 'Bent', 'Trigonal planar', 'Tetrahedral'],
    angleOptions: ['180°', '120°', '109.5°', '90°'],
    subjects: [
      {
        formula: 'BeCl₂', html: 'BeCl<sub>2</sub>', name: 'beryllium chloride',
        central: 'Be', terminals: atoms('Cl', 2), lone: 0, core: 'core-space',
        count: 'Be brings 2 valence electrons and two Cl bring 14, so 16 in total. Two bonds use 4. Three lone pairs on each Cl use 12. Nothing is left over, so beryllium has no lone pairs. Beryllium is an exception to the octet rule: it settles for four electrons.',
        shape: 'Linear',
        shapeWhy: 'Two domains get as far apart as possible by pointing in opposite directions, so the three atoms sit in a straight line.',
        shapeHints: {},
        angle: {
          answer: '180°',
          why: 'Two domains pointing in opposite directions are 180° apart.',
          hints: {},
        },
        facts: [['Cl–Be–Cl angle', '180°'], ['Polarity', 'Nonpolar: the two bond dipoles point in opposite directions and cancel']],
      },
      {
        formula: 'CO₂', html: 'CO<sub>2</sub>', name: 'carbon dioxide',
        central: 'C', terminals: atoms('O', 2, 2), lone: 0, core: 'core-fact',
        count: 'C brings 4 valence electrons and two O bring 12, so 16 in total. Single bonds would leave carbon short of an octet, so each oxygen shares two pairs: two double bonds use 8. Two lone pairs on each O use the other 8. Carbon has no lone pairs, and each double bond is one domain.',
        shape: 'Linear',
        shapeWhy: 'A double bond points in one direction, so it is a single domain. Two domains and no lone pairs: linear.',
        shapeHints: {
          Tetrahedral: 'Carbon does have four bonding pairs, but they are bundled into two double bonds, and each double bond is one domain.',
          Bent: 'A molecule bends when lone pairs on the central atom push the bonds aside. Carbon has none here.',
        },
        angle: {
          answer: '180°',
          why: 'Two domains, 180° apart. The second pair in each double bond does not change the direction the bond points.',
          hints: {},
        },
        facts: [['O–C–O angle', '180°'], ['Polarity', 'Nonpolar: the two C=O dipoles cancel']],
        builtLine: 'Correct. Four bonding pairs, but only two directions. A double bond is one domain, however much it would like to be two.',
      },
      {
        formula: 'HCN', html: 'HCN', name: 'hydrogen cyanide',
        central: 'C', terminals: [{ el: 'H', order: 1 }, { el: 'N', order: 3 }], lone: 0, core: 'core-wheatley',
        count: 'H brings 1 valence electron, C brings 4 and N brings 5, so 10 in total. The C–H bond uses 2. A triple bond between C and N uses 6, and one lone pair on N uses the last 2. Carbon has no lone pairs: its two domains are the single bond and the triple bond.',
        shape: 'Linear',
        shapeWhy: 'A single bond on one side and a triple bond on the other are still just two domains, pointing in opposite directions.',
        shapeHints: {
          Bent: 'A molecule bends when lone pairs on the central atom push the bonds aside. Carbon has none here.',
        },
        angle: {
          prompt: 'What is the H–C–N angle?',
          answer: '180°',
          why: 'Two domains, 180° apart, even though one is a single bond and the other a triple bond.',
          hints: {},
        },
        facts: [['H–C–N angle', '180°'], ['Polarity', 'Polar: the two ends are different, so the dipoles do not cancel']],
      },
    ],
  },
  {
    id: '03', domains: 3, title: 'Three electron domains', room: 'west',
    completionCode: 'TRIGONAL-120',
    shapeOptions: ['Trigonal planar', 'Bent', 'Linear', 'Trigonal pyramidal', 'Tetrahedral'],
    angleOptions: ['Exactly 120°', 'Slightly less than 120°', '109.5°', '180°'],
    subjects: [
      {
        formula: 'BF₃', html: 'BF<sub>3</sub>', name: 'boron trifluoride',
        central: 'B', terminals: atoms('F', 3), lone: 0, core: 'core-space',
        count: 'B brings 3 valence electrons and three F bring 21, so 24 in total. Three bonds use 6. Three lone pairs on each F use 18. Nothing is left over, so boron has no lone pairs. Boron is an exception to the octet rule: it settles for six electrons.',
        shape: 'Trigonal planar',
        shapeWhy: 'Three domains spread out to the corners of a flat triangle, with the central atom in the middle.',
        shapeHints: {
          'Trigonal pyramidal': 'A pyramid needs a lone pair on the central atom to push the three bonds out of the plane. Boron has none.',
        },
        angle: {
          answer: 'Exactly 120°',
          why: 'Three identical domains share the full circle equally: 360° ÷ 3 = 120°.',
          hints: {
            'Slightly less than 120°': 'Angles only shrink when a lone pair pushes on the bonds. Boron has no lone pairs.',
          },
        },
        facts: [['F–B–F angle', '120°'], ['Polarity', 'Nonpolar: the three bond dipoles cancel']],
      },
      {
        formula: 'SO₃', html: 'SO<sub>3</sub>', name: 'sulfur trioxide',
        central: 'S', terminals: [{ el: 'O', order: 2 }, { el: 'O', order: 1 }, { el: 'O', order: 1 }], lone: 0, core: 'core-fact',
        count: 'S brings 6 valence electrons and three O bring 18, so 24 in total. Three bonds use 6 and completing the oxygens’ octets uses 18. That leaves sulfur short of an octet, so one oxygen shares a second pair: one double bond and two single bonds, with no lone pairs on sulfur. Resonance spreads the double bond over all three oxygens, so the three bonds are identical.',
        shape: 'Trigonal planar',
        shapeWhy: 'Three bonds and no lone pairs. The double bond counts as one domain, like the others, so the atoms sit at the corners of a flat triangle.',
        shapeHints: {
          Tetrahedral: 'Count directions, not electron pairs. The double bond is one domain, so sulfur has three domains, not four.',
        },
        angle: {
          answer: 'Exactly 120°',
          why: 'Resonance makes the three S–O bonds identical, and there are no lone pairs on sulfur, so every angle is exactly 120°.',
          hints: {
            'Slightly less than 120°': 'Angles only shrink when a lone pair pushes on the bonds. Sulfur has no lone pairs here.',
          },
        },
        facts: [['O–S–O angle', '120°'], ['Polarity', 'Nonpolar: the three bond dipoles cancel']],
      },
      {
        formula: 'SO₂', html: 'SO<sub>2</sub>', name: 'sulfur dioxide',
        central: 'S', terminals: [{ el: 'O', order: 2 }, { el: 'O', order: 1 }], lone: 1, core: 'core-wheatley',
        count: 'S brings 6 valence electrons and two O bring 12, so 18 in total. Two bonds use 4 and completing the oxygens’ octets uses 12. That leaves 2 electrons: one lone pair on sulfur. Sulfur is still short of an octet, so one oxygen shares a second pair, a double bond that resonance spreads over both oxygens.',
        shape: 'Bent',
        shapeWhy: 'Three domains point to the corners of a triangle, but one corner holds a lone pair. The three atoms that remain make a bent shape.',
        shapeHints: {
          'Trigonal planar': `Trigonal planar ${NAMED_FROM_ATOMS}`,
          Linear: 'It would be linear with only two domains. Sulfur also has a lone pair, which pushes the two bonds to one side.',
        },
        angle: {
          answer: 'Slightly less than 120°',
          why: 'A lone pair pushes harder than a bond, so the O–S–O angle closes a little. The measured angle is about 119°.',
          hints: {
            'Exactly 120°': 'It would be 120° if all three domains pushed equally. A lone pair pushes harder than a bond.',
            '180°': 'That would be a linear molecule. Rotate this one: the lone pair has pushed both oxygens to one side.',
          },
        },
        facts: [['O–S–O angle', 'About 119°'], ['Polarity', 'Polar: the bent shape means the dipoles do not cancel']],
      },
    ],
  },
  {
    id: '04', domains: 4, title: 'Four electron domains', room: 'northwest',
    completionCode: 'TETRA-109',
    shapeOptions: ['Tetrahedral', 'Trigonal pyramidal', 'Bent', 'Trigonal planar', 'Linear', 'Square planar'],
    angleOptions: ['Exactly 109.5°', 'Slightly less than 109.5°', '120°', '90°'],
    subjects: [
      {
        formula: 'CH₄', html: 'CH<sub>4</sub>', name: 'methane',
        central: 'C', terminals: atoms('H', 4), lone: 0, core: 'core-space',
        count: 'C brings 4 valence electrons and four H bring 4, so 8 in total. Four bonds use all 8. Hydrogen needs only two electrons, so nothing is left over and carbon has no lone pairs.',
        shape: 'Tetrahedral',
        shapeWhy: 'Four domains get furthest apart by pointing to the corners of a tetrahedron, not the corners of a flat square.',
        shapeHints: {
          'Square planar': 'A flat square would put the bonds only 90° apart. In three dimensions they can spread to 109.5°. Rotate the molecule to see it.',
        },
        angle: {
          answer: 'Exactly 109.5°',
          why: 'Four identical domains at the corners of a tetrahedron are each 109.5° from the others.',
          hints: {
            '90°': 'That would be a flat square. Rotate the molecule: the four bonds are not in one plane.',
            'Slightly less than 109.5°': 'Angles only shrink when a lone pair pushes on the bonds. Carbon has no lone pairs here.',
          },
        },
        facts: [['H–C–H angle', '109.5°'], ['Polarity', 'Nonpolar: the four bond dipoles cancel']],
      },
      {
        formula: 'NH₃', html: 'NH<sub>3</sub>', name: 'ammonia',
        central: 'N', terminals: atoms('H', 3), lone: 1, core: 'core-fact',
        count: 'N brings 5 valence electrons and three H bring 3, so 8 in total. Three bonds use 6. Hydrogen needs no more, so the 2 electrons left over are one lone pair on nitrogen.',
        shape: 'Trigonal pyramidal',
        shapeWhy: 'Four domains make a tetrahedron, but one corner holds a lone pair. The nitrogen and three hydrogens form a low pyramid with a triangular base.',
        shapeHints: {
          'Trigonal planar': 'It would be flat with only three domains. The lone pair on nitrogen is a fourth domain, and it pushes the three bonds down out of the plane.',
          Tetrahedral: `Tetrahedral ${NAMED_FROM_ATOMS}`,
        },
        angle: {
          answer: 'Slightly less than 109.5°',
          why: 'The lone pair pushes harder than the bonding pairs and squeezes the H–N–H angle to about 107°.',
          hints: {
            'Exactly 109.5°': 'It would be 109.5° if all four domains pushed equally. A lone pair pushes harder than a bonding pair.',
            '120°': 'That is the angle for a flat triangle. Ammonia is a pyramid: rotate it and look from the side.',
          },
        },
        facts: [['H–N–H angle', 'About 107°'], ['Polarity', 'Polar: the lone pair makes the molecule lopsided']],
      },
      {
        formula: 'H₂O', html: 'H<sub>2</sub>O', name: 'water',
        central: 'O', terminals: atoms('H', 2), lone: 2, core: 'core-wheatley',
        count: 'O brings 6 valence electrons and two H bring 2, so 8 in total. Two bonds use 4. Hydrogen needs no more, so the 4 electrons left over are two lone pairs on oxygen.',
        shape: 'Bent',
        shapeWhy: 'Four domains make a tetrahedron, but two corners hold lone pairs. The three atoms that remain make a bent shape.',
        shapeHints: {
          Linear: 'It would be linear with only two domains. Oxygen has four: two bonds and two lone pairs.',
          Tetrahedral: `Tetrahedral ${NAMED_FROM_ATOMS}`,
        },
        angle: {
          answer: 'Slightly less than 109.5°',
          why: 'Two lone pairs squeeze the bonds even more than one does: the H–O–H angle is about 104.5°.',
          hints: {
            'Exactly 109.5°': 'It would be 109.5° if all four domains pushed equally. Lone pairs push harder than bonding pairs.',
          },
        },
        facts: [['H–O–H angle', 'About 104.5°'], ['Polarity', 'Polar: the bent shape means the dipoles do not cancel']],
      },
    ],
  },
  {
    id: '05', domains: 5, title: 'Five electron domains', room: 'atrium',
    completionCode: 'BIPYRAMID-5',
    shapeOptions: ['Trigonal bipyramidal', 'Seesaw', 'T-shaped', 'Linear', 'Tetrahedral', 'Trigonal planar', 'Bent'],
    angleOptions: ['Exactly 90°', 'Slightly less than 90°', '120°', '109.5°'],
    subjects: [
      {
        formula: 'PCl₅', html: 'PCl<sub>5</sub>', name: 'phosphorus pentachloride',
        central: 'P', terminals: atoms('Cl', 5), lone: 0, core: 'core-space',
        count: 'P brings 5 valence electrons and five Cl bring 35, so 40 in total. Five bonds use 10. Three lone pairs on each Cl use 30. Nothing is left over, so phosphorus has no lone pairs.',
        shape: 'Trigonal bipyramidal',
        shapeWhy: 'Five domains cannot all be the same distance apart. Three spread around the middle and two point straight up and down: two pyramids sharing a triangular base.',
        shapeHints: {
          Tetrahedral: 'A tetrahedron has four corners. Phosphorus has five bonds, so count the atoms again.',
        },
        angle: {
          prompt: 'Which angles separate neighbouring P–Cl bonds?',
          options: ['90° only', '120° only', '90° and 120°', '109.5° only'],
          answer: '90° and 120°',
          why: 'The three middle (equatorial) bonds are 120° apart. The top and bottom (axial) bonds are 90° from each of the middle three.',
          hints: {
            '90° only': 'That is true of the top and bottom bonds. Now look at the three around the middle.',
            '120° only': 'That is true of the three bonds around the middle. Now look at the top and bottom ones.',
          },
        },
        facts: [['Cl–P–Cl angles', '90° and 120°'], ['Polarity', 'Nonpolar: the five bond dipoles cancel']],
      },
      {
        formula: 'SF₄', html: 'SF<sub>4</sub>', name: 'sulfur tetrafluoride',
        central: 'S', terminals: atoms('F', 4), lone: 1, core: 'core-fact',
        count: 'S brings 6 valence electrons and four F bring 28, so 34 in total. Four bonds use 8. Three lone pairs on each F use 24. That leaves 2 electrons: one lone pair on sulfur.',
        shape: 'Seesaw',
        shapeWhy: 'Five domains make a trigonal bipyramid, and the lone pair takes one of the three middle positions. The four fluorines that remain look like a seesaw.',
        shapeHints: {
          Tetrahedral: 'There are four atoms, but five domains: the lone pair counts too. Count the domains on sulfur again.',
          'Trigonal bipyramidal': `Trigonal bipyramidal ${NAMED_FROM_ATOMS}`,
        },
        angle: {
          title: 'Lone pair position',
          prompt: 'Where does the lone pair sit?',
          options: ['Around the middle (equatorial)', 'At the top or bottom (axial)'],
          answer: 'Around the middle (equatorial)',
          why: 'Around the middle, the lone pair has only two neighbours at 90°. At the top or bottom it would have three. Lone pairs take the roomier middle positions.',
          hints: {
            'At the top or bottom (axial)': 'Count the close neighbours. A top or bottom position has three bonds only 90° away. A middle position has two.',
          },
        },
        facts: [['F–S–F angles', 'About 102° around the middle, 173° top to bottom'], ['Polarity', 'Polar: the lone pair makes the molecule lopsided']],
      },
      {
        formula: 'ClF₃', html: 'ClF<sub>3</sub>', name: 'chlorine trifluoride',
        central: 'Cl', terminals: atoms('F', 3), lone: 2, core: 'core-wheatley',
        count: 'Cl brings 7 valence electrons and three F bring 21, so 28 in total. Three bonds use 6. Three lone pairs on each F use 18. That leaves 4 electrons: two lone pairs on chlorine.',
        shape: 'T-shaped',
        shapeWhy: 'Five domains make a trigonal bipyramid. Both lone pairs take middle positions, which leaves the three fluorines in a T.',
        shapeHints: {
          'Trigonal planar': 'It would be a flat triangle with only three domains. Chlorine has five: three bonds and two lone pairs.',
          'Trigonal bipyramidal': `Trigonal bipyramidal ${NAMED_FROM_ATOMS}`,
        },
        angle: {
          answer: 'Slightly less than 90°',
          why: 'Both lone pairs sit around the middle and push the top and bottom fluorines toward the third one. The measured angle is about 87.5°.',
          hints: {
            'Exactly 90°': 'It would be 90° if all five domains pushed equally. Lone pairs push harder than bonding pairs.',
            '120°': 'The 120° positions around the middle are mostly taken by the lone pairs. Look at the angle between the bonds themselves.',
          },
        },
        facts: [['F–Cl–F angle', 'About 87.5°'], ['Polarity', 'Polar: the T shape means the dipoles do not cancel']],
      },
      {
        formula: 'XeF₂', html: 'XeF<sub>2</sub>', name: 'xenon difluoride',
        central: 'Xe', terminals: atoms('F', 2), lone: 3, core: 'core-space',
        count: 'Xe brings 8 valence electrons and two F bring 14, so 22 in total. Two bonds use 4. Three lone pairs on each F use 12. That leaves 6 electrons: three lone pairs on xenon.',
        shape: 'Linear',
        shapeWhy: 'All three lone pairs take the middle positions. The two fluorines are left at the top and bottom, in a straight line through xenon.',
        shapeHints: {
          Bent: 'Lone pairs often bend a molecule, but here three of them surround the middle evenly, so their pushes cancel.',
          'Trigonal bipyramidal': `Trigonal bipyramidal ${NAMED_FROM_ATOMS}`,
        },
        angle: {
          options: ['180°', '120°', '90°', '109.5°'],
          answer: '180°',
          why: 'The three lone pairs are spread evenly around the middle, so they push equally from every side and the F–Xe–F line stays straight.',
          hints: {},
        },
        facts: [['F–Xe–F angle', '180°'], ['Polarity', 'Nonpolar: the two bond dipoles cancel']],
        builtLine: 'Correct. Three lone pairs, all around the middle. They take up most of the room and none of the credit.',
      },
    ],
  },
  {
    id: '06', domains: 6, title: 'Six electron domains', room: 'north',
    completionCode: 'OCTAHEDRAL-90',
    shapeOptions: ['Octahedral', 'Square pyramidal', 'Square planar', 'Seesaw', 'T-shaped', 'Trigonal bipyramidal'],
    angleOptions: ['Exactly 90°', 'Slightly less than 90°', '109.5°', '120°'],
    subjects: [
      {
        formula: 'SF₆', html: 'SF<sub>6</sub>', name: 'sulfur hexafluoride',
        central: 'S', terminals: atoms('F', 6), lone: 0, core: 'core-space',
        count: 'S brings 6 valence electrons and six F bring 42, so 48 in total. Six bonds use 12. Three lone pairs on each F use 36. Nothing is left over, so sulfur has no lone pairs.',
        shape: 'Octahedral',
        shapeWhy: 'Six bonding pairs and no lone pairs: the atoms sit at all six corners of an octahedron.',
        shapeHints: {},
        angle: {
          answer: 'Exactly 90°',
          why: 'All six domains are identical bonding pairs, so every neighbouring F–S–F angle is exactly 90°.',
          hints: {
            'Slightly less than 90°': 'Angles only shrink when a lone pair pushes on the bonds. SF₆ has no lone pairs on sulfur.',
          },
        },
        facts: [['F–S–F angle', '90°'], ['Polarity', 'Nonpolar: the six bond dipoles cancel']],
      },
      {
        formula: 'BrF₅', html: 'BrF<sub>5</sub>', name: 'bromine pentafluoride',
        central: 'Br', terminals: atoms('F', 5), lone: 1, core: 'core-fact',
        count: 'Br brings 7 valence electrons and five F bring 35, so 42 in total. Five bonds use 10. Three lone pairs on each F use 30. That leaves 2 electrons: one lone pair on bromine.',
        shape: 'Square pyramidal',
        shapeWhy: 'Six domains make an octahedron, but one corner holds a lone pair. The five atoms that remain form a square-based pyramid.',
        shapeHints: {
          Octahedral: `Octahedral ${NAMED_FROM_ATOMS}`,
        },
        angle: {
          answer: 'Slightly less than 90°',
          why: 'A lone pair pushes harder than a bonding pair, so the four base fluorines are squeezed up toward the top one. The measured angle is about 85°.',
          hints: {
            'Exactly 90°': 'It would be 90° if all six domains pushed equally. A lone pair pushes harder than a bonding pair.',
          },
        },
        facts: [['F–Br–F angle', 'About 85°'], ['Polarity', 'Polar: the lone pair makes the molecule lopsided']],
      },
      {
        formula: 'XeF₄', html: 'XeF<sub>4</sub>', name: 'xenon tetrafluoride',
        central: 'Xe', terminals: atoms('F', 4), lone: 2, core: 'core-wheatley',
        count: 'Xe brings 8 valence electrons and four F bring 28, so 36 in total. Four bonds use 8. Three lone pairs on each F use 24. That leaves 4 electrons: two lone pairs on xenon.',
        shape: 'Square planar',
        shapeWhy: 'The two lone pairs take opposite corners of the octahedron, 180° apart. The four fluorines are left in a flat square around xenon.',
        shapeHints: {
          Octahedral: `Octahedral ${NAMED_FROM_ATOMS}`,
          Seesaw: 'Seesaw comes from five domains with one lone pair. Count the domains on xenon again.',
        },
        angle: {
          answer: 'Exactly 90°',
          why: 'Each lone pair does push on the bonds, but one pushes from above and the other from below. The pushes cancel and the F–Xe–F angle stays at 90°.',
          hints: {
            'Slightly less than 90°': 'One lone pair would squeeze the bonds. Here there are two, on opposite sides of the square. What happens to their pushes?',
          },
        },
        facts: [['F–Xe–F angle', '90°'], ['Polarity', 'Nonpolar: the bond dipoles cancel, and so do the lone pairs']],
        builtLine: 'Correct. Look at where the two lone pairs went: opposite sides, as far from each other as they can get.',
      },
    ],
  },
];

const COUNT_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six'];

export const LINES = {
  menu: 'Select a test chamber. They are numbered by how many electron domains surround the central atom.',
  intro: (c) => `Welcome to Test Chamber ${c.id}. Each of today’s subjects has ${COUNT_WORDS[c.domains]} electron domains around its central atom. Electron domains repel one another. This is not personal. It is physics.`,
  build: (s, i) => `Subject ${i + 1}: ${s.name}. Attach its electron domains to the central atom. Blue for a bond. Orange for a lone pair.`,
  firstBond: 'A bond, with an atom attached at no extra charge.',
  firstLone: 'A lone pair. It takes up more room than a bond and it will not apologise.',
  shuffle: 'Notice how the domains shuffle to get as far from each other as they can.',
  full: 'Six domains. This central atom is now at capacity.',
  overflow: 'These central atoms are rated for six electron domains. The seventh has been declined.',
  empty: 'There is nothing to remove. I admire the optimism.',
  fizzle: 'Domains removed. The central atom is alone again, which is how it started.',
  wrongBuild: (s) => `That is not ${s.formula}. The turrets have noticed.`,
  rightBuild: 'Correct. The domains have settled as far apart as possible, which is more cooperation than I expected.',
  wrongAnswer: 'Incorrect. The turrets are watching you try again.',
  rightShape: 'Correct. The shape is named for where the atoms are. Lone pairs shape the molecule without appearing in its name.',
  rightAngle: 'Correct. One turret has been deactivated. It wants you to know it does not blame you.',
  next: 'The next subject is ready whenever you are.',
  done: 'Testing is complete. Every turret in this chamber is asleep. You may collect your completion code.',
};
