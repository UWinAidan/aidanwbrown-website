// ---------- Travels: my places ----------
// status: 'been'  -> solid pin; hover shows a photo, click opens its gallery page
//         'want'  -> hollow pin; hover shows "why"
// Coordinates: in Google Maps, right-click a spot and click the numbers to copy them.
// Photos: put them in images/travels/<id>/ (the folder name must match the id).
//         The first photo (alphabetically) is used on hover. Name it 01-something.jpg to choose.

// "42.05° N, 82.60° W" - used by the map card (js/travels.js) and the place page (js/place.js)
const coords = (lat, lon) =>
  `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? 'E' : 'W'}`;

const PLACES = [
  // ----- Been -----
  { id: 'leamington', name: 'Leamington', region: 'Ontario, Canada',
    lat: 42.0534, lon: -82.5998, status: 'been',
    blurb: 'Where I grew up' },

  { id: 'erieau', name: 'Erieau', region: 'Ontario, Canada',
    lat: 42.2606, lon: -81.9095, status: 'been',
    blurb: 'The best winging spot on Lake Erie' },

  { id: 'blue-mountain', name: 'Blue Mountain', region: 'Ontario, Canada',
    lat: 44.5017, lon: -80.3161, status: 'been',
    blurb: 'Yearly snowboarding trips' },

  { id: 'mount-st-louis', name: 'Mount St. Louis Moonstone', region: 'Ontario, Canada',
    lat: 44.6211, lon: -79.6556, status: 'been',
    blurb: 'Where I learned to snowboard' },

  { id: 'algonquin', name: 'Algonquin Park', region: 'Ontario, Canada',
    lat: 45.5837, lon: -78.3584, status: 'been',
    blurb: 'My favourite place' },

  { id: 'winnipeg', name: 'Winnipeg', region: 'Manitoba, Canada',
    lat: 49.8951, lon: -97.1384, status: 'been',
    blurb: 'School trip 2024' },

  { id: 'florida', name: 'Florida', region: 'United States',
    lat: 27.9944, lon: -81.7603, status: 'been',
    blurb: 'Sunshine and beaches!' },

  { id: 'cayman-islands', name: 'Cayman Islands', region: 'Caribbean',
    lat: 19.3133, lon: -81.2546, status: 'been',
    blurb: 'Crystal clear waters and coral reefs!' },

  { id: 'quebec', name: 'Quebec', region: 'Canada',
    lat: 46.8182, lon: -71.2749, status: 'been',
    blurb: 'Epic whitewater rafting!' },

  // ----- Want to go -----
  { id: 'ireland', name: 'Ireland', region: 'Europe',
    lat: 53.1424, lon: -7.6921, status: 'want',
    why: 'Where my mom grew up' },

  { id: 'iceland', name: 'Iceland', region: 'Europe',
    lat: 64.9631, lon: -19.0208, status: 'want',
    why: 'Walter Mitty vibes' },

  { id: 'swiss-alps', name: 'Swiss Alps', region: 'Switzerland',
    lat: 46.5586, lon: 7.9063, status: 'want',
    why: 'Majestic mountains and alpine lakes' },

  { id: 'germany', name: 'Germany', region: 'Europe',
    lat: 51.1657, lon: 10.4515, status: 'want',
    why: 'Rich history and vibrant cities' },

  { id: 'italy', name: 'Italy', region: 'Europe',
    lat: 41.8719, lon: 12.5674, status: 'want',
    why: 'Beautiful countryside and delicious food' },

  { id: 'banff', name: 'Banff', region: 'Alberta, Canada',
    lat: 51.1784, lon: -115.5708, status: 'want',
    why: 'Mountains! Need I say more?' },

  { id: 'whistler', name: 'Whistler', region: 'British Columbia, Canada',
    lat: 50.1163, lon: -122.9574, status: 'want',
    why: 'Big mountain snowboarding' },

  { id: 'tofino', name: 'Tofino', region: 'British Columbia, Canada',
    lat: 49.153, lon: -125.9066, status: 'want',
    why: 'Coastal town with great surfing and hiking' },

  { id: 'hood-river', name: 'Hood River', region: 'Oregon, United States',
    lat: 45.7054, lon: -121.5215, status: 'want',
    why: "Best winging in North America? I don't know, I haven't been yet!" },

  { id: 'yellowstone', name: 'Yellowstone', region: 'Wyoming, United States',
    lat: 44.428, lon: -110.5885, status: 'want',
    why: 'A national park I would like to visit' },

  { id: 'hawaii', name: 'Hawaii', region: 'United States',
    lat: 20.7984, lon: -156.3319, status: 'want',
    why: 'M2M race? Maybe someday. Volcanoes and surfing!' },

  { id: 'tokyo', name: 'Tokyo', region: 'Japan',
    lat: 35.6762, lon: 139.6503, status: 'want',
    why: 'Amazing culture, food, and technology' },
];
