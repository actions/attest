const COLOR_CYAN = '\x1B[36m'
const COLOR_GRAY = '\x1B[38;5;244m'
const COLOR_DEFAULT = '\x1B[39m'

// Emphasis string using ANSI color codes
export const highlight = (str: string): string =>
  `${COLOR_CYAN}${str}${COLOR_DEFAULT}`

// De-emphasize string using ANSI color codes
export const mute = (str: string): string =>
  `${COLOR_GRAY}${str}${COLOR_DEFAULT}`
