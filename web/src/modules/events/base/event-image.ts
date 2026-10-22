// Resolve an event's display image from the backend record.
//
// The event schema (src/lib/models/events/event.ts) defines:
//   - coverImage: FileInfo
//   - logo:       FileInfo
//   - images:     FileInfo[]
//
// Some older records / denormalized ticket responses use `image` instead.
// This helper tries all of them in order so UI components render correctly
// regardless of which field the backend populated.
//
// FileInfo can be either a string URL or an object with { url, path, ... }.

type FileLike = string | { url?: string; path?: string } | null | undefined;

const fileUrl = (f: FileLike): string | null => {
  if (!f) return null;
  if (typeof f === 'string') return f;
  return f.url || f.path || null;
};

export const getEventImageUrl = (event: any): string | null => {
  if (!event) return null;
  const e = event.data || event;
  return (
    fileUrl(e.coverImage) ||
    fileUrl(Array.isArray(e.images) ? e.images[0] : null) ||
    fileUrl(e.image) ||
    fileUrl(e.logo) ||
    null
  );
};

// Return every image associated with an event — coverImage first, then each
// entry in images[], de-duped. Used by ticket/event detail views that want to
// show a full gallery instead of just the hero.
export const getEventImageUrls = (event: any): string[] => {
  if (!event) return [];
  const e = event.data || event;
  const urls: string[] = [];
  const push = (f: FileLike) => {
    const u = fileUrl(f);
    if (u && !urls.includes(u)) urls.push(u);
  };
  push(e.coverImage);
  if (Array.isArray(e.images)) e.images.forEach(push);
  push(e.image);
  return urls;
};

export const getEventLogoUrl = (event: any): string | null => {
  if (!event) return null;
  const e = event.data || event;
  return fileUrl(e.logo) || null;
};

// Participants / speakers may use `image`, `avatar`, or `photo`.
export const getPersonImageUrl = (person: any): string | null => {
  if (!person) return null;
  const p = person.data || person;
  return fileUrl(p.image) || fileUrl(p.avatar) || fileUrl(p.photo) || null;
};
