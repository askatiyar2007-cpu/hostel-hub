import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { createHmac, timingSafeEqual } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    if (!rawBody || !rawBody.trim()) {
      return NextResponse.json({ error: 'Empty webhook payload' }, { status: 400 });
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
    }

    console.log('Payment webhook received for order inspection');

    // 1. Webhook Signature Verification
    const webhookSecret = process.env.KNITPAY_WEBHOOK_SECRET || process.env.KNITPAY_API_SECRET;
    const isProd = process.env.NODE_ENV === 'production';

    const signature = 
      req.headers.get('x-knitpay-signature') || 
      req.headers.get('x-webhook-signature') || 
      req.headers.get('x-razorpay-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing webhook signature header' },
        { status: 401 }
      );
    }

    if (!webhookSecret) {
      console.error('Webhook secret unconfigured');
      return NextResponse.json(
        { error: isProd ? 'Server configuration error: webhook secret required' : 'Unauthorized: Webhook secret not configured' },
        { status: isProd ? 500 : 401 }
      );
    }

    try {
      const expectedSig = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
      const sigBuf = Buffer.from(signature, 'hex');
      const expBuf = Buffer.from(expectedSig, 'hex');

      if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
        return NextResponse.json({ error: 'Unauthorized: Invalid webhook signature' }, { status: 401 });
      }
    } catch (err) {
      return NextResponse.json({ error: 'Unauthorized: Webhook signature verification error' }, { status: 401 });
    }

    // 2. Identify order details from verified payload
    let orderId = payload.orderId || payload.order_id || payload.gateway_order_id;
    let paymentId = payload.paymentId || payload.payment_id || payload.transaction_id;
    const rawStatus = payload.status || payload.event;

    // Reject if status is missing - never default to SUCCESS
    if (!rawStatus || typeof rawStatus !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid status field in webhook payload' },
        { status: 400 }
      );
    }
    const status = rawStatus.trim().toLowerCase();

    // If nested structures exist (e.g. standard gateway webhook format)
    if (payload.payload?.payment?.entity) {
      const entity = payload.payload.payment.entity;
      orderId = orderId || entity.order_id;
      paymentId = paymentId || entity.id;
    }

    if (!orderId) {
      console.warn('Webhook received without order identifier:', payload);
      return NextResponse.json({ error: 'Order ID not found in payload' }, { status: 400 });
    }

    // 2. Fetch the corresponding payment record
    const { data: payment, error: paymentFetchError } = await supabaseServer
      .from('payments')
      .select('id, student_fees_id, student_id, amount_paid, payment_status')
      .eq('gateway_order_id', orderId)
      .maybeSingle();

    if (paymentFetchError || !payment) {
      console.error('Error matching webhook to payment record:', paymentFetchError);
      return NextResponse.json({ error: 'Transaction record not found' }, { status: 404 });
    }

    // If payment is already completed, just acknowledge the webhook
    if (payment.payment_status === 'completed' || payment.payment_status === 'verified') {
      return NextResponse.json({ received: true, already_processed: true });
    }

    // 3. Update payment status based on webhook status
    const isSuccess = ['success', 'paid', 'payment.captured', 'captured', 'completed'].includes(status);
    const isFailure = ['failed', 'payment.failed', 'cancelled', 'rejected'].includes(status);

    if (!isSuccess && !isFailure) {
      return NextResponse.json({ error: `Unsupported or untrusted payment status: ${rawStatus}` }, { status: 400 });
    }

    if (isSuccess) {
      // Mark payment as completed
      await supabaseServer
        .from('payments')
        .update({
          payment_status: 'completed',
          gateway_payment_id: paymentId || `pay_wh_${Math.random().toString(36).substring(2, 10)}`,
          auto_verified: true,
          notes: 'Online payment captured and verified via webhook callback.'
        })
        .eq('id', payment.id);

      // Mark student fee as paid
      await supabaseServer
        .from('student_fees')
        .update({
          status: 'paid',
          updated_at: new Date().toISOString()
        })
        .eq('id', payment.student_fees_id);

      // Dispatch student notification
      try {
        const { data: student } = await supabaseServer
          .from('students')
          .select('id, profile_id, profiles(user_id)')
          .eq('id', payment.student_id)
          .single();

        if (student) {
          const studentProfile = student.profiles as any;
          const studentUserId = Array.isArray(studentProfile) 
            ? studentProfile[0]?.user_id 
            : studentProfile?.user_id;

          if (studentUserId) {
            const { data: feeInfo } = await supabaseServer
              .from('student_fees')
              .select('billing_period')
              .eq('id', payment.student_fees_id)
              .single();

            const periodText = feeInfo?.billing_period || 'rent dues';

            await supabaseServer.from('notifications').insert({
              user_id: studentUserId,
              title: 'Payment Received ✓',
              message: `Your online payment of ₹${payment.amount_paid} for ${periodText} has been verified automatically.`,
              type: 'payment',
              read: false
            });
          }
        }
      } catch (notifErr) {
        console.error('Failed to issue webhook success notification:', notifErr);
      }

    } else if (isFailure) {
      // Mark payment as failed
      await supabaseServer
        .from('payments')
        .update({
          payment_status: 'failed',
          notes: `Online payment failed via webhook callback (Status: ${status}).`
        })
        .eq('id', payment.id);
    }

    return NextResponse.json({ received: true, status_updated: true });

  } catch (error: any) {
    console.error('Webhook endpoint error:', error);
    return NextResponse.json({ error: error.message || 'Internal webhook error' }, { status: 500 });
  }
}
