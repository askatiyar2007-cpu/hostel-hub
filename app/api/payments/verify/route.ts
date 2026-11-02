import { NextRequest, NextResponse } from 'next/server';
import { createClient, supabaseServer } from '@/lib/supabase/server';
import { createHmac, timingSafeEqual } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate caller
    const supabase = createClient(req);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    const { order_id, payment_id, signature } = await req.json();

    if (!order_id) {
      return NextResponse.json(
        { error: 'Missing required parameter: order_id' },
        { status: 400 }
      );
    }

    // 2. Retrieve the existing pending payment record
    const { data: payment, error: paymentFetchError } = await supabaseServer
      .from('payments')
      .select('id, student_fees_id, student_id, amount_paid, payment_status, hostel_id')
      .eq('gateway_order_id', order_id)
      .maybeSingle();

    if (paymentFetchError || !payment) {
      console.error('Error fetching payment transaction:', paymentFetchError);
      return NextResponse.json(
        { error: 'Payment transaction record not found' },
        { status: 404 }
      );
    }

    // 3. Authorize caller against payment record
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
      const { data: studentRecord } = await supabaseServer
        .from('students')
        .select('id')
        .eq('profile_id', profile.id)
        .maybeSingle();

      if (!studentRecord || studentRecord.id !== payment.student_id) {
        return NextResponse.json(
          { error: 'Forbidden: You can only verify your own payments' },
          { status: 403 }
        );
      }
    } else if (profile.role === 'owner' || profile.role === 'hostel_owner') {
      const { data: hostel } = await supabaseServer
        .from('hostels')
        .select('id, owner_id')
        .eq('id', payment.hostel_id)
        .single();

      if (!hostel || hostel.owner_id !== user.id) {
        return NextResponse.json(
          { error: 'Forbidden: You do not own the hostel associated with this payment' },
          { status: 403 }
        );
      }
    } else if (profile.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Forbidden: Unauthorized' },
        { status: 403 }
      );
    }

    // If payment is already marked as completed, return success early
    if (payment.payment_status === 'completed' || payment.payment_status === 'verified') {
      return NextResponse.json({
        success: true,
        message: 'Payment was already completed',
        feeId: payment.student_fees_id
      });
    }

    // 4. Validate transaction status, captured amount, and currency
    const isProd = process.env.NODE_ENV === 'production';
    const knitPayMode = process.env.KNITPAY_MODE || (isProd ? 'production' : 'sandbox');
    const isSandbox = !isProd && (knitPayMode === 'sandbox' || knitPayMode === 'test');
    let verified = false;
    let capturedAmount = Number(payment.amount_paid);
    let capturedCurrency = 'INR';

    if (isProd && order_id.startsWith('mock_')) {
      return NextResponse.json(
        { error: 'Mock orders cannot be verified in production environment' },
        { status: 400 }
      );
    }

    if (isSandbox && order_id.startsWith('mock_')) {
      // In Sandbox/Development mode ONLY, accept mock order testing
      verified = true;
      capturedAmount = Number(payment.amount_paid);
      capturedCurrency = 'INR';
    } else {
      // Production mode / Real gateway verification
      const apiSecret = process.env.KNITPAY_API_SECRET;

      // Check A: HMAC signature verification if signature and payment_id are provided
      if (signature && payment_id && apiSecret) {
        try {
          const expectedSig = createHmac('sha256', apiSecret)
            .update(`${order_id}|${payment_id}`)
            .digest('hex');
          const sigBuf = Buffer.from(signature, 'hex');
          const expBuf = Buffer.from(expectedSig, 'hex');
          if (sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf)) {
            verified = true;
          }
        } catch {
          // Signature parsing failed
        }
      }

      // Check B: Query gateway endpoint directly for authoritative status, amount, and currency
      if (process.env.KNITPAY_API_KEY) {
        try {
          const response = await fetch(`https://knit-pay-upi.p.rapidapi.com/order/status/${order_id}`, {
            method: 'GET',
            headers: {
              'X-RapidAPI-Key': process.env.KNITPAY_API_KEY || '',
              'X-RapidAPI-Host': process.env.RAPIDAPI_HOST || 'knit-pay-upi.p.rapidapi.com'
            }
          });

          if (response.ok) {
            const data = await response.json();
            const gatewayStatusOk = data.status === 'SUCCESS' || data.status === 'PAID' || data.paid === true;
            if (gatewayStatusOk) {
              verified = true;
              if (data.amount !== undefined || data.order_amount !== undefined) {
                capturedAmount = Number(data.amount ?? data.order_amount);
              }
              if (data.currency !== undefined || data.order_currency !== undefined) {
                capturedCurrency = String(data.currency ?? data.order_currency).trim().toUpperCase();
              }
            }
          }
        } catch (err) {
          console.error('Failed to verify payment via production gateway API:', err);
        }
      }
    }

    // Validate captured amount and currency strictly
    if (verified) {
      if (isNaN(capturedAmount) || capturedAmount <= 0) {
        return NextResponse.json(
          { error: 'Payment verification failed: invalid or non-positive captured amount' },
          { status: 400 }
        );
      }

      const expectedAmount = Number(payment.amount_paid);
      if (Math.abs(capturedAmount - expectedAmount) > 0.01) {
        return NextResponse.json(
          { error: `Payment verification failed: captured amount (₹${capturedAmount}) does not match order amount (₹${expectedAmount})` },
          { status: 400 }
        );
      }

      if (capturedCurrency !== 'INR') {
        return NextResponse.json(
          { error: `Payment verification failed: unsupported currency (${capturedCurrency}). Only INR is supported.` },
          { status: 400 }
        );
      }
    }

    if (!verified) {
      // Mark transaction as failed via coordinating RPC
      const failNotes = 'Online payment verification failed: invalid signature or unverified gateway status.';
      const { error: failRpcError } = await supabaseServer.rpc('fail_gateway_payment', {
        p_order_id: order_id,
        p_notes: failNotes
      });

      if (failRpcError) {
        await supabaseServer
          .from('payments')
          .update({
            status: 'failed',
            payment_status: 'failed',
            notes: failNotes
          })
          .eq('id', payment.id);
      }

      return NextResponse.json(
        { error: 'Payment verification failed' },
        { status: 400 }
      );
    }

    // 3. Perform atomic updates: payment completed & student fee marked paid via coordinating RPC
    const notes = `Online payment verified successfully via Knit Pay (${isSandbox ? 'Sandbox' : 'Production'})`;
    const gatewayPaymentId = payment_id || `pay_${Math.random().toString(36).substring(2, 10)}`;
    const gatewaySig = signature || 'mock_signature_sandbox';

    const { data: confirmResult, error: confirmRpcError } = await supabaseServer.rpc('confirm_gateway_payment', {
      p_order_id: order_id,
      p_gateway_payment_id: gatewayPaymentId,
      p_amount: capturedAmount,
      p_gateway_signature: gatewaySig,
      p_notes: notes
    });

    if (confirmResult && !confirmResult.success) {
      return NextResponse.json(
        { error: confirmResult.error || 'Payment confirmation failed' },
        { status: 400 }
      );
    }

    if (confirmRpcError) {
      console.warn('confirm_gateway_payment RPC unavailable or failed, falling back to direct updates:', confirmRpcError);
      // Fallback: update BOTH status and payment_status to completed
      const { error: paymentUpdateError } = await supabaseServer
        .from('payments')
        .update({
          status: 'completed',
          payment_status: 'completed',
          gateway_payment_id: gatewayPaymentId,
          gateway_signature: gatewaySig,
          auto_verified: true,
          notes
        })
        .eq('id', payment.id);

      if (paymentUpdateError) {
        throw paymentUpdateError;
      }

      // Update student fee status to paid
      const { error: feeUpdateError } = await supabaseServer
        .from('student_fees')
        .update({
          status: 'paid',
          updated_at: new Date().toISOString()
        })
        .eq('id', payment.student_fees_id);

      if (feeUpdateError) {
        throw feeUpdateError;
      }
    }

    // 4. Retrieve student user_id from profile to send notification
    try {
      const { data: student, error: studentError } = await supabaseServer
        .from('students')
        .select(`
          id,
          profile_id,
          profiles (
            user_id
          )
        `)
        .eq('id', payment.student_id)
        .single();

      if (!studentError && student) {
        const studentProfile = student.profiles as any;
        const studentUserId = Array.isArray(studentProfile) 
          ? studentProfile[0]?.user_id 
          : studentProfile?.user_id;

        if (studentUserId) {
          // Fetch billing period for notification text
          const { data: feeInfo } = await supabaseServer
            .from('student_fees')
            .select('billing_period')
            .eq('id', payment.student_fees_id)
            .single();

          const periodText = feeInfo?.billing_period || 'monthly dues';

          await supabaseServer.from('notifications').insert({
            user_id: studentUserId,
            title: 'Online Payment Successful ✓',
            message: `Your online payment of ₹${payment.amount_paid} for ${periodText} has been verified and processed automatically.`,
            type: 'payment',
            read: false
          });
        }
      }
    } catch (notifErr) {
      console.error('Failed to create student payment notification:', notifErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Payment verified and processed successfully',
      feeId: payment.student_fees_id
    });

  } catch (error: any) {
    console.error('Verify payment error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
