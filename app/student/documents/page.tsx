'use client';

import React from 'react';
import { FileText, Upload, ShieldCheck, Clock } from 'lucide-react';

export default function StudentDocumentsPage() {
  const docs = [
    { name: 'ID Proof (Aadhar/PAN)', status: 'Verified', date: '2024-01-15' },
    { name: 'College ID Card', status: 'Verified', date: '2024-01-15' },
    { name: 'Local Guardian Photo', status: 'Pending', date: '2024-03-10' },
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold">My Documents</h1>
          <p className="text-muted-foreground">Manage your identity and registration documents</p>
        </div>
        <button className="btn-secondary flex items-center space-x-2">
          <Upload size={20} />
          <span>Upload New</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {docs.map((doc, idx) => (
          <div key={idx} className="card flex items-center space-x-4">
            <div className="p-4 bg-primary/10 rounded-xl text-primary">
              <FileText size={32} />
            </div>
            <div className="flex-1">
              <h3 className="font-bold">{doc.name}</h3>
              <div className="flex items-center space-x-3 mt-1 text-xs">
                <span className={`flex items-center ${doc.status === 'Verified' ? 'text-green-600' : 'text-amber-600'}`}>
                  {doc.status === 'Verified' ? <ShieldCheck size={14} className="mr-1" /> : <Clock size={14} className="mr-1" />}
                  {doc.status}
                </span>
                <span className="text-muted-foreground">Updated: {doc.date}</span>
              </div>
            </div>
            <button className="text-primary font-medium text-sm hover:underline">View</button>
          </div>
        ))}
      </div>
    </div>
  );
}
