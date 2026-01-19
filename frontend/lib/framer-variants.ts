import { Variants } from 'framer-motion'

// Card entrance animation
export const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: 'easeOut' }
  }
}

// Staggered children
export const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
}

// Badge scale animation
export const badgeVariants: Variants = {
  hidden: { scale: 0 },
  visible: {
    scale: 1,
    transition: { type: 'spring', stiffness: 500, damping: 30 }
  }
}

// Sheet slide-in animation
export const sheetVariants: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.3, ease: 'easeOut' }
  }
}
