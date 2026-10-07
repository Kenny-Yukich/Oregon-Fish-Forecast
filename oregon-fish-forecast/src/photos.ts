/** User-supplied scenic photographs; these do not identify reach boundaries. */
const photos = {
  hero: {
    src: '/photos/metolius-river.jpg',
    width: 2560,
    height: 1708,
    alt: 'The Metolius River flowing through evergreen forest and golden autumn foliage.',
    caption: 'Metolius River · Central Oregon',
  },
  card: {
    src: '/photos/deschutes-river.jpg',
    width: 1000,
    height: 667,
    alt: 'Blue-green Deschutes River water beside a rocky bank, pine trees, and autumn shrubs.',
    caption: 'Deschutes River · Regional scenery',
  },
  reach: {
    src: '/photos/river-canyon.jpg',
    width: 509,
    height: 339,
    alt: 'A broad river winding between dry canyon hills and golden grasses.',
    caption: 'River country · Scenic view',
  },
} as const;

export function riverPhoto(variant: keyof typeof photos = 'hero'): string {
  const photo = photos[variant];
  const loading = variant === 'hero' ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"';
  return `<figure class="river-art river-art-${variant} river-photo">
    <img src="${photo.src}" width="${photo.width}" height="${photo.height}" alt="${photo.alt}" ${loading} decoding="async">
    <figcaption class="art-caption">${photo.caption}</figcaption>
  </figure>`;
}
