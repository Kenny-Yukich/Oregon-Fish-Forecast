/**
 * Source-backed water profiles, independent of live measurement stations.
 *
 * This is an editorial selection of well-known Oregon fishing destinations from
 * ODFW guides, not a measured popularity ranking. Each river row names a local
 * section; its species list describes the guide's fishery, not today's catch or
 * an authorization to fish. Profiles deliberately contain no inferred gauge,
 * stocking confirmation, current report, opening status, or numerical forecast.
 *
 * source_checked_on records our review of the linked background sources. It is
 * not the observation date of fish, a site inspection, or a current rules/access
 * verification. Guide amenities must be checked with the operator before a trip.
 */
export interface WaterProfile {
  id: string;
  name: string;
  reach: string;
  kind: 'river' | 'lake' | 'reservoir';
  region: string;
  species: string[];
  description: string;
  access_summary: string;
  source_checked_on: string;
  sources: { label: string; url: string }[];
  group: 'pilot' | 'popular-river' | 'popular-lake';
}

const CHECKED_ON = '2026-10-12';
const BEND_GUIDE = { label: 'ODFW: fishing near Bend', url: 'https://myodfw.com/articles/50-places-go-fishing-within-90-minutes-bend' };
const PORTLAND_GUIDE = { label: 'ODFW: fishing near Portland', url: 'https://myodfw.com/articles/50-places-go-fishing-within-60-minutes-portland' };
const NORTHWEST_GUIDE = { label: 'ODFW: Northwest Zone guide', url: 'https://myodfw.com/articles/easy-angling-northwest-zone' };
const WILLAMETTE_GUIDE = { label: 'ODFW: Willamette Zone guide', url: 'https://myodfw.com/articles/easy-angling-willamette-zone' };

