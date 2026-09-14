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
          bgColor: 'bg-rose-50', 
          iconColor: 'text-rose-600', 
          borderColor: 'border-rose-200',
          badgeColor: 'bg-rose-100 text-rose-700'
        };
      case 'fee_reminder': 
        return { 
          icon: Bell, 
          bgColor: 'bg-amber-50', 
          iconColor: 'text-amber-600', 
          borderColor: 'border-amber-200',
          badgeColor: 'bg-amber-100 text-amber-700'
        };
      case 'maintenance': 
        return { 
          icon: Wrench, 
          bgColor: 'bg-blue-50', 
          iconColor: 'text-blue-600', 
          borderColor: 'border-blue-200',
          badgeColor: 'bg-blue-100 text-blue-700'
        };
      default: 
        return { 
          icon: Megaphone, 
          bgColor: 'bg-slate-50', 
          iconColor: 'text-slate-600', 
          borderColor: 'border-slate-200',
          badgeColor: 'bg-slate-100 text-slate-700'
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
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900 font-display">Announcements</h1>
        <p className="text-slate-600">Stay updated with latest news from your hostel</p>
      </div>

      {announcements.length === 0 ? (
        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-12 text-center">
            <div className="h-16 w-16 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mx-auto mb-4">
              <Megaphone className="h-8 w-8 text-amber-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">No announcements yet</h3>
            <p className="text-slate-600 max-w-md mx-auto">Check back later for updates from your hostel.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {announcements.map((item) => {
            const config = getTypeConfig(item.notice_type);
            const Icon = config.icon;
            
            return (
              <Card key={item.id} className={`border ${config.borderColor} bg-white shadow-sm`}>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className={`h-12 w-12 rounded-xl ${config.bgColor} ${config.iconColor} flex items-center justify-center shrink-0`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold uppercase ${config.badgeColor}`}>
                          {item.notice_type.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-slate-500 flex items-center">
                          <Calendar size={12} className="mr-1" />
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 mb-2">{item.title}</h3>
                      <p className="text-slate-600 whitespace-pre-wrap">{item.body}</p>
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
