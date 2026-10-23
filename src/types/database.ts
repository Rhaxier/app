export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      announcements: {
        Row: {
          audience: Database['public']['Enums']['announcement_audience'];
          author_id: string;
          body: string;
          created_at: string;
          expires_at: string | null;
          grades: number[] | null;
          id: string;
          notified_at: string | null;
          pinned: boolean;
          posted_as: string | null;
          publish_at: string;
          removed_at: string | null;
          removed_by: string | null;
          removed_reason: string | null;
          section_ids: string[] | null;
          title: string;
          updated_at: string;
          urgent: boolean;
        };
        ComputedFields: never;
        Insert: {
          audience?: Database['public']['Enums']['announcement_audience'];
          author_id?: string;
          body?: string;
          created_at?: string;
          expires_at?: string | null;
          grades?: number[] | null;
          id?: string;
          notified_at?: string | null;
          pinned?: boolean;
          posted_as?: string | null;
          publish_at?: string;
          removed_at?: string | null;
          removed_by?: string | null;
          removed_reason?: string | null;
          section_ids?: string[] | null;
          title: string;
          updated_at?: string;
          urgent?: boolean;
        };
        Update: {
          audience?: Database['public']['Enums']['announcement_audience'];
          author_id?: string;
          body?: string;
          created_at?: string;
          expires_at?: string | null;
          grades?: number[] | null;
          id?: string;
          notified_at?: string | null;
          pinned?: boolean;
          posted_as?: string | null;
          publish_at?: string;
          removed_at?: string | null;
          removed_by?: string | null;
          removed_reason?: string | null;
          section_ids?: string[] | null;
          title?: string;
          updated_at?: string;
          urgent?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'announcements_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'announcements_removed_by_fkey';
            columns: ['removed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      app_settings: {
        Row: {
          accent_color: string;
          allow_dev_accounts: boolean;
          announcement_default_expiry_days: number | null;
          collab_max_team_size: number;
          collab_requires_teacher: boolean;
          created_at: string;
          digest_last_sent_on: string | null;
          digest_time: string;
          id: boolean;
          logo_url: string | null;
          maintenance_enabled: boolean;
          maintenance_message: string | null;
          maintenance_until: string | null;
          report_auto_urgent_votes: number | null;
          school_days: number[];
          school_email_domain: string | null;
          school_name: string;
          staff_email_pattern: string | null;
          student_events_need_approval: boolean;
          students_can_request_venues: boolean;
          teachers_post_any_grade: boolean;
          updated_at: string;
          venue_reminder_days_before: number;
          venue_reminder_hours: number;
        };
        ComputedFields: never;
        Insert: {
          accent_color?: string;
          allow_dev_accounts?: boolean;
          announcement_default_expiry_days?: number | null;
          collab_max_team_size?: number;
          collab_requires_teacher?: boolean;
          created_at?: string;
          digest_last_sent_on?: string | null;
          digest_time?: string;
          id?: boolean;
          logo_url?: string | null;
          maintenance_enabled?: boolean;
          maintenance_message?: string | null;
          maintenance_until?: string | null;
          report_auto_urgent_votes?: number | null;
          school_days?: number[];
          school_email_domain?: string | null;
          school_name?: string;
          staff_email_pattern?: string | null;
          student_events_need_approval?: boolean;
          students_can_request_venues?: boolean;
          teachers_post_any_grade?: boolean;
          updated_at?: string;
          venue_reminder_days_before?: number;
          venue_reminder_hours?: number;
        };
        Update: {
          accent_color?: string;
          allow_dev_accounts?: boolean;
          announcement_default_expiry_days?: number | null;
          collab_max_team_size?: number;
          collab_requires_teacher?: boolean;
          created_at?: string;
          digest_last_sent_on?: string | null;
          digest_time?: string;
          id?: boolean;
          logo_url?: string | null;
          maintenance_enabled?: boolean;
          maintenance_message?: string | null;
          maintenance_until?: string | null;
          report_auto_urgent_votes?: number | null;
          school_days?: number[];
          school_email_domain?: string | null;
          school_name?: string;
          staff_email_pattern?: string | null;
          student_events_need_approval?: boolean;
          students_can_request_venues?: boolean;
          teachers_post_any_grade?: boolean;
          updated_at?: string;
          venue_reminder_days_before?: number;
          venue_reminder_hours?: number;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          details: NonNullable<Json>;
          id: string;
          row_id: string | null;
          table_name: string;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          details?: NonNullable<Json>;
          id?: string;
          row_id?: string | null;
          table_name: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          details?: NonNullable<Json>;
          id?: string;
          row_id?: string | null;
          table_name?: string;
        };
        Relationships: [];
      };
      bookings: {
        Row: {
          announce: boolean;
          created_at: string;
          ends_at: string;
          expected_attendance: number | null;
          id: string;
          last_reminder_at: string | null;
          purpose: string;
          requester_id: string;
          review_note: string | null;
          reviewed_by: string | null;
          starts_at: string;
          status: Database['public']['Enums']['booking_status'];
          supervising_teacher_id: string | null;
          title: string;
          updated_at: string;
          venue_id: string;
          booking_auto_approve: {
            announce: boolean;
            created_at: string;
            ends_at: string;
            expected_attendance: number | null;
            id: string;
            last_reminder_at: string | null;
            purpose: string;
            requester_id: string;
            review_note: string | null;
            reviewed_by: string | null;
            starts_at: string;
            status: Database['public']['Enums']['booking_status'];
            supervising_teacher_id: string | null;
            title: string;
            updated_at: string;
            venue_id: string;
          } | null;
        };
        ComputedFields: 'booking_auto_approve';
        Insert: {
          announce?: boolean;
          created_at?: string;
          ends_at: string;
          expected_attendance?: number | null;
          id?: string;
          last_reminder_at?: string | null;
          purpose?: string;
          requester_id?: string;
          review_note?: string | null;
          reviewed_by?: string | null;
          starts_at: string;
          status?: Database['public']['Enums']['booking_status'];
          supervising_teacher_id?: string | null;
          title: string;
          updated_at?: string;
          venue_id: string;
        };
        Update: {
          announce?: boolean;
          created_at?: string;
          ends_at?: string;
          expected_attendance?: number | null;
          id?: string;
          last_reminder_at?: string | null;
          purpose?: string;
          requester_id?: string;
          review_note?: string | null;
          reviewed_by?: string | null;
          starts_at?: string;
          status?: Database['public']['Enums']['booking_status'];
          supervising_teacher_id?: string | null;
          title?: string;
          updated_at?: string;
          venue_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'bookings_requester_id_fkey';
            columns: ['requester_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bookings_reviewed_by_fkey';
            columns: ['reviewed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bookings_supervising_teacher_id_fkey';
            columns: ['supervising_teacher_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bookings_venue_id_fkey';
            columns: ['venue_id'];
            isOneToOne: false;
            referencedRelation: 'venues';
            referencedColumns: ['id'];
          },
        ];
      };
      class_students: {
        Row: {
          class_id: string;
          created_at: string;
          id: string;
          student_id: string;
        };
        ComputedFields: never;
        Insert: {
          class_id: string;
          created_at?: string;
          id?: string;
          student_id: string;
        };
        Update: {
          class_id?: string;
          created_at?: string;
          id?: string;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'class_students_class_id_fkey';
            columns: ['class_id'];
            isOneToOne: false;
            referencedRelation: 'classes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'class_students_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      class_teachers: {
        Row: {
          class_id: string;
          created_at: string;
          id: string;
          teacher_id: string;
        };
        ComputedFields: never;
        Insert: {
          class_id: string;
          created_at?: string;
          id?: string;
          teacher_id: string;
        };
        Update: {
          class_id?: string;
          created_at?: string;
          id?: string;
          teacher_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'class_teachers_class_id_fkey';
            columns: ['class_id'];
            isOneToOne: false;
            referencedRelation: 'classes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'class_teachers_teacher_id_fkey';
            columns: ['teacher_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      classes: {
        Row: {
          archived_at: string | null;
          created_at: string;
          grade: number;
          id: string;
          name: string;
          section_id: string | null;
          subject: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          grade: number;
          id?: string;
          name: string;
          section_id?: string | null;
          subject?: string | null;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          grade?: number;
          id?: string;
          name?: string;
          section_id?: string | null;
          subject?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'classes_grade_fkey';
            columns: ['grade'];
            isOneToOne: false;
            referencedRelation: 'grades';
            referencedColumns: ['grade'];
          },
          {
            foreignKeyName: 'classes_section_id_fkey';
            columns: ['section_id'];
            isOneToOne: false;
            referencedRelation: 'sections';
            referencedColumns: ['id'];
          },
        ];
      };
      collab_posts: {
        Row: {
          created_at: string;
          description: string;
          hidden_at: string | null;
          hidden_by: string | null;
          hidden_reason: string | null;
          id: string;
          owner_id: string;
          removed_at: string | null;
          removed_by: string | null;
          removed_reason: string | null;
          skills: string[];
          spots_wanted: number;
          status: Database['public']['Enums']['collab_status'];
          supervising_teacher_id: string | null;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          description?: string;
          hidden_at?: string | null;
          hidden_by?: string | null;
          hidden_reason?: string | null;
          id?: string;
          owner_id?: string;
          removed_at?: string | null;
          removed_by?: string | null;
          removed_reason?: string | null;
          skills?: string[];
          spots_wanted: number;
          status?: Database['public']['Enums']['collab_status'];
          supervising_teacher_id?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          hidden_at?: string | null;
          hidden_by?: string | null;
          hidden_reason?: string | null;
          id?: string;
          owner_id?: string;
          removed_at?: string | null;
          removed_by?: string | null;
          removed_reason?: string | null;
          skills?: string[];
          spots_wanted?: number;
          status?: Database['public']['Enums']['collab_status'];
          supervising_teacher_id?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'collab_posts_hidden_by_fkey';
            columns: ['hidden_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'collab_posts_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'collab_posts_removed_by_fkey';
            columns: ['removed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'collab_posts_supervising_teacher_id_fkey';
            columns: ['supervising_teacher_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      content_reports: {
        Row: {
          created_at: string;
          id: string;
          reason: string;
          reporter_id: string;
          reviewed_by: string | null;
          status: Database['public']['Enums']['content_report_status'];
          target_id: string;
          target_table: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          reason: string;
          reporter_id?: string;
          reviewed_by?: string | null;
          status?: Database['public']['Enums']['content_report_status'];
          target_id: string;
          target_table: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          reason?: string;
          reporter_id?: string;
          reviewed_by?: string | null;
          status?: Database['public']['Enums']['content_report_status'];
          target_id?: string;
          target_table?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'content_reports_reporter_id_fkey';
            columns: ['reporter_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'content_reports_reviewed_by_fkey';
            columns: ['reviewed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      email_outbox: {
        Row: {
          attempts: number;
          created_at: string;
          id: string;
          kind: Database['public']['Enums']['outbox_kind'];
          last_error: string | null;
          notification_id: string | null;
          payload: NonNullable<Json>;
          recipient_id: string;
          sent_at: string | null;
          status: Database['public']['Enums']['outbox_status'];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          attempts?: number;
          created_at?: string;
          id?: string;
          kind: Database['public']['Enums']['outbox_kind'];
          last_error?: string | null;
          notification_id?: string | null;
          payload?: NonNullable<Json>;
          recipient_id: string;
          sent_at?: string | null;
          status?: Database['public']['Enums']['outbox_status'];
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          created_at?: string;
          id?: string;
          kind?: Database['public']['Enums']['outbox_kind'];
          last_error?: string | null;
          notification_id?: string | null;
          payload?: NonNullable<Json>;
          recipient_id?: string;
          sent_at?: string | null;
          status?: Database['public']['Enums']['outbox_status'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'email_outbox_notification_id_fkey';
            columns: ['notification_id'];
            isOneToOne: false;
            referencedRelation: 'notifications';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'email_outbox_recipient_id_fkey';
            columns: ['recipient_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      emergency_broadcasts: {
        Row: {
          announcement_id: string | null;
          created_at: string;
          id: string;
          message: string;
          recipients: number;
          sent_by: string | null;
          title: string;
        };
        ComputedFields: never;
        Insert: {
          announcement_id?: string | null;
          created_at?: string;
          id?: string;
          message: string;
          recipients: number;
          sent_by?: string | null;
          title: string;
        };
        Update: {
          announcement_id?: string | null;
          created_at?: string;
          id?: string;
          message?: string;
          recipients?: number;
          sent_by?: string | null;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'emergency_broadcasts_announcement_id_fkey';
            columns: ['announcement_id'];
            isOneToOne: false;
            referencedRelation: 'announcements';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'emergency_broadcasts_sent_by_fkey';
            columns: ['sent_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      event_roles: {
        Row: {
          created_at: string;
          description: string;
          event_id: string;
          id: string;
          name: string;
          spots_wanted: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          description?: string;
          event_id: string;
          id?: string;
          name: string;
          spots_wanted: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          event_id?: string;
          id?: string;
          name?: string;
          spots_wanted?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'event_roles_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'volunteer_events';
            referencedColumns: ['id'];
          },
        ];
      };
      feature_flags: {
        Row: {
          created_at: string;
          enabled: boolean;
          feature: string;
          id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          enabled?: boolean;
          feature: string;
          id?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          enabled?: boolean;
          feature?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      floors: {
        Row: {
          created_at: string;
          height: number;
          id: string;
          image_path: string;
          name: string;
          sort_order: number;
          updated_at: string;
          width: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          height: number;
          id?: string;
          image_path: string;
          name: string;
          sort_order?: number;
          updated_at?: string;
          width: number;
        };
        Update: {
          created_at?: string;
          height?: number;
          id?: string;
          image_path?: string;
          name?: string;
          sort_order?: number;
          updated_at?: string;
          width?: number;
        };
        Relationships: [];
      };
      grades: {
        Row: {
          active: boolean;
          created_at: string;
          grade: number;
          id: string;
          name: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          created_at?: string;
          grade: number;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          grade?: number;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      holidays: {
        Row: {
          created_at: string;
          ends_on: string;
          id: string;
          name: string;
          starts_on: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          ends_on: string;
          id?: string;
          name: string;
          starts_on: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          ends_on?: string;
          id?: string;
          name?: string;
          starts_on?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      join_requests: {
        Row: {
          created_at: string;
          id: string;
          message: string;
          post_id: string;
          requester_id: string;
          status: Database['public']['Enums']['join_request_status'];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          message?: string;
          post_id: string;
          requester_id?: string;
          status?: Database['public']['Enums']['join_request_status'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          message?: string;
          post_id?: string;
          requester_id?: string;
          status?: Database['public']['Enums']['join_request_status'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'join_requests_post_id_fkey';
            columns: ['post_id'];
            isOneToOne: false;
            referencedRelation: 'collab_posts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'join_requests_requester_id_fkey';
            columns: ['requester_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      notification_prefs: {
        Row: {
          created_at: string;
          id: string;
          muted: boolean;
          type: Database['public']['Enums']['notification_type'];
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          muted?: boolean;
          type: Database['public']['Enums']['notification_type'];
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          muted?: boolean;
          type?: Database['public']['Enums']['notification_type'];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notification_prefs_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      notifications: {
        Row: {
          body: string;
          created_at: string;
          id: string;
          link: string | null;
          read_at: string | null;
          recipient_id: string;
          title: string;
          type: Database['public']['Enums']['notification_type'];
          urgent: boolean;
        };
        ComputedFields: never;
        Insert: {
          body?: string;
          created_at?: string;
          id?: string;
          link?: string | null;
          read_at?: string | null;
          recipient_id: string;
          title: string;
          type: Database['public']['Enums']['notification_type'];
          urgent?: boolean;
        };
        Update: {
          body?: string;
          created_at?: string;
          id?: string;
          link?: string | null;
          read_at?: string | null;
          recipient_id?: string;
          title?: string;
          type?: Database['public']['Enums']['notification_type'];
          urgent?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_recipient_id_fkey';
            columns: ['recipient_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      periods: {
        Row: {
          created_at: string;
          ends_at: string;
          id: string;
          name: string;
          sort_order: number;
          starts_at: string;
          updated_at: string;
          weekdays: number[];
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          ends_at: string;
          id?: string;
          name: string;
          sort_order?: number;
          starts_at: string;
          updated_at?: string;
          weekdays: number[];
        };
        Update: {
          created_at?: string;
          ends_at?: string;
          id?: string;
          name?: string;
          sort_order?: number;
          starts_at?: string;
          updated_at?: string;
          weekdays?: number[];
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          anonymised_at: string | null;
          archived_at: string | null;
          avatar_initials: string | null;
          created_at: string;
          email: string;
          full_name: string;
          grade: number | null;
          id: string;
          posting_suspended_until: string | null;
          role: Database['public']['Enums']['user_role'];
          section: string | null;
          suspension_reason: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          anonymised_at?: string | null;
          archived_at?: string | null;
          avatar_initials?: string | null;
          created_at?: string;
          email: string;
          full_name?: string;
          grade?: number | null;
          id: string;
          posting_suspended_until?: string | null;
          role?: Database['public']['Enums']['user_role'];
          section?: string | null;
          suspension_reason?: string | null;
          updated_at?: string;
        };
        Update: {
          anonymised_at?: string | null;
          archived_at?: string | null;
          avatar_initials?: string | null;
          created_at?: string;
          email?: string;
          full_name?: string;
          grade?: number | null;
          id?: string;
          posting_suspended_until?: string | null;
          role?: Database['public']['Enums']['user_role'];
          section?: string | null;
          suspension_reason?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      project_feedback: {
        Row: {
          author_id: string;
          body: string;
          created_at: string;
          id: string;
          project_id: string;
        };
        ComputedFields: never;
        Insert: {
          author_id?: string;
          body: string;
          created_at?: string;
          id?: string;
          project_id: string;
        };
        Update: {
          author_id?: string;
          body?: string;
          created_at?: string;
          id?: string;
          project_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'project_feedback_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'project_feedback_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      project_shares: {
        Row: {
          created_at: string;
          id: string;
          project_id: string;
          teacher_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          project_id: string;
          teacher_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          project_id?: string;
          teacher_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'project_shares_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'project_shares_teacher_id_fkey';
            columns: ['teacher_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      projects: {
        Row: {
          created_at: string;
          description: string;
          id: string;
          link_url: string | null;
          owner_id: string;
          status: Database['public']['Enums']['project_status'];
          subject: string | null;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          description?: string;
          id?: string;
          link_url?: string | null;
          owner_id?: string;
          status?: Database['public']['Enums']['project_status'];
          subject?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          id?: string;
          link_url?: string | null;
          owner_id?: string;
          status?: Database['public']['Enums']['project_status'];
          subject?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'projects_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      push_outbox: {
        Row: {
          attempts: number;
          created_at: string;
          id: string;
          kind: Database['public']['Enums']['outbox_kind'];
          last_error: string | null;
          notification_id: string | null;
          payload: NonNullable<Json>;
          recipient_id: string;
          sent_at: string | null;
          status: Database['public']['Enums']['outbox_status'];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          attempts?: number;
          created_at?: string;
          id?: string;
          kind: Database['public']['Enums']['outbox_kind'];
          last_error?: string | null;
          notification_id?: string | null;
          payload?: NonNullable<Json>;
          recipient_id: string;
          sent_at?: string | null;
          status?: Database['public']['Enums']['outbox_status'];
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          created_at?: string;
          id?: string;
          kind?: Database['public']['Enums']['outbox_kind'];
          last_error?: string | null;
          notification_id?: string | null;
          payload?: NonNullable<Json>;
          recipient_id?: string;
          sent_at?: string | null;
          status?: Database['public']['Enums']['outbox_status'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'push_outbox_notification_id_fkey';
            columns: ['notification_id'];
            isOneToOne: false;
            referencedRelation: 'notifications';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'push_outbox_recipient_id_fkey';
            columns: ['recipient_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      report_categories: {
        Row: {
          active: boolean;
          created_at: string;
          icon: string;
          id: string;
          key: string;
          name: string;
          responsibility: Database['public']['Enums']['responsibility_kind'];
          sort_order: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          created_at?: string;
          icon?: string;
          id?: string;
          key: string;
          name: string;
          responsibility?: Database['public']['Enums']['responsibility_kind'];
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          icon?: string;
          id?: string;
          key?: string;
          name?: string;
          responsibility?: Database['public']['Enums']['responsibility_kind'];
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      report_votes: {
        Row: {
          created_at: string;
          id: string;
          report_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          report_id: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          report_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'report_votes_report_id_fkey';
            columns: ['report_id'];
            isOneToOne: false;
            referencedRelation: 'reports';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'report_votes_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      reports: {
        Row: {
          assigned_to: string | null;
          category: string;
          created_at: string;
          description: string;
          duplicate_of: string | null;
          floor_id: string | null;
          id: string;
          photo_path: string | null;
          reporter_id: string;
          resolved_at: string | null;
          room_id: string | null;
          status: Database['public']['Enums']['report_status'];
          status_note: string | null;
          updated_at: string;
          urgent: boolean;
          x: number | null;
          y: number | null;
          report_headline: string | null;
        };
        ComputedFields: 'report_headline';
        Insert: {
          assigned_to?: string | null;
          category: string;
          created_at?: string;
          description: string;
          duplicate_of?: string | null;
          floor_id?: string | null;
          id?: string;
          photo_path?: string | null;
          reporter_id?: string;
          resolved_at?: string | null;
          room_id?: string | null;
          status?: Database['public']['Enums']['report_status'];
          status_note?: string | null;
          updated_at?: string;
          urgent?: boolean;
          x?: number | null;
          y?: number | null;
        };
        Update: {
          assigned_to?: string | null;
          category?: string;
          created_at?: string;
          description?: string;
          duplicate_of?: string | null;
          floor_id?: string | null;
          id?: string;
          photo_path?: string | null;
          reporter_id?: string;
          resolved_at?: string | null;
          room_id?: string | null;
          status?: Database['public']['Enums']['report_status'];
          status_note?: string | null;
          updated_at?: string;
          urgent?: boolean;
          x?: number | null;
          y?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'reports_assigned_to_fkey';
            columns: ['assigned_to'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reports_category_fkey';
            columns: ['category'];
            isOneToOne: false;
            referencedRelation: 'report_categories';
            referencedColumns: ['key'];
          },
          {
            foreignKeyName: 'reports_duplicate_of_fkey';
            columns: ['duplicate_of'];
            isOneToOne: false;
            referencedRelation: 'reports';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reports_floor_id_fkey';
            columns: ['floor_id'];
            isOneToOne: false;
            referencedRelation: 'floors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reports_reporter_id_fkey';
            columns: ['reporter_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reports_room_id_fkey';
            columns: ['room_id'];
            isOneToOne: false;
            referencedRelation: 'rooms';
            referencedColumns: ['id'];
          },
        ];
      };
      responsibilities: {
        Row: {
          created_at: string;
          id: string;
          kind: Database['public']['Enums']['responsibility_kind'];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          kind: Database['public']['Enums']['responsibility_kind'];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          kind?: Database['public']['Enums']['responsibility_kind'];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'responsibilities_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      role_signups: {
        Row: {
          attended: boolean | null;
          confirmed_at: string | null;
          confirmed_by: string | null;
          created_at: string;
          event_id: string;
          hours_confirmed: number | null;
          id: string;
          note: string | null;
          role_id: string;
          status: Database['public']['Enums']['signup_status'];
          student_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          attended?: boolean | null;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          created_at?: string;
          event_id: string;
          hours_confirmed?: number | null;
          id?: string;
          note?: string | null;
          role_id: string;
          status?: Database['public']['Enums']['signup_status'];
          student_id?: string;
          updated_at?: string;
        };
        Update: {
          attended?: boolean | null;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          created_at?: string;
          event_id?: string;
          hours_confirmed?: number | null;
          id?: string;
          note?: string | null;
          role_id?: string;
          status?: Database['public']['Enums']['signup_status'];
          student_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'role_signups_confirmed_by_fkey';
            columns: ['confirmed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'role_signups_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'volunteer_events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'role_signups_role_id_fkey';
            columns: ['role_id'];
            isOneToOne: false;
            referencedRelation: 'event_roles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'role_signups_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      rooms: {
        Row: {
          code: string;
          created_at: string;
          floor_id: string;
          id: string;
          kind: Database['public']['Enums']['room_kind'];
          name: string;
          updated_at: string;
          x: number;
          y: number;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          created_at?: string;
          floor_id: string;
          id?: string;
          kind?: Database['public']['Enums']['room_kind'];
          name: string;
          updated_at?: string;
          x: number;
          y: number;
        };
        Update: {
          code?: string;
          created_at?: string;
          floor_id?: string;
          id?: string;
          kind?: Database['public']['Enums']['room_kind'];
          name?: string;
          updated_at?: string;
          x?: number;
          y?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'rooms_floor_id_fkey';
            columns: ['floor_id'];
            isOneToOne: false;
            referencedRelation: 'floors';
            referencedColumns: ['id'];
          },
        ];
      };
      roster: {
        Row: {
          claimed_at: string | null;
          created_at: string;
          email: string;
          full_name: string;
          grade: number | null;
          id: string;
          imported_by: string | null;
          role: Database['public']['Enums']['user_role'];
          section: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          claimed_at?: string | null;
          created_at?: string;
          email: string;
          full_name: string;
          grade?: number | null;
          id?: string;
          imported_by?: string | null;
          role?: Database['public']['Enums']['user_role'];
          section?: string | null;
          updated_at?: string;
        };
        Update: {
          claimed_at?: string | null;
          created_at?: string;
          email?: string;
          full_name?: string;
          grade?: number | null;
          id?: string;
          imported_by?: string | null;
          role?: Database['public']['Enums']['user_role'];
          section?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'roster_imported_by_fkey';
            columns: ['imported_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      sections: {
        Row: {
          created_at: string;
          grade: number;
          id: string;
          name: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          grade: number;
          id?: string;
          name: string;
        };
        Update: {
          created_at?: string;
          grade?: number;
          id?: string;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'sections_grade_fkey';
            columns: ['grade'];
            isOneToOne: false;
            referencedRelation: 'grades';
            referencedColumns: ['grade'];
          },
        ];
      };
      skill_tag_suggestions: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          reviewed_by: string | null;
          status: Database['public']['Enums']['tag_suggestion_status'];
          suggested_by: string;
          tag_id: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          reviewed_by?: string | null;
          status?: Database['public']['Enums']['tag_suggestion_status'];
          suggested_by?: string;
          tag_id?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          reviewed_by?: string | null;
          status?: Database['public']['Enums']['tag_suggestion_status'];
          suggested_by?: string;
          tag_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'skill_tag_suggestions_reviewed_by_fkey';
            columns: ['reviewed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'skill_tag_suggestions_suggested_by_fkey';
            columns: ['suggested_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'skill_tag_suggestions_tag_id_fkey';
            columns: ['tag_id'];
            isOneToOne: false;
            referencedRelation: 'skill_tags';
            referencedColumns: ['id'];
          },
        ];
      };
      skill_tags: {
        Row: {
          active: boolean;
          created_at: string;
          id: string;
          name: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          created_at?: string;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      staff_email_prefs: {
        Row: {
          created_at: string;
          enabled: boolean;
          id: string;
          mode: Database['public']['Enums']['email_mode'];
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          enabled?: boolean;
          id?: string;
          mode?: Database['public']['Enums']['email_mode'];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          enabled?: boolean;
          id?: string;
          mode?: Database['public']['Enums']['email_mode'];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'staff_email_prefs_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      staff_emails: {
        Row: {
          added_by: string | null;
          created_at: string;
          email: string;
          id: string;
        };
        ComputedFields: never;
        Insert: {
          added_by?: string | null;
          created_at?: string;
          email: string;
          id?: string;
        };
        Update: {
          added_by?: string | null;
          created_at?: string;
          email?: string;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'staff_emails_added_by_fkey';
            columns: ['added_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      supw_targets: {
        Row: {
          created_at: string;
          grade: number;
          hours: number;
          id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          grade: number;
          hours: number;
          id?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          grade?: number;
          hours?: number;
          id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'supw_targets_grade_fkey';
            columns: ['grade'];
            isOneToOne: true;
            referencedRelation: 'grades';
            referencedColumns: ['grade'];
          },
        ];
      };
      terms: {
        Row: {
          created_at: string;
          ends_on: string;
          id: string;
          name: string;
          starts_on: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          ends_on: string;
          id?: string;
          name: string;
          starts_on: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          ends_on?: string;
          id?: string;
          name?: string;
          starts_on?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      venue_blackouts: {
        Row: {
          created_at: string;
          ends_on: string;
          id: string;
          reason: string;
          starts_on: string;
          updated_at: string;
          venue_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          ends_on: string;
          id?: string;
          reason: string;
          starts_on: string;
          updated_at?: string;
          venue_id?: string | null;
        };
        Update: {
          created_at?: string;
          ends_on?: string;
          id?: string;
          reason?: string;
          starts_on?: string;
          updated_at?: string;
          venue_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'venue_blackouts_venue_id_fkey';
            columns: ['venue_id'];
            isOneToOne: false;
            referencedRelation: 'venues';
            referencedColumns: ['id'];
          },
        ];
      };
      venues: {
        Row: {
          active: boolean;
          bookable_from: string | null;
          bookable_until: string | null;
          capacity: number | null;
          created_at: string;
          id: string;
          max_booking_minutes: number | null;
          max_days_ahead: number | null;
          name: string;
          needs_approval: boolean;
          room_id: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          bookable_from?: string | null;
          bookable_until?: string | null;
          capacity?: number | null;
          created_at?: string;
          id?: string;
          max_booking_minutes?: number | null;
          max_days_ahead?: number | null;
          name: string;
          needs_approval?: boolean;
          room_id?: string | null;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          bookable_from?: string | null;
          bookable_until?: string | null;
          capacity?: number | null;
          created_at?: string;
          id?: string;
          max_booking_minutes?: number | null;
          max_days_ahead?: number | null;
          name?: string;
          needs_approval?: boolean;
          room_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'venues_room_id_fkey';
            columns: ['room_id'];
            isOneToOne: false;
            referencedRelation: 'rooms';
            referencedColumns: ['id'];
          },
        ];
      };
      volunteer_categories: {
        Row: {
          active: boolean;
          created_at: string;
          id: string;
          name: string;
          sort_order: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          created_at?: string;
          id?: string;
          name: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          id?: string;
          name?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      volunteer_events: {
        Row: {
          allow_multiple_roles: boolean;
          approval_note: string | null;
          approved_by: string | null;
          category_id: string | null;
          created_at: string;
          creator_id: string;
          description: string;
          ends_at: string;
          id: string;
          organiser_label: string | null;
          place_text: string | null;
          removed_at: string | null;
          removed_by: string | null;
          removed_reason: string | null;
          room_id: string | null;
          signup_deadline: string | null;
          starts_at: string;
          status: Database['public']['Enums']['volunteer_event_status'];
          supw_hours: number;
          title: string;
          updated_at: string;
          event_when_where: string | null;
        };
        ComputedFields: 'event_when_where';
        Insert: {
          allow_multiple_roles?: boolean;
          approval_note?: string | null;
          approved_by?: string | null;
          category_id?: string | null;
          created_at?: string;
          creator_id?: string;
          description?: string;
          ends_at: string;
          id?: string;
          organiser_label?: string | null;
          place_text?: string | null;
          removed_at?: string | null;
          removed_by?: string | null;
          removed_reason?: string | null;
          room_id?: string | null;
          signup_deadline?: string | null;
          starts_at: string;
          status?: Database['public']['Enums']['volunteer_event_status'];
          supw_hours?: number;
          title: string;
          updated_at?: string;
        };
        Update: {
          allow_multiple_roles?: boolean;
          approval_note?: string | null;
          approved_by?: string | null;
          category_id?: string | null;
          created_at?: string;
          creator_id?: string;
          description?: string;
          ends_at?: string;
          id?: string;
          organiser_label?: string | null;
          place_text?: string | null;
          removed_at?: string | null;
          removed_by?: string | null;
          removed_reason?: string | null;
          room_id?: string | null;
          signup_deadline?: string | null;
          starts_at?: string;
          status?: Database['public']['Enums']['volunteer_event_status'];
          supw_hours?: number;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'volunteer_events_approved_by_fkey';
            columns: ['approved_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'volunteer_events_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'volunteer_categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'volunteer_events_creator_id_fkey';
            columns: ['creator_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'volunteer_events_removed_by_fkey';
            columns: ['removed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'volunteer_events_room_id_fkey';
            columns: ['room_id'];
            isOneToOne: false;
            referencedRelation: 'rooms';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_anonymise_user: { Args: { p_confirm: string; p_user_id: string }; Returns: undefined };
      admin_attention: {
        Args: Record<PropertyKey, never>;
        Returns: {
          item_count: number;
          kind: string;
          oldest_at: string;
          urgent_count: number;
        }[];
      };
      admin_audit_filters: {
        Args: Record<PropertyKey, never>;
        Returns: {
          kind: string;
          value: string;
        }[];
      };
      admin_emergency_broadcast: { Args: { p_message: string; p_title: string }; Returns: number };
      admin_export_bookings: {
        Args: { p_from: string; p_to: string };
        Returns: {
          ends_at: string;
          requested_at: string;
          requested_by: string;
          requester_role: Database['public']['Enums']['user_role'];
          review_note: string;
          reviewed_by: string;
          starts_at: string;
          status: Database['public']['Enums']['booking_status'];
          supervising_teacher: string;
          title: string;
          venue: string;
        }[];
      };
      admin_export_reports: {
        Args: { p_from: string; p_to: string };
        Returns: {
          assigned_to: string;
          category: string;
          description: string;
          me_too: number;
          reported_at: string;
          reported_by: string;
          resolved_at: string;
          room: string;
          status: Database['public']['Enums']['report_status'];
          urgent: boolean;
        }[];
      };
      admin_import_people: {
        Args: { p_dry_run?: boolean; p_rows: Json };
        Returns: {
          email: string;
          full_name: string;
          message: string;
          outcome: string;
          row_number: number;
        }[];
      };
      admin_lift_suspension: { Args: { p_user_id: string }; Returns: undefined };
      admin_list_users: {
        Args: Record<PropertyKey, never>;
        Returns: {
          archived_at: string;
          created_at: string;
          email: string;
          full_name: string;
          grade: number;
          id: string;
          posting_suspended_until: string;
          responsibilities: Database['public']['Enums']['responsibility_kind'][];
          role: Database['public']['Enums']['user_role'];
          section: string;
          suspension_reason: string;
        }[];
      };
      admin_metrics: {
        Args: Record<PropertyKey, never>;
        Returns: {
          active_users: number;
          avg_days_to_resolve: number;
          bookings_held: number;
          bookings_requested: number;
          collab_posts_created: number;
          collab_posts_filled: number;
          days: number;
          new_reports: number;
          resolved_reports: number;
          supw_hours_confirmed: number;
        }[];
      };
      admin_moderate: {
        Args: {
          p_action: string;
          p_reason?: string;
          p_report_id?: string;
          p_target_id?: string;
          p_target_table?: string;
        };
        Returns: undefined;
      };
      admin_moderation_queue: {
        Args: Record<PropertyKey, never>;
        Returns: {
          author_id: string;
          author_name: string;
          excerpt: string;
          happened_at: string;
          is_hidden: boolean;
          is_removed: boolean;
          kind: string;
          reason: string;
          report_id: string;
          reporter_name: string;
          target_id: string;
          target_table: string;
          title: string;
        }[];
      };
      admin_review_tag_suggestion: {
        Args: { p_action: string; p_merge_into?: string; p_suggestion_id: string };
        Returns: undefined;
      };
      admin_rollover: {
        Args: { p_confirm?: string; p_dry_run?: boolean };
        Returns: {
          from_grade: number;
          students: number;
          to_grade: number;
        }[];
      };
      admin_save_class: {
        Args: {
          p_grade: number;
          p_id: string;
          p_name: string;
          p_section_id: string;
          p_student_ids: string[];
          p_subject: string;
          p_teacher_ids: string[];
        };
        Returns: string;
      };
      admin_set_role: {
        Args: { p_role: Database['public']['Enums']['user_role']; p_user_id: string };
        Returns: undefined;
      };
      admin_staff_email_settings: {
        Args: Record<PropertyKey, never>;
        Returns: {
          email: string;
          enabled: boolean;
          full_name: string;
          has_setting: boolean;
          mode: Database['public']['Enums']['email_mode'];
          responsibilities: Database['public']['Enums']['responsibility_kind'][];
          role: Database['public']['Enums']['user_role'];
          user_id: string;
        }[];
      };
      admin_supw_by_grade: {
        Args: { p_days: number };
        Returns: {
          grade: number;
          hours: number;
          students: number;
        }[];
      };
      admin_suspend_posting: {
        Args: { p_reason: string; p_until: string; p_user_id: string };
        Returns: undefined;
      };
      admin_update_profile: {
        Args: { p_full_name: string; p_grade: number; p_section: string; p_user_id: string };
        Returns: undefined;
      };
      admin_user_files: {
        Args: { p_user_id: string };
        Returns: {
          bucket: string;
          path: string;
        }[];
      };
      admin_venue_utilisation: {
        Args: { p_days: number };
        Returns: {
          bookable_hours: number;
          booked_hours: number;
          utilisation: number;
          venue_id: string;
          venue_name: string;
        }[];
      };
      assert_role_has_space: {
        Args: { p_role_id: string; p_signup_id: string };
        Returns: undefined;
      };
      attach_report_photo: { Args: { p_path: string; p_report_id: string }; Returns: undefined };
      auth_role: {
        Args: Record<PropertyKey, never>;
        Returns: Database['public']['Enums']['user_role'];
      };
      begin_trusted_change: { Args: Record<PropertyKey, never>; Returns: undefined };
      booking_auto_approve: {
        Args: {
          p_booking: Omit<
            Database['public']['Tables']['bookings']['Row'],
            Database['public']['Tables']['bookings']['ComputedFields']
          >;
        };
        Returns: {
          announce: boolean;
          created_at: string;
          ends_at: string;
          expected_attendance: number | null;
          id: string;
          last_reminder_at: string | null;
          purpose: string;
          requester_id: string;
          review_note: string | null;
          reviewed_by: string | null;
          starts_at: string;
          status: Database['public']['Enums']['booking_status'];
          supervising_teacher_id: string | null;
          title: string;
          updated_at: string;
          venue_id: string;
        };
        SetofOptions: {
          from: 'bookings';
          to: 'bookings';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      booking_calendar_problem: {
        Args: { p_ends: string; p_starts: string; p_venue_id: string };
        Returns: string;
      };
      booking_details: {
        Args: Record<PropertyKey, never>;
        Returns: {
          announce: boolean;
          created_at: string;
          ends_at: string;
          expected_attendance: number;
          id: string;
          overlaps_pending: number;
          purpose: string;
          requester_id: string;
          requester_name: string;
          requester_role: Database['public']['Enums']['user_role'];
          review_note: string;
          reviewed_by: string;
          starts_at: string;
          status: Database['public']['Enums']['booking_status'];
          supervising_teacher_id: string;
          supervising_teacher_name: string;
          title: string;
          venue_id: string;
          venue_name: string;
        }[];
      };
      booking_overlaps_approved: {
        Args: { p_ends: string; p_ignore: string; p_starts: string; p_venue_id: string };
        Returns: boolean;
      };
      calendar_day_note: { Args: { p_day: string; p_venue_id: string }; Returns: string };
      can_confirm_hours: { Args: { p_event_id: string }; Returns: boolean };
      can_manage_report: { Args: { p_category: string }; Returns: boolean };
      can_read_project: { Args: { p_project_id: string }; Returns: boolean };
      can_review_venues: { Args: Record<PropertyKey, never>; Returns: boolean };
      can_see_report: { Args: { p_report_id: string }; Returns: boolean };
      can_see_volunteer_event: { Args: { p_event_id: string }; Returns: boolean };
      collab_accepted_count: { Args: { p_post_id: string }; Returns: number };
      collab_post_counts: {
        Args: Record<PropertyKey, never>;
        Returns: {
          accepted_count: number;
          pending_count: number;
          post_id: string;
        }[];
      };
      collab_requests: {
        Args: { p_post_id: string };
        Returns: {
          created_at: string;
          email: string;
          full_name: string;
          grade: number;
          message: string;
          request_id: string;
          requester_id: string;
          section: string;
          status: Database['public']['Enums']['join_request_status'];
        }[];
      };
      collab_team: {
        Args: { p_post_id: string };
        Returns: {
          email: string;
          full_name: string;
          grade: number;
          is_owner: boolean;
          user_id: string;
        }[];
      };
      contrast_with_white: { Args: { p_hex: string }; Returns: number };
      email_digest_due: { Args: Record<PropertyKey, never>; Returns: boolean };
      event_signups: {
        Args: { p_event_id: string };
        Returns: {
          attended: boolean;
          created_at: string;
          email: string;
          full_name: string;
          grade: number;
          hours_confirmed: number;
          note: string;
          role_id: string;
          role_name: string;
          section: string;
          signup_id: string;
          status: Database['public']['Enums']['signup_status'];
          student_id: string;
          supw_hours_so_far: number;
        }[];
      };
      event_when_where: {
        Args: {
          p_event: Omit<
            Database['public']['Tables']['volunteer_events']['Row'],
            Database['public']['Tables']['volunteer_events']['ComputedFields']
          >;
        };
        Returns: string;
      };
      feature_enabled: { Args: { p_feature: string }; Returns: boolean };
      format_school_time: { Args: { p_time: string }; Returns: string };
      has_responsibility: {
        Args: { p_kind: Database['public']['Enums']['responsibility_kind'] };
        Returns: boolean;
      };
      hex_luminance: { Args: { p_hex: string }; Returns: number };
      hours_to_confirm: {
        Args: Record<PropertyKey, never>;
        Returns: {
          event_id: string;
          event_starts_at: string;
          event_title: string;
          full_name: string;
          grade: number;
          role_name: string;
          signup_id: string;
          student_id: string;
          suggested_hours: number;
        }[];
      };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_collab_owner: { Args: { p_post_id: string }; Returns: boolean };
      is_event_organiser: { Args: { p_event_id: string }; Returns: boolean };
      is_my_report: { Args: { p_report_id: string }; Returns: boolean };
      is_posting_suspended: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_project_owner: { Args: { p_project_id: string }; Returns: boolean };
      is_project_shared_with_me: { Args: { p_project_id: string }; Returns: boolean };
      is_staff: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_staff_member: { Args: { p_user_id: string }; Returns: boolean };
      is_trusted_change: { Args: Record<PropertyKey, never>; Returns: boolean };
      mark_email_digest_sent: { Args: Record<PropertyKey, never>; Returns: undefined };
      my_account_status: {
        Args: Record<PropertyKey, never>;
        Returns: {
          posting_suspended_until: string;
          suspension_reason: string;
        }[];
      };
      my_grade: { Args: Record<PropertyKey, never>; Returns: number };
      my_section_id: { Args: Record<PropertyKey, never>; Returns: string };
      notification_type_is_unmutable: {
        Args: { p_type: Database['public']['Enums']['notification_type'] };
        Returns: boolean;
      };
      notify: {
        Args: {
          p_body: string;
          p_email_now?: boolean;
          p_link: string;
          p_recipient: string;
          p_title: string;
          p_type: Database['public']['Enums']['notification_type'];
          p_urgent?: boolean;
        };
        Returns: string;
      };
      notify_responsibility: {
        Args: {
          p_body: string;
          p_email_now?: boolean;
          p_kind: Database['public']['Enums']['responsibility_kind'];
          p_link: string;
          p_title: string;
          p_type: Database['public']['Enums']['notification_type'];
          p_urgent?: boolean;
        };
        Returns: number;
      };
      open_reports_in_room: {
        Args: { p_room_id: string };
        Returns: {
          category: string;
          category_name: string;
          created_at: string;
          description: string;
          id: string;
          reported_by_me: boolean;
          status: Database['public']['Enums']['report_status'];
          urgent: boolean;
          vote_count: number;
          voted_by_me: boolean;
        }[];
      };
      public_status: {
        Args: Record<PropertyKey, never>;
        Returns: {
          accent_color: string;
          logo_url: string;
          maintenance_message: string;
          maintenance_until: string;
          school_name: string;
        }[];
      };
      publish_due_announcements: { Args: Record<PropertyKey, never>; Returns: number };
      report_feed: {
        Args: Record<PropertyKey, never>;
        Returns: {
          assigned_to: string;
          assigned_to_name: string;
          category: string;
          category_name: string;
          created_at: string;
          description: string;
          duplicate_of: string;
          floor_id: string;
          id: string;
          photo_path: string;
          reported_by_me: boolean;
          reporter_id: string;
          reporter_name: string;
          resolved_at: string;
          room_code: string;
          room_id: string;
          room_name: string;
          routed_to: Database['public']['Enums']['responsibility_kind'];
          status: Database['public']['Enums']['report_status'];
          status_note: string;
          urgent: boolean;
          vote_count: number;
          voted_by_me: boolean;
          x: number;
          y: number;
        }[];
      };
      report_headline: {
        Args: {
          p_report: Omit<
            Database['public']['Tables']['reports']['Row'],
            Database['public']['Tables']['reports']['ComputedFields']
          >;
        };
        Returns: string;
      };
      report_route: {
        Args: { p_category: string };
        Returns: Database['public']['Enums']['responsibility_kind'];
      };
      role_selected_count: { Args: { p_role_id: string }; Returns: number };
      send_announcement_notifications: { Args: { p_id: string }; Returns: undefined };
      signup_conflicts: {
        Args: { p_event_id: string; p_ignore_signup: string; p_student_id: string };
        Returns: boolean;
      };
      supw_hours_report: {
        Args: Record<PropertyKey, never>;
        Returns: {
          email: string;
          events_attended: number;
          full_name: string;
          grade: number;
          hours_confirmed: number;
          section: string;
          student_id: string;
        }[];
      };
      teachers_post_any_grade: { Args: Record<PropertyKey, never>; Returns: boolean };
      teaches_audience: { Args: { p_grades: number[]; p_section_ids: string[] }; Returns: boolean };
      uuid_or_null: { Args: { p_text: string }; Returns: string };
      venue_bookable_minutes: { Args: { p_day: string; p_venue_id: string }; Returns: number };
      venue_reminders: { Args: Record<PropertyKey, never>; Returns: number };
      volunteer_role_counts: {
        Args: Record<PropertyKey, never>;
        Returns: {
          applied_count: number;
          event_id: string;
          role_id: string;
          selected_count: number;
          spots_wanted: number;
          waitlisted_count: number;
        }[];
      };
    };
    Enums: {
      announcement_audience: 'school' | 'grades';
      booking_status: 'awaiting_teacher' | 'pending' | 'approved' | 'rejected' | 'cancelled';
      collab_status: 'open' | 'full' | 'closed';
      content_report_status: 'open' | 'actioned' | 'dismissed';
      email_mode: 'immediate' | 'digest';
      join_request_status: 'pending' | 'accepted' | 'declined' | 'withdrawn';
      notification_type:
        | 'announcement_new'
        | 'report_new'
        | 'report_status'
        | 'collab_request_new'
        | 'collab_request_accepted'
        | 'collab_request_declined'
        | 'vol_event_pending_approval'
        | 'vol_event_approved'
        | 'vol_event_sent_back'
        | 'vol_signup_new'
        | 'vol_selected'
        | 'vol_waitlisted'
        | 'vol_withdrawal'
        | 'booking_awaiting_teacher'
        | 'booking_pending'
        | 'booking_approved'
        | 'booking_rejected'
        | 'booking_reminder'
        | 'project_shared'
        | 'project_feedback'
        | 'emergency';
      outbox_kind: 'immediate' | 'digest';
      outbox_status: 'queued' | 'sent' | 'failed';
      project_status: 'draft' | 'shared' | 'in_review' | 'feedback_given' | 'complete';
      report_status:
        'open' | 'acknowledged' | 'in_progress' | 'resolved' | 'duplicate' | 'wont_fix';
      responsibility_kind: 'facilities' | 'it' | 'venues' | 'supw';
      room_kind: 'classroom' | 'lab' | 'office' | 'hall' | 'library' | 'cafeteria' | 'other';
      signup_status: 'applied' | 'selected' | 'waitlisted' | 'not_selected' | 'withdrawn';
      tag_suggestion_status: 'pending' | 'approved' | 'merged' | 'rejected';
      user_role: 'student' | 'teacher' | 'admin';
      volunteer_event_status: 'awaiting_approval' | 'published' | 'sent_back' | 'closed';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      announcement_audience: ['school', 'grades'],
      booking_status: ['awaiting_teacher', 'pending', 'approved', 'rejected', 'cancelled'],
      collab_status: ['open', 'full', 'closed'],
      content_report_status: ['open', 'actioned', 'dismissed'],
      email_mode: ['immediate', 'digest'],
      join_request_status: ['pending', 'accepted', 'declined', 'withdrawn'],
      notification_type: [
        'announcement_new',
        'report_new',
        'report_status',
        'collab_request_new',
        'collab_request_accepted',
        'collab_request_declined',
        'vol_event_pending_approval',
        'vol_event_approved',
        'vol_event_sent_back',
        'vol_signup_new',
        'vol_selected',
        'vol_waitlisted',
        'vol_withdrawal',
        'booking_awaiting_teacher',
        'booking_pending',
        'booking_approved',
        'booking_rejected',
        'booking_reminder',
        'project_shared',
        'project_feedback',
        'emergency',
      ],
      outbox_kind: ['immediate', 'digest'],
      outbox_status: ['queued', 'sent', 'failed'],
      project_status: ['draft', 'shared', 'in_review', 'feedback_given', 'complete'],
      report_status: ['open', 'acknowledged', 'in_progress', 'resolved', 'duplicate', 'wont_fix'],
      responsibility_kind: ['facilities', 'it', 'venues', 'supw'],
      room_kind: ['classroom', 'lab', 'office', 'hall', 'library', 'cafeteria', 'other'],
      signup_status: ['applied', 'selected', 'waitlisted', 'not_selected', 'withdrawn'],
      tag_suggestion_status: ['pending', 'approved', 'merged', 'rejected'],
      user_role: ['student', 'teacher', 'admin'],
      volunteer_event_status: ['awaiting_approval', 'published', 'sent_back', 'closed'],
    },
  },
} as const;