export const WATER_PROFILES: WaterProfile[] = [
  {
    id: 'crooked-river-bowman-dam', name: 'Crooked River', reach: 'Bowman Dam to Castle Rock Campground',
    kind: 'river', region: 'Central Oregon', group: 'pilot',
    species: ['Redband trout', 'Mountain whitefish'],
    description: 'A Central Oregon trout reach downstream of Bowman Dam.',
    access_summary: 'ODFW lists roadside pullouts and BLM campsites. Current access unreviewed.',
    source_checked_on: CHECKED_ON, sources: [BEND_GUIDE],
  },
  {
    id: 'fall-river-above-falls', name: 'Fall River', reach: 'Hatchery area above the falls',
    kind: 'river', region: 'Central Oregon', group: 'pilot',
    species: ['Rainbow trout', 'Brown trout', 'Brook trout'],
    description: 'A clear-water trout stream near Sunriver and the Fall River Hatchery.',
    access_summary: 'ODFW describes hatchery foot-trail access. Current access unreviewed.',
    source_checked_on: CHECKED_ON, sources: [BEND_GUIDE],
  },
  {
    id: 'haystack-reservoir', name: 'Haystack Reservoir', reach: 'West Shore Day Use Area',
    kind: 'reservoir', region: 'Central Oregon', group: 'pilot',
    species: ['Rainbow trout', 'Smallmouth bass', 'Largemouth bass', 'Black crappie'],
    description: 'A small reservoir near Culver with trout and warmwater species.',
    access_summary: 'ODFW identifies West Shore for bank access. Current access unreviewed.',
    source_checked_on: CHECKED_ON, sources: [BEND_GUIDE],
  },
  {
    id: 'lake-billy-chinook-crooked-arm', name: 'Lake Billy Chinook', reach: 'Crooked River arm at Cove Palisades',
    kind: 'reservoir', region: 'Central Oregon', group: 'pilot',
    species: ['Kokanee', 'Rainbow trout', 'Smallmouth bass'],
    description: 'Cove Palisades provides a starting point for this canyon reservoir.',
    access_summary: 'Crooked River Day Use Area is listed by ODFW. Current access unreviewed.',
    source_checked_on: CHECKED_ON,
    sources: [BEND_GUIDE, { label: 'Oregon State Parks: Cove Palisades', url: 'https://stateparks.oregon.gov/index.cfm?do=park.profile&parkId=24' }],
  },
  {
    id: 'columbia-river-chinook-landing', name: 'Columbia River', reach: 'Chinook Landing area, Fairview',
    kind: 'river', region: 'Columbia River', group: 'popular-river',
    species: ['Salmon', 'Steelhead', 'Sturgeon', 'Walleye'],
    description: 'A Portland-area starting point for Columbia River fisheries.',
    access_summary: 'Chinook Landing has public launching facilities. Current access unreviewed.',
    source_checked_on: CHECKED_ON, sources: [PORTLAND_GUIDE],
  },
  {
    id: 'rogue-river-touvelle', name: 'Rogue River', reach: 'TouVelle State Recreation Site area',
    kind: 'river', region: 'Southwest Oregon', group: 'popular-river',
    species: ['Salmon', 'Steelhead', 'Trout'],
    description: 'An upper Rogue fishing area near Central Point and Denman Wildlife Area.',
    access_summary: 'ODFW describes bank access and a boat ramp at TouVelle. Current access unreviewed.',
    source_checked_on: CHECKED_ON,
    sources: [{ label: 'ODFW: fishing near Medford', url: 'https://myodfw.com/articles/50-places-go-fishing-within-60-minutes-medford' }],
  },
  {
    id: 'umpqua-river-elkton', name: 'Umpqua River', reach: 'Mainstem at Alfred S. Tyson Park, Elkton',
    kind: 'river', region: 'Southwest Oregon', group: 'popular-river',
    species: ['Smallmouth bass', 'Shad', 'Salmon', 'Steelhead'],
    description: 'A mainstem Umpqua location with both warmwater fish and migratory salmonids in ODFW’s guide.',
    access_summary: 'ODFW lists bank fishing and the Elkton boat ramp at Alfred S. Tyson Park. Current access unreviewed.',
    source_checked_on: CHECKED_ON,
    sources: [{ label: 'ODFW: fishing near Roseburg', url: 'https://myodfw.com/articles/50-places-go-fishing-within-60-minutes-roseburg' }],
  },
  {
    id: 'mckenzie-river-leaburg', name: 'McKenzie River', reach: 'Leaburg Landing below Leaburg Dam',
    kind: 'river', region: 'Willamette Valley', group: 'popular-river',
    species: ['Trout', 'Salmon', 'Steelhead'],
    description: 'A middle McKenzie access area downstream of Leaburg Dam.',
    access_summary: 'ODFW identifies a boat launch and some bank access at Leaburg Landing. Current access unreviewed.',
    source_checked_on: CHECKED_ON,
    sources: [{ label: 'ODFW: fishing in Lane County', url: 'https://myodfw.com/articles/65-places-go-fishing-lane-county' }],
  },
  {
    id: 'willamette-river-cathedral-park', name: 'Willamette River', reach: 'Cathedral Park at St. Johns Bridge',
    kind: 'river', region: 'Portland area', group: 'popular-river',
    species: ['Salmon', 'Bass', 'Crappie', 'Sturgeon'],
    description: 'A lower Willamette fishing location in Portland.',
    access_summary: 'ODFW lists park bank access and launching facilities. Current access unreviewed.',
    source_checked_on: CHECKED_ON, sources: [PORTLAND_GUIDE],
  },
  {
    id: 'clackamas-river-barton-carver', name: 'Clackamas River', reach: 'Barton Park to Carver Park',
    kind: 'river', region: 'Portland area', group: 'popular-river',
    species: ['Salmon', 'Steelhead', 'Trout'],
    description: 'A lower-river section served by two county parks.',
    access_summary: 'ODFW lists bank access and boat ramps at both parks. Current access unreviewed.',
    source_checked_on: CHECKED_ON, sources: [PORTLAND_GUIDE],
  },
  {
    id: 'sandy-river-lewis-clark', name: 'Sandy River', reach: 'Lewis and Clark State Recreation Site to mouth',
    kind: 'river', region: 'Portland area', group: 'popular-river',
    species: ['Salmon', 'Steelhead'],
    description: 'The lower Sandy near its Columbia River confluence.',
    access_summary: 'ODFW describes bank access and a park boat ramp. Current access unreviewed.',
    source_checked_on: CHECKED_ON, sources: [PORTLAND_GUIDE],
  },
  {
    id: 'wilson-river-mills-bridge', name: 'Wilson River', reach: 'Mills Bridge area along Highway 6',
    kind: 'river', region: 'North coast', group: 'popular-river',
    species: ['Steelhead', 'Chinook salmon', 'Cutthroat trout'],
    description: 'A coastal river with migratory salmon, steelhead and resident trout fisheries.',
    access_summary: 'ODFW names Mills Bridge among its bank-access locations. Current access unreviewed.',
    source_checked_on: CHECKED_ON, sources: [NORTHWEST_GUIDE],
  },
  {
    id: 'north-fork-nehalem-hatchery', name: 'North Fork Nehalem River', reach: 'North Nehalem Hatchery area',
    kind: 'river', region: 'North coast', group: 'popular-river',
    species: ['Winter steelhead'],
    description: 'A popular steelhead destination centered on a small coastal stream and hatchery.',
    access_summary: 'ODFW describes hatchery bank access and a permit-specific accessible platform. Current access unreviewed.',
    source_checked_on: CHECKED_ON, sources: [NORTHWEST_GUIDE],
  },
  {
    id: 'siletz-river-jack-morgan', name: 'Siletz River', reach: 'Jack Morgan Park area',
    kind: 'river', region: 'Central coast', group: 'popular-river',
    species: ['Steelhead', 'Chinook salmon', 'Cutthroat trout'],
    description: 'A coastal river destination reached from Highway 229.',
    access_summary: 'ODFW lists Jack Morgan Park’s boat ramp and nearby highway bank access. Current access unreviewed.',
    source_checked_on: CHECKED_ON, sources: [NORTHWEST_GUIDE],
  },
  {
    id: 'diamond-lake', name: 'Diamond Lake', reach: 'Lake Creek and north-shore area',
    kind: 'lake', region: 'Southern Cascades', group: 'popular-lake',
    species: ['Rainbow trout', 'Brown trout', 'Tiger trout'],
    description: 'A Cascade trout lake with an established rainbow fishery and predator trout introduced for invasive-fish control.',
    access_summary: 'ODFW identifies bank fishing near Lake Creek and Forest Service campgrounds. Current access unreviewed.',
    source_checked_on: CHECKED_ON,
    sources: [{ label: 'ODFW: Diamond Lake fishery', url: 'https://www.dfw.state.or.us/fish/local_fisheries/diamond_lake/index.asp' }],
  },
  {
    id: 'detroit-lake-mongold', name: 'Detroit Lake', reach: 'Mongold Day-use Area',
    kind: 'reservoir', region: 'Western Cascades', group: 'popular-lake',
    species: ['Rainbow trout', 'Kokanee', 'Chinook salmon'],
    description: 'A large Cascade reservoir east of Salem, with coldwater lake fisheries.',
    access_summary: 'Mongold provides a boat launch; lake levels affect facilities. Current access unreviewed.',
    source_checked_on: CHECKED_ON,
    sources: [WILLAMETTE_GUIDE, { label: 'Oregon State Parks: Detroit Lake', url: 'https://stateparks.oregon.gov/index.cfm?do=park.profile&parkId=65' }],
  },
  {
    id: 'henry-hagg-lake', name: 'Henry Hagg Lake', reach: 'Scoggins Valley Park',
    kind: 'reservoir', region: 'Portland area', group: 'popular-lake',
    species: ['Rainbow trout', 'Smallmouth bass', 'Largemouth bass', 'Yellow perch', 'Crappie'],
    description: 'A Coast Range foothill reservoir combining trout and warmwater fishing.',
    access_summary: 'ODFW lists bank fishing, two launches and an accessible pier. Current access unreviewed.',
    source_checked_on: CHECKED_ON, sources: [WILLAMETTE_GUIDE],
  },
  {
    id: 'odell-lake-princess-creek', name: 'Odell Lake', reach: 'North shore at Princess Creek',
    kind: 'lake', region: 'Central Cascades', group: 'popular-lake',
    species: ['Kokanee', 'Lake trout', 'Rainbow trout'],
    description: 'A large natural lake beside Highway 58, known for kokanee and lake trout.',
    access_summary: 'ODFW identifies Princess Creek’s boat launch and campground bank access. Current access unreviewed.',
    source_checked_on: CHECKED_ON,
    sources: [{ label: 'ODFW: Central Zone guide', url: 'https://myodfw.com/articles/easy-angling-central-zone' }],
  },
  {
    id: 'wallowa-lake-state-park', name: 'Wallowa Lake', reach: 'South end at Wallowa Lake State Park',
    kind: 'lake', region: 'Northeast Oregon', group: 'popular-lake',
    species: ['Kokanee', 'Rainbow trout', 'Lake trout'],
    description: 'A natural lake at the foot of the Wallowa Mountains with kokanee and trout fisheries.',
    access_summary: 'ODFW lists park and marina launches, plus shore fishing for rainbow trout. Current access unreviewed.',
    source_checked_on: CHECKED_ON,
    sources: [{ label: 'ODFW: Northeast Zone guide', url: 'https://myodfw.com/articles/easy-angling-northeast-zone' }],
  },
];

export function findProfile(id: string): WaterProfile | undefined {
  return WATER_PROFILES.find(water => water.id === id);
}
