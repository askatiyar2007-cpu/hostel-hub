'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/context';
import { Complaint } from '@/types/database';
import { AlertCircle, Plus, MessageCircle, Clock } from 'lucide-react';

export default function StudentComplaintsPage() {
  const { profile } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchComplaints = useCallback(async () => {
    try {
      if (!profile?.id) return;

      const { data: studentRecord, error: fetchError } = await supabase
        .from('students')
        .select('id')
        .eq('profile_id', profile.id)
        .maybeSingle();

      if (fetchError) {
        console.error("Error fetching student record:", fetchError);
        setLoading(false);
        return;
      }

      if (!studentRecord) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('complaints')
        .select('*')
        .eq('student_id', studentRecord.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setComplaints(data || []);
    } catch (error) {
      console.error('Error fetching complaints:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold">My Complaints</h1>
          <p className="text-muted-foreground">Report and track issues in your hostel</p>
        </div>
        <button className="btn-primary flex items-center space-x-2">
          <Plus size={20} />
          <span>New Complaint</span>
        </button>
      </div>

      <div className="space-y-4">
        {loading ? (
          <p>Loading complaints...</p>
        ) : complaints.length === 0 ? (
          <div className="card text-center py-12">
            <AlertCircle size={48} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No complaints filed yet</p>
          </div>
        ) : (
          complaints.map((complaint) => (
            <div key={complaint.id} className="card">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    complaint.priority === 1 ? 'bg-red-100 text-red-600' : 
                    complaint.priority === 2 ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                  }`}>
                    {complaint.priority === 1 ? 'High' : complaint.priority === 2 ? 'Medium' : 'Low'}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-gray-100 text-gray-600`}>
                    {complaint.status.replace('_', ' ')}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground flex items-center">
                  <Clock size={12} className="mr-1" />
                  {new Date(complaint.created_at).toLocaleDateString()}
                </span>
              </div>
              <h3 className="font-bold text-lg">{complaint.title}</h3>
              <p className="text-muted-foreground text-sm mt-1">{complaint.description}</p>
              
              {complaint.status === 'resolved' && (
                <div className="mt-4 p-3 bg-green-50 rounded-lg flex items-center space-x-2 text-green-700 text-sm">
                  <MessageCircle size={16} />
                  <span>Your issue has been resolved. Please rate the service.</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
