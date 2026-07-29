// Shared TypeScript interfaces for every object shape returned by the AudioRanobe API.
// Mirrors contracts/API.md exactly — do not drift from it.

export type Role = 'user' | 'moderator' | 'admin';
export type ModStatus = 'pending' | 'approved' | 'rejected';
/** Status of the source work itself. */
export type ReleaseStatus = 'ongoing' | 'completed' | 'abandoned' | 'frozen';
/** Status of one narrator's reading of a title — tracked separately. */
export type NarrationStatus = ReleaseStatus;

export const RELEASE_STATUS_LABELS: Record<ReleaseStatus, string> = {
  ongoing: 'Продолжается',
  completed: 'Завершён',
  abandoned: 'Заброшен',
  frozen: 'Заморожен',
};

export const NARRATION_STATUS_LABELS: Record<NarrationStatus, string> = {
  ongoing: 'Продолжается',
  completed: 'Завершена',
  abandoned: 'Заброшена',
  frozen: 'Заморожена',
};

export const STATUS_VALUES: ReleaseStatus[] = ['ongoing', 'completed', 'abandoned', 'frozen'];
export type AudioStatus = 'none' | 'queued' | 'processing' | 'ready' | 'error' | 'moderation';
export type LibraryStatus = 'planning' | 'in_progress' | 'completed' | 'dropped';

/**
 * Library list names shown to the user. The keys stay English — they are the
 * API values and the `?status=` slug — only the labels are Russian.
 */
export const LIBRARY_STATUS_LABELS: Record<LibraryStatus, string> = {
  planning: 'В планах',
  in_progress: 'Слушаю',
  completed: 'Прослушано',
  dropped: 'Брошено',
};

export const LIBRARY_STATUS_VALUES: LibraryStatus[] = [
  'planning',
  'in_progress',
  'completed',
  'dropped',
];
export type CommentTargetType = 'title' | 'narrator' | 'post' | 'announcement';
export type NotificationType =
  | 'new_chapter'
  | 'narrator_release'
  | 'comment_reply'
  | 'narrator_comment'
  | 'mention'
  | 'system'
  | 'request_approved'
  | 'request_rejected'
  | 'entity_modified'
  | 'entity_deleted'
  | 'narrator_post';
export type ReportStatus = 'open' | 'resolved' | 'dismissed';
export type ReportTargetType = 'title' | 'narrator' | 'chapter' | 'comment' | 'user' | 'collection';
export type JobStatus = 'queued' | 'processing' | 'done' | 'error';
export type ModRequestAction = 'create' | 'update' | 'delete' | 'transfer';
export type ModRequestStatus = 'pending' | 'approved' | 'rejected';
export type ModRequestEntityType = 'narrator' | 'title' | 'chapter' | 'author';

/** Minimal user reference used inside many shapes. */
export interface UserBrief {
  id: number;
  username: string;
  avatar_url: string | null;
}

export interface NotificationPrefs {
  new_chapter: boolean;
  narrator_release: boolean;
  comment_reply: boolean;
  narrator_comment: boolean;
  mention: boolean;
  system: boolean;
  request_approved: boolean;
  request_rejected: boolean;
  entity_modified: boolean;
  entity_deleted: boolean;
  narrator_post: boolean;
}

export interface UserPublic {
  id: number;
  username: string;
  bio: string;
  socials: string[];
  avatar_url: string | null;
  cover_url: string | null;
  role: Role;
  created_at: string;
}

/** Provider sign-in methods this deployment has configured. */
export type AuthProvider = 'google' | 'discord' | 'telegram';

/** One linked third-party account. */
export interface Identity {
  provider: AuthProvider;
  /** Address the provider reports, if any. Telegram never has one. */
  email: string | null;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
}

export interface Me extends UserPublic {
  /** null on a Telegram-only account, which never receives an address. */
  email: string | null;
  /** False on a provider-only account: offer "set password", not "change". */
  has_password: boolean;
  identities: Identity[];
  is_banned: boolean;
  ban_reason: string | null;
  /** Admin-granted: this user's submissions skip the moderation queue. */
  skip_moderation: boolean;
  /** Always false when the server has no mailer configured. */
  email_verified: boolean;
  notification_prefs: NotificationPrefs;
  content_prefs: ContentPrefs;
  narrators_count: number;
}

/**
 * What the viewer has chosen to hide from listings. Defaults (also applied to
 * signed-out visitors): 18+ hidden, every sensitive tag shown.
 */
export interface ContentPrefs {
  hide_nsfw: boolean;
  /** Genre ids the viewer has switched off. */
  hidden_genres: number[];
}

export interface Notification {
  id: number;
  type: NotificationType;
  body: string;
  link: string;
  is_read: boolean;
  created_at: string;
}

