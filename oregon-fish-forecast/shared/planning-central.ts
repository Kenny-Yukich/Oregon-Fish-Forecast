import type { WaterPlanning } from './planning-types';

/**
 * Editorial trip context checked 2026-10-12 against the linked official pages.
 * Report dates are the water-specific "last updated" dates, not page crawl dates.
 * Seasonal patterns and methods are background guidance, never fishing permission.
 * Public destinations are independent of gauge coordinates. In particular, the
 * Opal Springs and Grandview station records do not establish public access.
 */
const CHECKED = '2026-10-12';
const CENTRAL_REPORT = 'https://myodfw.com/recreation-report/fishing-report/central-zone';
const REGULATIONS = 'https://myodfw.com/articles/regulation-updates';
const CENTRAL_GUIDE = 'https://myodfw.com/articles/easy-angling-central-zone';
const CENTRAL_OVERVIEW = 'https://myodfw.com/fishing/central-zone';
const BEND_GUIDE = 'https://myodfw.com/articles/50-places-go-fishing-within-90-minutes-bend';
const TROUT_GUIDE = 'https://myodfw.com/articles/how-fish-trout';
const KOKANEE_GUIDE = 'https://myodfw.com/articles/kokanee-fishing-oregon';
const BOAT_ACCESS = 'https://www.oregon.gov/osmb/boater-info/Pages/Opportunities-and-Access.aspx';
const OHA_ALGAE = 'https://www.oregon.gov/oha/PH/HEALTHYENVIRONMENTS/RECREATION/HARMFULALGAEBLOOMS/Pages/Blue-GreenAlgaeAdvisories.aspx';
const OHA_FISH = 'https://www.oregon.gov/oha/PH/HealthyEnvironments/Recreation/FishConsumption/Pages/fishadvisories.aspx';
const TROUT_CREEK = 'https://www.blm.gov/visit/trout-creek-campground';
const DESCHUTES_PARK = 'https://stateparks.oregon.gov/index.cfm?do=park.profile&parkId=29';
const STEELHEAD_FALLS = 'https://www.blm.gov/sites/default/files/documents/files/Steelhead_Falls_brochure.pdf';
const OPAL_PASSAGE = 'https://www.dfw.state.or.us/fish/passage/project_highlights.asp';
const CASTLE_ROCK = 'https://www.blm.gov/visit/castle-rock-campground';
const FALL_HATCHERY = 'https://myodfw.com/fall-river-hatchery-visitors-guide';
const HAYSTACK_PARK = 'https://www.ccprd.org/haystack-reservoir';
const COVE_PARK = 'https://stateparks.oregon.gov/index.cfm?do=park.profile&parkId=24';
const DIAMOND_GUIDE = 'https://www.dfw.state.or.us/fish/local_fisheries/diamond_lake/index.asp';
const SOUTHWEST_REPORT = 'https://myodfw.com/recreation-report/fishing-report/southwest-zone';
const PRINCESS_CREEK = 'https://www.recreation.gov/camping/campgrounds/267079';

const source = (label: string, url: string) => ({ label, url });
const report = (summary: string, reported_on: string | null, coverage: string, url = CENTRAL_REPORT) =>
  ({ summary, reported_on, checked_on: CHECKED, coverage, url });
const advisory = (summary: string, url: string): WaterPlanning['alerts'][number] =>
  ({ summary, status: 'advisory', checked_on: CHECKED, url });
const gap = (summary: string, url: string): WaterPlanning['alerts'][number] =>
  ({ summary, status: 'unverified', checked_on: null, url });
const bassAdvisory = advisory('Statewide OHA mercury advice applies to bass; review meal guidance before keeping fish.', OHA_FISH);
const lowerScoreNotice = 'ODFW reports steelhead and salmon restrictions for this reach; the fishing score is withheld pending a rules review.';

