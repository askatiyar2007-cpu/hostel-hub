'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/context';
import { Notice } from '@/types/database';
import { Calendar, Megaphone } from 'lucide-react';

export default function StudentAnnouncementsPage() {
  const { profile } = useAuth();
  const [announcements, setAnnouncements] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAnnouncements = useCallback(async () => {
    try {
      if (!profile?.id) return;

      // Get the student's hostel_id from room_allocations
      // room_allocations.student_id references auth.users.id (which is profile.user_id)
      const { data: assignment } = await supabase
        .from('room_allocations')
        .select('hostel_id')
        .eq('student_id', profile.user_id)
        .eq('active', true)
        .maybeSingle();

      if (assignment) {
        const { data, error } = await supabase
          .from('notices')
          .select('*')
          .eq('hostel_id', assignment.hostel_id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setAnnouncements(data || []);
      }
    } catch (error) {
      console.error('Error fetching announcements:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.id, profile?.user_id]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const getTypeStyle = (type: string) => {
    switch (type) {
      case 'emergency': return 'bg-red-100 text-red-600 border-red-200';
      case 'fee_reminder': return 'bg-amber-100 text-amber-600 border-amber-200';
      case 'maintenance': return 'bg-blue-100 text-blue-600 border-blue-200';
      default: return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Announcements</h1>
        <p className="text-muted-foreground">Stay updated with latest news from your hostel</p>
      </div>

      <div className="space-y-6">
        {loading ? (
          <p>Loading announcements...</p>
        ) : announcements.length === 0 ? (
          <div className="card text-center py-12">
            <Megaphone size={48} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No announcements yet</p>
          </div>
        ) : (
          announcements.map((item) => (
            <div key={item.id} className={`p-6 rounded-xl border-l-4 shadow-sm bg-white ${getTypeStyle(item.notice_type)}`}>
              <div className="flex justify-between items-start mb-3">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getTypeStyle(item.notice_type)}`}>
                  {item.notice_type.replace('_', ' ')}
                </span>
                <span className="text-xs text-muted-foreground flex items-center">
                  <Calendar size={12} className="mr-1" />
                  {new Date(item.created_at).toLocaleDateString()}
                </span>
              </div>
              <h3 className="text-lg font-bold text-gray-900">{item.title}</h3>
              <p className="text-gray-600 mt-2 whitespace-pre-wrap">{item.body}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
