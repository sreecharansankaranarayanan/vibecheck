// ─────────────────────────────────────────────────────────────────────────────
// STARTER SHELL — Course Scheduler
//
// The Login component is fully implemented and provided.
// Your job: implement the Dashboard (everything shown after login).
//
// FEATURES TO BUILD (90-minute task — see TASK.md for the full spec):
//
//   [ ] 1. Render the course catalog from src/data/courses.json (20+ courses)
//   [ ] 2. Display each course's name, instructor, credits, and timeslot
//   [ ] 3. Allow a user to enroll in a course (add to "My Schedule" sidebar)
//   [ ] 4. Prevent enrolling in the same course twice
//   [ ] 5. Detect time conflicts — block enrollment if timeslots overlap
//   [ ] 6. Show a warning message when a conflict is detected
//   [ ] 7. Display a live credit counter that updates on enroll/drop
//   [ ] 8. Persist enrollment to localStorage so it survives page refresh
//   [ ] 9. Allow dropping a course from the sidebar
//   [ ] 10. Search/filter the catalog by course name or instructor
//   [ ] 11. Export the enrolled schedule as a .txt or .csv file
//   [ ] 12. Detect back-to-back conflicts (courses on the same day with no gap)
//
// You may use AI to help generate code. VibeCheck will ask you to explain
// each code block before it is applied.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { AppView } from "./types";
import { Login } from "./components/Login";
import { CourseCatalog } from "./components/CourseCatalog";

export function App() {
  const [view, setView] = useState<AppView>("login");
  const [username, setUsername] = useState("");

  function handleLogin(user: string) {
    setUsername(user);
    setView("scheduler");
  }

  if (view === "login") {
    return <Login onLogin={handleLogin} />;
  }

  // TODO: Replace this placeholder with your Dashboard implementation.
  // Import your components and hooks here as you build them.
  return (
    <div
      data-testid="scheduler-view"
      style={{
        minHeight: "100vh",
        background: "#0f1117",
        color: "#e2e8f0",
        fontFamily: "sans-serif",
        padding: 40,
      }}
    >
      <h1>📚 Course Scheduler — {username}</h1>
      <p style={{ color: "#8892b0", marginTop: 12 }}>
        Build your scheduler here. See TASK.md for the full feature list.
      </p>
      <CourseCatalog />
    </div>
  );
}
