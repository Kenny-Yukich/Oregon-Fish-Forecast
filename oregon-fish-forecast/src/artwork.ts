/** Original Oregon-inspired landscape. Illustrative, with no geographic claims. */
export function riverArtwork(variant = 'hero'): string {
  const id = variant.replace(/[^a-zA-Z0-9_-]/g, '') || 'hero';
  return `<div class="river-art river-art-${id}" role="img" aria-label="Original illustration of Oregon-inspired snowy peaks, evergreen forest, and a winding river through golden canyon country; not a navigation map">
  <svg viewBox="0 0 660 540" fill="none" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
    <defs>
      <linearGradient id="oregon-sky-${id}" x1="330" y1="0" x2="330" y2="300" gradientUnits="userSpaceOnUse"><stop stop-color="#002A86"/><stop offset="1" stop-color="#244C84"/></linearGradient>
      <linearGradient id="oregon-water-${id}" x1="335" y1="272" x2="355" y2="540" gradientUnits="userSpaceOnUse"><stop stop-color="#002A86"/><stop offset="1" stop-color="#142C46"/></linearGradient>
      <g id="oregon-fir-${id}"><path d="M0-62-11-39h7l-13 22h9L-24 8h21v10h6V8h21L8-17h9L4-39h7L0-62Z" fill="currentColor"/><path d="M0-52V8" stroke="#F5F1E6" stroke-opacity=".11" stroke-width="1.5"/></g>
    </defs>
    <path fill="url(#oregon-sky-${id})" d="M0 0h660v540H0z"/>
    <circle cx="465" cy="111" r="54" fill="#FFEA0F"/>
    <circle cx="465" cy="111" r="68" stroke="#FFEA0F" stroke-opacity=".28"/>
    <path d="M70 109h69M81 117h41M515 181h74M537 189h64" stroke="#F5F1E6" stroke-width="1.5" stroke-opacity=".3" stroke-linecap="round"/>
    <path d="m-25 267 87-50 61 12 55-65 46 24 58-97 74 111 35-33 43 45 46-65 67 70 41-21 104 82Z" fill="#6D898D"/>
    <path d="m134 266 77-58 13-20 58-97 13 60 55 67 41-49 43 45 46-65 12 45 76 83Z" fill="#3C6273"/>
    <path d="m243 157 39-66 43 65-27-17-10 10-9-22-19 37-6-11-11 4ZM457 184l23-35 32 34-17-6-6 8-12-15-8 15-12-1Z" fill="#F5F1E6"/>
    <path d="m282 91 13 60-7-2-9-22-19 37-6-11-11 4 39-66Z" fill="#E6EADA"/>
    <path d="m0 261 72-23 72 8 86-17 83 27 66-25 77 6 58-16 71 38 75-8v106H0Z" fill="#426D60"/>
    <g color="#285D45">
      <use href="#oregon-fir-${id}" transform="translate(25 274) scale(.58)"/><use href="#oregon-fir-${id}" transform="translate(53 262) scale(.7)"/><use href="#oregon-fir-${id}" transform="translate(82 270) scale(.53)"/>
      <use href="#oregon-fir-${id}" transform="translate(112 268) scale(.78)"/><use href="#oregon-fir-${id}" transform="translate(140 274) scale(.6)"/><use href="#oregon-fir-${id}" transform="translate(164 277) scale(.65)"/>
      <use href="#oregon-fir-${id}" transform="translate(488 265) scale(.54)"/><use href="#oregon-fir-${id}" transform="translate(512 268) scale(.68)"/><use href="#oregon-fir-${id}" transform="translate(539 274) scale(.54)"/>
      <use href="#oregon-fir-${id}" transform="translate(565 284) scale(.78)"/><use href="#oregon-fir-${id}" transform="translate(596 282) scale(.68)"/><use href="#oregon-fir-${id}" transform="translate(629 287) scale(.88)"/>
    </g>
    <path d="M0 287c91-28 176-24 263-9 39 7 63 7 90-3 92-36 175-13 307 24v241H0Z" fill="#D9AC4B"/>
    <path d="M0 292c113-27 177-12 279 8l-46 40C131 316 77 343 0 368Z" fill="#AD8743"/>
    <path d="M660 299c-111-36-185-43-278-17l33 17c95-10 171 23 245 60Z" fill="#E9C96E"/>
    <path d="M0 368c95-36 160-39 233-28l41 31C164 361 58 391 0 416Z" fill="#E9C96E"/>
    <path d="M660 359c-79-36-147-54-233-45l-52 31c89-2 177 48 285 79Z" fill="#B48843"/>
    <path d="M0 447c107-37 191-44 268-5l-20 98H0Z" fill="#C69B48"/>
    <path d="M322 273c-13 16 14 24 44 30 62 14 45 40-29 60-116 30-149 61-80 104 39 24 89 40 110 73h176c-24-47-120-73-198-107-44-19-41-26 39-56 88-33 89-63 24-79-47-12-69-13-68-25Z" fill="#F0D68B"/>
    <path d="M328 273c-8 17 27 27 57 34 49 11 17 34-47 52-116 33-156 66-73 111 41 22 91 44 108 70h142c-31-45-113-67-186-103-49-24-27-40 52-68 82-29 83-55 20-70-32-7-62-15-65-26Z" fill="url(#oregon-water-${id})"/>
    <path d="M328 284c6 9 38 17 61 22 43 10 18 27-34 44M356 371c-81 28-112 52-68 81M346 468c40 20 81 40 100 62" stroke="#4B82AA" stroke-width="2" stroke-linecap="round"/>
    <path d="m321 389 18-8m-29 14 5-2m36 88 23 12m9 4 8 4" stroke="#F5F1E6" stroke-width="2" stroke-linecap="round" opacity=".65"/>
    <path d="M660 414c-65-23-111-38-179-33l-27 18c76 12 153 54 206 84Z" fill="#E9C96E"/>
    <path d="M660 466c-75-29-123-33-173-19l45 29c53 7 90 24 128 41Z" fill="#AD8743"/>
    <g stroke="#8B713F" stroke-width="1.5" opacity=".5" stroke-linecap="round">
      <path d="M46 316c57-8 98-8 151 2M17 383c60-20 102-26 145-26M484 291c43 2 80 12 109 23M509 405c37 7 67 19 102 34M42 466c48-13 94-17 131-13"/>
      <path d="m152 341 11 19m13-15 7 13m352-26-6 22m24-16-5 22m-446 105 6 20m27-23 3 17"/>
    </g>
    <path d="M0 413c51-12 91 8 123 26 40 23 79 34 102 47 24 14 44 35 49 54H0Z" fill="#285D45"/>
    <path d="M0 462c39-4 70 9 100 25 37 18 64 26 84 53H0Z" fill="#193F36"/>
    <path d="M660 465c-27-12-48-11-70 3-31 20-47 48-55 72h125Z" fill="#285D45"/>
    <g color="#193F36">
      <use href="#oregon-fir-${id}" transform="translate(22 430) scale(1.28)"/><use href="#oregon-fir-${id}" transform="translate(65 452) scale(1.58)"/>
      <use href="#oregon-fir-${id}" transform="translate(113 468) scale(1.18)"/><use href="#oregon-fir-${id}" transform="translate(154 489) scale(.94)"/>
      <use href="#oregon-fir-${id}" transform="translate(613 503) scale(1.38)"/><use href="#oregon-fir-${id}" transform="translate(655 489) scale(1.62)"/>
    </g>
    <g color="#285D45"><use href="#oregon-fir-${id}" transform="translate(18 488) scale(1.45)"/><use href="#oregon-fir-${id}" transform="translate(86 522) scale(1.35)"/></g>
    <path d="M196 507c16 6 26 12 35 20m-31-15-3 9m13-4-2 10M570 520l8-15m-5 8 8-2" stroke="#88A174" stroke-width="1.5" stroke-linecap="round"/>
  </svg><span class="art-caption">An impression of Oregon river country &middot; Not a navigation map</span></div>`;
}
