import { Course } from '../types';
import { exportAsCsv, exportAsTxt } from '../utils/exportSchedule';

interface EnrolledSidebarProps {
  enrolled: Course[];
  totalCredits: number;
  onDrop: (courseId: string) => void;
  onClearAll: () => void;
  username: string;
  onLogout: () => void;
}

export function EnrolledSidebar({
  enrolled,
  totalCredits,
  onDrop,
  onClearAll,
  username,
  onLogout,
}: EnrolledSidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="user-info">
          <span className="user-avatar">👤</span>
          <span className="user-name">{username}</span>
        </div>
        <button className="btn-logout" onClick={onLogout}>
          Sign out
        </button>
      </div>

      <div className="credits-summary" data-testid="credits-counter">
        <span className="credits-label">Total Credits</span>
        <span className="credits-value">{totalCredits}</span>
      </div>

      <h2 className="sidebar-title">My Schedule</h2>

      {enrolled.length === 0 ? (
        <p className="empty-enrolled" data-testid="empty-enrolled">
          No courses enrolled yet. Browse the catalog to add courses.
        </p>
      ) : (
        <ul className="enrolled-list" data-testid="enrolled-list">
          {enrolled.map((course) => (
            <li key={course.id} className="enrolled-item" data-testid={`enrolled-${course.id}`}>
              <div className="enrolled-info">
                <span className="enrolled-id">{course.id}</span>
                <span className="enrolled-name">{course.name}</span>
                <span className="enrolled-time">{course.timeslot}</span>
              </div>
              <button
                className="btn-drop-small"
                onClick={() => onDrop(course.id)}
                aria-label={`Drop ${course.name}`}
                data-testid={`sidebar-drop-${course.id}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {enrolled.length > 0 && (
        <div className="sidebar-actions">
          <button
            className="btn-export"
            onClick={() => exportAsTxt(enrolled)}
            data-testid="export-txt"
          >
            Export .txt
          </button>
          <button
            className="btn-export"
            onClick={() => exportAsCsv(enrolled)}
            data-testid="export-csv"
          >
            Export .csv
          </button>
          <button className="btn-clear" onClick={onClearAll} data-testid="clear-all">
            Clear All
          </button>
        </div>
      )}
    </aside>
  );
}
