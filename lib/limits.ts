/**
 * Input length limits, mirroring the server-side validation (the source of
 * truth). Applied as `maxLength` on inputs/textareas so the browser prevents
 * over-limit input, and re-checked server-side — which still returns a 400 the
 * forms surface. Keep these in sync with the backend controllers.
 */
export const LIMITS = {
  // auth / profile
  username: 30,
  password: 128,
  displayName: 40,
  bio: 10000,
  socialUrl: 200,
  socialsCount: 10,
  email: 254,

  // comments / chat
  commentBody: 5000,
  dmBody: 5000,
  dmImageUrl: 2000,

  // library
  libraryNote: 2000,

  // collections
  collectionName: 100,
  collectionDescription: 5000,
  collectionNote: 1000,

  // narrators
  narratorName: 100,
  narratorBio: 10000,
  narratorContact: 2000,
  narratorSlug: 200,

  // titles
  titleName: 300,
  titleAltName: 300,
  titleAltNamesCount: 20,
  titleDescription: 20000,
  titleSlug: 200,

  // authors
  authorName: 120,
  authorBio: 10000,

  // genres
  genreName: 40,

  // posts
  postTitle: 200,
  postBody: 20000,

  // announcements
  announcementTitle: 200,
  announcementBody: 20000,

  // dmca (public form)
  dmcaName: 200,
  dmcaEmail: 200,
  dmcaCountry: 100,
  dmcaUrl: 5000,
  dmcaDescription: 5000,
} as const;
