// Projects: the UI's own logic and the card. Who can read which project is
// tested in the database: supabase/tests/05_projects_test.sql.
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/utils';
import type { Project } from './api';
import { ProjectCard } from './components/ProjectCard';
import { ProjectForm } from './components/ProjectForm';
import {
  emptyProjectValues,
  filterProjects,
  sharingLine,
  toProjectInput,
  validateProject,
} from './logic';

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    owner_id: 'student-1',
    title: 'Solar bus stop',
    subject: 'Physics',
    description: '',
    link_url: null,
    status: 'draft',
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    owner: { full_name: 'Student Grade 10 A', grade: 10 },
    shares: [],
    feedback: [],
    ...overrides,
  };
}

const shared = makeProject({
  id: 'p2',
  status: 'feedback_given',
  shares: [{ teacher_id: 't1', teacher: { full_name: 'Teacher A' } }],
  feedback: [
    {
      id: 'f1',
      body: 'Great start.',
      created_at: '2026-10-02T00:00:00Z',
      author: { full_name: 'Teacher A', avatar_initials: null },
    },
  ],
});

describe('filterProjects', () => {
  const projects = [
    makeProject(),
    shared,
    makeProject({ id: 'p3', status: 'in_review', shares: shared.shares }),
  ];

  it("splits a student's projects into shared and drafts", () => {
    expect(filterProjects(projects, 'shared').map((p) => p.id)).toEqual(['p2', 'p3']);
    expect(filterProjects(projects, 'drafts').map((p) => p.id)).toEqual(['p1']);
  });

  it("splits a teacher's list into to-review and reviewed", () => {
    expect(filterProjects(projects, 'waiting').map((p) => p.id)).toEqual(['p3']);
    expect(filterProjects(projects, 'reviewed').map((p) => p.id)).toEqual(['p2']);
  });
});

describe('sharingLine', () => {
  it('reads like the mockup', () => {
    expect(sharingLine(shared)).toBe('Physics · Shared with Teacher A');
    expect(sharingLine(makeProject({ subject: null }))).toBe('Not shared yet');
  });
});

describe('project form validation', () => {
  it('needs a title and a web link if any', () => {
    const errors = validateProject({ ...emptyProjectValues, linkUrl: 'drive.google.com/x' });
    expect(errors.title).toBe('Add a title.');
    expect(errors.linkUrl).toBe('Links start with https:// (or http://).');
  });

  it('turns empty optional fields into null', () => {
    expect(
      toProjectInput({ title: ' Model ', subject: ' ', description: '', linkUrl: '' }),
    ).toEqual({
      title: 'Model',
      subject: null,
      description: '',
      link_url: null,
    });
  });

  it('does not submit until the title is filled in', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(
      <ProjectForm
        initialValues={emptyProjectValues}
        submitLabel="Save draft"
        cancelTo="/projects"
        submitting={false}
        submitError={null}
        onSubmit={onSubmit}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(onSubmit).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText('Title'), 'Traffic simulator');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ title: 'Traffic simulator' }));
  });
});

describe('ProjectCard', () => {
  it('shows the latest feedback inline and the status badge', () => {
    renderWithProviders(<ProjectCard project={shared} showOwner={false} canShare />);
    expect(screen.getByText('Great start.')).toBeInTheDocument();
    expect(screen.getByText('Feedback')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Share with a teacher' })).not.toBeInTheDocument();
  });

  it('offers "Share with a teacher" on unshared drafts', () => {
    renderWithProviders(<ProjectCard project={makeProject()} showOwner={false} canShare />);
    expect(screen.getByRole('link', { name: 'Share with a teacher' })).toHaveAttribute(
      'href',
      '/projects/p1?share=1',
    );
  });
});
