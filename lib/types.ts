
export type Role = 'user' | 'moderator' | 'admin';
export type ModStatus = 'pending' | 'approved' | 'rejected';
export type ReleaseStatus = 'ongoing' | 'completed' | 'abandoned' | 'frozen';
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
  | 'request_reviewed'
  // Retired in favour of request_reviewed, but rows already in the table keep
  // their original type and still have to render.
  | 'request_approved'
  | 'request_rejected'
  | 'entity_modified'
  | 'entity_deleted'
  | 'narrator_post'
  | 'friend_request'
  | 'friend_accept'
  | 'narration_ready'
  | 'badge_earned';
export type ReportStatus = 'open' | 'resolved' | 'dismissed';
export type ReportTargetType = 'title' | 'narrator' | 'chapter' | 'comment' | 'user' | 'collection';
export type JobStatus = 'queued' | 'processing' | 'done' | 'error';
export type ModRequestAction = 'create' | 'update' | 'delete' | 'transfer';
export type ModRequestStatus = 'pending' | 'approved' | 'rejected';
export type ModRequestEntityType = 'narrator' | 'title' | 'chapter' | 'author';

export type PresenceStatus = 'online' | 'offline';

export interface UserBrief {
  username: string;
  display_name: string;
  id: number;
  avatar_url: string | null;
  role: Role;
  is_developer: boolean;
  is_donator: boolean;
  is_banned: boolean;
  /** Derived server-side; 'offline' on briefs whose query omits presence cols. */
  presence: PresenceStatus;
  last_seen_at: string | null;
}

/** `system` has no key: hand-written announcements are not opt-out. */
export interface NotificationPrefs {
  new_chapter: boolean;
  narrator_release: boolean;
  narrator_post: boolean;
  comment_reply: boolean;
  narrator_comment: boolean;
  mention: boolean;
  friend_request: boolean;
  request_reviewed: boolean;
  entity_modified: boolean;
  entity_deleted: boolean;
  narration_ready: boolean;
}

export interface UserPublic {
  id: number;
  username: string;
  display_name: string;
  bio: string;
  socials: string[];
  avatar_url: string | null;
  cover_url: string | null;
  role: Role;
  is_developer: boolean;
  is_donator: boolean;
  is_banned: boolean;
  created_at: string;
  presence: PresenceStatus;
  last_seen_at: string | null;
}

export type AuthProvider = 'google' | 'discord' | 'telegram';

export interface Identity {
  provider: AuthProvider;
  email: string | null;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
}

// Viewer = the slim identity/flags the backend ships in the X-Me header on every
// response, and what the auth context carries. Deliberately excludes the big
// fields (bio, socials, identities, prefs) — a large bio would overflow the
// proxy's response-header buffer. Those live only on Me (fetched from GET /me).
export interface Viewer {
  id: number;
  username: string;
  /** Raw value (may be empty); callers fall back to username themselves. */
  display_name: string;
  avatar_url: string | null;
  cover_url: string | null;
  role: Role;
  is_developer: boolean;
  is_donator: boolean;
  created_at: string;
  email: string | null;
  has_password: boolean;
  needs_setup: boolean;
  is_banned: boolean;
  ban_reason: string | null;
  skip_moderation: boolean;
  accepted_cookies: boolean;
  email_verified: boolean;
  /** Who may DM the user: everyone, or accepted friends only (staff bypass). */
  dm_privacy: DmPrivacy;
}

// Me = Viewer + the heavy profile fields, returned by GET /me (never in a header).
export interface Me extends Viewer {
  bio: string;
  socials: string[];
  identities: Identity[];
  notification_prefs: NotificationPrefs;
  content_prefs: ContentPrefs;
  narrators_count: number;
}

export type DmPrivacy = 'all' | 'friends';

export interface ChatReplyPreview {
  id: number;
  author: string;
  excerpt: string;
  is_deleted: boolean;
  mine: boolean;
}

export interface ChatMessage {
  id: number;
  conversation_id: number;
  sender_id: number | null;
  mine: boolean;
  body: string;
  image_url: string;
  /** 'plain' = escaped text; 'rich' = markdown (mods) / raw HTML (admins). */
  format: 'plain' | 'rich';
  /** Whether the sender's role allows toggling this message off rich rendering. */
  can_toggle_format: boolean;
  plain_text: boolean;
  is_deleted: boolean;
  edited: boolean;
  reply_to: ChatReplyPreview | null;
  created_at: string;
}

export interface ChatConversation {
  user: UserBrief;
  last_message: {
    body: string;
    image_url: string;
    mine: boolean;
    is_deleted: boolean;
    created_at: string;
  } | null;
  last_message_at: string | null;
  unread: number;
}

export interface ChatThread {
  user: UserBrief;
  me_id: number;
  can_send: boolean;
  block_reason: string;
  their_last_read_id: number;
  messages: ChatMessage[];
  has_more: boolean;
}

export interface ContentPrefs {
  hide_nsfw: boolean;
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
  is_sensitive: boolean;
}

export interface GenreTag {
  id: number;
  slug: string;
  name: string;
  is_sensitive: boolean;
}

export type TrashKind = 'title' | 'narrator' | 'author' | 'chapter' | 'comment';

