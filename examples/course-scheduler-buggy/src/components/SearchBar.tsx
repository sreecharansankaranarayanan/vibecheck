interface SearchBarProps {
  query: string;
  onChange: (q: string) => void;
}

export function SearchBar({ query, onChange }: SearchBarProps) {
  return (
    <div className="search-bar">
      <span className="search-icon">🔍</span>
      <input
        type="text"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search by course name, instructor, or ID..."
        data-testid="search-input"
      />
      {query && (
        <button className="search-clear" onClick={() => onChange('')} aria-label="Clear search">
          ✕
        </button>
      )}
    </div>
  );
}
