(globalThis.sprites ??= {}).butterfly = {
  legend: {
    y: 'Y2',
    Y: 'Y0',
    r: 'R2',
    R: 'R0',
    v: 'V2',
    V: 'V0',
    p: 'P2',
    P: 'P0',
  },
  frames: {
    'variant-0-0': ['...Y.Y...', 'yyy.Y.yyy', 'yyyyYyyyY', '.yyYYyYY.', '..yyYyY..', '..yYYyY..', '.........'],
    'variant-0-1': ['...Y.Y...', '..yyYyy..', '.yyyYyyY.', '.yyyYyyY.', '..yyYyY..', '..yyYyY..', '...yYyY..'],
    'variant-1-0': ['...R.R...', 'rrr.R.rrr', 'rrrrRrrrR', '.rrRRrRR.', '..rrRrR..', '..rRRrR..', '.........'],
    'variant-1-1': ['...R.R...', '..rrRrr..', '.rrrRrrR.', '.rrrRrrR.', '..rrRrR..', '..rrRrR..', '...rRrR..'],
    'variant-2-0': ['...V.V...', 'vvv.V.vvv', 'vvvvVvvvV', '.vvVVvVV.', '..vvVvV..', '..vVVvV..', '.........'],
    'variant-2-1': ['...V.V...', '..vvVvv..', '.vvvVvvV.', '.vvvVvvV.', '..vvVvV..', '..vvVvV..', '...vVvV..'],
    'variant-3-0': ['...P.P...', 'ppp.P.ppp', 'ppppPpppP', '.ppPPpPP.', '..ppPpP..', '..pPPpP..', '.........'],
    'variant-3-1': ['...P.P...', '..ppPpp..', '.pppPppP.', '.pppPppP.', '..ppPpP..', '..ppPpP..', '...pPpP..'],
  },
  faded: {},
  animations: {
    'variant-0': {
      frames: ['variant-0-0', 'variant-0-1'],
      length: 6,
    },
    'variant-1': {
      frames: ['variant-1-0', 'variant-1-1'],
      length: 6,
    },
    'variant-2': {
      frames: ['variant-2-0', 'variant-2-1'],
      length: 6,
    },
    'variant-3': {
      frames: ['variant-3-0', 'variant-3-1'],
      length: 6,
    },
  },
};
