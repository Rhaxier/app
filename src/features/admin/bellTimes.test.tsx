// Upload bell times: the preview shows what's wrong with each line, and the
// import stays locked until the file has no problems. (The database checks
// every line and refuses a file with problems anyway:
// supabase/tests/17_bell_times_test.sql.)
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { PeriodCsvRow, PeriodImportResult } from '@/features/school/api';
import { renderWithProviders } from '@/test/utils';
import { PeriodImportPreview } from './components/PeriodImportPreview';
import { BellTimesImportPage } from './pages/BellTimesImportPage';

const checked: PeriodImportResult[] = [
  {
    line: 2,
    weekday: 'Friday',
    period_name: 'Period 1',
    start_time: '07:30',
    end_time: '08:15',
    sort_order: '1',
    outcome: 'ok',
    message: null,
  },
  {
    line: 3,
    weekday: 'Funday',
    period_name: 'Period 2',
    start_time: '08:15',
    end_time: '09:00',
    sort_order: '2',
    outcome: 'error',
    message: 'Unknown weekday "Funday": use Sunday to Saturday, or Sun to Sat.',
  },
  {
    line: 4,
    weekday: 'Friday',
    period_name: 'Period 3',
    start_time: '08:00',
    end_time: '09:30',
    sort_order: '3',
    outcome: 'error',
    message: 'Overlaps Period 1 (07:30–08:15) on line 2.',
  },
];

// The database's dry run, faked: it answers with the results above.
const importPeriods = vi.fn<
  (rows: PeriodCsvRow[], dryRun: boolean) => Promise<PeriodImportResult[]>
>(async () => checked);
vi.mock('@/features/school/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/school/api')>()),
  fetchPeriods: async () => [],
  importPeriods: (rows: PeriodCsvRow[], dryRun: boolean) => importPeriods(rows, dryRun),
}));

describe('PeriodImportPreview', () => {
  it('shows every line, with each problem next to its line', () => {
    render(<PeriodImportPreview results={checked} />);
    expect(screen.getByText('3 lines: 2 with problems')).toBeInTheDocument();

    const rows = screen.getAllByRole('row').slice(1); // skip the heading row
    expect(within(rows[0]).getByText('OK')).toBeInTheDocument();
    expect(within(rows[1]).getByText('3')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Problem')).toBeInTheDocument();
    expect(
      within(rows[1]).getByText('Unknown weekday "Funday": use Sunday to Saturday, or Sun to Sat.'),
    ).toBeInTheDocument();
    expect(
      within(rows[2]).getByText('Overlaps Period 1 (07:30–08:15) on line 2.'),
    ).toBeInTheDocument();
  });
});

describe('BellTimesImportPage', () => {
  it('previews an uploaded file and locks the import until the problems are fixed', async () => {
    renderWithProviders(<BellTimesImportPage />);
    const file = new File(
      [
        'weekday,period_name,start_time,end_time,order\n' +
          'Friday,Period 1,07:30,08:15,1\n' +
          'Funday,Period 2,08:15,09:00,2\n' +
          'Friday,Period 3,08:00,09:30,3\n',
      ],
      'bell-times.csv',
      { type: 'text/csv' },
    );
    await userEvent.upload(screen.getByLabelText('CSV file'), file);

    expect(
      await screen.findByText('Overlaps Period 1 (07:30–08:15) on line 2.'),
    ).toBeInTheDocument();
    // Only the preview ran: nothing was saved.
    expect(importPeriods).toHaveBeenCalledTimes(1);
    expect(importPeriods.mock.calls[0][1]).toBe(true);
    expect(importPeriods.mock.calls[0][0][1]).toEqual({
      weekday: 'Funday',
      period_name: 'Period 2',
      start_time: '08:15',
      end_time: '09:00',
      order: '2',
    });
    expect(screen.getByRole('button', { name: 'Fix 2 problems in the file first' })).toBeDisabled();
  });

  it('says which headings are missing without asking the database', async () => {
    importPeriods.mockClear();
    renderWithProviders(<BellTimesImportPage />);
    const file = new File(['day,start\nFriday,07:30\n'], 'wrong.csv', { type: 'text/csv' });
    await userEvent.upload(screen.getByLabelText('CSV file'), file);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The first line must be the headings',
    );
    expect(importPeriods).not.toHaveBeenCalled();
  });
});
