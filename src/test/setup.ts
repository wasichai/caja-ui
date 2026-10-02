import { configure } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// findBy* and waitFor wait 1 s by default: under load a screen that answers well takes longer to draw, and the test
// fails for nothing. 5 s gives it room, and stays under the test's 15 s (vite.config.ts), so a screen that never
// draws what is expected fails with testing-library's message and the DOM, not with a bare «Test timed out»
configure({ asyncUtilTimeout: 5000 })
