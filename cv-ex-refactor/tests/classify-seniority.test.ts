// Unit tests for classifySeniority — ~10 representative rows per Seniority level.
// Pure function, no IO.

import { describe, it, expect } from 'vitest';
import { classifySeniority } from '@/lib/jobs/classify';

describe('classifySeniority', () => {
  // intern
  it('Software Engineering Intern → intern', () => {
    expect(classifySeniority('Software Engineering Intern')).toBe('intern');
  });
  it('Marketing Internship → intern', () => {
    expect(classifySeniority('Marketing Internship')).toBe('intern');
  });
  it('Thực tập sinh Kỹ thuật → intern', () => {
    expect(classifySeniority('Thực tập sinh Kỹ thuật')).toBe('intern');
  });

  // lead
  it('Tech Lead → lead', () => {
    expect(classifySeniority('Tech Lead')).toBe('lead');
  });
  it('Engineering Manager → mid (no lead keyword)', () => {
    // "Engineering Manager" has no lead/senior/intern/junior keyword → mid
    expect(classifySeniority('Engineering Manager')).toBe('mid');
  });
  it('Principal Software Engineer → lead', () => {
    expect(classifySeniority('Principal Software Engineer')).toBe('lead');
  });
  it('Head of Engineering → lead', () => {
    expect(classifySeniority('Head of Engineering')).toBe('lead');
  });
  it('Chapter Lead → lead', () => {
    expect(classifySeniority('Chapter Lead Frontend')).toBe('lead');
  });

  // senior
  it('Senior Software Engineer → senior', () => {
    expect(classifySeniority('Senior Software Engineer')).toBe('senior');
  });
  it('Sr. Frontend Developer → senior', () => {
    expect(classifySeniority('Sr. Frontend Developer')).toBe('senior');
  });
  it('Sr Backend Engineer → senior', () => {
    expect(classifySeniority('Sr Backend Engineer')).toBe('senior');
  });

  // junior
  it('Junior Developer → junior', () => {
    expect(classifySeniority('Junior Developer')).toBe('junior');
  });
  it('Jr. Software Engineer → junior', () => {
    expect(classifySeniority('Jr. Software Engineer')).toBe('junior');
  });
  it('Fresher Backend Developer → junior', () => {
    expect(classifySeniority('Fresher Backend Developer')).toBe('junior');
  });
  it('Entry-level Data Analyst → junior', () => {
    expect(classifySeniority('Entry-level Data Analyst')).toBe('junior');
  });

  // mid (explicit keyword)
  it('Mid Frontend Engineer → mid', () => {
    expect(classifySeniority('Mid Frontend Engineer')).toBe('mid');
  });
  it('Middle Developer → mid', () => {
    expect(classifySeniority('Middle Developer')).toBe('mid');
  });

  // mid (default fallback)
  it('Software Engineer (no level indicator) → mid (default)', () => {
    expect(classifySeniority('Software Engineer')).toBe('mid');
  });
  it('Product Designer → mid (default)', () => {
    expect(classifySeniority('Product Designer')).toBe('mid');
  });
  it('empty string → mid (default)', () => {
    expect(classifySeniority('')).toBe('mid');
  });

  // case insensitivity
  it('SENIOR DATA SCIENTIST → senior (case-insensitive)', () => {
    expect(classifySeniority('SENIOR DATA SCIENTIST')).toBe('senior');
  });
  it('INTERN Backend → intern (case-insensitive)', () => {
    expect(classifySeniority('INTERN Backend')).toBe('intern');
  });

  // priority: intern before lead (intern check runs first in source)
  it('Lead Intern → intern (intern pattern checked first)', () => {
    expect(classifySeniority('Lead Intern')).toBe('intern');
  });

  // Vietnamese patterns
  it('Trưởng phòng Marketing → lead', () => {
    expect(classifySeniority('Trưởng phòng Marketing')).toBe('lead');
  });
  it('Trưởng nhóm Kinh doanh → lead', () => {
    expect(classifySeniority('Trưởng nhóm Kinh doanh')).toBe('lead');
  });
  it('Trưởng ban Kỹ thuật → lead', () => {
    expect(classifySeniority('Trưởng ban Kỹ thuật')).toBe('lead');
  });
  it('Giám đốc Tài chính → lead', () => {
    expect(classifySeniority('Giám đốc Tài chính')).toBe('lead');
  });
  it('Phó Giám đốc Vận hành → lead', () => {
    expect(classifySeniority('Phó Giám đốc Vận hành')).toBe('lead');
  });
  it('Chuyên viên cao cấp Kế toán → senior', () => {
    expect(classifySeniority('Chuyên viên cao cấp Kế toán')).toBe('senior');
  });
  it('Nhân viên Kế toán → mid (no level signal)', () => {
    expect(classifySeniority('Nhân viên Kế toán')).toBe('mid');
  });
  it('Trưởng nhóm Thực tập sinh → intern (intern beats lead)', () => {
    expect(classifySeniority('Trưởng nhóm Thực tập sinh')).toBe('intern');
  });
});