export interface TrashEntry {
  kind: TrashKind;
  id: number;
  name: string;
  context: string;
  link: string;
  deleted_at: string | null;
}

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
  updated_at: string | null;
  chapters_count: number;
  genres: GenreTag[];
  age_rating: string | null;
  my_favorite: boolean;
  is_deleted: boolean;
  is_nsfw: boolean;
  is_ai: boolean;
  has_sensitive_genre: boolean;
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
  narrators: { id: number; slug: string; name: string }[];
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
  is_ai: boolean;
  is_verified: boolean;
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
  /** First page of comments, embedded to save a separate request on load. */
  comments?: Paginated<Comment>;
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
  nsfw_restricted?: boolean;
  /** True for an imported title still narrating — drives the "in progress" banner. */
  narration_pending?: boolean;
  /** True for an imported (AI-narrated) title — enables mod re-narrate controls. */
  is_imported?: boolean;
  /** Viewer opted into a notification for every new comment on this title. */
  comment_subscribed: boolean;
  /** First page of comments, embedded to save a separate request on load. */
  comments?: Paginated<Comment>;
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
  rating: number | null;
  is_favorite: boolean;
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
  slug: string;
  title: string;
  body: string;
  author: { id: number; username: string } | null;
  is_published: boolean;
  is_hidden: boolean;
  created_at: string;
  /** First page of comments, embedded to save a separate request on load. */
  comments?: Paginated<Comment>;
}

export interface NarratorPost {
  id: number;
  narrator: { id: number; slug: string; name: string; avatar_url: string | null } | null;
  title: string;
  body: string;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
  /** First page of comments, embedded to save a separate request on load. */
  comments?: Paginated<Comment>;
}

export interface Report {
  id: number;
  target_type: ReportTargetType;
  target_id: number;
  reason: string;
  status: ReportStatus;
  resolution_note: string;
  reporter: UserBrief | null;
  target_preview: string;
  target_link: string;
  created_at: string;
  resolved_at: string | null;
}

export interface AuditEntry {
  id: number;
  actor: UserBrief | null;
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
  submitted_by: UserBrief | null;
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

/** GET /panel/titles/{id}/jobs — `active` counts the whole title, not the page. */
export interface JobsPage extends Paginated<Job> {
  active: number;
}

export interface ReservedUsername {
  id: number;
  username: string;
  note: string;
  created_by_username: string | null;
  created_at: string;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  per_page: number;
  total: number;
}

export interface ModNarrator {
  id: number;
  slug: string;
  name: string;
  avatar_url: string | null;
  mod_status: ModStatus;
  is_self: boolean;
  titles_count: number;
  subscribers_count: number;
  created_at: string;
  deleted_at: string | null;
  owner: { id: number; username: string; role: Role; is_developer: boolean; is_donator: boolean } | null;
  admin_contact: string | null;
}

export interface ModNarratorList extends Paginated<ModNarrator> {
  counts: { pending: number; approved: number; rejected: number; deleted: number };
}

export interface HomeData {
  announcements: Announcement[];
  continue: ContinueItem[];
  new_titles: TitleCard[];
}

/** A title not in the catalog yet — AI narration can be requested. */
export interface RequestableTitle {
  ref: string;
  name: string;
  cover_url: string | null;
  year: number | null;
  status: string;
}

export interface SearchSuggest {
  titles: { id: number; slug: string; name: string; author: AuthorBrief | null; cover_url: string | null }[];
  narrators: { id: number; slug: string; name: string; avatar_url: string | null }[];
  authors: { id: number; slug: string; name: string; titles_count: number }[];
  collections: { id: number; name: string; items_count: number }[];
  external?: RequestableTitle[];
}

/** Whether the viewer can order a narration now (GET /titles/request-narration). */
export interface OrderStatus {
  authenticated: boolean;
  enabled?: boolean;
  can_order: boolean;
  next_at: string | null;
}

/** A narration queue task (GET /mod/narration-jobs). */
export interface NarrationJob {
  id: number;
  title: { id: number; slug: string; name: string };
  volume: string;
  number: number;
  name: string;
  status: JobStatus;
  attempts: number;
  error: string;
  chapter_id: number | null;
  created_at: string;
  finished_at: string | null;
}

export interface NarrationJobList extends Paginated<NarrationJob> {
  counts: { queued: number; processing: number; done: number; error: number };
}

/** Admin narration settings (GET/PUT /admin/narration-settings). */
export interface NarrationSettings {
  enabled: boolean;
  narrator_id: number | null;
  speaker: string;
  sample_rate: number;
  batch_size: number;
  batch_threshold: number;
  poll_interval_minutes: number;
  has_token: boolean;
}

export type FriendStatus = 'self' | 'none' | 'friends' | 'outgoing' | 'incoming';

export interface Friendship {
  status: FriendStatus;
  friends_count: number;
}

export interface FriendRequestItem {
  user: UserBrief;
  created_at: string;
}

export interface FriendsData {
  friends: UserBrief[];
  incoming: FriendRequestItem[];
  outgoing: FriendRequestItem[];
}

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
  friendship: Friendship;
  can_message: boolean;
}

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
  mods_online: number;
  jobs_queued: number;
  jobs_processing: number;
  jobs_error: number;
}
