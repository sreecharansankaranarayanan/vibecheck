import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function SearchBar({ query, onChange }) {
    return (_jsxs("div", { className: "search-bar", children: [_jsx("span", { className: "search-icon", children: "\uD83D\uDD0D" }), _jsx("input", { type: "text", value: query, onChange: (e) => onChange(e.target.value), placeholder: "Search by course name, instructor, or ID...", "data-testid": "search-input" }), query && (_jsx("button", { className: "search-clear", onClick: () => onChange(''), "aria-label": "Clear search", children: "\u2715" }))] }));
}
