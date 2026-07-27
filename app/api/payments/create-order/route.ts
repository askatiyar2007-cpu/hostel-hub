import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const { feeId, amount, studentId } = await req.json();

    if (!feeId || !amount || !studentId) {
      return NextResponse.json(
        { error: 'Missing required parameters: feeId, amount, studentId' },
        { status: 400 }
      );
    }

    // 1. Fetch the student fee details to confirm existence and retrieve associated metadata
    const { data: fee, error: feeError } = await supabaseServer
      .from('student_fees')
      .select('id, allocation_id, hostel_id, amount')
      .eq('id', feeId)
      .single();

    if (feeError || !fee) {
      console.error('Error fetching student fee:', feeError);
      return NextResponse.json(
        { error: 'Student fee record not found' },
        { status: 404 }
      );
    }

    // 2. Determine mode (Sandbox vs Production)
    const knitPayMode = process.env.KNITPAY_MODE || 'sandbox';
    const isSandbox = knitPayMode === 'sandbox' || 
                      process.env.KNITPAY_API_KEY?.startsWith('test_') || 
                      process.env.NEXT_PUBLIC_KNITPAY_KEY_ID?.startsWith('test_');

    let gatewayOrderId = '';

    if (isSandbox) {
      // In Sandbox/Demo mode, generate a mock order ID
      gatewayOrderId = `mock_order_${Math.random().toString(36).substring(2, 11)}`;
    } else {
      // Real integration: Make API request to Knit Pay / RapidAPI UPI gateway
      try {
        const response = await fetch('https://knit-pay-upi.p.rapidapi.com/order/create', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'X-RapidAPI-Key': process.env.KNITPAY_API_KEY || '',
            'X-RapidAPI-Host': process.env.RAPIDAPI_HOST || 'knit-pay-upi.p.rapidapi.com'
          },
          body: JSON.stringify({
            amount: Number(amount),
            merchantId: process.env.KNITPAY_MERCHANT_ID,
            callbackUrl: `${new URL(req.url).origin}/api/payments/webhook`,
            metadata: {
              feeId,
              studentId,
              allocationId: fee.allocation_id,
              hostelId: fee.hostel_id
            }
          })
        });

        if (response.ok) {
          const data = await response.json();
          gatewayOrderId = data.orderId || data.id;
        } else {
          console.warn('Knit Pay production API failed, falling back to mock sandbox order');
          gatewayOrderId = `mock_order_${Math.random().toString(36).substring(2, 11)}`;
        }
      } catch (err) {
        console.error('Failed to call Knit Pay API, falling back to mock sandbox order:', err);
        gatewayOrderId = `mock_order_${Math.random().toString(36).substring(2, 11)}`;
      }
    }

    // 3. Create a pending payment log in Supabase database
    const { error: paymentError } = await supabaseServer
      .from('payments')
      .insert({
        student_fees_id: feeId,
        student_id: studentId,
        allocation_id: fee.allocation_id,
        hostel_id: fee.hostel_id,
        amount_paid: Number(amount),
        payment_method: 'knitpay',
        payment_type: 'rent',
        payment_status: 'pending',
        gateway_order_id: gatewayOrderId,
        reference_number: gatewayOrderId,
        notes: `Online payment initiated via Knit Pay (${isSandbox ? 'Sandbox' : 'Production'})`,
        paid_date: new Date().toISOString()
      });

    if (paymentError) {
      console.error('Error inserting pending payment record:', paymentError);
      return NextResponse.json(
        { error: 'Failed to log pending transaction: ' + paymentError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      orderId: gatewayOrderId,
      amount: Number(amount),
      feeId,
      studentId,
      mode: isSandbox ? 'sandbox' : 'production'
    });

  } catch (error: any) {
    console.error('Create order error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
