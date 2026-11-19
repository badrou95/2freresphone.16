import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number;
  count?: number;
  size?: 'sm' | 'md';
  showNumeric?: boolean;
}

export function StarRating({ rating, count, size = 'sm', showNumeric = true }: StarRatingProps) {
  const iconSize = size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5';
  const rounded = Math.round(rating);

  return (
    <div className="inline-flex items-center gap-1.5" aria-label={`Note ${rating} sur 5`}>
      <div className="inline-flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${iconSize} ${
              star <= rounded
                ? 'fill-amber-500 text-amber-500'
                : 'fill-slate-100 text-slate-300'
            }`}
          />
        ))}
      </div>
      {showNumeric && (
        <span className="text-xs text-slate-600 tabular-nums">
          {rating > 0 ? rating.toFixed(1) : '—'}
          {typeof count === 'number' && (
            <span className="text-slate-400"> ({count})</span>
          )}
        </span>
      )}
    </div>
  );
}

interface StarInputProps {
  value: number;
  onChange: (rating: number) => void;
}

export function StarInput({ value, onChange }: StarInputProps) {
  return (
    <div className="inline-flex items-center gap-1" role="radiogroup" aria-label="Choisir une note de 1 à 5 étoiles">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          aria-label={`${star} étoile${star > 1 ? 's' : ''}`}
          aria-checked={value === star}
          role="radio"
          className="p-1 rounded hover:bg-amber-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <Star
            className={`w-6 h-6 transition-colors ${
              star <= value
                ? 'fill-amber-500 text-amber-500'
                : 'fill-slate-100 text-slate-300 hover:text-amber-400'
            }`}
          />
        </button>
      ))}
    </div>
  );
}
