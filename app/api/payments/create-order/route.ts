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

    // 4. Derive authoritative remaining balance from server database
    const invoiceTotal = Number((fee as any).amount_due || fee.amount);
    if (!invoiceTotal || invoiceTotal <= 0 || isNaN(invoiceTotal)) {
      return NextResponse.json(
        { error: 'Invalid fee amount on server record' },
        { status: 400 }
      );
    }

    // Query genuine collected payments to calculate remaining balance
    const { data: existingPayments, error: paymentsError } = await supabaseServer
      .from('payments')
      .select('amount, amount_paid, status, payment_status, auto_verified, gateway_payment_id')
      .or(`student_fees_id.eq.${fee.id},fee_id.eq.${fee.id}`);

    if (paymentsError) {
      console.error('Error fetching existing fee payments:', paymentsError);
      return NextResponse.json(
        { error: 'Failed to calculate fee balance' },
        { status: 500 }
      );
    }

    let alreadyPaid = 0;
    if (existingPayments && existingPayments.length > 0) {
      for (const p of existingPayments) {
        const isPathA =
          ['completed', 'verified'].includes(p.status) &&
          (!p.payment_status || ['completed', 'verified'].includes(p.payment_status)) &&
          !['pending', 'manual_pending', 'failed', 'rejected'].includes(p.status) &&
          (!p.payment_status || !['pending', 'pending_verification', 'manual_pending', 'failed', 'rejected', 'partial'].includes(p.payment_status));

        const isPathB =
          ['completed', 'verified'].includes(p.payment_status) &&
          (p.auto_verified === true || Boolean(p.gateway_payment_id)) &&
          (!p.status || !['failed', 'rejected'].includes(p.status)) &&
          !['failed', 'rejected', 'partial'].includes(p.payment_status);

        const isPartial =
          p.payment_status === 'partial' &&
          !['failed', 'rejected'].includes(p.status);

        const isOverpaid =
          ['completed', 'verified'].includes(p.status) &&
          p.payment_status === 'overpaid';

        if (isPathA || isPathB || isPartial || isOverpaid) {
          const val = Number(p.amount_paid || p.amount || 0);
          if (val > 0) {
            alreadyPaid += val;
          }
        }
      }
    }

    const remainingBalance = invoiceTotal - alreadyPaid;
    if (remainingBalance <= 0) {
      return NextResponse.json(
        { error: 'This fee has already been fully paid or covered by existing payments' },
        { status: 400 }
      );
    }

    // Server-derived order amount is strictly the remaining balance
    const serverAmount = remainingBalance;

    // 5. Determine mode (Sandbox vs Production)
    const isProd = process.env.NODE_ENV === 'production';
    const knitPayMode = process.env.KNITPAY_MODE || (isProd ? 'production' : 'sandbox');
    const isSandbox = !isProd && (
      knitPayMode === 'sandbox' || 
      process.env.KNITPAY_API_KEY?.startsWith('test_') || 
      process.env.NEXT_PUBLIC_KNITPAY_KEY_ID?.startsWith('test_')
    );

    // Generate unique order tracking reservation identifier
    const trackingOrderId = (isSandbox ? 'mock_' : 'order_') + Math.random().toString(36).substring(2, 11) + '_' + Date.now();

    // 6. Atomically reserve order in database FIRST
    const reservationNotes = `Online payment reservation initiated via Knit Pay (${isSandbox ? 'Sandbox' : 'Production'})`;
    const { data: orderRpcResult, error: rpcError } = await supabaseServer.rpc('create_gateway_payment_order', {
      p_fee_id: fee.id,
      p_gateway_order_id: trackingOrderId,
      p_amount: serverAmount,
      p_notes: reservationNotes
    });

    if (rpcError || !orderRpcResult || !orderRpcResult.success) {
      console.error('Failed to reserve gateway payment order in database:', rpcError || orderRpcResult?.error);
      // NO DIRECT INSERT FALLBACK: Abort immediately if database reservation fails
      return NextResponse.json(
        { error: orderRpcResult?.error || rpcError?.message || 'Failed to initialize payment order' },
        { status: 400 }
      );
    }

    const reservationPaymentId = orderRpcResult.payment_id;
    let gatewayOrderId = trackingOrderId;

    // 7. Request external Knit Pay order SECOND (only after database reservation succeeded)
    if (!isSandbox) {
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
              hostelId: fee.hostel_id,
              paymentId: reservationPaymentId,
              trackingOrderId: trackingOrderId
            }
          }),
          signal: AbortSignal.timeout(15000)
        });

        const definitiveRejectionStatusCodes = [400, 401, 403, 422];
        const isDefinitiveRejection = definitiveRejectionStatusCodes.includes(response.status);

        if (response.ok) {
          const data = await response.json();
          const returnedOrderId = data.orderId || data.id;
          if (returnedOrderId && returnedOrderId !== trackingOrderId) {
            gatewayOrderId = returnedOrderId;
            // Gateway Order ID Persistence verification:
            // Check database update error and ensure exactly 1 row was updated.
            const { data: updateData, error: updateError } = await supabaseServer
              .from('payments')
              .update({
                gateway_order_id: gatewayOrderId,
                reference_number: gatewayOrderId,
                notes: `Online payment initiated via Knit Pay (Production) [Gateway: ${gatewayOrderId}]`
              })
              .eq('id', reservationPaymentId)
              .select('id');

            if (updateError || !updateData || updateData.length !== 1) {
              console.error('Critical: Failed to persist gateway order ID to database:', {
                updateError,
                updateData,
                reservationPaymentId,
                trackingOrderId,
                gatewayOrderId
              });

              // DO NOT blindly release the live external order on Knit Pay.
              // Retain reservation with critical flag for support reconciliation.
              // Recovery mechanism:
              // 1. Knit Pay received metadata.paymentId = reservationPaymentId and metadata.trackingOrderId = trackingOrderId.
              // 2. Incoming webhooks or verification calls from Knit Pay can match either by metadata.paymentId or trackingOrderId.
              // 3. Storing both IDs in the audit note ensures administrative/support traceability.
              const { error: critNoteError } = await supabaseServer
                .from('payments')
                .update({
                  notes: `[CRITICAL PERSISTENCE FAILURE: External order ${gatewayOrderId} created on Knit Pay, but failed to persist order ID to payment row ${reservationPaymentId}. Local tracking ID is ${trackingOrderId}. Do not release blindly.]`
                })
                .eq('id', reservationPaymentId);

              if (critNoteError) {
                console.error('Failed to persist critical persistence audit note to database:', critNoteError);
              }

              // Never return a usable order ID to the client if persistence failed
              return NextResponse.json(
                {
                  error: 'Failed to record payment order. Please contact support before attempting payment.',
                  trackingId: trackingOrderId
                },
                { status: 500 }
              );
            }
          }
        } else if (isDefinitiveRejection) {
          // Provider-documented definitive rejection (HTTP 400, 401, 403, 422):
          // The gateway definitively rejected order creation before an order was created.
          // No external order exists. Safely release reservation via fail_gateway_payment.
          const errBody = await response.text();
          console.error('Knit Pay definitive provider rejection:', response.status, errBody);
          await supabaseServer.rpc('fail_gateway_payment', {
            p_order_id: trackingOrderId,
            p_notes: `Gateway definitively rejected order creation: HTTP ${response.status}. Released reservation.`
          });
          return NextResponse.json(
            { error: 'Payment gateway rejected order creation. Please try again later.' },
            { status: response.status === 400 ? 400 : 502 }
          );
        } else {
          // Uncertain / ambiguous outcome (HTTP 408, 409, 429, 5xx):
          // We cannot confirm whether an order was created (e.g. 409 Conflict implies order exists, 408 is a timeout, 429 is rate limit).
          // DO NOT release reservation. Retain ambiguous reservation in non-reusable state for reconciliation.
          const errBody = await response.text();
          console.error('Knit Pay ambiguous gateway response:', response.status, errBody);

          const { error: noteUpdateError } = await supabaseServer
            .from('payments')
            .update({
              notes: `[AMBIGUOUS GATEWAY OUTCOME: Knit Pay returned HTTP ${response.status}; reservation retained for reconciliation]`
            })
            .eq('id', reservationPaymentId);

          if (noteUpdateError) {
            console.error('Failed to persist ambiguous outcome audit note to database:', noteUpdateError);
            // DO NOT release reservation. Continue to retain reservation in pending state.
          }

          return NextResponse.json(
            { error: 'Payment gateway returned an uncertain response. A pending reservation has been retained for reconciliation. Please check status before retrying.' },
            { status: response.status === 408 ? 504 : 502 }
          );
        }
      } catch (err: any) {
        // Ambiguous failure: Network timeout, socket hangup, or connection error.
        // The external gateway may have created the order before the connection dropped.
        // DO NOT mark reservation failed. Retain in pending state to block duplicate orders and allow reconciliation.
        console.error('Ambiguous network failure while contacting Knit Pay:', err);

        const { error: noteUpdateError } = await supabaseServer
          .from('payments')
          .update({
            notes: `[AMBIGUOUS GATEWAY OUTCOME: Network timeout / connection error (${err?.message || 'unknown'}); reservation retained for reconciliation]`
          })
          .eq('id', reservationPaymentId);

        if (noteUpdateError) {
          console.error('Failed to persist network timeout ambiguous audit note to database:', noteUpdateError);
          // DO NOT release reservation. Continue to retain reservation in pending state.
        }

        return NextResponse.json(
          { error: 'Payment gateway request timed out. A pending reservation has been retained for reconciliation. Please check payment status before retrying.' },
          { status: 504 }
        );
      }
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
