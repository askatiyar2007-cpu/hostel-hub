'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/context';
import { Notice } from '@/types/database';
import { Calendar, Megaphone, AlertTriangle, Wrench, Bell, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function StudentAnnouncementsPage() {
  const { profile } = useAuth();
  const [announcements, setAnnouncements] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAnnouncements = useCallback(async () => {
    try {
      if (!profile?.id) return;

      const { data: studentRecord } = await supabase
        .from('students')
        .select('id')
        .eq('profile_id', profile.id)
        .maybeSingle();

      if (!studentRecord) {
        setLoading(false);
        return;
      }

      const { data: assignment } = await supabase
        .from('room_allocations')
        .select('hostel_id')
        .eq('student_id', studentRecord.id)
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
  }, [profile?.id]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const getTypeConfig = (type: string) => {
    switch (type) {
      case 'emergency': 
        return { 
          icon: AlertTriangle, 
          bgColor: 'bg-rose-50 dark:bg-rose-950/40', 
          iconColor: 'text-rose-600 dark:text-rose-400', 
          borderColor: 'border-rose-200 dark:border-rose-900',
          badgeColor: 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300'
        };
      case 'fee_reminder': 
        return { 
          icon: Bell, 
          bgColor: 'bg-amber-50 dark:bg-amber-950/40', 
          iconColor: 'text-amber-600 dark:text-amber-400', 
          borderColor: 'border-amber-200 dark:border-amber-900',
          badgeColor: 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300'
        };
      case 'maintenance': 
        return { 
          icon: Wrench, 
          bgColor: 'bg-teal-50 dark:bg-teal-500/10', 
          iconColor: 'text-teal-700 dark:text-teal-400', 
          borderColor: 'border-slate-200/90 dark:border-[#1a3d52]',
          badgeColor: 'bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300'
        };
      default: 
        return { 
          icon: Megaphone, 
          bgColor: 'bg-teal-50 dark:bg-teal-500/10', 
          iconColor: 'text-teal-700 dark:text-teal-400', 
          borderColor: 'border-slate-200/90 dark:border-[#1a3d52]',
          badgeColor: 'bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300'
        };
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Clock className="animate-spin h-8 w-8 text-teal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-[#1a3d52]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Announcements</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Stay updated with official notices and alerts from your hostel management.</p>
        </div>
      </div>

      {announcements.length === 0 ? (
        <Card className="border border-slate-200/90 dark:border-[#1a3d52] bg-white dark:bg-[#0e222e] shadow-sm">
          <CardContent className="p-12 text-center">
            <div className="h-16 w-16 rounded-2xl bg-teal-50 text-teal-700 border border-teal-200/60 dark:bg-teal-500/10 dark:text-teal-400 dark:border-teal-500/20 flex items-center justify-center mx-auto mb-4">
              <Megaphone className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">No announcements yet</h3>
            <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto">Check back later for updates from your hostel.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {announcements.map((item) => {
            const config = getTypeConfig(item.notice_type);
            const Icon = config.icon;
            
            return (
              <Card key={item.id} className={`border ${config.borderColor} bg-white dark:bg-[#0e222e] shadow-sm`}>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className={`h-12 w-12 rounded-xl ${config.bgColor} ${config.iconColor} border border-teal-200/60 dark:border-teal-500/20 flex items-center justify-center shrink-0`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold uppercase ${config.badgeColor}`}>
                          {item.notice_type.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center">
                          <Calendar size={12} className="mr-1" />
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2 capitalize">{item.title}</h3>
                      <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{item.body}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
