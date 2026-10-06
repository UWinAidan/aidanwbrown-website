// ---------- Designs: my 3D models ----------
// Each design gets a card on designs.html; clicking it opens a 3D viewer you can spin and zoom.
// Models: put the file(s) in models/<folder>/ - .glb, .gltf, .stl and .obj all work.
// folder: the folder name in models/ (defaults to the id).
//         1 file  = normal viewer.
//         2+ files = a toggle to switch between them (e.g. stowed / deployed). If they're the same assembly
//         exported twice (same part names), the parts glide into place; otherwise the views crossfade.
//         Name the files 1-stowed.glb, 2-deployed.glb... - the number sets the order, the rest is the label.
// configs: optional labels for the toggle buttons, e.g. ['Stowed', 'Intake', 'Scoring'].
//          Without it: 2 files = Stowed / Deployed, 3 files = Stowed / Deployed 1 / Deployed 2.
// section: true adds a "3/4 section" button that cuts away a quarter, with filled cut faces (for the gearboxes).
//          The cut goes through the model's centre, around its vertical axis. If the gearbox axis lies
//          sideways, use section: 'x' or section: 'z' instead to cut around that axis.
//          Hide reference surfaces / sketches in Inventor before exporting - only solids cut cleanly.
// slice:   'yz' adds a "Slice" button: a cut plane slowly pans back and forth through the whole model
//          (filled cut faces). 'yz' cuts across the X direction; 'xy' and 'xz' are the other two planes.
// explode: adds an "Explode" button: the parts glide apart along the model's vertical axis, and back.
//          layers: one entry per group of parts - [part names, how far they move in mm (minus = down)].
//          Part names are the ones from Inventor; | means "or". Twin parts are told apart by height:
//          { below: 9 } = only the ones whose centre is under 9 mm, { above: 15 } = only those over 15 mm.
//          hide: optional - part names to hide while exploded (e.g. a reference body that covers other parts).
//          Parts that aren't listed stay where they are. Ask Claude to set this up for a new model.
// frame: optional. 1.2 puts the camera 20% further back - for a boxy model that fills the view and gets its
//        corners cut off (a building, a cabinet). Leave it out for everything else.
// thumb: optional picture for the card, in images/designs/. Leave it '' and the card uses
//        images/designs/<id>.webp (ask Claude to render these - instant), or renders an
//        isometric view in the browser if that's missing (slow for big robots).
// link:  optional. One link, or a list of them. The button names itself from the website
//        (MakerWorld, YouTube, GitHub, Printables, GrabCAD, Onshape...), or give your own label:
//          link: 'https://makerworld.com/en/models/123456',
//          link: ['https://makerworld.com/...', 'https://youtube.com/...'],
//          link: [{ label: 'Match video', url: 'https://youtube.com/...' }, 'https://github.com/...'],
// Downloads: put a zipped STEP file in cad/<id>/ (the folder name = the design's id), then run this in
//            the VS Code terminal:   node scripts/sync-cad.mjs
//            (or Terminal > Run Task > "Sync CAD to the site"). That uploads it to the Cloudflare bucket
//            the site reads from - cad/ is NOT part of the repo, so Commit + Sync alone does nothing for it.
//            The viewer then shows "Download STEP" within 5 minutes. No file = no download button.
// license: who owns the design, shown under the download button. Leave it out for your own designs
//          ("© <year> Aidan Brown. All rights reserved."). Team robots name the team instead.
// download: false hides the STEP download even if a file is in cad/<id>/ (e.g. team CAD you mostly didn't design).
// cadLink: optional link to the full CAD hosted elsewhere (GrabCAD, Onshape, GitHub) - for files too big
//          for the site, or team CAD that already lives somewhere else.
// hideSurfaces: true removes reference surface bodies (Srf1, Srf2...) left in an export.
// rotate: optional [x, y, z] in degrees, if a model comes out on its side, e.g. [-90, 0, 0].
// color: optional colour for the model in the viewer (default: site sage).
// status: optional, e.g. 'In progress' - shows a badge on the card and a note in the viewer.
// project: optional - the id of a project in js/projects.js. The model then also shows on that
//          project's page, and the viewer links back to the project.

// year, tags, link, status, summary: leave them blank ('' or []) to use the linked portfolio
//          project's (js/projects.js) - so you only fill these in once, on the portfolio.
//          Fill one in here only when this model needs something different, e.g. the two cycloidal
//          gearbox versions have their own year and summary.

