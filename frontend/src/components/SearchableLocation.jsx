
import { useState, useEffect, useRef } from "react";
import "./SearchableLocation.css";

function SearchableLocation({
  locations,
  value,
  onChange,
  placeholder,
  label,
}) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  const selectedLocation = locations.find(
    (location) => location.name === value
  );

  const filteredLocations = locations.filter((location) =>
    location.name
      .toLowerCase()
      .includes(search.trim().toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target)
      ) {
        setIsOpen(false);
        setSearch("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, []);

  return (
    <div className="location-search-wrapper" ref={wrapperRef}>
      <label className="location-search-label">
        {label}
      </label>

      <div
        className={`location-search-box ${
          isOpen ? "location-search-active" : ""
        }`}
      >
        <span className="location-search-icon">📍</span>

        <input
          type="text"
          value={
            isOpen
              ? search
              : selectedLocation?.name || ""
          }
          placeholder={placeholder}
          onFocus={() => {
            setSearch("");
            setIsOpen(true);
          }}
          onChange={(event) => {
            setSearch(event.target.value);
            setIsOpen(true);
          }}
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
        />

        {value && (
          <button
            type="button"
            className="location-clear-button"
            aria-label="Clear location"
            onClick={() => {
              onChange("");
              setSearch("");
              setIsOpen(true);
            }}
          >
            ×
          </button>
        )}

        <span className="location-search-arrow">
          {isOpen ? "▲" : "▼"}
        </span>
      </div>

      {isOpen && (
        <div className="location-search-results">
          {filteredLocations.length > 0 ? (
            filteredLocations.map((location) => (
              <button
                type="button"
                className={`location-search-option ${
                  location.name === value
                    ? "location-option-selected"
                    : ""
                }`}
                key={`${location.name}-${location.lat}-${location.lng}`}
                onClick={() => {
                  onChange(location.name);
                  setSearch("");
                  setIsOpen(false);
                }}
              >
                <span>📍</span>
                <span>{location.name.trim()}</span>
                {location.name === value && (
                  <span className="location-option-check">
                    ✓
                  </span>
                )}
              </button>
            ))
          ) : (
            <div className="location-no-results">
              No campus locations found.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SearchableLocation;
