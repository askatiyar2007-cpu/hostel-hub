'use client';

import React from 'react';
import { FileText, Upload, ShieldCheck, Clock, Download, File } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function StudentDocumentsPage() {
  const docs = [
    { name: 'ID Proof (Aadhar/PAN)', status: 'Verified', date: '2024-01-15', type: 'ID' },
    { name: 'College ID Card', status: 'Verified', date: '2024-01-15', type: 'Academic' },
    { name: 'Local Guardian Photo', status: 'Pending', date: '2024-03-10', type: 'Photo' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-900 font-display">Documents</h1>
          <p className="text-slate-600">Manage your identity and registration documents</p>
        </div>
        <Button variant="outline" className="rounded-xl">
          <Upload className="mr-2 h-4 w-4" />
          Upload New
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {docs.map((doc, idx) => (
          <Card key={idx} className="border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
                  <FileText className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 mb-1">{doc.name}</h3>
                  <p className="text-xs text-slate-500 mb-2">{doc.type}</p>
                  <div className="flex items-center gap-2">
                    <span className={`flex items-center text-xs font-medium ${doc.status === 'Verified' ? 'text-green-600' : 'text-amber-600'}`}>
                      {doc.status === 'Verified' ? <ShieldCheck size={12} className="mr-1" /> : <Clock size={12} className="mr-1" />}
                      {doc.status}
                    </span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs text-slate-500">{doc.date}</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100">
                <Button variant="ghost" size="sm" className="w-full rounded-lg text-slate-600 hover:text-slate-900">
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State Card for Additional Documents */}
      <Card className="border border-dashed border-slate-300 bg-slate-50">
        <CardContent className="p-8 text-center">
          <div className="h-12 w-12 rounded-xl bg-slate-200 flex items-center justify-center mx-auto mb-4">
            <File className="h-6 w-6 text-slate-400" />
          </div>
          <h3 className="font-semibold text-slate-900 mb-2">More Documents Coming Soon</h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto">Additional document types will be available based on your hostel requirements.</p>
        </CardContent>
      </Card>
    </div>
  );
}
