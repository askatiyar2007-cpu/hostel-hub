import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    console.log('Payment webhook received:', JSON.stringify(payload));

    // 1. Identify order details from various potential payload formats
    let orderId = payload.orderId || payload.order_id || payload.gateway_order_id;
    let paymentId = payload.paymentId || payload.payment_id || payload.transaction_id;
    let status = payload.status || payload.event || 'SUCCESS'; // Default to success if undefined in simple webhook mocks

    // If nested structures exist (e.g. Razorpay webhook format)
    if (payload.payload?.payment?.entity) {
      const entity = payload.payload.payment.entity;
      orderId = orderId || entity.order_id;
      paymentId = paymentId || entity.id;
      status = status || entity.status;
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
    const isSuccess = ['SUCCESS', 'PAID', 'payment.captured', 'captured', 'completed'].includes(status.toLowerCase());
    const isFailure = ['FAILED', 'payment.failed', 'failed', 'cancelled', 'rejected'].includes(status.toLowerCase());

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
