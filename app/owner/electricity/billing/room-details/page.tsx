'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, FileText, Users, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface BillingSegment {
  id: string;
  start_date: string;
  end_date: string | null;
  start_reading_id: string | null;
  end_reading_id: string | null;
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

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
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
    
    // Calculate consumption from charge amount and segment rate
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="outline" 
          size="icon"
          onClick={() => window.location.href = '/owner/electricity/billing'}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileText className="h-8 w-8 text-blue-600" />
            Room {details.room_number} Billing Details
          </h1>
          <p className="text-gray-600 mt-1">
            {new Date(details.billing_month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Consumption</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">
              {details.total_consumption.toFixed(2)} kWh
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Electricity Cost</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(details.total_cost_paise)}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Segments</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{details.segments.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Student Billing Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Student Electricity Charges
          </CardTitle>
          <CardDescription>
            Electricity charges per student for this billing period
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(chargesByStudent).map(([studentId, data]) => (
              <div key={studentId} className="flex items-center justify-between p-4 bg-muted/20 rounded-lg border">
                <div>
                  <p className="font-semibold">{data.student_name}</p>
                  <p className="text-sm text-gray-500">
                    {data.total_consumption.toFixed(2)} kWh
                  </p>
                  <p className="text-xs text-gray-400">
                    {data.segments.length} segment{data.segments.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 mb-1">Electricity Due</p>
                  <p className="text-xl font-bold text-green-600">
                    {formatCurrency(data.total_charge)}
                  </p>
                  <Badge variant="outline" className="mt-1">Due</Badge>
                </div>
              </div>
            ))}
            
            {Object.keys(chargesByStudent).length === 0 && (
              <p className="text-center text-gray-500 py-4">
                No student charges found for this period
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Segment Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Segment Breakdown
          </CardTitle>
          <CardDescription>
            Detailed breakdown of billing segments and consumption
          </CardDescription>
        </CardHeader>
        <CardContent>
          {details.segments.length === 0 ? (
            <p className="text-center text-gray-500 py-4">
              No billing segments found for this period
            </p>
          ) : (
            <div className="space-y-6">
              {details.segments.map((segment, index) => (
                <div key={segment.id} className="border rounded-lg p-4 space-y-4">
                  {/* Segment Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-100 text-blue-800">
                        Segment {index + 1}
                      </Badge>
                      <Badge variant={segment.segment_type === 'occupied' ? 'default' : 'secondary'}>
                        {segment.segment_type === 'occupied' ? 'Occupied' : 'Empty'}
                      </Badge>
                    </div>
                    {segment.end_date && (
                      <Badge className="bg-green-100 text-green-800">
                        Closed
                      </Badge>
                    )}
                  </div>

                  {/* Segment Dates */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Start Date</p>
                      <p className="font-semibold">{formatDateTime(segment.start_date)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">End Date</p>
                      <p className="font-semibold">
                        {segment.end_date ? formatDateTime(segment.end_date) : 'Open'}
                      </p>
                    </div>
                  </div>

                  {/* Reading Values */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Start Reading</p>
                      <p className="font-semibold">
                        {segment.start_reading_value !== null ? `${segment.start_reading_value} kWh` : 'Pending'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">End Reading</p>
                      <p className="font-semibold">
                        {segment.end_reading_value !== null ? `${segment.end_reading_value} kWh` : 'Pending'}
                      </p>
                    </div>
                  </div>

                  {/* Consumption and Cost */}
                  {segment.consumption_units !== null && segment.total_cost_paise !== null && (
                    <div className="grid grid-cols-2 gap-4 text-sm bg-muted/30 p-3 rounded">
                      <div>
                        <p className="text-gray-500">Consumption</p>
                        <p className="font-semibold text-blue-600">
                          {segment.consumption_units.toFixed(2)} kWh
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Cost</p>
                        <p className="font-semibold text-green-600">
                          {formatCurrency(segment.total_cost_paise)}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Rate */}
                  <div className="text-sm">
                    <p className="text-gray-500">Electricity Rate</p>
                    <p className="font-semibold">
                      ₹{segment.rate_per_unit.toFixed(4)} / kWh
                    </p>
                  </div>

                  {/* Occupants */}
                  {segment.occupants.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-500 mb-2">Occupants ({segment.occupant_count})</p>
                      <div className="flex flex-wrap gap-2">
                        {segment.occupants.map(occupant => (
                          <Badge key={occupant.student_id} variant="outline">
                            {occupant.student_name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Segment Charges */}
                  {segment.segment_type === 'occupied' && segment.consumption_units !== null && (
                    <div className="border-t pt-3">
                      <p className="text-sm text-gray-500 mb-2">Charges for this segment</p>
                      <div className="space-y-2">
                        {segment.occupants.map(occupant => {
                          const charge = details.student_charges.find(
                            c => c.student_id === occupant.student_id && c.segment_id === segment.id
                          );
                          const consumption = charge ? charge.charge_amount_paise / 100 / segment.rate_per_unit : 0;
                          return charge ? (
                            <div key={occupant.student_id} className="flex justify-between text-sm">
                              <span>{occupant.student_name}</span>
                              <div className="text-right">
                                <span className="text-gray-500 mr-2">{consumption.toFixed(2)} kWh</span>
                                <span className="font-semibold">
                                  {formatCurrency(charge.charge_amount_paise)}
                                </span>
                              </div>
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
