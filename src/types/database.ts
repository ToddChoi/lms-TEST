// =====================================================
// Database 타입 — 수동 갱신본 (마이그레이션 기준 2026-05-05)
//
// 이 파일은 Supabase CLI 가 본격 도입되기 전까지 수동 관리.
// CLI 도입 시:
//   npx supabase gen types typescript --project-id unrhoadjtyyuqvtdeyks > src/types/database.ts
//
// 갱신 시 체크: src/types/database.ts 의 mtime 과 supabase/migration_*.sql
// 의 mtime 을 비교. SQL 이 더 새로우면 이 파일이 stale.
// =====================================================

export type UserRole = 'student' | 'instructor' | 'admin' | 'superadmin' | 'org_admin'
export type CourseStatus = 'draft' | 'active' | 'closed'
export type CourseLevel = 'beginner' | 'intermediate' | 'advanced' | 'all'
export type EnrollmentStatus = 'active' | 'completed' | 'expired' | 'cancelled'
export type ContactStatus = 'pending' | 'answered'
export type ContactType = 'general' | 'b2b' | 'course' | 'technical'
export type CourseBadge = 'none' | 'new' | 'best' | 'discount' | 'hot'
export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded'
export type RecommendationContext = 'dashboard' | 'similar' | 'next_step' | 'course_list'

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
          // migration_recommendations.sql 에서 추가
          job_role: string | null
          job_level: string | null
          interests: string[]
          learning_goals: string | null
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
          job_role?: string | null
          job_level?: string | null
          interests?: string[]
          learning_goals?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      categories: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          icon: string | null
          sort_order: number
          is_visible: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          name: string
          slug: string
          description?: string | null
          icon?: string | null
          sort_order?: number
          is_visible?: boolean
        }
        Update: Partial<Database['public']['Tables']['categories']['Insert']>
      }
      courses: {
        Row: {
          id: string
          title: string
          slug: string
          description: string | null
          thumbnail_url: string | null
          category_id: string | null
          instructor_id: string | null
          price: number
          // migration_courses_metadata.sql 에서 추가
          rating_avg: number
          rating_count: number
          enrolled_count: number
          preview_url: string | null
          price_original: number | null
          badge: CourseBadge
          // migration_course_details.sql 에서 추가
          what_you_learn: string[]
          requirements: string[]
          target_audience: string | null
          instructor_name: string | null
          instructor_bio: string | null
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
          category_id?: string | null
          instructor_id?: string | null
          price?: number
          rating_avg?: number
          rating_count?: number
          enrolled_count?: number
          preview_url?: string | null
          price_original?: number | null
          badge?: CourseBadge
          what_you_learn?: string[]
          requirements?: string[]
          target_audience?: string | null
          instructor_name?: string | null
          instructor_bio?: string | null
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
        Update: { title?: string; sort_order?: number }
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
        Update: { pdf_url?: string | null }
      }
      notices: {
        Row: {
          id: number
          title: string
          content: string | null
          is_pinned: boolean
          is_active: boolean
          // migration_boards_v2.sql 에서 추가
          view_count: number
          author_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          title: string
          content?: string | null
          is_pinned?: boolean
          is_active?: boolean
          view_count?: number
          author_id?: string | null
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
          // migration_boards_v2.sql 에서 추가
          type: ContactType
          phone: string | null
          company: string | null
          created_at: string
        }
        Insert: {
          user_id?: string | null
          title: string
          content: string
          status?: ContactStatus
          type?: ContactType
          phone?: string | null
          company?: string | null
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
        Insert: { user_id: string; course_id: string }
        Update: never
      }
      nav_menus: {
        Row: {
          id: string
          location: 'header' | 'footer'
          label: string
          url: string
          target: string
          sort_order: number
          is_visible: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          location: 'header' | 'footer'
          label: string
          url: string
          target?: string
          sort_order?: number
          is_visible?: boolean
        }
        Update: Partial<Database['public']['Tables']['nav_menus']['Insert']>
      }
      home_sections: {
        Row: {
          id: string
          type: string
          label: string
          title: string | null
          subtitle: string | null
          sort_order: number
          is_visible: boolean
          config: Record<string, unknown>
          created_at: string
          updated_at: string
        }
        Insert: {
          type: string
          label?: string
          title?: string | null
          subtitle?: string | null
          sort_order?: number
          is_visible?: boolean
          config?: Record<string, unknown>
        }
        Update: Partial<Database['public']['Tables']['home_sections']['Insert']>
      }
      banners: {
        Row: {
          id: string
          section_id: string
          title: string
          image_url: string | null
          link_url: string | null
          link_target: string
          sort_order: number
          is_visible: boolean
          starts_at: string | null
          ends_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          section_id: string
          title?: string
          image_url?: string | null
          link_url?: string | null
          link_target?: string
          sort_order?: number
          is_visible?: boolean
          starts_at?: string | null
          ends_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['banners']['Insert']>
      }
      site_settings: {
        Row: {
          key: string
          value: string | null
          label: string | null
          group_name: string | null
          updated_at: string
        }
        Insert: {
          key: string
          value?: string | null
          label?: string | null
          group_name?: string | null
        }
        Update: Partial<Database['public']['Tables']['site_settings']['Insert']>
      }
      // ─── B2B (schema.sql) ────────────────────────────
      companies: {
        Row: {
          id: string
          name: string
          contact_name: string | null
          contact_email: string | null
          contract_start: string | null
          contract_end: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          name: string
          contact_name?: string | null
          contact_email?: string | null
          contract_start?: string | null
          contract_end?: string | null
          is_active?: boolean
        }
        Update: Partial<Database['public']['Tables']['companies']['Insert']>
      }
      company_members: {
        Row: {
          id: string
          company_id: string
          user_id: string
          department: string | null
          is_manager: boolean
          created_at: string
        }
        Insert: {
          company_id: string
          user_id: string
          department?: string | null
          is_manager?: boolean
        }
        Update: { department?: string | null; is_manager?: boolean }
      }
      // ─── 결제 (schema_phase6.sql) ────────────────────
      payments: {
        Row: {
          id: string
          user_id: string | null
          course_id: string | null
          amount: number
          currency: string
          provider: string
          stripe_session_id: string | null
          stripe_payment_intent_id: string | null
          status: PaymentStatus
          receipt_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id?: string | null
          course_id?: string | null
          amount: number
          currency?: string
          provider?: string
          stripe_session_id?: string | null
          stripe_payment_intent_id?: string | null
          status?: PaymentStatus
          receipt_url?: string | null
        }
        Update: Partial<Database['public']['Tables']['payments']['Insert']>
      }
      // ─── 후기 / Q&A (migration_reviews_qa.sql) ───────
      course_reviews: {
        Row: {
          id: string
          course_id: string
          user_id: string
          rating: number
          content: string
          is_verified: boolean
          created_at: string
        }
        Insert: {
          course_id: string
          user_id: string
          rating: number
          content: string
          // ★ self-write 정책에서 false 강제. 관리자만 true 가능.
          is_verified?: boolean
        }
        Update: { rating?: number; content?: string; is_verified?: boolean }
      }
      course_questions: {
        Row: {
          id: string
          course_id: string
          user_id: string
          lesson_id: string | null
          title: string
          content: string
          is_resolved: boolean
          created_at: string
        }
        Insert: {
          course_id: string
          user_id: string
          lesson_id?: string | null
          title: string
          content: string
          is_resolved?: boolean
        }
        Update: { title?: string; content?: string; is_resolved?: boolean }
      }
      course_answers: {
        Row: {
          id: string
          question_id: string
          user_id: string
          content: string
          is_instructor_answer: boolean
          created_at: string
        }
        Insert: {
          question_id: string
          user_id: string
          content: string
          // ★ self-write 정책에서 false 강제. 강사 답변은 별도 SECURITY DEFINER RPC.
          is_instructor_answer?: boolean
        }
        Update: { content?: string; is_instructor_answer?: boolean }
      }
      // ─── 학습 노트 (migration_lesson_notes.sql) ──────
      lesson_notes: {
        Row: {
          id: string
          user_id: string
          lesson_id: string
          course_id: string | null
          timestamp: number | null
          content: string
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          lesson_id: string
          course_id?: string | null
          timestamp?: number | null
          content: string
        }
        Update: { timestamp?: number | null; content?: string }
      }
      // ─── 알림 (migration_notifications.sql) ──────────
      notification_logs: {
        Row: {
          id: string
          user_id: string | null
          template: string
          channel: string
          to_address: string
          subject: string | null
          status: 'sent' | 'failed' | 'skipped'
          error: string | null
          created_at: string
        }
        Insert: {
          user_id?: string | null
          template: string
          channel: string
          to_address: string
          subject?: string | null
          status: 'sent' | 'failed' | 'skipped'
          error?: string | null
        }
        Update: never
      }
      user_notification_preferences: {
        Row: {
          user_id: string
          email_marketing: boolean
          email_course: boolean
          email_announcement: boolean
          updated_at: string
        }
        Insert: {
          user_id: string
          email_marketing?: boolean
          email_course?: boolean
          email_announcement?: boolean
        }
        Update: {
          email_marketing?: boolean
          email_course?: boolean
          email_announcement?: boolean
        }
      }
      // ─── 추천 (migration_recommendations.sql) ────────
      // course_embeddings / user_embeddings 는 vector 컬럼 — TS 에서 unknown.
      course_embeddings: {
        Row: {
          course_id: string
          embedding: unknown
          updated_at: string
        }
        Insert: { course_id: string; embedding: unknown }
        Update: { embedding?: unknown }
      }
      user_embeddings: {
        Row: {
          user_id: string
          embedding: unknown
          updated_at: string
        }
        Insert: { user_id: string; embedding: unknown }
        Update: { embedding?: unknown }
      }
      recommendation_cache: {
        Row: {
          id: string
          user_id: string | null
          context: RecommendationContext
          payload: Record<string, unknown>
          created_at: string
        }
        Insert: {
          user_id?: string | null
          context: RecommendationContext
          payload: Record<string, unknown>
        }
        Update: { payload?: Record<string, unknown> }
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
export type NavMenu = Database['public']['Tables']['nav_menus']['Row']
export type HomeSection = Database['public']['Tables']['home_sections']['Row']
export type Banner = Database['public']['Tables']['banners']['Row']
export type SiteSetting = Database['public']['Tables']['site_settings']['Row']
export type Company = Database['public']['Tables']['companies']['Row']
export type CompanyMember = Database['public']['Tables']['company_members']['Row']
export type Payment = Database['public']['Tables']['payments']['Row']
export type CourseReview = Database['public']['Tables']['course_reviews']['Row']
export type CourseQuestion = Database['public']['Tables']['course_questions']['Row']
export type CourseAnswer = Database['public']['Tables']['course_answers']['Row']
export type LessonNote = Database['public']['Tables']['lesson_notes']['Row']
export type NotificationLog = Database['public']['Tables']['notification_logs']['Row']
export type UserNotificationPreference = Database['public']['Tables']['user_notification_preferences']['Row']

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

// NavLink 타입 (Header/Footer 렌더링용)
export type NavLink = {
  id: string
  label: string
  href: string
  target: string
}
