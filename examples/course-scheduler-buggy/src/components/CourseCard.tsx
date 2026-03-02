import { Course } from '../types';

interface CourseCardProps {
  course: Course;
  isEnrolled: boolean;
  onEnroll: (course: Course) => void;
  onDrop: (courseId: string) => void;
  conflictMessage?: string;
}

export function CourseCard({ course, isEnrolled, onEnroll, onDrop, conflictMessage }: CourseCardProps) {
  return (
    <div
      className={`course-card ${isEnrolled ? 'enrolled' : ''}`}
      data-testid={`course-card-${course.id}`}
    >
      <div className="course-header">
        <span className="course-id">{course.id}</span>
        <span className="course-credits">{course.credits} cr</span>
      </div>
      <h3 className="course-name">{course.name}</h3>
      <p className="course-instructor">👤 {course.instructor}</p>
      <p className="course-timeslot">🕐 {course.timeslot}</p>
      <p className="course-description">{course.description}</p>

      {conflictMessage && (
        <p className="conflict-warning" data-testid={`conflict-${course.id}`}>
          ⚠️ {conflictMessage}
        </p>
      )}

      <div className="course-actions">
        {isEnrolled ? (
          <button
            className="btn-drop"
            onClick={() => onDrop(course.id)}
            data-testid={`drop-${course.id}`}
          >
            Drop Course
          </button>
        ) : (
          <button
            className="btn-enroll"
            onClick={() => onEnroll(course)}
            data-testid={`enroll-${course.id}`}
          >
            + Enroll
          </button>
        )}
      </div>
    </div>
  );
}
