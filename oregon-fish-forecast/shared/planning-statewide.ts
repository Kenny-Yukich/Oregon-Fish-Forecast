import type { PlanningSource, WaterPlanning } from './planning-types';

// Dates below record source review, not a field inspection or a new observation.
const CHECKED = '2026-10-12';
const reportUrl = (zone: string) => `https://myodfw.com/recreation-report/fishing-report/${zone}-zone`;
const reportSource = (zone: string): PlanningSource => ({ label: `ODFW: ${zone} fishing report`, url: reportUrl(zone) });
const PORTLAND = { label: 'ODFW: Portland fishing access', url: 'https://myodfw.com/articles/50-places-go-fishing-within-60-minutes-portland' };
const NORTHWEST = { label: 'ODFW: Northwest fishing guide', url: 'https://myodfw.com/articles/easy-angling-northwest-zone' };
const WILLAMETTE = { label: 'ODFW: Willamette fishing guide', url: 'https://myodfw.com/articles/easy-angling-willamette-zone' };
const STEELHEAD = { label: 'ODFW: steelhead timing and methods', url: 'https://myodfw.com/articles/how-fish-steelhead' };
const BASS = { label: 'ODFW: bass methods', url: 'https://myodfw.com/articles/all-about-bass' };
const CYANO = { label: 'OHA: current cyanobacteria advisories', url: 'https://www.oregon.gov/oha/ph/HealthyEnvironments/Recreation/HarmfulAlgaeBlooms/Pages/Blue-GreenAlgaeAdvisories.aspx' };
const FISH_HEALTH = { label: 'OHA: fish consumption advisories', url: 'https://www.oregon.gov/oha/ph/HealthyEnvironments/Recreation/FishConsumption/Pages/fishadvisories.aspx' };
const LOWER_WILLAMETTE = { label: 'OHA: Lower Willamette fish advisory', url: 'https://www.oregon.gov/oha/PH/HEALTHYENVIRONMENTS/RECREATION/FISHCONSUMPTION/Pages/Lower-Willamette-Fish-Advisory.aspx' };
const CHINOOK_LANDING = { label: 'Metro: Chinook Landing', url: 'https://www.oregonmetro.gov/places/chinook-landing-marine-park' };
const TOUVELLE = { label: 'State Parks: TouVelle', url: 'https://stateparks.oregon.gov/index.cfm?do=park.profile&parkId=72' };
const CATHEDRAL = { label: 'Portland Parks: permitted fishing locations', url: 'https://www.portland.gov/parks/fishing-portland-parks' };
const CARVER = { label: 'Clackamas County: Carver Park', url: 'https://www.clackamas.us/parks/carver' };
const JACK_MORGAN = { label: 'Lincoln County: Jack Morgan Park and road access', url: 'https://www.co.lincoln.or.us/1065/AW-Jack-Morgan-Park' };
const MONGOLD = { label: 'State Parks: Mongold', url: 'https://stateparks.oregon.gov/index.cfm?do=park.profile&parkId=63' };
const WALLOWA_PARK = { label: 'State Parks: Wallowa Lake', url: 'https://stateparks.oregon.gov/index.cfm?do=park.profile&parkId=20' };
const unverified = (summary = 'Local bloom conditions are unverified. Check current notices; an absent advisory does not establish safety.', url = CYANO.url): WaterPlanning['alerts'][number] => ({
  summary, status: 'unverified', checked_on: null, url,
});
const bassAdvisory = (): WaterPlanning['alerts'][number] => ({
  summary: 'OHA statewide mercury advisory applies to bass. Review species-specific consumption guidance before keeping fish.',
  status: 'advisory', checked_on: CHECKED, url: FISH_HEALTH.url,
});