export interface Genre {
  id: number;
  slug: string;
  name: string;
  titles_count: number;
  /** Admin-flagged: hidden from signed-out visitors, like 18+ titles. */
  is_sensitive: boolean;
}

/** A genre as it travels attached to a title. */
export interface GenreTag {
  id: number;
  slug: string;
  name: string;
  is_sensitive: boolean;
}

/** GET /mod/trash — one soft-deleted row of any kind. */
export type TrashKind = 'title' | 'narrator' | 'author' | 'chapter' | 'comment';

export interface TrashEntry {
  kind: TrashKind;
  id: number;
  name: string;
  /** Extra context: the parent title for a chapter, the author for a comment. */
  context: string;
  link: string;
  deleted_at: string | null;
}

/** GET /mod/words — one entry of the admin-configured forbidden word list. */
export interface BannedWord {
  id: number;
  word: string;
  match_mode: 'substring' | 'word';
  note: string;
  created_by: string | null;
  created_at: string;
}

export interface AuthorBrief {
  id: number;
  slug: string;
  name: string;
}

export interface TitleCard {
  id: number;
  slug: string;
  name: string;
  author: AuthorBrief | null;
  year: number | null;
  cover_url: string | null;
  cover_thumb_url: string | null;
  release_status: ReleaseStatus;
  avg_rating: number | null;
  rating_count: number;
  listens: number;
  genres: GenreTag[];
  age_rating: string | null;
  my_favorite: boolean;
  is_deleted: boolean;
  /** 18+ mark: visible to everyone, but playable only when signed in. */
  is_nsfw: boolean;
  /** True when one of the title's genres is admin-flagged as sensitive. */
  has_sensitive_genre: boolean;
  /**
   * True when the current viewer is signed out and the title is gated (18+ or
   * sensitive genre): the UI blurs the cover and blocks playback.
   */
  is_restricted: boolean;
}

export interface ChapterRow {
  id: number;
  volume_id: number;
  number: number;
  name: string;
  duration_seconds: number;
  audio_status: AudioStatus;
  mod_status: ModStatus;
  my_position: number | null;
  /** Narrators credited on this specific chapter (a chapter may have several). */
  narrators: { id: number; slug: string; name: string }[];
  /** Soft-deleted; only editors and staff ever see these. */
  is_deleted: boolean;
}

export interface Volume {
  id: number;
  number: number;
  name: string;
  chapters: ChapterRow[];
}

export interface NarratorCard {
  id: number;
  slug: string;
  name: string;
  avatar_url: string | null;
  avatar_thumb_url: string | null;
  titles_count: number;
  is_deleted: boolean;
}

export interface NarratorFull extends NarratorCard {
  bio: string;
  socials: string[];
  cover_url: string | null;
  cover_thumb_url: string | null;
  mod_status: ModStatus;
  created_at: string;
  titles: TitleCard[];
  subscribers_count: number;
  my_subscription: boolean;
  is_self: boolean;
  admin_contact: string | null;
  can_edit: boolean;
  my_role: 'owner' | 'editor' | null;
}

export interface TitleFull extends TitleCard {
  alt_names: string[];
  description: string;
  bg_url: string | null;
  views_count: number;
  mod_status: ModStatus;
  created_at: string;
  updated_at: string;
  favorites_count: number;
  my_favorite: boolean;
  narrators: (NarratorCard & { narration_status: NarrationStatus })[];
  my_rating: number | null;
  my_library: { status: LibraryStatus; note: string } | null;
  rating_distribution: Record<string, number>;
  similar: TitleCard[];
  volumes: Volume[];
  source_url: string | null;
  age_rating: string | null;
  author: AuthorBrief | null;
  can_edit: boolean;
  /** True when the viewer is signed out and the title is 18+: playback stripped. */
  nsfw_restricted?: boolean;
}

export interface ChapterPlay {
  id: number;
  number: number;
  name: string;
  duration_seconds: number;
  audio_url: string;
  my_position: number | null;
  volume: { id: number; number: number; name: string };
  title: { id: number; slug: string; name: string; cover_url: string | null };
  prev_id: number | null;
  next_id: number | null;
  narrator: { id: number; slug: string; name: string } | null;
}

