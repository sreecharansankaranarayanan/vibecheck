import { useState } from 'react';
import { AppView } from './types';
import { Login } from './components/Login';
import { CourseList } from './components/CourseList';
import { EnrolledSidebar } from './components/EnrolledSidebar';
import { useEnrollment } from './hooks/useEnrollment';
import coursesData from './data/courses.json';
import './styles.css';

export function App() {
  const [view, setView] = useState<AppView>('login');
  const [username, setUsername] = useState('');
  const { enrolled, totalCredits, enroll, drop, isEnrolled, clearAll } = useEnrollment();

  function handleLogin(user: string) {
    setUsername(user);
    setView('scheduler');
  }

  function handleLogout() {
    setView('login');
    setUsername('');
  }

  if (view === 'login') {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="app-layout" data-testid="scheduler-view">
      <header className="app-header">
        <h1>📚 Course Scheduler</h1>
        <span className="semester-label">Spring 2026</span>
      </header>

      <div className="app-body">
        <main className="main-panel">
          <CourseList
            courses={coursesData}
            enrolled={enrolled}
            isEnrolled={isEnrolled}
            onEnroll={enroll}
            onDrop={drop}
          />
        </main>

        <EnrolledSidebar
          enrolled={enrolled}
          totalCredits={totalCredits}
          onDrop={drop}
          onClearAll={clearAll}
          username={username}
          onLogout={handleLogout}
        />
      </div>
    </div>
  );
}
