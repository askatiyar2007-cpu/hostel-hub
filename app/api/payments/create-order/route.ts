import { NextRequest, NextResponse } from 'next/server';
import { createClient, supabaseServer } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate the caller
    const supabase = createClient(req);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    const { feeId } = await req.json();

    if (!feeId) {
      return NextResponse.json(
        { error: 'Missing required parameter: feeId' },
        { status: 400 }
      );
    }

    // 2. Fetch the student fee details from database
    const { data: fee, error: feeError } = await supabaseServer
      .from('student_fees')
      .select('id, allocation_id, hostel_id, student_id, amount, status')
      .eq('id', feeId)
      .single();

    if (feeError || !fee) {
      console.error('Error fetching student fee:', feeError);
      return NextResponse.json(
        { error: 'Student fee record not found' },
        { status: 404 }
      );
    }

    if (fee.status === 'paid') {
      return NextResponse.json(
        { error: 'This fee has already been paid' },
        { status: 400 }
      );
    }

    // 3. Authorize caller: Must be the student owing the fee, the hostel owner, or super_admin
    const { data: profile, error: profileError } = await supabaseServer
      .from('profiles')
      .select('id, user_id, role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Forbidden: User profile not found' },
        { status: 403 }
      );
    }

    if (profile.role === 'student') {
      const { data: studentRecord, error: studentLookupError } = await supabaseServer
        .from('students')
        .select('id')
        .eq('profile_id', profile.id)
        .maybeSingle();

      if (studentLookupError || !studentRecord || studentRecord.id !== fee.student_id) {
        return NextResponse.json(
          { error: 'Forbidden: You can only create payment orders for your own fees' },
          { status: 403 }
        );
      }
    } else if (profile.role === 'owner' || profile.role === 'hostel_owner') {
      const { data: hostel, error: hostelError } = await supabaseServer
        .from('hostels')
        .select('id, owner_id')
        .eq('id', fee.hostel_id)
        .single();

      if (hostelError || !hostel || hostel.owner_id !== user.id) {
        return NextResponse.json(
          { error: 'Forbidden: You do not own the hostel for this fee' },
          { status: 403 }
        );
      }
    } else if (profile.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Forbidden: Unauthorized role' },
        { status: 403 }
      );
    }

    // 4. Derive order amount STRICTLY from server-side database fee record
    const serverAmount = Number(fee.amount);
    if (!serverAmount || serverAmount <= 0 || isNaN(serverAmount)) {
      return NextResponse.json(
        { error: 'Invalid fee amount on server record' },
        { status: 400 }
      );
    }

    // 5. Determine mode (Sandbox vs Production)
    const isProd = process.env.NODE_ENV === 'production';
    const knitPayMode = process.env.KNITPAY_MODE || (isProd ? 'production' : 'sandbox');
    const isSandbox = !isProd && (
      knitPayMode === 'sandbox' || 
      process.env.KNITPAY_API_KEY?.startsWith('test_') || 
      process.env.NEXT_PUBLIC_KNITPAY_KEY_ID?.startsWith('test_')
    );

    let gatewayOrderId = '';

    if (isSandbox) {
      // In Sandbox/Demo mode (non-production only), generate a mock order ID
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
            amount: serverAmount,
            merchantId: process.env.KNITPAY_MERCHANT_ID,
            callbackUrl: `${new URL(req.url).origin}/api/payments/webhook`,
            metadata: {
              feeId: fee.id,
              studentId: fee.student_id,
              allocationId: fee.allocation_id,
              hostelId: fee.hostel_id
            }
          })
        });

        if (response.ok) {
          const data = await response.json();
          gatewayOrderId = data.orderId || data.id;
        } else {
          const errBody = await response.text();
          console.error('Knit Pay production API failed:', response.status, errBody);
          return NextResponse.json(
            { error: 'Payment gateway rejected order creation. Please try again later.' },
            { status: 502 }
          );
        }
      } catch (err: any) {
        console.error('Failed to call Knit Pay API:', err);
        return NextResponse.json(
          { error: 'Payment gateway connection failed. Please try again later.' },
          { status: 502 }
        );
      }
    }

    // 6. Create a pending payment log in Supabase database
    const { error: paymentError } = await supabaseServer
      .from('payments')
      .insert({
        student_fees_id: fee.id,
        student_id: fee.student_id,
        allocation_id: fee.allocation_id,
        hostel_id: fee.hostel_id,
        amount_paid: serverAmount,
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
      amount: serverAmount,
      feeId: fee.id,
      studentId: fee.student_id,
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
