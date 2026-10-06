// ---------- Portfolio: my projects ----------
// Each project gets a card on portfolio.html and its own page at project.html?id=<id>.
// Photos: put them in images/projects/<id>/ (folder name must match the id).
//         The first photo (alphabetically) is the card picture - name it 01-something.jpg to choose.
//         On the project page that first photo is the large one at the top, next to the 3D model and the first
//         clip (.mp4). Everything else goes in the gallery at the bottom, in name order.
// cover: optional - use a different photo from the folder as the card picture: cover: 'IMG_1234.jpg'
//         Or put a picture named cover.jpg in the folder: it becomes the card picture and is left out of
//         the gallery (used for the trebuchet, where the card is two photos joined side by side).
// coverFocus: optional - which part of the card picture to keep when it's cropped to the card's wide shape.
//         'top', 'bottom', 'left', 'right', or how far across + how far down: '50% 20%' (default is the middle).
//         (Project pages use the site's own banner photos, not project photos.)
// tags:  who / what it was for (team, role, class or personal project) - shown in the grey line.
// types: the kind of work, shown as small chips. Use these so they stay consistent:
//        'Design', 'Software', 'Hardware', 'Fabrication', 'Networking'   (add a new one only if none fit)
// summary: the short description. It's also used for the project's 3D model on the Designs page,
//          so you only write it once (a model can still override it in js/designs-list.js).
// body:  one string per paragraph.
// videos: optional YouTube / Vimeo links, shown as players on the project page:
//         videos: ['https://youtu.be/abc123', 'https://www.youtube.com/watch?v=xyz789'],
//         Short clips (.mp4, under ~25 MB) can also go straight into images/projects/<id>/ with the photos.
// links: optional buttons, e.g. { label: 'GitHub', url: 'https://github.com/UWinAidan/...' }
// status: optional, e.g. 'In progress' - shows a badge on the card and the project page.
// license: who owns the work, shown on the project page. Leave it out for your own projects
//         ("© <year> Aidan Brown. All rights reserved."). Team robots take theirs from their 3D model
//         (license: in js/designs-list.js); class projects done as a team say so here.
// sim:   optional - an interactive simulation on the project page (only 'trebuchet' exists). simText is the line above it.
// section: which part of the portfolio page the card goes in - one of the ids in SECTIONS just below.
// featured: optional - puts the card in the "Featured" row at the very top of the page as well.
//         The number is its place in that row: featured: 1 is first, 2 is second... Keep it to about three.
// Order here = order inside each section, so put your best work first.

// The sections of the portfolio page, top to bottom. Each one gets a jump button at the top of the page.
// To reorder the page, reorder these lines. To rename a section, change its title (keep the id).
const SECTIONS = [
  { id: 'robots', title: 'Robots' },
  { id: 'school', title: 'School projects' },
  { id: 'personal', title: 'Personal projects' },
  { id: 'software', title: 'Software' },
  { id: 'workshop', title: 'Wood & metal working' },
];

