import Link from 'next/link'
import { Briefcase, Star, User } from 'lucide-react'
import {
  OFFLINE_PROGRAM_TYPE_LABEL,
  type OfflineProgramType,
} from '@/types/database'

export interface OfflineProgramCardData {
  id: string
  title: string
  slug: string
  thumbnail_url: string | null
  program_type: OfflineProgramType
  instructor_name: string | null
  is_featured: boolean
  categories: { name: string } | null
}

const TYPE_CLASS: Record<OfflineProgramType, string> = {
  workshop: 'bg-blue-50 text-blue-700',
  regular_course: 'bg-purple-50 text-purple-700',
  corporate: 'bg-amber-50 text-amber-700',
}

export function OfflineProgramCard({ program }: { program: OfflineProgramCardData }) {
  return (
    <Link
      href={`/offline/${program.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm transition hover:shadow-md"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-silver">
        {program.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={program.thumbnail_url}
            alt={program.title}
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Briefcase className="h-10 w-10 text-gray-300" />
          </div>
        )}
        {program.is_featured && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-amber-400/95 px-2 py-0.5 text-[11px] font-semibold text-white shadow">
            <Star className="h-3 w-3 fill-white" /> 추천
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${TYPE_CLASS[program.program_type]}`}>
            {OFFLINE_PROGRAM_TYPE_LABEL[program.program_type]}
          </span>
          {program.categories && (
            <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
              {program.categories.name}
            </span>
          )}
        </div>

        <h3 className="line-clamp-2 text-base font-bold text-navy group-hover:text-accent">
          {program.title}
        </h3>

        {program.instructor_name && (
          <p className="mt-auto inline-flex items-center gap-1 text-xs text-gray-500">
            <User className="h-3.5 w-3.5 text-gray-400" />
            {program.instructor_name}
          </p>
        )}
      </div>
    </Link>
  )
}
