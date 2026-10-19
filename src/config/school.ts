// Static text about the school. Values in [brackets] are placeholders the
// school hasn't confirmed yet (docs/OPEN_QUESTIONS.md, Q9). Settings that
// admins change at runtime live in the app_settings table instead.

export const school = {
  // Shown before sign-in. After sign-in the app uses app_settings.school_name.
  name: '[SCHOOL NAME]',
  appName: 'School App',
} as const;

// Shown on the fix-it report form. Wording from the plan.
export const SAFETY_COPY =
  "Emergencies or anything dangerous: tell a teacher now, don't use the app.";

// Grades offered in pickers (announcement audiences, admin user editing).
// Placeholder until the school confirms which grades use the app (Q9).
export const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
