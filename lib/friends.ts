export const FRIENDS_CHANGED = 'friends:changed';

export function emitFriendsChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(FRIENDS_CHANGED));
  }
}
