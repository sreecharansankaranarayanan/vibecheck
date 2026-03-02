import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Login } from './components/Login';
import { CourseList } from './components/CourseList';
import { EnrolledSidebar } from './components/EnrolledSidebar';
import { useEnrollment } from './hooks/useEnrollment';
import coursesData from './data/courses.json';
import './styles.css';
export function App() {
    const [view, setView] = useState('login');
    const [username, setUsername] = useState('');
    const { enrolled, totalCredits, enroll, drop, isEnrolled, clearAll } = useEnrollment();
    function handleLogin(user) {
        setUsername(user);
        setView('scheduler');
    }
    function handleLogout() {
        setView('login');
        setUsername('');
    }
    if (view === 'login') {
        return _jsx(Login, { onLogin: handleLogin });
    }
    return (_jsxs("div", { className: "app-layout", "data-testid": "scheduler-view", children: [_jsxs("header", { className: "app-header", children: [_jsx("h1", { children: "\uD83D\uDCDA Course Scheduler" }), _jsx("span", { className: "semester-label", children: "Spring 2026" })] }), _jsxs("div", { className: "app-body", children: [_jsx("main", { className: "main-panel", children: _jsx(CourseList, { courses: coursesData, enrolled: enrolled, isEnrolled: isEnrolled, onEnroll: enroll, onDrop: drop }) }), _jsx(EnrolledSidebar, { enrolled: enrolled, totalCredits: totalCredits, onDrop: drop, onClearAll: clearAll, username: username, onLogout: handleLogout })] })] }));
}
