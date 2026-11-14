// Runs before every Vitest file: adds DOM matchers like toBeInTheDocument().
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { afterEach } from 'vitest';

// Tests check what's on screen, not how it got there: Motion jumps straight
// to the end of every animation (sheets close at once, as before).
MotionGlobalConfig.skipAnimations = true;

afterEach(() => {
  cleanup();
});
