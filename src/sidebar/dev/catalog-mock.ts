// Dev-only: a fabricated Spring 2027 catalog seeded into IndexedDB, so the Plan
// can fill requirements, resolve registered classes and pick backups in the
// harness exactly as it does against a real catalog. No real sections.
import { saveCourses } from "../../shared/db";
import type { Course, Day, Section, SectionAttribute } from "../../shared/types";

const EP3: SectionAttribute = { code: "EP3", description: "Eloquentia Perfecta 3" };
const PLUR: SectionAttribute = { code: "PLUR", description: "Pluralism in the U.S." };

const sec = (
  crn: string,
  section: string,
  days: Day[],
  startTime: string,
  endTime: string,
  seatsAvailable: number,
  attributes: SectionAttribute[] = [],
  instructor = "Prof. Example"
): Section => ({
  crn,
  section,
  instructor,
  seatsAvailable,
  campus: "Rose Hill",
  deliveryMode: "in_person",
  meetings: [{ days, startTime, endTime, building: "Keating", room: "206" }],
  attributes,
});

const course = (courseCode: string, title: string, credits: number, sections: Section[]): Course => ({
  courseCode,
  subject: courseCode.split(" ")[0],
  title,
  credits,
  description: "",
  prerequisites: "",
  sections,
});

export const MOCK_CATALOG: Course[] = [
  // Registered for Spring 2027 (see the audit summary's `registered`)
  course("CISC 3500", "Database Systems", 4, [sec("42001", "R01", ["T", "R"], "10:00", "11:15", 4)]),
  course("MATH 2006", "Discrete Mathematics", 4, [
    sec("42010", "R01", ["M", "W"], "08:30", "09:45", 2),
    sec("42011", "R02", ["M", "W"], "13:00", "14:15", 5),
  ]),
  course("ARHI 1101", "Art History Survey", 3, [
    sec("42020", "R01", ["F"], "09:00", "11:45", 10),
    sec("42021", "R02", ["W"], "18:00", "20:45", 8),
  ]),
  // EP3
  course("ENGL 3014", "Writing the City", 3, [sec("41021", "R01", ["T", "F"], "13:00", "14:15", 6, [EP3])]),
  course("COMM 3233", "Rhetoric of Public Life", 3, [sec("41388", "R01", ["T"], "14:30", "17:15", 3, [EP3], "Prof. Sample")]),
  course("PHIL 3712", "Ethics of Persuasion", 3, [sec("41507", "R01", ["T", "R"], "11:30", "12:45", 2, [EP3], "Prof. Placeholder")]),
  // Pluralism
  course("SOCI 2400", "Race and Ethnicity", 3, [sec("41833", "R01", ["M", "R"], "14:30", "15:45", 12, [PLUR], "Prof. Sample")]),
  course("HIST 3050", "The City in History", 3, [sec("41912", "R01", ["T", "R"], "14:00", "15:15", 7, [PLUR], "Prof. Mock")]),
  course("THEO 3310", "Faith and Argument", 3, [sec("41662", "R01", ["T", "R"], "16:00", "17:15", 5, [EP3, PLUR], "Prof. Mock")]),
  // Upper-level CISC
  course("CISC 4615", "Data Communications and Networks", 4, [
    sec("41790", "R01", ["M", "W"], "10:00", "11:15", 9),
    sec("41791", "R02", ["T", "F"], "11:30", "12:45", 3),
  ]),
  course("CISC 4080", "Computer Algorithms", 4, [sec("41780", "R01", ["M", "W"], "13:00", "14:15", 0)]),
  course("CISC 4631", "Data Mining", 4, [sec("41795", "R01", ["W"], "16:00", "18:45", 6, [], "Prof. Sample")]),
  course("CISC 4999", "Senior Capstone", 4, [sec("41799", "R01", ["F"], "13:00", "15:45", 11, [], "Prof. Mock")]),
];

export async function seedMockCatalog(): Promise<void> {
  await saveCourses(MOCK_CATALOG);
}