export const CENTRAL_PLANNING: WaterPlanning[] = [
  {
    water_id: 'lower-deschutes-warm-springs-trout-creek',
    target_species: ['Redband trout', 'Mountain whitefish'],
    access_summary: 'Trout Creek: bank, trail, boat ramp',
    access_detail: 'BLM lists day-use parking, a boat launch and an upriver trail at Trout Creek Campground. The approach includes gravel and a narrow tunnel; bring water. This is a public destination on the reach, not directions to the Madras gauge.',
    access_point: { label: 'Trout Creek Campground', map_query: 'BLM Trout Creek Campground Deschutes River Madras Oregon' },
    seasonal_summary: 'Trout focus; check migratory-fish closures',
    seasonal_detail: 'Resident redband trout are a core lower-river fishery. Treat seasonal steelhead descriptions as historical run context: current species restrictions take precedence.',
    methods: 'ODFW reports stonefly nymphs and evening dry flies for trout; check exact tackle rules.',
    report: report('ODFW reports good trout fishing.', '2026-10-05', 'Mouth-to-Pelton report; not a Trout Creek catch survey.'),
    alerts: [
      advisory('Aug 15-Dec 31, 2026: steelhead and coho angling/retention closed from Sherars Falls to Pelton Reregulating Reservoir. Review Chinook rules separately.', REGULATIONS),
      gap('Boater permits, land boundaries and current trail/fire restrictions need a trip-day check.', TROUT_CREEK),
    ],
    score_notice: lowerScoreNotice,
    score_notice_effective_at: '2026-08-15T00:00:00-07:00',
    checked_on: CHECKED,
    sources: [source('ODFW lower Deschutes report', CENTRAL_REPORT), source('ODFW in-season restrictions', REGULATIONS), source('BLM Trout Creek destination', TROUT_CREEK), source('ODFW Central Zone fishery background', CENTRAL_OVERVIEW)],
  },
  {
    water_id: 'lower-deschutes-moody',
    target_species: ['Redband trout', 'Mountain whitefish'],
    access_summary: 'State park: bank and riverside trails',
    access_detail: 'Deschutes River State Recreation Area provides a public starting point at the river mouth. Its Blackberry Trail follows the east bank; Heritage Landing is the separate boat launch across the river. The station itself is not the access destination.',
    access_point: { label: 'Deschutes River State Recreation Area', map_query: 'Deschutes River State Recreation Area 89600 Biggs Rufus Highway Oregon' },
    seasonal_summary: 'Trout focus; salmon/steelhead restriction',
    seasonal_detail: 'ODFW describes resident redband trout and a historical summer/fall steelhead run in the lower Deschutes. Run timing does not establish an open fishery; this mouth-area row has a current restriction.',
    methods: 'ODFW reports stonefly nymphs for trout. Use permitted bank locations and verify tackle rules.',
    report: report('ODFW reports good trout fishing.', '2026-10-05', 'Mouth-to-Pelton report; not a Moody-area catch survey.'),
    alerts: [
      advisory('Aug 15-Dec 31, 2026: salmon/steelhead angling and retention closed from the westbound I-84 bridge to the trestle three miles below Sherars Falls.', REGULATIONS),
      gap('Confirm river-use permits and park notices before boating or taking the longer canyon trail.', DESCHUTES_PARK),
    ],
    score_notice: lowerScoreNotice,
    score_notice_effective_at: '2026-08-15T00:00:00-07:00',
    checked_on: CHECKED,
    sources: [source('ODFW lower Deschutes report', CENTRAL_REPORT), source('ODFW in-season restrictions', REGULATIONS), source('Oregon State Parks: Deschutes River', DESCHUTES_PARK), source('ODFW Central Zone background', CENTRAL_OVERVIEW)],
  },
  {
    water_id: 'middle-deschutes-culver',
    target_species: ['Redband trout', 'Brown trout', 'Mountain whitefish'],
    access_summary: 'Steelhead Falls: hike to river upstream',
    access_detail: 'BLM describes a roughly half-mile trail from Steelhead Falls Trailhead to the falls, with a short steep section and no drinking water. This middle-river destination is upstream of the Culver station; it does not establish parking or shoreline access at the gauge.',
    access_point: { label: 'Steelhead Falls Trailhead', map_query: 'BLM Steelhead Falls Trailhead River Road Terrebonne Oregon' },
    seasonal_summary: 'Cooler-season trout pattern',
    seasonal_detail: 'ODFW general trout guidance favors spring and fall in moving water. That is species-level context, not a measured seasonal advantage for this canyon or a prediction of conditions at the falls.',
    methods: 'General trout approach: examine current breaks behind rocks and deeper pools; use legal flies or lures suited to that water.',
    report: report('ODFW reported productive trout fishing near Steelhead Falls.', '2026-07-30', 'Broader middle Deschutes; older than the live Culver readings.'),
    alerts: [gap('Exact fishing boundaries, trail condition and fire restrictions are not fully reviewed for this trip.', REGULATIONS)],
    checked_on: CHECKED,
    sources: [source('ODFW middle Deschutes report', CENTRAL_REPORT), source('BLM Steelhead Falls trail brochure', STEELHEAD_FALLS), source('ODFW general trout methods', TROUT_GUIDE), source('ODFW Central Zone guide', CENTRAL_GUIDE)],
  },
  {
    water_id: 'crooked-river-opal-springs',
    target_species: ['Redband trout (basin evidence)', 'Mountain whitefish (basin evidence)'],
    access_summary: 'Public route not established',
    access_detail: 'The monitoring station and hydro project do not establish a public fishing entrance, parking permission or an easement. No suitable public destination for the canyon below Opal Springs was verified in this review; do not route to the gauge.',
    access_point: null,
    seasonal_summary: 'Lower-canyon timing unconfirmed',
    seasonal_detail: 'ODFW fish-passage material documents native fish connectivity in the Crooked basin and bull trout below the project. This is habitat evidence, not a catch-rate record or a basis for importing the Bowman Dam seasonal outlook.',
    methods: 'A reach-specific fishing method is not established. First resolve a legal public access location and exact section rules; then assess the actual bank, current and habitat.',
    report: report('No dated fishing report specific to the canyon below Opal Springs was found.', null, 'ODFW passage evidence; the Bowman Dam fishing report does not assess this canyon.', OPAL_PASSAGE),
    alerts: [
      gap('Public access and exact reach rules remain unresolved; a live flow reading does not establish permission to fish.', REGULATIONS),
      advisory('ODFW documents bull trout below the hydro project; species identification and current protections matter here.', OPAL_PASSAGE),
    ],
    checked_on: CHECKED,
    sources: [source('ODFW Opal Springs fish-passage evidence', OPAL_PASSAGE), source('ODFW current restriction updates', REGULATIONS)],
  },
  {
    water_id: 'metolius-river-grandview',
    target_species: ['Redband trout', 'Mountain whitefish', 'Bull trout'],
    access_summary: 'Grandview public route unconfirmed',
    access_detail: 'No verified public trailhead or launch serving the lower river near the Grandview gauge was established. Camp Sherman and Wizard Falls descriptions concern a different section and are not substituted as access to this row.',
    access_point: null,
    seasonal_summary: 'River-wide fall hatches; local gap',
    seasonal_detail: 'The broader Metolius fishery has resident trout and a winter bull-trout fishery in ODFW background material. There is no Grandview-specific seasonal assessment, route inspection or abundance estimate in this record.',
    methods: 'Broader-river guidance mentions stonefly and midge nymphs. A Grandview-specific presentation or depth is unverified.',
    report: report('ODFW reports trout fishing and spawning activity.', '2026-09-03', 'Whole-river context, not a Grandview observation.'),
    alerts: [
      advisory('Avoid spawning fish and redds; ODFW flags Metolius spawning activity.', CENTRAL_REPORT),
      gap('Confirm lower-river public access and precise section/tribal boundaries before choosing a route.', REGULATIONS),
    ],
    checked_on: CHECKED,
    sources: [source('ODFW Metolius report', CENTRAL_REPORT), source('ODFW Central Zone background', CENTRAL_OVERVIEW), source('ODFW section-rule updates', REGULATIONS)],
  },
  {
    water_id: 'crooked-river-bowman-dam',
    target_species: ['Redband trout', 'Mountain whitefish'],
    access_summary: 'Castle Rock: bank access from campground',
    access_detail: 'BLM identifies Castle Rock Campground on Highway 27 south of Prineville as a Crooked River access site. It provides an evidenced starting point at the lower end of this Bowman-to-Castle Rock row; verify individual pullouts before parking elsewhere.',
    access_point: { label: 'Castle Rock Campground', map_query: 'BLM Castle Rock Campground Crooked River Highway 27 Prineville Oregon' },
    seasonal_summary: 'September to mid-May guide window',
    seasonal_detail: 'ODFW guide timing favors September through mid-May below Bowman. The naturally colored water is not automatically poor fishing; slippery footing deserves a separate on-site assessment.',
    methods: 'Small midge, scud and mayfly nymphs feature in ODFW guidance; watch for rising fish.',
    report: report('ODFW reports strong trout/whitefish fishing and reduced autumn flows.', '2026-10-08', 'Bowman tailwater; not the Opal Springs canyon.'),
    alerts: [
      advisory('Autumn storage reduces tailwater flow; assess current conditions before entering the river.', CENTRAL_REPORT),
      gap('Current wading depth, footing and each roadside access point remain unassessed.', CASTLE_ROCK),
    ],
    checked_on: CHECKED,
    sources: [source('ODFW Crooked River report', CENTRAL_REPORT), source('ODFW tailwater seasonal guide', CENTRAL_GUIDE), source('BLM Castle Rock access', CASTLE_ROCK)],
  },
  {
    water_id: 'fall-river-above-falls',
    target_species: ['Rainbow trout', 'Brown trout'],
    access_summary: 'Hatchery: bank and foot-trail fishing',
    access_detail: 'Fall River Hatchery at 15055 S. Century Drive is an official fishing destination. ODFW describes bank access without requiring wading. Use the hatchery-side river access, respecting posted operating areas and visitor hours.',
    access_point: { label: 'Fall River Hatchery', map_query: 'Fall River Hatchery 15055 South Century Drive Bend Oregon' },
    seasonal_summary: 'June-July evenings in ODFW guide',
    seasonal_detail: 'The guide highlights late-day summer fishing around the hatchery. Seasonal stocking background is not confirmation of a new release today.',
    methods: 'Dry flies and nymphs are the guide starting points; choose flies based on insects observed at the water.',
    report: report('ODFW reports consistent fly fishing.', '2026-10-01', 'Fall River; this profile covers the hatchery area above the falls.'),
    alerts: [advisory('Barbless flies only. The below-falls seasonal closure concerns a different section.', CENTRAL_REPORT)],
    checked_on: CHECKED,
    sources: [source('ODFW Fall River report', CENTRAL_REPORT), source('ODFW Fall River guide', CENTRAL_GUIDE), source('ODFW hatchery location and visitor information', FALL_HATCHERY)],
  },
  {
    water_id: 'haystack-reservoir',
    target_species: ['Rainbow trout', 'Smallmouth bass', 'Largemouth bass', 'Black crappie'],
    access_summary: 'West Shore: bank, ramp and day use',
    access_detail: 'Crook County Parks identifies the West Shore day-use area, boat ramp, boarding floats and trailer parking at 9900 SW Haystack Drive. Irrigation changes the lake level; a listed ramp does not guarantee enough water for a particular boat.',
    access_point: { label: 'Haystack West Shore Day Use', map_query: 'Haystack West Shore Day Use 9900 SW Haystack Drive Culver Oregon' },
    seasonal_summary: 'Cooler-water trout; fluctuating shoreline',
    seasonal_detail: 'General ODFW guidance for trout in lakes favors cooler spring/fall water and deeper summer habitat. This is a species pattern, not a measured temperature or Haystack-specific catch forecast.',
    methods: 'General trout methods include a retrieved spinner or suspended bait where permitted. Match depth to conditions; no current productive depth is documented for West Shore.',
    report: report('ODFW confirms spring stocking; no newer water-specific update.', '2026-07-06', 'Reservoir-wide; not a recent West Shore catch report.'),
    alerts: [
      advisory('Park operator noted algae buildup on July 16, 2026; this older notice does not describe conditions today.', HAYSTACK_PARK),
      advisory('West ramp usability depends on reservoir level; check the operator before trailering a boat.', BOAT_ACCESS),
      bassAdvisory,
    ],
    checked_on: CHECKED,
    sources: [source('ODFW Haystack report', CENTRAL_REPORT), source('Crook County Parks: Haystack', HAYSTACK_PARK), source('Oregon Marine Board access report', BOAT_ACCESS), source('ODFW general trout methods', TROUT_GUIDE), source('ODFW Bend guide species', BEND_GUIDE), source('OHA consumption guidance', OHA_FISH)],
  },
  {
    water_id: 'lake-billy-chinook-crooked-arm',
    target_species: ['Kokanee', 'Rainbow trout', 'Smallmouth bass'],
    access_summary: 'Crooked River day use: ramp and kayak launch',
    access_detail: 'Cove Palisades identifies a boat ramp and accessible kayak launch at Crooked River Day-use Area. Drive to day use rather than assuming the campground is on the shoreline; the connecting road is steep. Winter low water can affect ramps.',
    access_point: { label: 'Crooked River Day-use Area', map_query: 'Crooked River Day Use Area Cove Palisades State Park Culver Oregon' },
    seasonal_summary: 'Kokanee: general April-August pattern',
    seasonal_detail: 'ODFW kokanee guidance highlights April-August effort and movement to spawning habitat in fall. This general pattern does not locate fish in the Crooked arm or predict a productive depth.',
    methods: 'For kokanee, search for schools from a boat and troll or jig at their depth. Bank plans should focus on documented shoreline species rather than assume kokanee are within casting range.',
    report: report('ODFW reports lake-wide kokanee catches; Crooked-arm success is unconfirmed.', '2026-09-24', 'Lake-wide and Metolius-arm information; not a Crooked-arm sample.'),
    alerts: [
      bassAdvisory,
      advisory('OHA downgraded a bloom advisory on June 29, 2026; consult the current map for the latest status, especially for pets.', 'https://www.oregon.gov/oha/ERD/Pages/Recreational-use-advisory-downgraded-to-precaution-for-Lake-Billy-Chinook-06.29.2026.aspx'),
      advisory('Sep 28 park notice closes some camp loops and Lower Deschutes day use; those are separate from this Crooked River day-use destination.', COVE_PARK),
      gap('Current bloom extent and exact Crooked-arm fishing rules still need a trip-day review.', OHA_ALGAE),
    ],
    checked_on: CHECKED,
    sources: [source('ODFW Lake Billy Chinook report', CENTRAL_REPORT), source('Cove Palisades access and notices', COVE_PARK), source('ODFW kokanee techniques', KOKANEE_GUIDE), source('ODFW lake species guide', BEND_GUIDE), source('OHA current bloom advisories', OHA_ALGAE), source('OHA consumption guidance', OHA_FISH)],
  },
  {
    water_id: 'diamond-lake',
    target_species: ['Rainbow trout', 'Brown trout', 'Tiger trout'],
    access_summary: 'North launch; Lake Creek shore options',
    access_detail: 'The Marine Board lists the North Lake boat launch, and ODFW identifies shore fishing near Lake Creek. The destination is the public north launch; it is not a promise of accessible shoreline all around the north end.',
    access_point: { label: 'Diamond Lake North End Boat Ramp', map_query: 'Diamond Lake North End Boat Ramp Oregon' },
    seasonal_summary: 'After ice-off and cooler autumn water',
    seasonal_detail: 'ODFW background guidance highlights spring after ice-off and autumn cooling. Ice-off dates vary each year; this profile does not assess ice thickness or certify winter access.',
    methods: 'ODFW describes trolling small lures and spinners, or fishing flies near Lake Creek. Shore and boat methods differ; no current north-end productive depth is recorded.',
    report: report('ODFW reports good trout catches, with brown and tiger trout released.', '2026-10-07', 'Lake-wide report, not a north-shore catch survey.', SOUTHWEST_REPORT),
    alerts: [
      advisory('ODFW requires release of brown and tiger trout; review the full current species rules.', SOUTHWEST_REPORT),
      advisory('Oct 7 report says the main-ramp fish-cleaning station is under repair.', SOUTHWEST_REPORT),
      gap('Present bloom status, snow and shoreline conditions are not established by this fishing report.', OHA_ALGAE),
    ],
    checked_on: CHECKED,
    sources: [source('ODFW Diamond Lake report', SOUTHWEST_REPORT), source('ODFW Diamond Lake seasonal and method guide', DIAMOND_GUIDE), source('Oregon Marine Board launch information', BOAT_ACCESS), source('OHA current bloom advisories', OHA_ALGAE)],
  },
  {
    water_id: 'odell-lake-princess-creek',
    target_species: ['Kokanee', 'Lake trout', 'Rainbow trout'],
    access_summary: 'Princess Creek: public ramp and campground',
    access_detail: 'Recreation.gov identifies Princess Creek Campground and its Odell Lake boat ramp. ODFW names the adjacent north shore as a kokanee starting area. Check day-use access and launch conditions independently of a camping reservation.',
    access_point: { label: 'Princess Creek Campground and Boat Ramp', map_query: 'Princess Creek Campground Boat Ramp Odell Lake Oregon' },
    seasonal_summary: 'Spring/fall fish; November closure notice',
    seasonal_detail: 'ODFW guide timing favors spring and fall for kokanee and lake trout. Seasonal habitat patterns are separate from the approaching angling closure.',
    methods: 'Troll or jig for kokanee at the depth of marked schools. Boat access improves reach; do not assign a depth without present observations.',
    report: report('ODFW reports small kokanee and productive lake-trout fishing.', '2026-09-14', 'Odell Lake overall; Princess Creek is not separately sampled.'),
    alerts: [
      advisory('ODFW reports angling closes Nov 1, 2026; bull trout must be released.', CENTRAL_REPORT),
      gap('Current wind, waves, bloom status and launch usability need a trip-day check.', BOAT_ACCESS),
    ],
    checked_on: CHECKED,
    sources: [source('ODFW Odell report', CENTRAL_REPORT), source('ODFW Odell seasonal guide', CENTRAL_GUIDE), source('Recreation.gov: Princess Creek', PRINCESS_CREEK), source('ODFW kokanee methods', KOKANEE_GUIDE), source('Oregon Marine Board access information', BOAT_ACCESS)],
  },
];
