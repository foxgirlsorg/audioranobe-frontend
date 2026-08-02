
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
  | 'narrator_post';
export type ReportStatus = 'open' | 'resolved' | 'dismissed';
export type ReportTargetType = 'title' | 'narrator' | 'chapter' | 'comment' | 'user' | 'collection';
export type JobStatus = 'queued' | 'processing' | 'done' | 'error';
export type ModRequestAction = 'create' | 'update' | 'delete' | 'transfer';
export type ModRequestStatus = 'pending' | 'approved' | 'rejected';
export type ModRequestEntityType = 'narrator' | 'title' | 'chapter' | 'author';

export interface UserBrief {
  username: string;
  display_name: string;
  id: number;
  avatar_url: string | null;
}

/** `system` has no key: hand-written announcements are not opt-out. */
export interface NotificationPrefs {
  new_chapter: boolean;
  narrator_release: boolean;
  narrator_post: boolean;
  comment_reply: boolean;
  narrator_comment: boolean;
  mention: boolean;
  request_reviewed: boolean;
  entity_modified: boolean;
  entity_deleted: boolean;
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
  created_at: string;
}

export type AuthProvider = 'google' | 'discord' | 'telegram';

export interface Identity {
  provider: AuthProvider;
  email: string | null;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
}

export interface Me extends UserPublic {
  email: string | null;
  has_password: boolean;
  identities: Identity[];
  display_name: string;
  needs_setup: boolean;
  is_banned: boolean;
  ban_reason: string | null;
  skip_moderation: boolean;
  email_verified: boolean;
  notification_prefs: NotificationPrefs;
  content_prefs: ContentPrefs;
  narrators_count: number;
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
}

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
  owner: { id: number; username: string } | null;
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

export interface SearchSuggest {
  titles: { id: number; slug: string; name: string; author: AuthorBrief | null; cover_url: string | null }[];
  narrators: { id: number; slug: string; name: string; avatar_url: string | null }[];
  authors: { id: number; slug: string; name: string; titles_count: number }[];
  collections: { id: number; name: string; items_count: number }[];
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
  jobs_queued: number;
  jobs_processing: number;
  jobs_error: number;
}