const DESIGNS = [
  { id: 'frc-2026', title: 'FRC Robot 2026', year: '',
    tags: [],
    license: '© 2026 FRC Team 5885. All rights reserved.',
    download: false,   // new on the team - not my CAD to hand out
    summary: '',   // uses the portfolio summary
    folder: 'ROBOT_FRC_2026',
    rotate: [-90, 0, 0],   // exported lying on its side
    project: 'frc-2026',
    thumb: '',
    link: '' },

  { id: 'frc-2025', title: 'FRC Robot 2025', year: '',
    tags: [],
    license: '© 2025 FRC Team 8081. All rights reserved.',
    summary: '',   // uses the portfolio summary
    folder: 'ROBOT_FRC_2025',
    project: 'frc-2025',
    thumb: '',
    link: '' },

  { id: 'frc-2024', title: 'FRC Robot 2024', year: '',
    tags: [],
    license: '© 2024 FRC Team 8081. All rights reserved.',
    summary: '',   // uses the portfolio summary
    folder: 'ROBOT_FRC_2024',
    project: 'frc-2024',
    thumb: '',
    link: '' },

  { id: 'six-axis-robot', title: '6-Axis Robot', year: '',
    tags: [],
    summary: '',   // uses the portfolio summary
    folder: '6A_ROBOT',
    slice: 'yz',
    project: 'six-axis-robot',
    thumb: '',
    link: '' },

  { id: 'trebuchet', title: 'Trebuchet', year: '',
    tags: [],
    summary: '',   // uses the portfolio summary
    folder: 'TREBUCHET',
    project: 'trebuchet',
    thumb: '',
    link: '' },

  { id: 'cornerstone-robot', title: 'Cornerstone Robot', year: '',
    tags: [],
    summary: '',   // uses the portfolio summary
    folder: 'CORNERSTONE',
    project: 'cornerstone-robot',
    thumb: '',
    link: '' },

  { id: 'frc-2023', title: 'FRC Robot 2023', year: '',
    tags: [],
    license: '© 2023 FRC Team 8081. All rights reserved.',
    summary: '',   // uses the portfolio summary
    folder: 'ROBOT_FRC_2023',
    configs: ['Stowed', 'Scoring', 'Intake'],   // file 1_, 2_, 3_
    project: 'frc-2023',
    thumb: '',
    link: '' },

  { id: 'ftc-2025', title: 'FTC Robot 2025', year: '',
    tags: [],
    license: '© 2025 FTC Team 19530. All rights reserved.',
    summary: '',   // uses the portfolio summary
    folder: 'ROBOT_FTC_2025',
    hideSurfaces: true,   // reference surfaces on the wheels
    project: 'ftc-2025',
    thumb: '',
    link: '' },

  { id: 'ftc-2024', title: 'FTC Robot 2024', year: '',
    tags: [],
    license: '© 2024 FTC Team 19530. All rights reserved.',
    summary: '',   // uses the portfolio summary
    folder: 'ROBOT_FTC_2024',
    rotate: [180, 0, 0],   // exported upside down
    project: 'ftc-2024',
    thumb: '',
    link: '' },

  { id: 'strain-wave-reducer', title: 'Strain Wave Reducer', year: '',
    tags: [],
    summary: '',   // uses the portfolio summary
    folder: 'STRAIN_WAVE_REDUCER',
    section: true,
    explode: { hide: 'CR_ROLLER_BOUNDRY', layers: [   // [part names, mm to move along the axis]
      ['BASS_PLATE', -106], ['CR_OUTSIDE,BOTTOM', -92], ['Flex_SPLINE|Spur_Gear', -68], ['ROLLER', -40],
      ['DERIVEN_CR_INSIDE', -17], ['CR_OUTSIDE,TOP', 6], ['O_RING', 21], ['BOTTOM_ELIP', 37],
      ['ELIPSE_DRIVE', 49], ['BALL_BEARINGS', 63], ['DERIVEN_BALL', 76], ['SCREW', 106]] },
    project: 'strain-wave-reducer',
    thumb: '',
    link: '' },

  { id: 'cycloidal-gearbox-v2', title: 'Cycloidal Gearbox V2', year: '2026',
    tags: [],
    summary: 'Second version of my cycloidal gearbox, designed for the 6-axis robot and future projects.',
    folder: 'CYCLODAL_GEARBOX_V2',
    section: true,
    explode: { layers: [   // [part names, mm to move along the axis, { below / above: height in mm } for twin parts]
      ['Thrust_Bearing', -92], ['Case_Taped', -74], ['Case_Bearing', -50, { below: 0 }],
      ['Carier_Plate|SCREW|1611-0514', -32, { below: 0 }], ['Cycloid|Bearing_GB', -16, { below: 0 }],
      ['Cycloid|Bearing_GB', 16, { above: 0 }], ['Carier_Plate|SCREW|1611-0514', 32, { above: 0 }],
      ['Case_Bearing', 50, { above: 0 }], ['Case_GB', 74], ['Hex_Cap', 112]] },
    project: 'cycloidal-gearbox',
    thumb: '',
    link: '' },

  { id: 'cycloidal-gearbox', title: 'Cycloidal Gearbox', year: '2025',
    tags: [],
    summary: 'My first cycloidal gearbox, designed for the 6-axis robot and FRC robots.',
    folder: 'CYCLODAL_GEARBOX',
    rotate: [-90, 0, 0],   // exported with its axis lying flat
    section: true,
    explode: { layers: [   // [part names, mm to move along the axis, { below / above: height in mm } for twin parts]
      ['MOTOR,MOUNT|Hex_Cap', -131], ['BASE', -97],
      ['PLATE,DRIVE|1611-0514|2304-0006|SCREW|2303-4008', -49, { below: 9 }],
      ['RING,SPACER', -31, { below: 15 }], ['dowel_pin|SHAFT,REX', -7],
      ['CYCLODIAL|CAM,GENERATOR|F6701', 21, { below: 15 }], ['BRACE', 38],
      ['CYCLODIAL|CAM,GENERATOR|F6701', 55, { above: 15 }], ['RING,SPACER', 70, { above: 15 }],
      ['PLATE,DRIVE|1611-0514|SCREW', 89, { above: 15 }], ['CAP,PLATE', 109], ['HEX,SUPPORT', 132]] },
    project: 'cycloidal-gearbox',
    thumb: '',
    link: '' },

  { id: 'sauna', title: 'Sauna', year: '',
    tags: [],
    summary: '',   // uses the portfolio summary
    folder: 'SAUNA',
    rotate: [-90, 0, 0],   // exported lying on its back
    frame: 1.2,            // a building fills the view: step back so the corners aren't cut off
    project: 'sauna',
    thumb: '',
    link: '' },
];