const PROJECTS = [
  { id: 'six-axis-robot', title: '6-Axis Robot', year: '2024-present',
    tags: ['Robotics', 'Personal project'],
    section: 'personal',
    featured: 3,
    types: ['Design', 'Software', 'Hardware', 'Fabrication'],
    status: 'In progress',
    summary: 'A 10 lb payload class, 6-axis robot arm that I am building from scratch.',
    body: [
      'I am building this robot to challenge myself. The goal is a very finished product that uses everything I know about manufacturing processes: an arm that can handle a large payload with fast accelerations while keeping the end of the arm very light. A big part of that is mounting the motors as far back as possible.',
      'The joints use cycloidal gearboxes I designed myself. Axes 1 and 2 are driven by NEO 2.0 motors and the other four by NEO 550s, with an absolute encoder on every axis.',
      'I started with an analysis to predict the gear ratios from the expected weights, inertias and motor curves. Once the design is done, I plan to redo the analysis and iterate before manufacturing anything.',
      'On the controls side I am designing custom electronics and writing the control code: PID with feedforward, including friction and gravity compensation.',
      'After that I plan to build a teach pendant and end effectors for it, and potentially a vision system.',
    ],
    links: [{ label: 'GitHub', url: 'https://github.com/UWinAidan/6-Axis-Robot.git' }] },

  { id: 'frc-2026', title: 'FRC Robot 2026', year: '2026',
    tags: ['FRC', '5885-Villanova WiredCats', 'Mentor'],
    section: 'robots',
    types: ['Design', 'Fabrication'],
    summary: 'Team 5885’s 2026 competition robot, designed and built for the FIRST Robotics Competition game REBUILT.',
    body: [
      'REBUILT had robots collecting foam balls called fuel and shooting them into a hub, then climbing a ladder-shaped tower at the end of the match. This was my first season mentoring Team 5885.',
      'I was busier with school this year, so my part was smaller: running design reviews, teaching some CAD classes and giving my opinion on the design. The robot is the work of the students.',
      'It is a swerve drive with a turret-mounted shooter and an adjustable hood, a spindexer that feeds it, and an intake that slides out on a rack and pinion. The intake started out on a four-bar linkage and was switched to the linear design during the season.',
      'The shooter, turret and intake ran on feedforward control with PID correcting the remaining error, and a lookup table set the shot for wherever the robot was on the field. Four Arducam cameras on Orange Pi computers tracked the AprilTags so the robot always knew its position.',
      'The team was a finalist at the Georgian College event, where it also won the Gracious Professionalism Award. It won the Engineering Inspiration Award at Windsor Essex and ranked 14th of 49 in its division at the Ontario championship.',
    ],
    links: [{ label: 'Team Website', url: 'https://www.wiredcats5885.ca/' }, { label: 'GitHub', url: 'https://github.com/frc5885' }, { label: 'The Blue Alliance', url: 'https://www.thebluealliance.com/team/5885' }],
    videos: ['https://youtu.be/rb9A8jJv6QM?si=tUg_QarApQRb-zKc'] },

  { id: 'frc-2025', title: 'FRC Robot 2025', year: '2025',
    tags: ['FRC', '8081-UMEI Lightning Robotics', 'Mentor'],
    section: 'robots',
    types: ['Design', 'Fabrication'],
    summary: 'Team 8081’s 2025 competition robot, designed and built for the FIRST Robotics Competition game REEFSCAPE.',
    body: [
      'REEFSCAPE had robots placing coral pieces on a tall reef, clearing algae balls off it and climbing a hanging cage. This was my first year as a mentor.',
      'The team was rebuilding its design experience that year, so I ended up designing most of the robot myself and teaching by demonstration, showing the students how as I went.',
      'The robot is a swerve drive that positions its end effector with four degrees of freedom: a vertical elevator, a lateral elevator, a pivot and a wrist. The end effector has spring-loaded arms that grip both the coral and the algae balls, so one mechanism handles both game pieces. A separate climber lifts the robot onto the cage.',
      'Everything except the climber ran on feedforward control with PID correcting the remaining error, including the swerve drive and all four axes of the end effector. Two Orange Pi computers with Arducam cameras tracked the AprilTags on the field, which the robot used to line itself up.',
      'The team ranked 5th of 29 and captained the fourth alliance at the Windsor Essex event, where it also won the Team Sustainability Award.',
    ],
    links: [{ label: 'The Blue Alliance', url: 'https://www.thebluealliance.com/team/8081' }, { label: 'GitHub', url: 'https://github.com/Benrecker/DeepDiveFRC2025' }] },

  { id: 'frc-2024', title: 'FRC Robot 2024 - Fortissimo', year: '2024',
    tags: ['FRC', '8081-UMEI Lightning Robotics', 'Team lead'],
    section: 'robots',
    featured: 1,
    types: ['Design', 'Fabrication'],
    summary: 'Team 8081’s 2024 competition robot, designed and built for the FIRST Robotics Competition game CRESCENDO.',
    body: [
      'CRESCENDO was about picking foam rings off the floor, shooting them into targets and climbing a chain. In my last year of high school I was the team lead as well as the mechanical sub-team lead, and I designed most of the robot.',
      'Fortissimo is a swerve-drive robot with a ground intake that feeds straight into a pivoting shooter, an end effector for the amp and the human player station, and hooks for the climb.',
      'We built it mainly from Lexan, sheet aluminum and steel, 3D prints, machined extrusion and purchased parts. The whole robot was modelled in CAD first, with each part designed around how we would actually make it. Finding problems in the model instead of on the robot made the build much smoother.',
      'The design still changed once it met the field. After our first competition we tore the end effector and its angled telescoping slides off the robot and replaced them with a single pivoting end effector. It was simpler and lighter, and it removed some dead zones where we could not shoot. At our second event we ranked 6th of 31, up from 13th of 27 at the first.',
      'The swerve drive, shooter, shooter pivot and end effector all ran on feedforward control with PID correcting the remaining error. Two Orange Pi computers with fixed-mounted Arducam cameras read the field tags so the robot knew where it was, and spotted rings on the floor.',
      'We won the Excellence in Engineering Award at all three events, including the Ontario championship, and finished 26th of 138 Ontario teams, up from 35th the year before.',
    ],
    links: [{ label: 'The Blue Alliance', url: 'https://www.thebluealliance.com/team/8081' }],
    videos: ['https://www.youtube.com/watch?v=I5F4SLYCYjk'] },

  { id: 'frc-2023', title: 'FRC Robot 2023', year: '2023',
    tags: ['FRC', '8081-UMEI Lightning Robotics', 'Sub-team lead'],
    section: 'robots',
    types: ['Design', 'Fabrication'],
    summary: 'Team 8081’s 2023 competition robot, designed and built for the FIRST Robotics Competition game CHARGED UP.',
    body: [
      'CHARGED UP was about placing cones and cubes on a scoring grid and balancing on a tilting charge station. I led the build sub-team and did some of the design.',
      'The robot is a six-wheel drive base with an arm that pivots and telescopes out to reach the high rows. The arm is made from 7075-T6 aluminum extrusion with a 1 mm wall, to keep it as light as possible.',
      'Cones were the awkward part of this game, so we came up with our own mechanisms for them. The intake uses a fibreglass stick to flip a cone upright so it can be grabbed. A collapsible hopper rights the cones on its own. The pneumatic gripper holds a cone on contacts that spin freely, so the cone always swings upright in its grip.',
      'This was only the second season the team had competed, after a two-year gap, so we kept the controls simple and ran everything on position control.',
      'We ranked 4th of 28 at the Windsor Essex Great Lakes event, captained the third alliance and won the Quality Award, after winning the Engineering Inspiration Award at Waterloo.',
    ],
    links: [{ label: 'The Blue Alliance', url: 'https://www.thebluealliance.com/team/8081' }, { label: 'GitHub', url: 'https://github.com/frc8081/Mach-10-V3' }] },

  { id: 'ftc-2025', title: 'FTC Robot 2025', year: '2025',
    tags: ['FTC', '19530-UMEI Lightning Robotics', 'Mentor'],
    section: 'robots',
    types: ['Design', 'Fabrication'],
    summary: 'Team 19530’s 2025 competition robot, designed and built for the FIRST Tech Challenge game INTO THE DEEP.',
    body: [
      'INTO THE DEEP had robots collecting samples from a pit, clipping specimens onto bars and climbing at the end of the match. I was a mentor this season.',
      'The team was rebuilding its design experience, so I did a lot of the design myself and taught the students along the way. I also taught them how to assemble the robot and why each part was designed the way it was.',
      'The robot reaches into the pit on linear slides and picks samples up with a roller intake. It has a claw for specimens and a ratcheting winch for the climb.',
      'The linear slides ran on feedforward control with PID correction, and a camera handled image detection. Most of the other mechanisms were driven by servos, to keep the robot simple.',
      'The team placed second at the Mississauga qualifier, won the Design Award and qualified for the Ontario championship.',
    ],
    links: [{ label: 'The Orange Alliance', url: 'https://theorangealliance.org/teams/19530' }, { label: 'GitHub', url: 'https://github.com/Benrecker/FTC2025PinkViper' }] },

  { id: 'ftc-2024', title: 'FTC Robot 2024', year: '2024',
    tags: ['FTC', '19530-UMEI Lightning Robotics', 'Team lead'],
    section: 'robots',
    types: ['Design', 'Fabrication'],
    summary: 'Team 19530’s 2024 competition robot, designed and built for the FIRST Tech Challenge game CENTERSTAGE.',
    body: [
      'CENTERSTAGE was about picking up small hexagonal pixels and placing them on a slanted backdrop, with bonus points for hanging from a bar at the end. I led the team and designed most of the robot, which was almost entirely custom built.',
      'A pivot at the base of the robot tilts a set of slides that extend from 18 inches to over a metre. At the end of the slides, the end effector hangs on its own pivot so that gravity keeps it at the right angle, and a cam system lets it drop its pixels one at a time.',
      'To pick up, the end effector slides back into a homing bay inside the robot. A full-width intake, with G10 disks that help sweep the pixels off the floor, feeds them straight into it. Dead shafts let one motor drive every intake shaft, even though the shafts sit in different parts of the robot and some of them move.',
      'The slides, main pivot and drive base ran on feedforward control with light PID correction, and a camera handled object detection.',
      'We reached the finals at both of our qualifying tournaments, won the Kingston one in an alliance with the other UMEI team, and went on to place second at the Ontario championship.',
    ],
    links: [{ label: 'The Orange Alliance', url: 'https://theorangealliance.org/teams/19530' }, { label: 'GitHub', url: 'https://github.com/Benrecker/ftc-19530' }] },

  { id: 'cornerstone-robot', title: 'Cornerstone Robot', year: '2025',
    tags: ['Robotics', 'Class project'],
    section: 'school',
    featured: 2,
    types: ['Design', 'Software', 'Hardware'],
    summary: '1st place autonomous Arduino car for my first-year Cornerstone design competition.',
    body: [
      'In first year, teams of four had to turn an Arduino robot car into an automated fertilizer spreader: tow a trailer around a course with no outside control, find the zones that need fertilizer and drop it only there. Pom-poms stood in for the fertilizer.',
      'The challenge required the pom-poms to be dropped one at a time, and that was where the other teams struggled. Our trailer uses one small servo to turn a camshaft with three cams set 30 degrees apart. The cams trip six spring-loaded launchers one after another, so each pom-pom is released on its own and the car never has to slow down: it could drop them while driving at full speed. A five-point hitch lets the trailer follow the car through 90 degree turns without jackknifing. The parts are 3D printed in PLA with TPU wheels, and the whole trailer cost under $40 on top of the car kit.',
      'The course was set up for line following with infrared sensors, and we used it for our first two attempts as a safety net. Those runs took about 25 seconds each and already had us in first place by a wide margin. Ultrasonic sensors handle obstacles, and it is all coded in C++ on the Arduino.',
      'For the last attempt we bypassed line following completely. The car reads its heading from an IMU and runs a PD control loop on it: the proportional term steers it back toward the heading it wants, and the derivative term damps the correction so it does not overshoot. Driving from heading alone instead of chasing a line, that run finished in 17.6 seconds and beat every other team by a long way, including our own first two.',
      'We finished first of 80 teams. I led the team.',
    ],
    license: '© 2025 Aidan Brown and teammates. All rights reserved.',
    links: [{ label: 'GitHub', url: 'https://github.com/Benrecker/RAMB-TECH-TOP-SECRCT-CODE.git' }] },

  { id: 'trebuchet', title: 'Trebuchet', year: '2026',
    tags: ['Class project', 'C++'],
    section: 'school',
    types: ['Design', 'Software', 'Fabrication'],
    summary: '1st place trebuchet for my second-year design class.',
    body: [
      'For my second-year design class, teams of three had to build a trebuchet that throws a 24 g squash ball as far as possible. The rules were tight: wood, glue and cotton string only, a frame no taller than 1.0 m, a machine under 1.3 kg, and gravity as the only power, from up to three unopened pop cans as the counterweight.',
      'We chose a whipper design because it puts more of the falling weight into ball speed, knowing it would be harder to build and much harder to predict. We modelled it in Inventor, used FEA to decide where lightening holes could go to get under the weight limit, and built it from poplar with dovetail joints and a steam-bent counterweight arm. Alongside the CAD we wrote a simulation in C++ that solves the three moving parts (main arm, counterweight arm and sling) with Lagrangian mechanics, so we could predict the throw before cutting any wood.',
      'Testing found problems the model did not: the frame tipped forward, the sling tangled, the counterweight arm hit the ground, and the throwing arm snapped on a dry fire. We had finished more than a month before the competition, so there was time to fix each one.',
      'It won, 1st of 30 teams, with a 115 ft throw. Our first simulation had predicted more than twice that, so after the competition I rebuilt it, checked it against slow-motion video of the real launch and added what it was missing: air drag, friction that grows with the load on the pins, and the real resting angle of the counterweight arm. With two inputs tuned, the new model lands on the measured 115 ft, and you can run it on this page.',
    ],
    license: '© 2026 Aidan Brown and teammates. All rights reserved.',
    links: [{ label: 'GitHub', url: 'https://github.com/UWinAidan/Design_II_Group6.git' }],
    sim: 'trebuchet',
    simText: 'A physics model of the launch, built from the CAD and checked against slow-motion video. Move the sliders to see how the throw changes.' },

  { id: 'home-server', title: 'Home Server Build', year: '2026',
    tags: ['Personal project'],
    section: 'software',
    types: ['Hardware', 'Software', 'Networking'],
    summary: 'A home server I built for my family: file storage, photo backup and media streaming, reachable from anywhere.',
    body: [
      'I wanted one place at home for my family to keep files and photos, back them up automatically and stream our own media, without depending on paid cloud accounts.',
      'The server is a Lenovo ThinkCentre M920q mini PC with 24 GB of RAM running TrueNAS SCALE. It hosts Nextcloud for files, Immich for photos (our phones back up to it on their own) and Jellyfin for movies on the TV. Everyone has their own account and storage limit, and the shared folder is copied to Backblaze B2 every day. I rebuilt the home network at the same time around a UniFi gateway, three access points and a Cisco PoE switch, with intrusion prevention and ad blocking turned on.',
      'The hardest part was remote access. Our internet provider uses carrier-grade NAT, so port forwarding and a normal VPN were not possible. I solved it two ways: a Cloudflare Tunnel puts the web apps on my own domain, and Tailscale gives our own devices private access to the file shares.',
      'Storage is a single drive for now, with the cloud backup protecting the most important files. I chose that trade-off knowingly. Next is a mirrored pair of hard drives for important data, a separate drive for media and a Pi-hole for network-wide ad blocking.',
    ],
    links: [] },

  { id: 'strain-wave-reducer', title: 'Strain Wave Reducer', year: '2026',
    tags: ['Gearbox', 'Class project'],
    section: 'school',
    types: ['Design'],
    summary: 'A strain wave (harmonic) reducer designed for a class project, with plans to manufacture it.',
    body: [
      'A strain wave (harmonic) reducer gets a large gear reduction with almost no backlash from three parts: an elliptical wave generator, a thin flexible gear called the flex spline, and a rigid ring gear called the circular spline. That is why they are used in robot joints. For a reverse-engineering project in my second-year design class, our team of three studied how commercial ones work and then designed our own.',
      'Most designs hold the ring still and take the output from the flex spline. We did the opposite: the flex spline is fixed and the ring turns around it, carried by a cross roller bearing built into the housing. That bearing takes the side and tilting loads, so the thin flex spline only ever sees torque. The teeth use a concave-convex profile instead of a normal involute, so they can pass each other as the flex spline walks around the ring.',
      'The flex spline is the hard part: it has to bend into an ellipse on every turn and spring back every time. Our FEA showed it needs about 0.5 mm of radial deflection for the teeth to fully engage, which puts 1,545 MPa into the wall. In heat-treated 4340 steel that is under the 1,861 MPa yield strength, so it stays elastic.',
      'We also made manufacturing drawings for the three main parts and worked out how each would be made: hobbing, turning and grinding, plus eccentric turning for the wave generator. The next step is to build one.',
    ],
    license: '© 2026 Aidan Brown and teammates. All rights reserved.',
    links: [{ label: 'GitHub', url: 'https://github.com/UWinAidan/Design_II_Group6.git' }] },

  { id: 'cycloidal-gearbox', title: 'Cycloidal Gearbox', year: '2025-2026',
    tags: ['Gearbox', 'Personal project'],
    section: 'personal',
    types: ['Design'],
    summary: 'Two generations of cycloidal gearbox, designed for the 6-axis robot and FRC robots.',
    body: [
      'A cycloidal gearbox gets a large reduction out of a small, flat package, which makes it a good fit for robot joints. I have designed two so far. Both come from one parametric CAD model I built: the lobe count, eccentricity, roller size and diameter are all driven from an Excel sheet, so changing a few numbers gives a new gearbox.',
      'The first version was 40:1. It used a planetary first stage that turned three cam wobblers, which drove the cycloid discs together. It worked, but it was much too hard to backdrive.',
      'The second version went back to a more traditional layout with a single cam wobbler on the input shaft. Each disc has 19 lobes running in a 20-lobe housing, which makes it 19:1. The first version also did not contain its loads well, so a big focus of the second was giving every load a proper bearing surface, including a thrust bearing for the axial load.',
    ],
    links: [] },

  { id: 'inventor-addins', title: 'Inventor Add-ins', year: '2026-present',
    tags: ['Autodesk Inventor', 'Personal project'],
    section: 'software',
    types: ['Software'],
    status: 'In progress',
    summary: 'Add-ins I wrote for Autodesk Inventor that automate the repetitive parts of my CAD workflow.',
    body: [
      'A lot of CAD time goes to things that are not design: numbering parts, filling in properties and setting up drawings. I write my own add-ins for Autodesk Inventor to take those jobs off my hands, and I add to them whenever I find another task worth automating.',
      'The main one automates part creation. When I start a new file it assigns the part number, the part type (purchased, manufactured and so on) and the file type (sheet metal, part or assembly), so every file starts out numbered and filled in the same way.',
      'Around that are a set of part and drawing templates, custom material and finish libraries with tools to apply them, and drawing tools such as a hole wizard.',
    ],
    links: [] },

  { id: 'website', title: 'This Website', year: '2026',
    tags: ['Personal project'],
    section: 'software',
    cover: '03-designs.jpg',
    types: ['Software'],
    summary: 'The site you are on, built from scratch in plain HTML, CSS and JavaScript, with a 3D model viewer and a trebuchet simulator.',
    body: [
      'I wanted one place to show my work properly, including CAD models people can spin around, and I wanted to learn web development along the way. So I built this site from scratch in plain HTML, CSS and JavaScript, with no website builder or framework.',
      'The Designs page is a 3D viewer built on three.js. Models are exported from Inventor, compressed so they load quickly, and can be switched between configurations where a design has them. The trebuchet page runs a physics simulation of the launch right in the browser, the Travels map is drawn with D3, and the resume and about pages are generated from Word documents, so updating them only takes saving a new file.',
      'The site runs on Cloudflare and deploys itself every time I push to GitHub. A small Worker handles the contact form and serves the CAD downloads from separate storage, and a build step makes small copies of the photos and models so pages load fast.',
      'I wrote the simpler pages myself to learn, and worked with an AI assistant (Claude) on the more complex parts such as the 3D viewer.',
    ],
    links: [] },

  { id: 'canoe', title: 'Canoe Build', year: '2025',
    tags: ['Woodworking', 'Personal project'],
    section: 'workshop',
    coverFocus: '50% 78%',   // portrait photo: keep the canoe in the card
    types: ['Fabrication'],
    summary: 'A 16 ft Prospector cedar strip canoe I built with my dad.',
    body: [
      'My dad built a cedar strip canoe the year I was born. Over one summer we built a second one together in our woodshop, a 16 ft Prospector, so now we each have one for interior camping trips. It took about three months.',
      'The hull is made of cedar strips a quarter inch thick, one inch wide and 17 ft long: a foot longer than the canoe, because they follow the curve of the hull. We cut every strip ourselves from 1 in by 12 in boards and added the bead and cove edges that let the strips nest together. The stems are steam-bent white walnut, and the whole hull is fibreglassed and varnished.',
      'The rails and decks are walnut. We cut the decks on a CNC router, with inukshuk inlays in oak. The seats were made by an Indigenous craftsman in Algonquin Park, laced with deer gut and sealed with shellac.',
      'Sanding took the longest, but the hardest part was the football, the centre of the bottom of the hull. We chose a complex pattern for it, and it took a lot of planning to get every strip to fit.',
      'It has been on many trips in Algonquin Park since.',
    ],
    links: [] },

  { id: 'printer-workbench', title: '3D Printer Workbench', year: '2026',
    tags: ['Woodworking', '3D printing', 'Personal project'],
    section: 'workshop',
    types: ['Design', 'Fabrication'],
    summary: 'A custom workbench built to house, power and organize my 3D printers.',
    body: [
      'I built this workbench to give my 3D printing setup a permanent home. It holds my Bambu Lab X1C and two AMS 2 Pro units, along with my soldering station, and I plan to add more printers to it in the future.',
      'The base is steel tubing with a 1/8 in wall, which I MIG welded and painted. The top is made from walnut slabs that I varnished.',
    ],
    links: [] },

  { id: 'desk-build', title: 'Desk Build', year: '2024',
    tags: ['Woodworking', 'Personal project'],
    section: 'workshop',
    types: ['Fabrication'],
    summary: 'A solid walnut desk, built from scratch and hand-finished with tung oil.',
    body: [
      'I built this desk in the summer of 2024 because I wanted one made a certain way, with more leg clearance than usual. The top is solid walnut, 28 in deep and about 5.5 ft long, and it sits on purchased legs made from 1/16 in steel, with about 32 in of leg clearance.',
      'It started out with a riser for my monitor. I replaced that with a 5-DOF VESA mount with two arms: one holds the monitor, and the other holds a custom stand I built for my laptop and docking station. A raceway underneath keeps the cables tidy for a clean look.',
      'I refinished it in the summer of 2026.',
    ],
    links: [] },

  { id: 'rocket', title: 'High School Rocket', year: '2024',
    tags: ['Rocketry', 'High school'],
    section: 'school',
    types: ['Design', 'Fabrication'],
    summary: 'My grade 12 physics project: a rocket that reached an apogee of just over 1 km.',
    body: [
      'This rocket was my final project for grade 12 physics. I designed and built it on my own over the winter of 2023 and launched it in the spring of 2024.',
      'I modelled it in Inventor and simulated the flight in OpenRocket. The body is a thin-walled cardboard tube of the kind common in hobby rocketry, about 2 in across and 28 in long, with a wall of about 1 mm to keep the weight down. The nose cone is a purchased injection-moulded part, the fins are 3D printed, and the motor is an Aerotech G80-13T.',
      'I added lead shot to the nose cone to put the centre of gravity and the centre of pressure in the right places for a stable flight, and sewed my own nylon parachute for the recovery.',
      'A Jolly Logic AltimeterTwo that I modified recorded the flight. The rocket reached an apogee of just over 1 km, and the parachute brought it down in one piece.',
    ],
    links: [] },

  { id: 'sauna', title: 'Sauna', year: '2025-2026',
    tags: ['Woodworking', 'Personal project'],
    section: 'workshop',
    types: ['Fabrication'],
    summary: 'A custom sauna built in my backyard.',
    body: [
      'My dad and I built this sauna in our backyard over the fall of 2025 and the winter that followed. We framed it like a house.',
      'The interior is fully cedar. The outside is mostly pine, with a steel roof and some steel siding, a full glass front and a burnt wood arch at the entrance. We added custom lighting inside and out.',
      'To make it efficient we insulated it and lined it with an aluminum vapour barrier. The heat comes from a HUUM electric heater.',
      'Most recently I added a cedar strip floor.',
    ],
    links: [] },

  // ----- Centerline Windsor (only once I have permission) -----
  // { id: 'centerline-project', title: 'Project name', year: '2025',
  //   tags: ['Co-op', 'Centerline Windsor'],
  //   section: 'personal',
  //   types: ['Design'],
  //   summary: 'Short description.',
  //   body: ['A few sentences - no confidential details.'],
  //   links: [] },
];

// The "kind of work" chips for a project (types: above)
function projectTypes(p) {
  const row = document.createElement('p');
  row.className = 'work-types';
  (p.types || []).forEach((type) => {
    const chip = document.createElement('span');
    chip.textContent = type;
    row.appendChild(chip);
  });
  return row;
}

// The card text for a project
function projectSummary(p) {
  return p.summary || 'Description coming soon.';
}

// The year for a rights line: "2024-present" -> "2024-2026", blank -> this year
function rightsYear(year) {
  const now = new Date().getFullYear();
  return String(year || now).replace(/present/i, now).replace(/^(\d{4})-\1$/, '$1');   // (and "2026-2026" -> "2026")
}

// Who owns a project: its own license: line, else the team named on its 3D model, else Aidan.
// Returns { text, mine } - mine is true when it is the standard "© <year> Aidan Brown" line.
function projectRights(p) {
  const team = typeof DESIGNS !== 'undefined' && DESIGNS.find((d) => d.project === p.id && d.license)?.license;
  if (p.license) return { text: p.license, mine: false };
  if (team) return { text: `Design ${team}`, mine: false };
  return { text: `© ${rightsYear(p.year)} Aidan Brown. All rights reserved.`, mine: true };
}
