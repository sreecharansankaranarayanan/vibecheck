import type { Course } from '../types';
import coursesData from '../data/courses.json';

const courses = coursesData as Course[];

export function CourseCatalog() {
  return (
    <section aria-label="Course catalog" style={{ marginTop: 24 }}>
      <h2 style={{ fontSize: '1.25rem', marginBottom: 16, color: '#e2e8f0' }}>
        Course Catalog
      </h2>
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'grid',
          gap: 12,
        }}
      >
        {courses.map((course) => (
          <li
            key={course.id}
            style={{
              padding: '14px 18px',
              background: '#1a1f2e',
              borderRadius: 8,
              border: '1px solid #2d3748',
            }}
          >
            <div style={{ fontWeight: 600, color: '#f7fafc', marginBottom: 6 }}>
              {course.name}
            </div>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '12px 20px',
                fontSize: '0.9rem',
                color: '#a0aec0',
              }}
            >
              <span>Instructor: {course.instructor}</span>
              <span>{course.credits} credits</span>
              <span>Timeslot: {course.timeslot}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
