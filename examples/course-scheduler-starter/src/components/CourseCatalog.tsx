import { useMemo, useState } from "react";
import { Course } from "../types";
import coursesData from "../data/courses.json";

const courses = coursesData as Course[];

function courseMatchesQuery(course: Course, query: string): boolean {
  if (!query.trim()) {
    return true;
  }
  const q = query.trim().toLowerCase();
  const haystack = [
    course.name,
    course.instructor,
    course.timeslot,
    course.description,
    course.credits.toString(),
    course.days.join(" "),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export function CourseCatalog() {
  const [filter, setFilter] = useState("");

  const visibleCourses = useMemo(
    () => courses.filter((c) => courseMatchesQuery(c, filter)),
    [filter],
  );

  return (
    <section
      data-testid="course-catalog"
      style={{
        marginTop: 24,
        background: "#1a1d27",
        border: "1px solid #2e3250",
        borderRadius: 8,
        padding: 24,
      }}
    >
      <h2 style={{ fontSize: 18, marginBottom: 16, color: "#e2e8f0" }}>
        Course Catalog
      </h2>
      <input
        type="text"
        placeholder="Search courses..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        style={{
          width: "100%",
          marginBottom: 16,
          padding: "8px 12px",
          background: "#22263a",
          border: "1px solid #2e3250",
          borderRadius: 6,
          color: "#e2e8f0",
          fontSize: 14,
          outline: "none",
        }}
      />
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "grid",
          gap: 12,
        }}
      >
        {visibleCourses.map((course) => (
          <li
            key={course.id}
            data-testid={`course-${course.id}`}
            style={{
              padding: "12px 16px",
              background: "#22263a",
              border: "1px solid #2e3250",
              borderRadius: 6,
              display: "grid",
              gridTemplateColumns: "1fr auto auto auto",
              gap: 16,
              alignItems: "center",
            }}
          >
            <span style={{ fontWeight: 600, color: "#e2e8f0" }}>
              {course.name}
            </span>
            <span style={{ color: "#8892b0", fontSize: 14 }}>
              {course.instructor}
            </span>
            <span style={{ color: "#8892b0", fontSize: 14 }}>
              {course.credits} credit{course.credits !== 1 ? "s" : ""}
            </span>
            <span
              style={{
                color: "#64b5f6",
                fontSize: 14,
                fontFamily: "monospace",
              }}
            >
              {course.timeslot}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
