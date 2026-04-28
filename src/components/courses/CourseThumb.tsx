'use client'

import { BookOpen } from 'lucide-react'

interface Props {
  src: string | null
  alt: string
}

export function CourseThumb({ src, alt }: Props) {
  if (!src) {
    return (
      <div className="flex h-full items-center justify-center">
        <BookOpen className="h-12 w-12 text-accent/40" />
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="h-full w-full object-cover"
      onError={(e) => {
        const target = e.target as HTMLImageElement
        target.style.display = 'none'
        target.parentElement?.classList.add('flex', 'items-center', 'justify-center')
      }}
    />
  )
}
