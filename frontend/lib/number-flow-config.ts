// NOTE: continuous plugin temporarily disabled to debug React error #310
// import { continuous } from '@number-flow/react'

// Spring-based easing from https://number-flow.barvian.me/
export const springEasing = 'linear(0, 0.0075 2.8%, 0.0294 5.1%, 0.0648, 0.1148, 0.1778, 0.2535, 0.3415, 0.4409 15.3%, 0.5508, 0.6694, 0.7948 24%, 0.9255, 1.0593, 1.1956 31.2%, 1.3326, 1.4689, 1.6026 37.8%, 1.7321 40.3%, 1.8556, 1.9717 44.6%, 2.0787, 2.1759, 2.2626, 2.3384, 2.4029, 2.4559 54.6%, 2.4975, 2.528 59.3%, 2.5479, 2.5575, 2.5573 64.6%, 2.5478, 2.5297 68.8%, 2.5036, 2.4703, 2.4307 74%, 2.3858, 2.3365, 2.2838 78.8%, 2.2288, 2.1725 82.5%, 2.1158, 2.0598 85.5%, 2.0053, 1.9531, 1.904 89.5%, 1.8588 91.5%, 1.8175, 1.7808, 1.7493 95.1%, 1.7236, 1.7044 97.4%, 1.6925, 1.6885 99.2%, 1.6928 99.8%)'

export const defaultNumberFlowConfig = {
  transformTiming: { duration: 750, easing: springEasing },
  opacityTiming: { duration: 350, easing: 'ease-out' },
  // plugins: [continuous], // Disabled for debugging
}

// Faster config for live-updating data
export const liveNumberFlowConfig = {
  transformTiming: { duration: 500, easing: springEasing },
  opacityTiming: { duration: 250, easing: 'ease-out' },
  // plugins: [continuous], // Disabled for debugging
}