export const STATEWIDE_PLANNING: WaterPlanning[] = [
  {
    water_id: 'columbia-river-chinook-landing',
    target_species: ['Coho salmon', 'Chinook salmon', 'Steelhead', 'Sturgeon', 'Walleye'],
    access_summary: 'Public launch; accessible docks',
    access_detail: 'Chinook Landing Marine Park in Fairview has six launch lanes, paved parking and restrooms. Metro lists a parking fee. Check ramp operations before towing a boat; a launch is not a verified bank-fishing spot.',
    access_point: { label: 'Chinook Landing Marine Park', map_query: 'Chinook Landing Marine Park 5201 NE 223rd Avenue Fairview Oregon' },
    seasonal_summary: 'Salmon runs vary by season',
    seasonal_detail: 'Spring Chinook and autumn salmon are distinct planning windows. Run timing and in-season decisions matter more than a fixed best-month label; confirm the fishery and reach before choosing a trip.',
    methods: 'ODFW describes trolling flashers and bait or fishing lures from an anchored boat for spring Chinook. This is general technique background, not a current gear or retention authorization.',
    report: {
      summary: 'Troutdale-area checks recorded coho catches and Chinook releases; no lower-river walleye or sturgeon report.',
      reported_on: '2026-10-08', checked_on: CHECKED,
      coverage: 'ODFW Troutdale reporting area, broader than Chinook Landing; catch checks are not measurements at the launch.',
      url: reportUrl('columbia'),
    },
    alerts: [
      { summary: 'OHA consumption guidance applies to lower Columbia sturgeon. Read the advisory before planning to eat a catch; retention permission is separate.', status: 'advisory', checked_on: CHECKED, url: FISH_HEALTH.url },
      unverified(),
    ],
    checked_on: CHECKED,
    sources: [PORTLAND, CHINOOK_LANDING, reportSource('columbia'), { label: 'ODFW: spring Chinook techniques', url: 'https://myodfw.com/articles/columbia-spring-chinook-game' }, FISH_HEALTH, CYANO],
  },
  {
    water_id: 'rogue-river-touvelle',
    target_species: ['Steelhead', 'Chinook salmon', 'Trout'],
    access_summary: 'Park bank access + boat ramp',
    access_detail: 'Use TouVelle State Recreation Site at Table Rock Road. The boat ramp is across the bridge from the main picnic area; both sides have facilities. State Parks identifies swift currents and submerged obstructions. Parking permit required.',
    access_point: { label: 'TouVelle State Recreation Site', map_query: 'TouVelle State Recreation Site Table Rock Road Central Point Oregon' },
    seasonal_summary: 'Winter and summer-run steelhead',
    seasonal_detail: 'Winter and early spring bring winter steelhead; summer-run fish follow later. These are basin-wide patterns, not a TouVelle catch forecast.',
    methods: 'Swing flies or drift nymphs for steelhead, subject to current upper Rogue seasonal gear rules.',
    report: {
      summary: 'Upper Rogue update records steelhead and Chinook activity. Hatchery returns and reservoir-release readings are upstream context, not TouVelle observations.',
      reported_on: '2026-10-06', checked_on: CHECKED,
      coverage: 'Upper Rogue region; no TouVelle-only catch rate, temperature or flow was provided.', url: reportUrl('southwest'),
    },
    alerts: [unverified('TouVelle conditions and temporary park notices are unverified. Recheck park access before traveling.', TOUVELLE.url), unverified('Upper Rogue seasonal gear restrictions need an exact-section review.', reportUrl('southwest'))],
    checked_on: CHECKED,
    sources: [TOUVELLE, { label: 'ODFW: Medford fishing access', url: 'https://myodfw.com/articles/50-places-go-fishing-within-60-minutes-medford' }, STEELHEAD, reportSource('southwest'), CYANO],
  },
  {
    water_id: 'umpqua-river-elkton',
    target_species: ['Smallmouth bass', 'Shad', 'Salmon', 'Steelhead'],
    access_summary: 'Elkton bank access + ramp',
    access_detail: 'ODFW lists a boat ramp and bank fishing at Alfred S. Tyson Park beside the RV park in Elkton. Navigate to the public ramp via River Road. Current ramp usability and shoreline footing have not been inspected.',
    access_point: { label: 'Alfred S. Tyson Park / Elkton Boat Ramp', map_query: 'Alfred S Tyson Park Elkton Boat Ramp River Road Elkton Oregon' },
    seasonal_summary: 'Warmwater bass; seasonal migrants',
    seasonal_detail: 'Smallmouth provide a resident fishery alongside migratory salmon, steelhead and shad. ODFW identifies the lower Umpqua as a bass destination; recent mainstem reporting is useful context but does not establish a bite at Elkton.',
    methods: 'For smallmouth, work small fish or crayfish imitations with spinning tackle: jigs and spinners are ODFW starting points. Seasonal salmon methods and rules require a separate check.',
    report: {
      summary: 'Mainstem bass fishing was fair. Salmon catches described near Reedsport are downstream of this Elkton profile.',
      reported_on: '2026-10-07', checked_on: CHECKED,
      coverage: 'Mainstem Umpqua; the salmon observations are at Reedsport, not Alfred S. Tyson Park.', url: reportUrl('southwest'),
    },
    alerts: [
      { summary: 'Permanent cyanobacteria recreational advisory includes the mainstem past Elkton to Sawyers Rapids. Shoreline bedrock pools can contain harmful blooms.', status: 'advisory', checked_on: CHECKED, url: CYANO.url },
      bassAdvisory(),
    ],
    checked_on: CHECKED,
    sources: [{ label: 'ODFW: Roseburg fishing access', url: 'https://myodfw.com/articles/50-places-go-fishing-within-60-minutes-roseburg' }, { label: 'ODFW: southwest warmwater fishing', url: 'https://myodfw.com/articles/warmwater-fishing-southwest-oregon' }, reportSource('southwest'), CYANO, FISH_HEALTH],
  },
  {
    water_id: 'mckenzie-river-leaburg',
    target_species: ['Rainbow trout', 'Steelhead', 'Chinook salmon'],
    access_summary: 'Launch + limited bank access',
    access_detail: 'Leaburg Landing is on the McKenzie below Leaburg Dam, not Leaburg Lake. ODFW describes a launch, restrooms and some bank access. Check the exact dam, fish-screen and powerhouse boundaries before fishing.',
    access_point: { label: 'Leaburg Landing', map_query: 'Leaburg Landing McKenzie River Oregon' },
    seasonal_summary: 'Trout; summer-run steelhead',
    seasonal_detail: 'ODFW places McKenzie summer steelhead broadly in May-November. Hatchery trout releases provide additional context, without guaranteeing fish at this landing.',
    methods: 'Swing flies or drift an indicator nymph for steelhead. Check seasonal gear restrictions before selecting tackle.',
    report: {
      summary: 'Below-Leaburg trout stocking ended in the week of Sept. 1, per ODFW.',
      reported_on: '2026-09-15', checked_on: CHECKED,
      coverage: 'Below Leaburg Lake; no landing-specific survey or measurement.', url: reportUrl('willamette'),
    },
    alerts: [unverified('Reach access and temporary restrictions are unverified. Dam, fish-screen and powerhouse closures require an exact-boundary rules check.', 'https://myodfw.com/fishing/regulations')],
    checked_on: CHECKED,
    sources: [{ label: 'ODFW: Lane County access guide', url: 'https://myodfw.com/articles/65-places-go-fishing-lane-county' }, STEELHEAD, reportSource('willamette'), { label: 'ODFW: 2026 regulations and reach boundaries', url: 'https://myodfw.com/sites/default/files/2025-11/26_Fish_regs.pdf' }, CYANO],
  },
  {
    water_id: 'willamette-river-cathedral-park',
    target_species: ['Salmon', 'Bass', 'Crappie', 'Sturgeon'],
    access_summary: 'Park bank + designated fishing pier',
    access_detail: 'Portland permits fishing from Cathedral Park riverbank and its upstream fishing/light-watercraft pier. This does not authorize fishing from every dock. The park also has a boat ramp; follow posted uses and parking rules.',
    access_point: { label: 'Cathedral Park', map_query: 'Cathedral Park North Edison Street and Pittsburg Avenue Portland Oregon' },
    seasonal_summary: 'Warmwater fish + salmon runs',
    seasonal_detail: 'Resident bass and panfish offer a different trip from migratory salmon. ODFW identifies this park for both, but no park-specific best-month assessment was found; do not apply the above-Willamette-Falls coho outlook here.',
    methods: 'For bass, ODFW describes jigs and prey-imitating lures around cover. Choose a presentation for the target species and check current lower-river rules; the linked health advisory is essential if keeping resident fish.',
    report: {
      summary: 'No Cathedral Park-specific report found; latest narrative discusses upstream reaches.',
      reported_on: null, checked_on: CHECKED,
      coverage: 'Broader river; no dated St. Johns Bridge observation.', url: reportUrl('willamette'),
    },
    alerts: [
      { summary: 'Lower Willamette fish-consumption advisory applies here. OHA recommends not eating bass, carp or brown bullhead; review guidance for other resident fish.', status: 'advisory', checked_on: CHECKED, url: LOWER_WILLAMETTE.url },
      unverified(),
    ],
    checked_on: CHECKED,
    sources: [PORTLAND, CATHEDRAL, BASS, reportSource('willamette'), LOWER_WILLAMETTE, CYANO],
  },
  {
    water_id: 'clackamas-river-barton-carver',
    target_species: ['Coho salmon', 'Steelhead', 'Chinook salmon', 'Trout'],
    access_summary: 'Two parks with banks + ramps',
    access_detail: 'Barton and Carver parks are public access anchors for this reach. Barton has bank access, a ramp and restrooms; Carver has a ramp near Clear Creek. A mapped park pair does not establish a safe float route or continuous public shoreline.',
    access_point: { label: 'Carver Park boat ramp', map_query: 'Carver Park boat ramp Clackamas Oregon' },
    seasonal_summary: 'Fall coho; winter steelhead',
    seasonal_detail: 'ODFW identifies winter steelhead peaks around January and March, alongside summer-run fish. Autumn coho provide a separate target.',
    methods: 'ODFW describes spinners, jigs, plugs and float presentations for coho; check gear rules.',
    report: {
      summary: 'ODFW described good lower-river coho fishing.',
      reported_on: '2026-09-24', checked_on: CHECKED,
      coverage: 'Lower Clackamas; no Barton-to-Carver survey.', url: reportUrl('willamette'),
    },
    alerts: [unverified('Temporary park closures and river obstructions remain unverified; check notices before a float or bank trip.', CARVER.url), unverified()],
    checked_on: CHECKED,
    sources: [PORTLAND, CARVER, STEELHEAD, reportSource('willamette'), CYANO],
  },
  {
    water_id: 'sandy-river-lewis-clark',
    target_species: ['Steelhead', 'Salmon'],
    access_summary: 'Lower-river bank access + ramp',
    access_detail: 'ODFW identifies Lewis and Clark State Recreation Site for access toward the Sandy mouth, with a ramp, picnic area and restrooms. Stay within posted public access; current ramp usability and wading conditions are unverified.',
    access_point: { label: 'Lewis and Clark State Recreation Site', map_query: 'Lewis and Clark State Recreation Site Sandy River Troutdale Oregon' },
    seasonal_summary: 'Winter steelhead; salmon runs',
    seasonal_detail: 'ODFW identifies winter steelhead mainly December-April and summer-run fish May-August. These river-wide patterns are not opening dates or onsite observations.',
    methods: 'Float a jig or swing a spinner for steelhead, subject to current lower Sandy gear and species rules.',
    report: {
      summary: 'July report described summer-steelhead catches below the hatchery; no October update.',
      reported_on: '2026-07-27', checked_on: CHECKED,
      coverage: 'Below hatchery; no recent mouth-area observation.', url: reportUrl('willamette'),
    },
    alerts: [unverified()],
    checked_on: CHECKED,
    sources: [PORTLAND, STEELHEAD, reportSource('willamette'), CYANO],
  },
  {
    water_id: 'wilson-river-mills-bridge',
    target_species: ['Steelhead', 'Chinook salmon', 'Cutthroat trout'],
    access_summary: 'Highway 6 bank-access location',
    access_detail: 'ODFW lists bank access at Mills Bridge on Highway 6. Current parking, footing and neighboring land permissions are unverified.',
    access_point: { label: 'Mills Bridge, Wilson River', map_query: 'Mills Bridge Wilson River Highway 6 Tillamook Oregon' },
    seasonal_summary: 'Steelhead; spring/fall cutthroat',
    seasonal_detail: 'Steelhead runs overlap; ODFW highlights spring/fall resident cutthroat and summer sea-run fish.',
    methods: 'Work steelhead pools with spinners or floats; small spinners or flies suit cutthroat. Confirm seasonal gear rules.',
    report: {
      summary: 'ODFW describes fall steelhead opportunity, with more fish upriver; Chinook remained concentrated nearer tidewater.',
      reported_on: '2026-09-30', checked_on: CHECKED,
      coverage: 'Wilson River overall; not a Mills Bridge catch or conditions survey.', url: reportUrl('northwest'),
    },
    alerts: [unverified()],
    checked_on: CHECKED,
    sources: [NORTHWEST, reportSource('northwest'), CYANO],
  },
  {
    water_id: 'north-fork-nehalem-hatchery',
    target_species: ['Winter steelhead'],
    access_summary: 'Hatchery bank access',
    access_detail: 'Hatchery bank access includes a platform for disabled-angling permit holders. Neighboring timberland permissions are unverified.',
    access_point: { label: 'North Nehalem Fish Hatchery', map_query: 'North Nehalem Fish Hatchery Highway 53 Oregon' },
    seasonal_summary: 'Winter peak: December-January',
    seasonal_detail: 'ODFW highlights December-January within a December-April window. This is a popular bank fishery.',
    methods: 'ODFW suggests drift presentations, spinners or a float and jig; check hatchery deadlines and gear restrictions.',
    report: {
      summary: 'Combined Nehalem report focuses on bay salmon and basin cutthroat; no current hatchery-area winter-steelhead assessment.',
      reported_on: '2026-09-30', checked_on: CHECKED,
      coverage: 'Combined Nehalem and North Fork report; bay salmon success is not evidence of fish at this hatchery reach.', url: reportUrl('northwest'),
    },
    alerts: [unverified('Hatchery access notices and local conditions are unverified. Check posted fishing boundaries and accessible-platform permit requirements.', NORTHWEST.url)],
    checked_on: CHECKED,
    sources: [NORTHWEST, reportSource('northwest'), CYANO],
  },
  {
    water_id: 'siletz-river-jack-morgan',
    target_species: ['Steelhead', 'Chinook salmon', 'Cutthroat trout'],
    access_summary: 'Boat ramp; approach via Siletz',
    access_detail: 'Jack Morgan Park at OR-229 mile 17.5 has a concrete ramp, vault toilets and picnic area west of the highway. Lincoln County directs access from the south through Siletz because the highway is blocked farther north.',
    access_point: { label: 'A.W. Jack Morgan Park', map_query: 'A W Jack Morgan Park Siletz Oregon' },
    seasonal_summary: 'Fall salmon depend on rain',
    seasonal_detail: 'Fall rain helps Chinook move upstream from tidewater. Steelhead provide a longer seasonal window; sea-run cutthroat arrive in summer and early fall.',
    methods: 'Spinners or float presentations are established salmon approaches; small spinners or streamers suit cutthroat. Check current section-specific rules.',
    report: {
      summary: 'ODFW reports salmon success in bay/tidewater and slow summer-steelhead fishing; conditions at Jack Morgan were not separately reported.',
      reported_on: '2026-10-06', checked_on: CHECKED,
      coverage: 'Siletz basin, with salmon observations downstream and steelhead discussion mainly upriver.', url: reportUrl('northwest'),
    },
    alerts: [
      { summary: 'OR-229 closed between mileposts 14-15 after a landslide. County says reach Jack Morgan Park from the south through Siletz; no local detour.', status: 'advisory', checked_on: CHECKED, url: JACK_MORGAN.url },
      unverified(),
    ],
    checked_on: CHECKED,
    sources: [JACK_MORGAN, NORTHWEST, reportSource('northwest'), CYANO],
  },
  {
    water_id: 'detroit-lake-mongold',
    target_species: ['Rainbow trout', 'Kokanee'],
    access_summary: 'Mongold launch; check lake level',
    access_detail: 'Mongold Day-use Area has a public ramp, trailer parking, restrooms and picnic facilities. Falling reservoir levels change shoreline access and launch usability; use the current operator notice before towing.',
    access_point: { label: 'Mongold Day-use Area', map_query: 'Mongold Day Use Area Detroit Lake Oregon' },
    seasonal_summary: 'Trout: spring, early summer, fall',
    seasonal_detail: 'Cooler surface water favors rainbow fishing. Kokanee tend to move deeper as summer advances; lake-wide patterns do not establish fish depth at Mongold today.',
    methods: 'Try standard trout presentations from bank or boat. For kokanee, ODFW describes trolling small spinners behind flashers or jigging; depth control matters.',
    report: {
      summary: 'Trout remained active; Mongold was the remaining usable ramp in this dated report.',
      reported_on: '2026-09-28', checked_on: CHECKED,
      coverage: 'Lake-wide fishing; Mongold ramp update, not live level.', url: reportUrl('willamette'),
    },
    alerts: [
      { summary: 'Other ramps were out of water on Sept. 28. Recheck Mongold before towing.', status: 'advisory', checked_on: CHECKED, url: reportUrl('willamette') },
      unverified(),
    ],
    checked_on: CHECKED,
    sources: [MONGOLD, WILLAMETTE, reportSource('willamette'), CYANO],
  },
  {
    water_id: 'henry-hagg-lake',
    target_species: ['Rainbow trout', 'Smallmouth bass', 'Largemouth bass', 'Yellow perch', 'Crappie'],
    access_summary: 'Shoreline, fishing pier + ramps',
    access_detail: 'Scoggins Valley Park provides shore access, two launches, an accessible fishing pier and restrooms. The public C-Ramp recreation area is one named arrival point; check current park hours and ramp notices.',
    access_point: { label: 'Hagg Lake C-Ramp Recreation Area', map_query: 'Henry Hagg Lake C Ramp Recreation Area Gaston Oregon' },
    seasonal_summary: 'Spring trout; warmwater bass',
    seasonal_detail: 'Early-season bank trout and warmer-water bass offer different trips. Bass use shallow arms as water warms; reservoir drawdown changes available cover.',
    methods: 'ODFW suggests spinners for bank trout and soft plastics, grubs or jigs for bass. Work submerged structure and adjust to water level.',
    report: {
      summary: 'ODFW described active fall bass around submerged structure; recheck park conditions.',
      reported_on: '2026-10-05', checked_on: CHECKED,
      coverage: 'Lake-wide; no C-Ramp survey or measured temperature.', url: reportUrl('willamette'),
    },
    alerts: [bassAdvisory(), unverified()],
    checked_on: CHECKED,
    sources: [WILLAMETTE, { label: 'Washington County: C-Ramp location', url: 'https://www.washingtoncountyor.gov/home/news/2024/07/09/washington-county-parks-2024-summer-concert-series' }, reportSource('willamette'), FISH_HEALTH, CYANO],
  },
  {
    water_id: 'wallowa-lake-state-park',
    target_species: ['Rainbow trout', 'Kokanee', 'Lake trout'],
    access_summary: 'South-shore bank + park launch',
    access_detail: 'Wallowa Lake State Park provides south-end shore access, a boat launch, picnic areas and restrooms. Marina rentals and services are seasonal; the park notes service changes from October into May.',
    access_point: { label: 'Wallowa Lake State Park boat launch', map_query: 'Wallowa Lake State Park boat launch Joseph Oregon' },
    seasonal_summary: 'Kokanee: May-early July',
    seasonal_detail: 'Kokanee are generally shallower in May-early July and move deeper later. Stocked rainbows offer a shore option at the south end; spawning fish in the inlet are separate from the lake fishery.',
    methods: 'Cast spinners or fish a float presentation for nearshore rainbows. Troll a small spinner or jig for kokanee, adjusting depth to observed fish rather than assuming a fixed depth.',
    report: {
      summary: 'ODFW described south-end nearshore trout and deeper kokanee, generally below 45 feet; inlet kokanee spawning had begun.',
      reported_on: '2026-09-24', checked_on: CHECKED,
      coverage: 'Lake-wide report with south-end trout guidance; reported kokanee depth is dated angling information, not a live measurement.', url: reportUrl('northeast'),
    },
    alerts: [unverified('Marina services are seasonal; current facilities and temporary closures remain unverified. Check the park before relying on rentals or facilities.', WALLOWA_PARK.url), unverified()],
    checked_on: CHECKED,
    sources: [WALLOWA_PARK, { label: 'ODFW: Northeast fishing guide', url: 'https://myodfw.com/articles/easy-angling-northeast-zone' }, reportSource('northeast'), CYANO],
  },
];
