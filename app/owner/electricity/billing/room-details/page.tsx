'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, FileText, Users, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface BillingSegment {
  id: string;
  start_date: string;
  end_date: string | null;
  start_reading_id: string | null;
  end_reading_id: string | null;
  meter_id: string | null;
  start_reading_value: number | null;
  end_reading_value: number | null;
  consumption_units: number | null;
  rate_per_unit: number;
  total_cost_paise: number | null;
  occupant_count: number;
  segment_type: 'occupied' | 'empty';
}

interface SegmentOccupant {
  student_id: string;
  student_name: string;
  student_email: string | null;
}

interface StudentCharge {
  student_id: string;
  student_name: string;
  charge_amount_paise: number;
  segment_id: string;
}

interface RoomBillingDetails {
  room_id: string;
  room_number: string;
  billing_month: string;
  meter_id: string | null;
  segments: (BillingSegment & { occupants: SegmentOccupant[] })[];
  student_charges: StudentCharge[];
  total_consumption: number;
  total_cost_paise: number;
}

export default function RoomBillingDetailsPage() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get('room_id');
  const month = searchParams.get('month');
  
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<RoomBillingDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId || !month) {
      setError('Missing required parameters: room_id and month');
      setLoading(false);
      return;
    }

    const fetchDetails = async () => {
      try {
        const params = new URLSearchParams({
          room_id: roomId,
          billing_month: month
        });

        const response = await fetch(`/api/billing/room-details?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch billing details');
        }
        
        const data = await response.json();
        setDetails(data);
      } catch (err: any) {
        console.error('Error fetching billing details:', err);
        setError(err.message || 'Failed to load billing details');
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [roomId, month]);

  const formatCurrency = (paise: number) => {
    return `₹${(paise / 100).toFixed(2)}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-center text-gray-500">Loading billing details...</p>
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-red-500">
          <CardContent className="pt-6">
            <p className="text-red-600">{error || 'Failed to load billing details'}</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => window.location.href = '/owner/electricity/billing'}
            >
              Back to Billing Overview
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Group charges by student and calculate consumption
  const chargesByStudent = details.student_charges.reduce((acc, charge) => {
    if (!acc[charge.student_id]) {
      acc[charge.student_id] = {
        student_name: charge.student_name,
        total_charge: 0,
        total_consumption: 0,
        segments: []
      };
    }
    acc[charge.student_id].total_charge += charge.charge_amount_paise;
    
    const segment = details.segments.find(s => s.id === charge.segment_id);
    if (segment && segment.rate_per_unit > 0) {
      const consumption = charge.charge_amount_paise / 100 / segment.rate_per_unit;
      acc[charge.student_id].total_consumption += consumption;
    }
    
    acc[charge.student_id].segments.push({
      segment_id: charge.segment_id,
      charge: charge.charge_amount_paise,
      consumption: segment ? charge.charge_amount_paise / 100 / segment.rate_per_unit : 0
    });
    return acc;
  }, {} as Record<string, { student_name: string; total_charge: number; total_consumption: number; segments: Array<{ segment_id: string; charge: number; consumption: number }> }>);

  const isOpenSegment = (segment: BillingSegment) => !segment.end_date;

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6 max-w-4xl">
      {/* Compact Header */}
      <div className="flex items-center gap-3">
        <Button 
          variant="outline" 
          size="icon"
          onClick={() => window.location.href = '/owner/electricity/billing'}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <FileText className="h-5 w-5 md:h-6 md:w-6 text-blue-600" />
            Room {details.room_number}
          </h1>
          <p className="text-sm text-gray-600">
            {new Date(details.billing_month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Compact Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-700 font-medium">Consumption</p>
          <p className="text-lg md:text-xl font-bold text-blue-900">
            {details.total_consumption.toFixed(2)} kWh
          </p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-xs text-green-700 font-medium">Total Cost</p>
          <p className="text-lg md:text-xl font-bold text-green-900">
            {formatCurrency(details.total_cost_paise)}
          </p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <p className="text-xs text-gray-700 font-medium">Segments</p>
          <p className="text-lg md:text-xl font-bold text-gray-900">
            {details.segments.length}
          </p>
        </div>
      </div>

      {/* Student Electricity Charges - Primary Section */}
      <Card>
        <CardContent className="p-4">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
            <Users className="h-5 w-5 text-blue-600" />
            Student Electricity Charges
          </h2>
          {Object.keys(chargesByStudent).length === 0 ? (
            <p className="text-center text-gray-500 py-4">No student charges found</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(chargesByStudent).map(([studentId, data]) => (
                <div key={studentId} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
                  <div>
                    <p className="font-semibold text-sm">{data.student_name}</p>
                    <p className="text-xs text-gray-500">
                      {data.total_consumption.toFixed(2)} kWh • {data.segments.length} segment{data.segments.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-600">
                      {formatCurrency(data.total_charge)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Compact Billing Timeline */}
      <Card>
        <CardContent className="p-4">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
            <Clock className="h-5 w-5 text-blue-600" />
            Billing Timeline
          </h2>
          {details.segments.length === 0 ? (
            <p className="text-center text-gray-500 py-4">No billing segments found</p>
          ) : (
            <div className="space-y-3">
              {details.segments.map((segment, index) => {
                const isOpen = isOpenSegment(segment);
                return (
                  <div 
                    key={segment.id} 
                    className={`border rounded-lg p-3 ${isOpen ? 'border-yellow-400 bg-yellow-50' : ''}`}
                  >
                    {/* Timeline Header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-500">#{index + 1}</span>
                        <Badge variant={segment.segment_type === 'occupied' ? 'default' : 'secondary'} className="text-xs">
                          {segment.segment_type === 'occupied' ? 'Occupied' : 'Empty'}
                        </Badge>
                        {isOpen && (
                          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 text-xs flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            OPEN — READING REQUIRED
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">
                        ₹{segment.rate_per_unit.toFixed(2)}/kWh
                      </span>
                    </div>

                    {/* Time Range */}
                    <div className="text-sm mb-2">
                      <span className="font-medium">{formatDate(segment.start_date)}</span>
                      <span className="text-gray-400 mx-1">→</span>
                      <span className={isOpen ? 'text-yellow-700 font-medium' : ''}>
                        {isOpen ? 'Pending' : formatDate(segment.end_date!)}
                      </span>
                    </div>

                    {/* Readings */}
                    <div className="text-sm mb-2">
                      <span className="font-medium">
                        {segment.start_reading_value !== null ? `${segment.start_reading_value} kWh` : 'Pending'}
                      </span>
                      <span className="text-gray-400 mx-1">→</span>
                      <span className={isOpen ? 'text-yellow-700 font-medium' : ''}>
                        {segment.end_reading_value !== null ? `${segment.end_reading_value} kWh` : 'Pending'}
                      </span>
                    </div>

                    {/* Consumption & Cost */}
                    {segment.consumption_units !== null && segment.total_cost_paise !== null && (
                      <div className="flex items-center justify-between text-sm bg-white/50 rounded p-2 mb-2">
                        <span className="text-blue-600 font-medium">
                          {segment.consumption_units.toFixed(2)} kWh
                        </span>
                        <span className="text-green-600 font-bold">
                          {formatCurrency(segment.total_cost_paise)}
                        </span>
                      </div>
                    )}

                    {/* Occupants */}
                    {segment.occupants.length > 0 && (
                      <div className="text-xs mb-2">
                        <span className="text-gray-500">Occupants:</span>{' '}
                        <span className="font-medium">
                          {segment.occupants.map(o => o.student_name).join(' + ')}
                        </span>
                      </div>
                    )}

                    {/* Per-Student Split for Occupied Segments - Compact */}
                    {segment.segment_type === 'occupied' && segment.consumption_units !== null && (
                      <div className="text-xs">
                        <span className="text-gray-500">Split:</span>{' '}
                        {segment.occupants.map(occupant => {
                          const charge = details.student_charges.find(
                            c => c.student_id === occupant.student_id && c.segment_id === segment.id
                          );
                          return charge ? (
                            <span key={occupant.student_id} className="font-medium">
                              {occupant.student_name} {formatCurrency(charge.charge_amount_paise)}
                              {segment.occupants.indexOf(occupant) < segment.occupants.length - 1 && ' · '}
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}

                    {/* Record Reading Action for Open Segments */}
                    {isOpen && details.meter_id && (
                      <div className="mt-3 pt-2 border-t border-yellow-200">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="text-xs h-7"
                          onClick={() => window.location.href = `/owner/electricity/readings/record?meter_id=${details.meter_id}&reason=month_end`}
                        >
                          Record Closing Reading
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
