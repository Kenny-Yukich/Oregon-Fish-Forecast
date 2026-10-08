type HomeView = {
  waterPath: string;
  fish: string;
  arrow: string;
  icon: (name: string) => string;
};

const proposedWaters = [
  { name: 'Crooked River', reach: 'Below Bowman Dam', review: 'Flow source and reach review' },
  { name: 'Metolius River', reach: 'Reach to be defined', review: 'Boundaries and sensor review' },
  { name: 'Fall River', reach: 'Above the falls', review: 'Boundaries and rules review' },
  { name: 'Haystack Reservoir', reach: 'Bank-fishing conditions', review: 'Access and weather point review' },
  { name: 'Lake Billy Chinook', reach: 'Sector to be defined', review: 'Sector and jurisdiction review' },
];

/** The selected field-guide homepage; proposed waters never imply live coverage. */
export function fieldGuideHome({ waterPath, fish, arrow, icon }: HomeView): string {
  return `<main id="main" class="field-guide">
    <section class="field-guide-hero guide-wrap" aria-labelledby="home-title">
      <div class="field-guide-intro">
        <div class="eyebrow">${icon('flow')} OREGON FISH FORECAST</div>
        <h1 id="home-title">Get to know<br> the water.</h1>
        <p>Landscapes change. Rivers move. This is your field guide to Oregon’s key waters — and what to know before you go.</p>
      </div>
      <div class="field-guide-hero-art">
        <img class="field-guide-hero-image" src="/brand/river-country-landscape.webp" width="1280" height="683" alt="Illustrated snowy mountains, evergreen forest, and a winding river under a golden sun." fetchpriority="high" decoding="async">
      </div>
    </section>

    <section class="featured-reach guide-wrap" aria-labelledby="featured-title">
      <div class="featured-reach-copy">
        <div class="eyebrow"><span class="short-rule"></span> THE LOWER DESCHUTES</div>
        <h2 id="featured-title">Lower Deschutes</h2>
        <p class="featured-reach-location">Warm Springs to Trout Creek</p>
        <p class="featured-reach-status">First conditions page <span aria-hidden="true">·</span> Reach review in progress</p>
        <a class="button button-primary" data-nav href="${waterPath}">Explore the Lower Deschutes ${arrow}</a>
      </div>
      <figure class="field-guide-photo featured-reach-photo">
        <img src="/photos/deschutes-river.jpg" width="1000" height="667" alt="Blue-green Deschutes River water beside pine trees, rocky banks, and autumn shrubs." decoding="async">
        <figcaption>Deschutes River · Regional scenery</figcaption>
      </figure>
    </section>

    <section class="guide-principles guide-wrap" aria-label="What goes into the field guide">
      <article>
        ${icon('flow')}
        <h2>River flow</h2>
        <p class="eyebrow">GAUGE OBSERVATIONS</p>
        <p>Validated gauge observations, with visible measurement times.</p>
      </article>
      <article>
        ${icon('sun')}
        <h2>Weather</h2>
        <p class="eyebrow">SOURCE-LINKED FORECASTS</p>
        <p>Local forecasts from trusted weather sources, once each location is reviewed.</p>
      </article>
      <article>
        ${icon('location')}
        <h2>Sources</h2>
        <p class="eyebrow">VISIBLE TIMESTAMPS</p>
        <p>Official sources, clear timestamps, and an honest view of what’s available.</p>
      </article>
    </section>

    <section class="future-waters guide-wrap" id="waters" aria-labelledby="future-title">
      <div class="future-waters-copy">
        <h2 id="future-title">More waters on the horizon.</h2>
        <p>Additional rivers and lakes are in the works. Coverage grows as each water’s sources and reach are reviewed.</p>
        <div class="proposed-waters">
          ${proposedWaters.map(water => `<details class="proposed-water">
            <summary>${fish}<span class="proposed-water-name">${water.name}</span><span class="tag tag-muted">Proposed coverage</span>${arrow}</summary>
            <div class="proposed-water-detail">
              <p><strong>${water.reach}</strong><br>${water.review} in progress. A conditions page is not available yet.</p>
              <a class="text-link" data-nav href="/methodology#coverage">How we add new waters ${arrow}</a>
            </div>
          </details>`).join('')}
        </div>
      </div>
      <figure class="field-guide-photo future-waters-photo">
        <img src="/photos/metolius-river.jpg" width="2560" height="1708" alt="The Metolius River rushing through evergreen forest and golden autumn foliage." loading="lazy" decoding="async">
        <figcaption>Metolius River · Central Oregon</figcaption>
      </figure>
    </section>
  </main>`;
}
