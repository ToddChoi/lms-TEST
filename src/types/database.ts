export type UserRole = 'student' | 'instructor' | 'admin' | 'superadmin'
export type CourseStatus = 'draft' | 'active' | 'closed'
export type CourseLevel = 'beginner' | 'intermediate' | 'advanced' | 'all'
export type EnrollmentStatus = 'active' | 'completed' | 'expired' | 'cancelled'
export type ContactStatus = 'pending' | 'answered'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          name: string
          role: UserRole
          avatar_url: string | null
          phone: string | null
          company: string | null
          department: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          name: string
          role?: UserRole
          avatar_url?: string | null
          phone?: string | null
          company?: string | null
          department?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          email?: string
          name?: string
          role?: UserRole
          avatar_url?: string | null
          phone?: string | null
          company?: string | null
          department?: string | null
          is_active?: boolean
          updated_at?: string
        }
      }
      categories: {
        Row: {
          id: number
          name: string
          slug: string
          sort_order: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          name: string
          slug: string
          sort_order?: number
          is_active?: boolean
        }
        Update: {
          name?: string
          slug?: string
          sort_order?: number
          is_active?: boolean
        }
      }
      courses: {
        Row: {
          id: string
          title: string
          slug: string
          description: string | null
          thumbnail_url: string | null
          category_id: number | null
          instructor_id: string | null
          price: number
          enroll_start: string | null
          enroll_end: string | null
          learn_start: string | null
          learn_end: string | null
          review_days: number
          total_duration: number
          level: CourseLevel
          status: CourseStatus
          is_featured: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          title: string
          slug: string
          description?: string | null
          thumbnail_url?: string | null
          category_id?: number | null
          instructor_id?: string | null
          price?: number
          enroll_start?: string | null
          enroll_end?: string | null
          learn_start?: string | null
          learn_end?: string | null
          review_days?: number
          total_duration?: number
          level?: CourseLevel
          status?: CourseStatus
          is_featured?: boolean
          sort_order?: number
        }
        Update: Partial<Database['public']['Tables']['courses']['Insert']>
      }
      sections: {
        Row: {
          id: string
          course_id: string
          title: string
          sort_order: number
        }
        Insert: {
          course_id: string
          title: string
          sort_order?: number
        }
        Update: {
          title?: string
          sort_order?: number
        }
      }
      lessons: {
        Row: {
          id: string
          section_id: string
          course_id: string
          title: string
          video_url: string | null
          duration: number
          sort_order: number
          is_preview: boolean
        }
        Insert: {
          section_id: string
          course_id: string
          title: string
          video_url?: string | null
          duration?: number
          sort_order?: number
          is_preview?: boolean
        }
        Update: Partial<Database['public']['Tables']['lessons']['Insert']>
      }
      enrollments: {
        Row: {
          id: string
          user_id: string
          course_id: string
          status: EnrollmentStatus
          enrolled_at: string
          expires_at: string | null
        }
        Insert: {
          user_id: string
          course_id: string
          status?: EnrollmentStatus
          expires_at?: string | null
        }
        Update: {
          status?: EnrollmentStatus
          expires_at?: string | null
        }
      }
      lesson_progress: {
        Row: {
          id: string
          user_id: string
          lesson_id: string
          course_id: string
          watched_seconds: number
          is_completed: boolean
          last_watched_at: string
        }
        Insert: {
          user_id: string
          lesson_id: string
          course_id: string
          watched_seconds?: number
          is_completed?: boolean
          last_watched_at?: string
        }
        Update: {
          watched_seconds?: number
          is_completed?: boolean
          last_watched_at?: string
        }
      }
      certificates: {
        Row: {
          id: string
          user_id: string
          course_id: string
          cert_number: string
          issued_at: string
          pdf_url: string | null
        }
        Insert: {
          user_id: string
          course_id: string
          cert_number: string
          pdf_url?: string | null
        }
        Update: {
          pdf_url?: string | null
        }
      }
      notices: {
        Row: {
          id: number
          title: string
          content: string | null
          is_pinned: boolean
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          title: string
          content?: string | null
          is_pinned?: boolean
          is_active?: boolean
        }
        Update: Partial<Database['public']['Tables']['notices']['Insert']>
      }
      faqs: {
        Row: {
          id: number
          question: string
          answer: string
          category: string | null
          sort_order: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          question: string
          answer: string
          category?: string | null
          sort_order?: number
          is_active?: boolean
        }
        Update: Partial<Database['public']['Tables']['faqs']['Insert']>
      }
      contacts: {
        Row: {
          id: string
          user_id: string | null
          title: string
          content: string
          status: ContactStatus
          answer: string | null
          answered_at: string | null
          created_at: string
        }
        Insert: {
          user_id?: string | null
          title: string
          content: string
          status?: ContactStatus
        }
        Update: {
          status?: ContactStatus
          answer?: string | null
          answered_at?: string | null
        }
      }
      wishlists: {
        Row: {
          id: string
          user_id: string
          course_id: string
          created_at: string
        }
        Insert: {
          user_id: string
          course_id: string
        }
        Update: never
      }
      site_settings: {
        Row: {
          key: string
          value: string | null
          updated_at: string
        }
        Insert: {
          key: string
          value?: string | null
        }
        Update: {
          value?: string | null
          updated_at?: string
        }
      }
    }
  }
}

// 편의 타입
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Category = Database['public']['Tables']['categories']['Row']
export type Course = Database['public']['Tables']['courses']['Row']
export type Section = Database['public']['Tables']['sections']['Row']
export type Lesson = Database['public']['Tables']['lessons']['Row']
export type Enrollment = Database['public']['Tables']['enrollments']['Row']
export type LessonProgress = Database['public']['Tables']['lesson_progress']['Row']
export type Certificate = Database['public']['Tables']['certificates']['Row']
export type Notice = Database['public']['Tables']['notices']['Row']
export type Faq = Database['public']['Tables']['faqs']['Row']
export type Contact = Database['public']['Tables']['contacts']['Row']
export type Wishlist = Database['public']['Tables']['wishlists']['Row']

// 확장 타입 (JOIN 결과)
export type CourseWithCategory = Course & {
  categories: Pick<Category, 'id' | 'name' | 'slug'> | null
}

export type CourseWithInstructor = Course & {
  instructor: Pick<Profile, 'id' | 'name' | 'avatar_url'> | null
}

export type EnrollmentWithCourse = Enrollment & {
  courses: CourseWithCategory | null
}
