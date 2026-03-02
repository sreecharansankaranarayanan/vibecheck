import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
const MOCK_CREDENTIALS = { username: 'student', password: 'cs2026' };
export function Login({ onLogin }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    function handleSubmit(e) {
        e.preventDefault();
        if (username === MOCK_CREDENTIALS.username && password === MOCK_CREDENTIALS.password) {
            onLogin(username);
        }
        else {
            setError('Invalid credentials. Try student / cs2026');
        }
    }
    return (_jsx("div", { className: "login-page", children: _jsxs("div", { className: "login-card", children: [_jsx("div", { className: "login-logo", children: "\uD83D\uDCDA" }), _jsx("h1", { children: "Course Scheduler" }), _jsx("p", { className: "login-subtitle", children: "Sign in to manage your semester" }), _jsxs("form", { onSubmit: handleSubmit, children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "username", children: "Username" }), _jsx("input", { id: "username", type: "text", value: username, onChange: (e) => setUsername(e.target.value), placeholder: "student", autoComplete: "username", "data-testid": "username-input" })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "password", children: "Password" }), _jsx("input", { id: "password", type: "password", value: password, onChange: (e) => setPassword(e.target.value), placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022", autoComplete: "current-password", "data-testid": "password-input" })] }), error && _jsx("p", { className: "login-error", "data-testid": "login-error", children: error }), _jsx("button", { type: "submit", className: "btn-primary full-width", "data-testid": "login-button", children: "Sign In" })] }), _jsxs("p", { className: "login-hint", children: ["Demo credentials: ", _jsx("code", { children: "student" }), " / ", _jsx("code", { children: "cs2026" })] })] }) }));
}
