// The genre selector. User-mutable at any time; the parent re-runs the match on
// the current text whenever the selection changes (genre is a matching constraint,
// re-read on every query, not a filter applied after the fact).

import { GENRES } from "@/lib/types";
import type { Genre } from "@/lib/types";

interface Props {
  value: Genre;
  onChange: (genre: Genre) => void;
}

export default function GenreSelector({ value, onChange }: Props) {
  return (
    <div className="genres" role="group" aria-label="Genre">
      {GENRES.map((genre) => (
        <button
          key={genre}
          type="button"
          className="genre-chip"
          aria-pressed={genre === value}
          onClick={() => onChange(genre)}
        >
          {genre}
        </button>
      ))}
    </div>
  );
}