export interface Comment {
  id: number;
  user: UserBrief & { role?: Role } | null;
  target_type: CommentTargetType;
  target_id: number;
  parent_id: number | null;
  body: string;
  score: number;
  my_vote: -1 | 0 | 1;
  is_deleted: boolean;
  /** True when a moderator/admin edited someone else's comment. */
  edited_by_staff: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface UserComment extends Comment {
  target: { type: CommentTargetType; id: number; name: string; link: string };
}

export interface LibraryEntry {
  title: TitleCard;
  status: LibraryStatus;
  note: string;
  updated_at: string;
}

export interface ContinueItem {
  title: { id: number; slug: string; name: string; cover_url: string | null };
  chapter: { id: number; name: string; number: number; duration_seconds: number };
  position_seconds: number;
  updated_at: string;
}

export interface HistoryItem {
  chapter: { id: number; name: string; number: number; duration_seconds: number };
  title: { id: number; slug: string; name: string; cover_url: string | null };
  position_seconds: number;
  updated_at: string;
}

export interface CollectionCard {
  id: number;
  name: string;
  description: string;
  is_public: boolean;
  user: UserBrief;
  items_count: number;
  likes_count: number;
  cover_urls: string[];
  created_at: string;
  updated_at: string;
}

export interface CollectionFull extends CollectionCard {
  my_like: boolean;
  items: { position: number; note: string; title: TitleCard }[];
}

export interface Announcement {
  id: number;
  /** Own URL segment: /news/{slug}. */
  slug: string;
  title: string;
  /** Markdown. */
  body: string;
  author: { id: number; username: string } | null;
  is_published: boolean;
  /** Hidden from the home page but still listed on /news. */
  is_hidden: boolean;
  created_at: string;
}

/** A post by a narrator to its subscribers. Body is markdown. */
export interface NarratorPost {
  id: number;
  narrator: { id: number; slug: string; name: string; avatar_url: string | null } | null;
  title: string;
  body: string;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
}

export interface Report {
  id: number;
  target_type: ReportTargetType;
  target_id: number;
  reason: string;
  status: ReportStatus;
  resolution_note: string;
  reporter: { id: number; username: string } | null;
  target_preview: string;
  target_link: string;
  created_at: string;
  resolved_at: string | null;
}

export interface AuditEntry {
  id: number;
  actor: { id: number; username: string } | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface ModRequest {
  id: number;
  entity_type: ModRequestEntityType;
  entity_id: number | null;
  action: ModRequestAction;
  payload: Record<string, unknown>;
  status: ModRequestStatus;
  review_note: string;
  submitted_by: { id: number; username: string } | null;
  entity: Record<string, unknown> | null;
  created_at: string;
  reviewed_at: string | null;
  retry_count: number;
  can_retry: boolean;
}

export interface Job {
  id: number;
  chapter_id: number;
  chapter_name: string;
  title_name: string;
  status: JobStatus;
  attempts: number;
  error: string;
  created_at: string;
  finished_at: string | null;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  per_page: number;
  total: number;
}

// ---------------------------------------------------------------------------
// Convenience shapes for specific endpoints (derived from API.md)
// ---------------------------------------------------------------------------

/** GET /home */
export interface HomeData {
  announcements: Announcement[];
  continue: ContinueItem[];
  new_titles: TitleCard[];
  popular: TitleCard[];
  top_rated: TitleCard[];
  recently_updated: TitleCard[];
}

/** GET /search/suggest */
export interface SearchSuggest {
  titles: { id: number; slug: string; name: string; author: AuthorBrief | null; cover_url: string | null }[];
  narrators: { id: number; slug: string; name: string; avatar_url: string | null }[];
}

/** GET /users/{username} */
export interface UserProfile {
  user: UserPublic;
  stats: {
    planning: number;
    in_progress: number;
    completed: number;
    dropped: number;
    comments: number;
    favorites: number;
  };
}

/** GET /panel/narrators/{id}/stats */
export interface NarratorStats {
  subscribers_count: number;
  totals: { listens: number; favorites: number; ratings: number };
  titles: {
    id: number;
    slug: string;
    name: string;
    listens: number;
    avg_rating: number | null;
    rating_count: number;
    favorites_count: number;
    chapters_count: number;
  }[];
}

export interface Author {
  id: number;
  name: string;
  slug: string;
  titles_count: number;
}

export interface AuthorFull extends Author {
  bio: string;
  links: string[];
  titles: TitleCard[];
  created_at: string;
  can_edit: boolean;
}

export interface DmcaRequest {
  id: number;
  name: string;
  email: string;
  country: string;
  /** Legacy single-URL column; kept as a fallback for pre-v2 claims. */
  content_url: string;
  content_urls: string[];
  original_urls: string[];
  proof_url: string;
  description: string;
  status: 'open' | 'resolved' | 'dismissed';
  resolution_note: string;
  reporter: { id: number; username: string } | null;
  created_at: string;
  resolved_at: string | null;
}

/** GET /mod/dashboard */
export interface DashboardStats {
  users: number;
  new_users_7d: number;
  titles_total: number;
  titles_pending: number;
  chapters_total: number;
  narrators_total: number;
  comments_total: number;
  collections_total: number;
  listens_total: number;
  pending_requests: number;
  open_reports: number;
  jobs_queued: number;
  jobs_processing: number;
  jobs_error: number;
}
