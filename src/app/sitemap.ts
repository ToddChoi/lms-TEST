import type { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    'http://localhost:3000'

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/courses`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/login`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/register`, changeFrequency: 'yearly', priority: 0.3 },
  ]

  try {
    const supabase = createClient()
    const { data: rawCourses } = await supabase
      .from('courses')
      .select('id, updated_at')
      .eq('status', 'active')

    const courses =
      (rawCourses as unknown as { id: string; updated_at: string }[] | null) ??
      []

    return [
      ...staticEntries,
      ...courses.map((c) => ({
        url: `${base}/courses/${c.id}`,
        lastModified: new Date(c.updated_at),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      })),
    ]
  } catch {
    return staticEntries
  }
}
