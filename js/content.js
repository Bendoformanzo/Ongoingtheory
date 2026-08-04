/* ==========================================================================
   ONGOING THEORY — CONTENT
   --------------------------------------------------------------------------
   The only file you need to edit to change copy or move hotspots.

   Each hotspot:
     id      unique string
     x, y    centre of the hit area, as a % of the IMAGE (not the screen)
     w, h    size of the hit area, as a % of the image
     align   where the card opens: "left" | "right" | "auto"
     vAlign  "up" | "down" | "auto"
     title   heading
     body    the paragraph shown on the card. Keep it to one paragraph.
     long    optional array of paragraphs. If present the card gets a "Read
             more" button that opens the full text in the reading window —
             this is how the long pieces stay readable without turning the
             hover card into an essay.
     links   optional [{ label, href }] — buttons, on the card if there is no
             `long`, otherwise at the foot of the reading window.

   TUNING THE HOTSPOTS
   Load the page and press  D  to enter tuning mode. Hit areas become visible
   and clicking anywhere copies that point's coordinates to your clipboard.
   ========================================================================== */

const EMAIL = 'ben@ongoingtheory.com';
const PHONE_DISPLAY = '+64 27 424 9863';
const PHONE_LINK    = '+6427424 9863';

const HOTSPOTS = [
  {
    // the tumbler on the desk
    id: 'whisky',
    x: 31.7, y: 62.2, w: 2.4, h: 4.4,
    align: 'right', vAlign: 'up',
    title: 'Have a drink with me',
    body: "The best way to start a project is to start a relationship. Let's grab a drink. Whisky, coffee, matcha, mezcal, I'm flexible. We'll soon learn if we're meant for each other.",
    links: [{ label: 'Say hello', href: `mailto:${EMAIL}?subject=Let%27s%20grab%20a%20drink` }]
  },

  {
    // the telephone
    id: 'phone',
    x: 39.0, y: 57.4, w: 4.3, h: 3.8,
    align: 'right', vAlign: 'up',
    title: 'Call me',
    body: "It's nice to talk to a real human.",
    links: [
      { label: PHONE_DISPLAY, href: 'tel:' + PHONE_LINK.replace(/\s/g, '') },
      { label: EMAIL, href: `mailto:${EMAIL}` }
    ]
  },

  {
    /* NOTE: this duplicates the two framed photographs on the right-hand wall,
       which carry the same two products. Delete whichever you don't want. */
    id: 'typewriter',
    x: 30.5, y: 57.6, w: 7.0, h: 2.8,
    align: 'right', vAlign: 'down',
    title: 'Currently working on',
    // an array renders as separate lines, typed straight through
    body: [
      'Exploring the frontiers of artificial intelligence and how we can leverage it to create clarity for brands and individuals. This is manifesting in two projects:',
      // domains live on the buttons below, not in the sentence
      'Kader: Brand and Growth Architecture',
      'Career Canvas: Career Planning and Positioning'
    ],
    links: [
      { label: 'kader.nz', href: 'https://www.kader.nz' },
      { label: 'mycareercanvas.app', href: 'https://www.mycareercanvas.app' }
    ]
  },

  {
    // the executive chair behind the desk
    id: 'desk-chair',
    x: 20.7, y: 56.5, w: 7.0, h: 15,
    align: 'right', vAlign: 'down',
    title: 'Ben Forman',
    body: "I've spent my career exploring the intersection of creativity, technology, and culture — helping build global brands, launch integrated campaigns and scale companies from tech to wellness to everything in between. I've always been drawn to the edge of what's possible.",
    long: [
      "I've spent my career exploring the intersection of creativity, technology, and culture — helping build global brands, launch integrated campaigns and scale companies from tech to wellness to everything in between. I've always been drawn to the edge of what's possible.",
      "I've run successful election campaigns, invested in startups, founded startups, raised money, made money, lost money, and learned a hell of a lot in between. I've served on the board of TVNZ, been named a Forbes 30 Under 30, and continue to advise and invest in ventures that spark my curiosity.",
      'Founded on fifteen years across creative agencies, startups, boards, and the conversations where decisions get made.'
    ],
    links: [{ label: 'LinkedIn', href: 'https://www.linkedin.com/in/benjamin-forman/' }]
  },

  {
    // the guest chair, facing the desk
    id: 'guest-chair',
    x: 52.0, y: 62.5, w: 11, h: 18,
    align: 'right', vAlign: 'up',
    title: 'Working together',
    body: 'I partner with businesses as a fractional brand and growth architect. I also coach leaders looking to improve their professional lives through a holistic lens.',
    links: [{ label: 'Get in touch', href: `mailto:${EMAIL}?subject=Working%20together` }]
  },

  {
    // the leather couch
    id: 'couch',
    x: 83.0, y: 66.0, w: 20, h: 17,
    align: 'left', vAlign: 'up',
    title: 'Ongoing Theory',
    body: 'Ongoing Theory partners with founders and senior decision-makers to put brand and story to work as growth infrastructure. Strategic, creative and systematised.',
    long: [
      'Ongoing Theory partners with founders and senior decision-makers to put brand and story to work as growth infrastructure. Strategic, creative and systematised.',
      "Brand is often treated as the icing. The layer added after the cake is built. That's a mistake. The story a business tells about itself is structural. It decides which products people remember, which teams attract talent, which companies endure.",
      "This work asks for two instincts rarely found in the same person. The creative, sharp enough to make people care. The commercial, sharp enough to know what's actually moving the business. I'm both. A business owner and founder who tells stories. A creative who has built companies.",
      'Brand and story that compound value over time.'
    ]
  },

  {
    // the large framed photograph on the left wall
    id: 'interests',
    x: 6.1, y: 34.0, w: 6.5, h: 32,
    align: 'right', vAlign: 'down',
    title: 'Interests',
    body: "I pull my creative inspiration from a wide range of places and spaces — from the desert of Nevada watching the man burn, to sitting in silence in the mountains of Queenstown on retreat, to working in the rooms of Silicon Valley's leading brands, to joining think tanks aiming to grow NZ's GDP. It's my curiosity that gives me an edge not many can offer."
  },

  {
    // the books and objects standing on the credenza
    id: 'books',
    x: 12.75, y: 54.9, w: 4.7, h: 8.4,
    align: 'right', vAlign: 'down',
    title: 'Current musings',
    body: 'As technology accelerates beyond our ability to absorb it, and world-class tools become available to everyone, competitive advantage shifts back to what only humans can bring. Story. Culture. Taste.',
    long: [
      'As technology accelerates beyond our ability to absorb it, and world-class tools become available to everyone, competitive advantage shifts back to what only humans can bring. Story. Culture. Taste.',
      "Our entire world is built on story, it's quite possibly the most interesting facet of human existence. I'm sure even cavemen had certain swag that others were envious of. However for most of human existence knowledge has controlled power, so what happens when knowledge is not only accessible, but deployable? We reach a tipping point, and what was competitive advantage only yesterday is now obsolete. When anyone can do what you're doing what separates you? The story you tell. The brand you create. The culture you cultivate. As strange as it may seem, we're going back to basics.",
      'So what do we create? Where do we focus this superpower? What worked yesterday no longer builds the next chapter. To use the technology now in everyone’s hands, we have to think creatively about where it earns its place in the work, and where it does not. We need to be decisive and intentional. Solving precise problems in precise ways.',
      "The good news is that being a human hasn't changed. We are still driven by the same emotional levers that we always have been. From cave swag to Patagonia, it's the same chemistry set driving our behaviour.",
      'The work, then, lives at the intersection. Using creativity to build brands that people trust and believe in. Telling stories that connect in deeply human ways. Evolving with technology and allowing it to unlock unseen potential as it emerges. Building cultures that sustain community, engagement, trust, loyalty and all of the good things that see your business grow from an idea into the fabric of our society.',
      "That's all well and good, and any exec team or CEO will nod along, but who is actually willing to take this up? Who is brave enough to truly throw out the rule book and venture bravely into the complete unknown? Who is willing to fail spectacularly in the pursuit of creating something entirely new? Who wants to contribute to culture rather than simply consuming it. You can use AI as a jetpack to your own human creativity, or you can let it absorb you into a regurgitated mediocrity. Who will be the bold ones?",
      "That's the Ongoing Theory."
    ]
  },

  {
    // the credenza / sideboard along the left wall
    id: 'cupboard',
    x: 7.0, y: 63.0, w: 12, h: 5.5,
    align: 'right', vAlign: 'down',
    title: 'Back catalogue',
    body: 'Ongoing Theory draws on my career operating where brand meets business. Former founder of Wrestler, a leading creative agency sold in 2025. Pioneering work across film, drones, virtual reality, wellness, and Web3, with backing from Blackbird, Icehouse, and the former COO of Disney along the way.',
    long: [
      'Ongoing Theory draws on my career operating where brand meets business. Former founder of Wrestler, a leading creative agency sold in 2025. Pioneering work across film, drones, virtual reality, wellness, and Web3, with backing from Blackbird, Icehouse, and the former COO of Disney along the way.',
      'Brands worked on now part of the global vocabulary include Allbirds, Halter, Niantic, Hyatt Hotels, Education NZ, and the New Zealand Police. Election campaigns won. Startups advised, invested in, and built from scratch.',
      'Forbes 30 Under 30',
      'Deloitte Fast 50 & Fast 500 Asia Pacific',
      'Board Member, TVNZ',
      'Advisor, Growth NZ',
      'BEST Awards, Finalist',
      'Host, The Gathering'
    ]
  },

  {
    // the Sky Tower, out the window
    id: 'skytower',
    x: 58.9, y: 25.0, w: 4, h: 18,
    align: 'right', vAlign: 'down',
    title: 'Auckland, NZ',
    body: 'I am based in Auckland but work internationally, in person and online.'
  },

  {
    // right-hand wall, the frame nearest the window
    id: 'photo-kader',
    x: 87.4, y: 36.0, w: 4.5, h: 28,
    align: 'left', vAlign: 'down',
    title: 'Kader',
    body: 'Brand and growth architecture.',
    links: [{ label: 'kader.nz', href: 'https://www.kader.nz' }]
  },

  {
    // right-hand wall, the far frame
    id: 'photo-career',
    x: 95.5, y: 35.0, w: 6.5, h: 28,
    align: 'left', vAlign: 'down',
    title: 'Career Canvas',
    body: 'Career planning and positioning.',
    links: [{ label: 'mycareercanvas.app', href: 'https://www.mycareercanvas.app' }]
  },

  {
    // the glass dish on the coffee table. No title — the line is the whole joke.
    id: 'ashtray',
    x: 86.2, y: 77.3, w: 4.4, h: 4.5,
    align: 'left', vAlign: 'up',
    body: "You shouldn't smoke. It's bad for you. This is actually an incense holder, I swear."
  }
];

/* --------------------------------------------------------------------------
   TWINKLE REGIONS
   Areas of the image scanned for city lights, as % of the image.
   -------------------------------------------------------------------------- */
const LIGHT_REGIONS = [
  // The skyline. Top edge sits under the cloud line — bright cloud otherwise
  // reads as a row of lights strung across the sky.
  { x: 22, y: 34, w: 49, h: 23 },

  // The harbour, kept to the right of the guest chair so the furniture in the
  // foreground is never scanned.
  { x: 57, y: 57, w: 14, h: 8 }
];

/* Anything inside these boxes is skipped, even within a region above. For
   bright things in the room that sit in front of the window. */
const LIGHT_EXCLUDE = [
  { x: 29.5, y: 43, w: 10, h: 12 }   // the desk lamp
];

/* The page is deliberately bare — no wordmark, no nav, no tagline. */
const SITE = {
  hint: 'Look around the room',
  hintTouch: 'Drag, or tap the arrows',
  email: EMAIL,

  /* Where the view sits when the room is too wide for the window — a fraction
     across the image. 0.5 would be the middle of the room; 0.27 opens on the
     desk, with the framed photograph just in frame on the left and the
     telephone on the right. */
  startView: 0.27
};
