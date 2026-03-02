export function exportAsCsv(courses) {
    const header = 'ID,Name,Instructor,Credits,Timeslot';
    const rows = courses.map((c) => `${c.id},"${c.name}","${c.instructor}",${c.credits},"${c.timeslot}"`);
    const csv = [header, ...rows].join('\n');
    downloadFile(csv, 'my-schedule.csv', 'text/csv');
}
export function exportAsTxt(courses) {
    const totalCredits = courses.reduce((sum, c) => sum + c.credits, 0);
    const lines = [
        'MY COURSE SCHEDULE',
        '==================',
        '',
        ...courses.map((c) => `[${c.id}] ${c.name}\n  Instructor: ${c.instructor}\n  Time: ${c.timeslot}\n  Credits: ${c.credits}`),
        '',
        `Total Credits: ${totalCredits}`,
    ];
    downloadFile(lines.join('\n'), 'my-schedule.txt', 'text/plain');
}
function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
